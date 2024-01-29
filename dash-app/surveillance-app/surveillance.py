import cv2
import zmq
import queue
import threading
import os
import sqlite3
import asyncio

# import pybgs as bgs
from math import floor
from time import sleep
from datetime import datetime
from ffprobe import FFProbe
from ultralytics import YOLO
from ultralytics.utils.plotting import Annotator

print(cv2.getBuildInformation())

QUIET_SECONDS = 1
MAX_VID_LENGTH = 20

INSERT_ALERT = """
INSERT INTO alert (filepath, detection_time, detection_objects, detection_feed, detection_status) VALUES(?, ?, ?, ?, ?)
"""
GET_LIVE_FEEDS = """
SELECT * from live_feed
"""

# Video capture buffer:
# When movement is detected, start running YOLO every n-th frame, play with different n values
# While YOLO is detecting person, start writing to a buffer that will hold the past 20 seconds
# If YOLO stops detecting person, wait for 5 seconds and then stop writing to the buffer and save the buffer to a file
# If YOLO continues detecting person for 20 seconds, also stop writing to the buffer and save the buffer to a file,
# but start a new buffer and continue running YOLO
# Continue this process until there is no more movement and YOLO detects no more people

model = YOLO("yolov8n.pt")

# create the background subtractor object
backSub = cv2.createBackgroundSubtractorMOG2(
    history=100, varThreshold=50, detectShadows=True
)

detection_timestamp = 0

worker_queue = queue.Queue()

DISABLE_DETECTIONS = True


def connect_to_db():
    dir = os.path.dirname(os.path.realpath(__file__))
    print(dir)
    conn = sqlite3.connect(dir + "/../camdb.db")
    return conn


def worker_thread(task_queue):
    conn = connect_to_db()
    print("Worker thread started")
    while True:
        try:
            task = task_queue.get()
            if task is None:
                conn.close()
                break
            filename, fps, detection_objects, buffer = task
            print("got task", filename, fps, detection_objects)
            # save_video_clip(buffer, filename, fps)
            cursor = conn.cursor()
            print("created cursor")
            print("got filename")
            detection_timestamp = int(floor(datetime.utcnow().timestamp()))
            detection_feed = 1
            print("got timestamp")
            print(
                "Saving alert",
                filename,
                detection_timestamp,
                detection_objects,
                detection_feed,
            )
            cursor.execute(
                INSERT_ALERT,
                (
                    filename,
                    datetime.utcnow().timestamp(),
                    detection_objects,
                    detection_feed,
                    0,
                ),
            )
            conn.commit()
            task_queue.task_done()
            save_video_clip(buffer, f"./output/{filename}", fps)
            print("Saved alert, closing connections")
        except queue.Empty:
            print("Queue empty, sleeping 1s")
            sleep(1)
            continue


def save_video_clip(buffer, filename, fps):
    print("Saving video clip")
    sample_frame = buffer.get()
    height, width, layers = sample_frame.shape
    fourcc = cv2.VideoWriter_fourcc(*"VP80")
    # Write the buffer to a file
    out = cv2.VideoWriter(
        filename,
        fourcc,
        fps,
        (width, height),
    )
    print("got out")
    out.write(sample_frame)
    print("wrote sample frame, rest is size ", buffer.qsize())
    while not buffer.empty():
        print("writing frame", buffer.qsize())
        out.write(buffer.get())
    out.release()
    print("released out")


def detect_person(frame):
    results = model(frame, verbose=False)
    # annotator = Annotator(frame)

    detected = False
    classes_detected = []

    for r in results:
        for box in r.boxes:
            b = box.xyxy[0]
            c = box.cls
            class_name = r.names[int(c)]
            classes_detected.append(class_name)
            if class_name == "person":
                # annotator.box_label(b, f"{r.names[int(c)]} {float(box.conf):.2}")
                detected = detected or box.conf > 0.5
    return detected, classes_detected


def should_stop_recording(frame_count, fps, person_detected_at, first_detection):
    if (first_detection == -1) or (person_detected_at == -1):
        return False

    # Calculate if the last detection of person in frame was more than 5 seconds
    quiet_frames_elapsed = frame_count - person_detected_at
    quiet_seconds_elapsed = quiet_frames_elapsed / fps
    has_been_quiet = quiet_frames_elapsed > 0 and quiet_seconds_elapsed >= QUIET_SECONDS

    frames_elapsed_since_first = frame_count - first_detection
    seconds_elapsed_since_first = frames_elapsed_since_first / fps
    has_recorded_full_buffer = (
        frames_elapsed_since_first > 0 and seconds_elapsed_since_first >= MAX_VID_LENGTH
    )

    return has_been_quiet or has_recorded_full_buffer


def run_live_feed(fps, width, height, stream_buffer, index):
    # OpenCV VideoWriter with the GStreamer pipeline
    gst_simple = (
        "appsrc ! "
        "videoconvert ! "
        "vp8enc ! "
        "webmmux streamable=true ! "
        f"tcpserversink host=localhost port={5000 + index} recover-policy=keyframe sync-method=latest-keyframe"
    )
    print(gst_simple, index)
    out = cv2.VideoWriter(gst_simple, cv2.CAP_GSTREAMER, fps, (width, height), True)
    while True:
        try:
            frame = stream_buffer.get()
            if frame is None:
                out.release()
                break
            out.write(frame)
        except queue.Empty:
            print("Stream queue empty, sleeping 1s")
            sleep(1)
            continue


def capture(feed):
    if feed["url"]:
        print("Using url", feed["url"])
        # If feed is a network camera with a url, use that
        return cv2.VideoCapture(feed["url"])
    elif feed["cameraIndex"] is not None:
        print("Using cameraIndex", feed["cameraIndex"])
        # If feed is a local camera, use the camera index
        return cv2.VideoCapture(feed["cameraIndex"])


def get_foreground_mask(frame):
    fgMask = backSub.apply(frame)
    return fgMask


# Performs denoising and background subtraction on a frame, returns the contours
# of the foreground objects
def find_frame_movement(frame):
    # apply Gaussian Blur to reduce noise
    frame = cv2.GaussianBlur(frame, (5, 5), 0)

    # apply the background subtraction
    fgMask = get_foreground_mask(frame)

    # apply a morphological operation to remove noise
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fgMask = cv2.morphologyEx(fgMask, cv2.MORPH_OPEN, kernel)

    # find contours of the foreground objects
    contours, hierarchy = cv2.findContours(
        fgMask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
    )

    # loop over the contours
    for i, contour in enumerate(contours):
        # get the bounding box of the contour
        (x, y, w, h) = cv2.boundingRect(contour)

        # filter out small contours
        if cv2.contourArea(contour) > 1000:
            # draw the bounding box on the frame
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 2)

    return frame, contours


def process_video(feed, index):
    print("_____FEED_____", feed)
    video_count = 0
    cap = capture(feed)
    frame_count = 0
    fps = 20
    frame_buffer = queue.Queue(maxsize=fps * MAX_VID_LENGTH)
    stream_buffer = queue.Queue(maxsize=fps * MAX_VID_LENGTH)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    new_width = 960
    ratio = new_width / width
    new_height = int(height * ratio)

    first_detection = -1
    person_detected_at = -1
    objects_detected = []

    # Start a new thread to stream the video
    # if index == 0:
    stream_thread = threading.Thread(
        target=run_live_feed,
        args=(fps, new_width, new_height, stream_buffer, index),
    )
    stream_thread.start()

    while True:
        frame_count += 1
        frame_count = frame_count % 1000000
        # read a frame from the video
        ret, frame = cap.read()

        if not ret:
            break

        frame, contours = find_frame_movement(
            cv2.resize(frame, (new_width, new_height))
        )

        # only run YOLO when contours are detected and detections are enabled
        if not DISABLE_DETECTIONS and (contours or first_detection != -1):
            detected, classes_detected = detect_person(frame)
            if detected:
                objects_detected = list(set(objects_detected + classes_detected))
                person_detected_at = frame_count
                if first_detection == -1:
                    first_detection = frame_count

        if frame_buffer.full():
            frame_buffer.get()
        if stream_buffer.full():
            stream_buffer.get()

        if should_stop_recording(frame_count, fps, person_detected_at, first_detection):
            video_count += 1
            person_detected_at = -1
            first_detection = -1
            frame_buffer_copy = queue.Queue()
            while not frame_buffer.empty():
                item = frame_buffer.get()
                frame_buffer_copy.put(item)

            filename = datetime.utcnow().strftime("%Y-%m-%d-%H:%M:%S")
            worker_queue.put(
                (f"{filename}.webm", fps, ",".join(objects_detected), frame_buffer_copy)
            )
        else:
            # add frame to buffer
            frame_buffer.put(frame)

        # display the frame
        # cv2.imshow("frame", frame)
        stream_buffer.put(frame)
        # out.write(frame)

        # check for quit signal
        if cv2.pollKey() == ord("q"):
            break

    stream_buffer.put(None)
    # release resources
    cap.release()
    # out.release()
    cv2.destroyAllWindows()
    cv2.waitKey(1)
    stream_thread.join()


vid_list = [
    "./samples/worker-zone-detection.mp4",
    "./samples/people-detection.mp4",
    "./samples/store-aisle-detection.mp4",
    "./samples/one-by-one-person-detection.mp4",
    "./samples/person-bicycle-car-detection.mp4",
    "./samples/Traffic_Laramie_1.mp4",
    "./samples/Traffic_Laramie_2.mp4",
]

# home_cam = "rtsp://admin:janneman@192.168.178.136:8554/Streaming/Channels/101"

# context = zmq.Context()
# socket = context.socket(zmq.REP)
# socket.bind("tcp://*:5555")
#
# while True:
#     message = socket.recv()
#     print("Received request: %s" % message)
#     socket.send_string("World")
#     sleep(1)

# process_video(vid_list[2])


def restart():
    worker_queue.put(None)
    # Get the current thread (main thread in this case)
    current_thread = threading.current_thread()

    # Enumerate all alive threads except the current thread
    for thread in threading.enumerate():
        if thread is not current_thread:
            thread.join()
    main()


def main():
    worker_ref = threading.Thread(target=worker_thread, args=(worker_queue,))
    worker_ref.start()

    conn = connect_to_db()
    cursor = conn.cursor()
    cursor.execute(GET_LIVE_FEEDS)
    feeds = cursor.fetchall()
    conn.close()

    names = list(map(lambda x: x[0], cursor.description))
    print("Got feeds", names, feeds)
    feed_threads = []
    for i, feed_data in enumerate(feeds):
        feed = {name: feed_data[index] for index, name in enumerate(names)}
        print("Processing feed", feed)
        # process_video(feed)
        feed_thread = threading.Thread(
            target=process_video,
            args=(
                feed,
                i,
            ),
        )
        feed_thread.start()
        feed_threads.append(feed_thread)
    print("Finished feed loop")
    for feed_thread in feed_threads:
        feed_thread.join()


def calculate_iou(box1, box2):
    """
    Calculate the Intersection over Union (IoU) of two bounding boxes.
    """
    # Determine the coordinates of the intersection rectangle
    x_left = max(box1[0], box2[0])
    y_top = max(box1[1], box2[1])
    x_right = min(box1[0] + box1[2], box2[0] + box2[2])
    y_bottom = min(box1[1] + box1[3], box2[1] + box2[3])

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    # Calculate area of intersection rectangle
    intersection_area = (x_right - x_left) * (y_bottom - y_top)

    # Calculate the area of both bounding boxes
    box1_area = box1[2] * box1[3]
    box2_area = box2[2] * box2[3]

    # Calculate union area
    union_area = box1_area + box2_area - intersection_area

    # Compute IoU
    iou = intersection_area / union_area
    return iou


def measure_accuracy(gt_contours, detected_contours):
    # Convert contours to bounding boxes
    detected_boxes = [cv2.boundingRect(contour) for contour in detected_contours]

    ground_truth_boxes = [cv2.boundingRect(contour) for contour in gt_contours]

    # Calculate IoU and store the results
    results = []
    for gt_box in ground_truth_boxes:
        for det_box in detected_boxes:
            iou = calculate_iou(det_box, gt_box)
            if iou > 0.5:
                results.append(
                    {"Detected Box": det_box, "Ground Truth Box": gt_box, "IoU": iou}
                )

    # Calculate accuracy
    correct_detections = sum(1 for result in results)
    total_detections = len(ground_truth_boxes)
    accuracy = (
        correct_detections / total_detections
        if total_detections > correct_detections
        else correct_detections
    )

    return results, accuracy


def find_movement_bsuv():
    model = torch.load("Fast-BSUV-Net-2.0.mdl")
    model.eval()
    return model


# bg_model = bgs.ViBe()


def evaluation():
    path = "./dataset2014/dataset/baseline/pedestrians"
    while True:
        aggregated_results = []
        total_accuracy = 0
        # for index in range(1, 1099):
        for i in range(400, 900):
            index = str(i).zfill(6)
            gt_path = f"{path}/groundtruth/gt{index}.png"
            ground_truth = cv2.imread(gt_path)
            input = cv2.imread(f"{path}/input/in{index}.jpg")

            # cv2.imshow("gt", ground_truth)

            gray = cv2.cvtColor(ground_truth, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 169, 255, cv2.THRESH_BINARY)

            gt_contours, _ = cv2.findContours(
                thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            for contour in gt_contours:
                x, y, w, h = cv2.boundingRect(contour)
                cv2.rectangle(input, (x, y), (x + w, y + h), (0, 255, 0), 2)

            # bgsub_frame, bgsub_contours = find_frame_movement(input)
            bgs_out = bg_model.apply(input)
            bgs_contours, _ = cv2.findContours(
                bgs_out, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            # bgs_bgmodel = bg_model.getBackgroundModel()

            # acc_results, accuracy = measure_accuracy(gt_contours, bgsub_contours)
            # aggregated_results += acc_results
            # total_accuracy += accuracy

            cv2.imshow("Ground truth contours", input)
            cv2.imshow("bgs", bgs_out)
            # cv2.imshow("bgs_model", bgs_bgmodel)
            cv2.waitKey(1)

            if cv2.pollKey() == ord("q"):
                cv2.destroyAllWindows()
                return
        # average_accuracy = total_accuracy / len(aggregated_results)
        # print(f"\nAverage Accuracy: {average_accuracy:.2f}")
        # print(aggregated_results)
        return


# evaluation()
main()
