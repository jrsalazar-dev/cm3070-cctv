import cv2
import zmq
import queue
import threading
import os
import sqlite3
import asyncio
from time import sleep
from datetime import datetime
from ffprobe import FFProbe
from ultralytics import YOLO
from ultralytics.utils.plotting import Annotator

QUIET_SECONDS = 1
MAX_VID_LENGTH = 20

# print(cv2.getBuildInformation())

# (id, filepath, detection_time (unix ts), detection_objects (comma string), detection_feed (id))
INSERT_ALERT = """
INSERT INTO alerts (filepath, detection_time, detection_objects, detection_feed) VALUES(?, ?, ?, ?)
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

DISABLE_DETECTIONS = False


def worker_thread(task_queue):
    print("Worker thread started")
    while True:
        try:
            task = task_queue.get()
            if task is None:
                conn.close()
                break
            filename, fps, detection_objects = task
            conn = sqlite3.connect("../camdb.db")
            print("got task", filename, fps, detection_objects)
            # save_video_clip(buffer, filename, fps)
            cursor = conn.cursor()
            print("created cursor")
            print("got filename")
            detection_timestamp = datetime.utcnow().timestamp()
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
                ),
            )
            conn.commit()
            task_queue.task_done()
            conn.close()
            print("Saved alert, closing connections")
        except queue.Empty:
            print("Queue empty, sleeping 1s")
            sleep(1)
            continue


worker_ref = threading.Thread(target=worker_thread, args=(worker_queue,))
worker_ref.start()


def save_video_clip(buffer, filename, fps):
    print("Saving video clip")
    sample_frame = buffer.get()
    height, width, layers = sample_frame.shape
    fourcc = cv2.VideoWriter_fourcc(*"VP90")
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


def detect_person(frame, frame_count):
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
                detected = box.conf > 0.5
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


def capture(file):
    # open the video file
    # cap = cv2.VideoCapture(file)
    cap = cv2.VideoCapture(0)

    return cap


def process_video(file):
    video_count = 0
    cap = capture(file)
    frame_count = 0
    fps = 20
    frame_buffer = queue.Queue(maxsize=20 * MAX_VID_LENGTH)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    gst_simple = (
        "appsrc ! "
        "videoconvert ! "
        "vp8enc ! "
        "webmmux streamable=true ! "
        "tcpserversink host=localhost port=5000 recover-policy=keyframe sync-method=latest-keyframe"
    )
    # OpenCV VideoWriter with the GStreamer pipeline
    out = cv2.VideoWriter(gst_simple, cv2.CAP_GSTREAMER, fps, (width, height), True)

    first_detection = -1
    person_detected_at = -1
    objects_detected = []

    while True:
        frame_count += 1
        # read a frame from the video
        ret, frame = cap.read()

        if not ret:
            break

        # apply Gaussian Blur to reduce noise
        frame = cv2.GaussianBlur(frame, (5, 5), 0)

        # apply the background subtraction
        fgMask = backSub.apply(frame)

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
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        # only run YOLO when contours are detected
        if not DISABLE_DETECTIONS and contours or first_detection != -1:
            detected, classes_detected = detect_person(frame, frame_count)
            if detected:
                objects_detected = list(set(objects_detected + classes_detected))
                person_detected_at = frame_count
                if first_detection == -1:
                    first_detection = frame_count

        if frame_buffer.full():
            frame_buffer.get()

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
                (
                    f"{filename}.webm",
                    fps,
                    ",".join(objects_detected),
                )
            )
            # # Start a new thread to save the video
            thread = threading.Thread(
                target=save_video_clip,
                args=(frame_buffer_copy, f"./output/{filename}.webm", fps),
            )
            thread.start()
            # Clear the memory of the frame buffer
            # del frame_buffer_copy
        else:
            # add frame to buffer
            frame_buffer.put(frame)

        # display the frame
        cv2.imshow("frame", frame)
        out.write(frame)

        # check for quit signal
        if cv2.pollKey() == ord("q"):
            break

    # release resources
    cap.release()
    out.release()
    cv2.destroyAllWindows()
    cv2.waitKey(1)
    worker_ref.join()


#

vid_list = [
    "./samples/worker-zone-detection.mp4",
    "./samples/people-detection.mp4",
    "./samples/store-aisle-detection.mp4",
    "./samples/one-by-one-person-detection.mp4",
    "./samples/person-bicycle-car-detection.mp4",
    "./samples/Traffic_Laramie_1.mp4",
    "./samples/Traffic_Laramie_2.mp4",
]

home_cam = "rtsp://admin:janneman@192.168.178.136:8554/Streaming/Channels/101"

# context = zmq.Context()
# socket = context.socket(zmq.REP)
# socket.bind("tcp://*:5555")
#
# while True:
#     message = socket.recv()
#     print("Received request: %s" % message)
#     socket.send_string("World")
#     sleep(1)

process_video(vid_list[2])
