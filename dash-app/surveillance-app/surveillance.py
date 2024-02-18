import cv2
import zmq
import queue
import threading
import os
import sqlite3
import asyncio

import pybgs as bgs
from math import floor
from time import sleep
from datetime import datetime
from ffprobe import FFProbe
from ultralytics import YOLO
from ultralytics.utils.plotting import Annotator

restart_event = threading.Event()

detecting_events = {}

context = zmq.Context()
socket = context.socket(zmq.REP)
socket.bind("tcp://*:5555")

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

dir = os.path.dirname(os.path.realpath(__file__))

worker_queue = queue.Queue()

DISABLE_DETECTIONS = False


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
            save_video_clip(buffer, f"{dir}/output/{filename}", fps)
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


def run_live_feed(fps, width, height, stream_buffer, feed_id):
    # OpenCV VideoWriter with the GStreamer pipeline
    gst_simple = (
        "appsrc ! "
        "videoconvert ! "
        "vp8enc ! "
        "webmmux streamable=true ! "
        f"tcpserversink host=localhost port={5000 + feed_id} recover-policy=keyframe sync-method=latest-keyframe"
    )
    out = cv2.VideoWriter(gst_simple, cv2.CAP_GSTREAMER, fps, (width, height), True)
    while True:
        try:
            frame = stream_buffer.get()
            if frame is None or restart_event.is_set():
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


def process_video(feed, started_threads):
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

    detecting_events[feed["id"]] = threading.Event()

    if feed["is_detecting"]:
        detecting_events[feed["id"]].set()

    # Start a new thread to stream the video
    # if index == 0:
    stream_thread = threading.Thread(
        target=run_live_feed,
        args=(fps, new_width, new_height, stream_buffer, feed["id"]),
    )
    stream_thread.start()

    while True:
        frame_count += 1
        frame_count = frame_count % 1000000
        # read a frame from the video
        ret, frame = cap.read()

        if not ret or restart_event.is_set() or cv2.pollKey() == ord("q"):
            break

        frame, contours = find_frame_movement(
            cv2.resize(frame, (new_width, new_height))
        )

        # only run YOLO when contours are detected and detections are enabled
        if (
            not DISABLE_DETECTIONS
            and detecting_events[feed["id"]].is_set()
            and (contours or first_detection != -1)
        ):
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
            print("stop recording")
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

        if frame_count == 100:
            started_threads.put(feed["id"])

        stream_buffer.put(frame)

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
    restart_event.set()
    # Get the current thread (main thread in this case)
    current_thread = threading.current_thread()

    # Enumerate all alive threads except the current thread
    for thread in threading.enumerate():
        if thread is not current_thread:
            thread.join()
    main()


def read_live_feeds():
    conn = connect_to_db()
    cursor = conn.cursor()
    cursor.execute(GET_LIVE_FEEDS)
    names = list(map(lambda x: x[0], cursor.description))
    db_feeds = cursor.fetchall()
    conn.close()
    feeds = []

    for feed in db_feeds:
        feeds.append({name: feed[index] for index, name in enumerate(names)})

    return feeds


def main():
    restart_event.clear()

    started_threads = queue.Queue()

    feeds = read_live_feeds()

    print("Got feeds", feeds)
    # feed_threads = []
    for feed in feeds:
        print("Processing feed", feed)
        # process_video(feed)
        feed_thread = threading.Thread(
            target=process_video,
            args=(feed, started_threads),
        )
        feed_thread.start()
        # feed_threads.append(feed_thread)
    print("Finished feed loop")
    while started_threads.qsize() < len(feeds):
        print("Waiting for threads to start")
        sleep(1)

    socket.send_string("started")


# Source: https://stackoverflow.com/questions/57577445/list-available-cameras-opencv-python
def list_ports():
    """
    Test the ports and returns a tuple with the available ports and the ones that are working.
    """
    non_working_ports = []
    dev_port = 0
    working_ports = []
    available_ports = []
    while (
        len(non_working_ports) < 6
    ):  # if there are more than 5 non working ports stop the testing.
        camera = cv2.VideoCapture(dev_port)
        if not camera.isOpened():
            non_working_ports.append(dev_port)
            print("Port %s is not working." % dev_port)
        else:
            is_reading, img = camera.read()
            w = camera.get(3)
            h = camera.get(4)
            if is_reading:
                print(
                    "Port %s is working and reads images (%s x %s)" % (dev_port, h, w)
                )
                working_ports.append(dev_port)
            else:
                print(
                    "Port %s for camera ( %s x %s) is present but does not reads."
                    % (dev_port, h, w)
                )
                available_ports.append(dev_port)
        dev_port += 1
    return available_ports, working_ports, non_working_ports


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


def get_frame_accuracy(gt_contours, detected_contours):
    # Convert contours to bounding boxes
    detected_boxes = [cv2.boundingRect(contour) for contour in detected_contours]

    ground_truth_boxes = [cv2.boundingRect(contour) for contour in gt_contours]

    if len(ground_truth_boxes) < 1:
        return -1

    # Calculate IoU and store the results
    total_iou = 0
    for gt_box in ground_truth_boxes:
        highest_iou = 0
        for det_box in detected_boxes:
            highest_iou = max(highest_iou, calculate_iou(det_box, gt_box))
        total_iou += highest_iou

    # Calculate accuracy
    accuracy = total_iou / len(ground_truth_boxes)

    return accuracy


def show_frames(input, gt, bgs):
    cv2.imshow("Input frames", input)
    cv2.imshow("Ground truth with contours", gt)
    cv2.imshow("Foreground contours", bgs)
    cv2.waitKey(1)


def evaluate_bgs_model(model, frame_count, path, eval_name):
    # print(f"Starting evaluation of model {model['name']} on {eval_name} dataset")
    results = []
    total_accuracy = 0
    bg_model = model["model"]()
    for index in range(1, frame_count):
        index = str(index).zfill(6)
        gt_path = f"{path}/groundtruth/gt{index}.png"
        ground_truth = cv2.imread(gt_path)
        input = cv2.imread(f"{path}/input/in{index}.jpg")

        gray = cv2.cvtColor(ground_truth, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 169, 255, cv2.THRESH_BINARY)

        gt_contours, _ = cv2.findContours(
            thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        for contour in gt_contours:
            x, y, w, h = cv2.boundingRect(contour)
            cv2.rectangle(thresh, (x, y), (x + w, y + h), (255, 255, 255), 2)

        # Use if we want to use the same function for both methods
        # bgsub_frame, bgsub_contours = find_frame_movement(input)
        bgs_out = bg_model.apply(input)
        bgs_contours, _ = cv2.findContours(
            bgs_out, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        for contour in bgs_contours:
            x, y, w, h = cv2.boundingRect(contour)
            cv2.rectangle(bgs_out, (x, y), (x + w, y + h), (255, 255, 255), 2)

        # show_frames(input, thresh, bgs_out)

        accuracy = get_frame_accuracy(gt_contours, bgs_contours)
        if accuracy != -1:
            results.append(accuracy)

    total_accuracy = sum(results)
    average_accuracy = total_accuracy / len(results)
    # print(f"Evaluated {model['name']} with accuracy: {average_accuracy}")
    return average_accuracy


def evaluation():
    path = "./dataset2014/dataset/baseline/pedestrians"

    eval_models = [
        {
            "name": "MOG2",
            "model": lambda: backSub,
        },
        {
            "name": "ViBe",
            "model": bgs.ViBe,
        },
        {"name": "KNN", "model": bgs.KNN},
        # {"name": "SuBSENSE", "model": bgs.SuBSENSE()},
        # {"name": "LOBSTER", "model": bgs.LOBSTER()},
        {"name": "Sigma Delta", "model": bgs.SigmaDelta},
        {"name": "Two Points", "model": bgs.TwoPoints},
    ]

    eval = [
        {
            "name": "pedestrians",
            "path": "./dataset2014/dataset/baseline/pedestrians",
            "frame_count": 1099,
        },
        {
            "name": "office",
            "path": "./dataset2014/dataset/baseline/office",
            "frame_count": 2050,
        },
        {
            "name": "highway",
            "path": "./dataset2014/dataset/baseline/highway",
            "frame_count": 1700,
        },
        {
            "name": "sofa",
            "path": "./dataset2014/dataset/intermittentObjectMotion/sofa",
            "frame_count": 2750,
        },
        {
            "name": "winter driveway",
            "path": "./dataset2014/dataset/intermittentObjectMotion/winterDriveway",
            "frame_count": 2500,
        },
        {
            "name": "tramstop",
            "path": "./dataset2014/dataset/intermittentObjectMotion/tramstop",
            "frame_count": 3200,
        },
        {
            "name": "night boulevard",
            "path": "./dataset2014/dataset/nightVideos/busyBoulvard",
            "frame_count": 2760,
        },
    ]

    for model in eval_models:
        model_results = {
            "name": model["name"],
        }
        total_accuracy = 0
        for item in eval:
            accuracy = evaluate_bgs_model(
                model, item["frame_count"], item["path"], item["name"]
            )
            total_accuracy += accuracy
            model_results[item["name"]] = accuracy
        model_results["average_accuracy"] = total_accuracy / len(eval)
        print(f"Model results {model_results}")


# worker_ref = threading.Thread(target=worker_thread, args=(worker_queue,))
# worker_ref.start()

evaluation()
# main()


def start_added_feed(feed_id):
    feeds = read_live_feeds()
    for feed in feeds:
        if feed_id == feed["id"]:
            feed_thread = threading.Thread(
                target=process_video,
                args=(feed, queue.Queue()),
            )
            feed_thread.start()
    socket.send_string("feed_started")


# while True:
#     message = socket.recv()
#     print("message %s" % message)
#     decoded = message.decode("utf-8")
#     if message == b"start":
#         print("starting")
#         main()
#     elif message == b"restart":
#         print("restarting")
#         restart()
#     elif decoded.startswith("add_feed:"):
#         feed_info = decoded.split(":")
#         print("adding feed")
#         start_added_feed(int(feed_info[1]))
#     elif decoded.startswith("set_detecting:"):
#         print("setting detecting", decoded)
#         detection_info = decoded.split(":")
#         feed_id = int(detection_info[1])
#         feed_status = int(detection_info[2])
#         print("setting detecting for", feed_id, feed_status)
#         if feed_status == 0:
#             detecting_events[feed_id].clear()
#             print("clearing detecting")
#         else:
#             detecting_events[feed_id].set()
#             print("setting detecting")
#         socket.send_string("detection_set")
#
#     sleep(1)
