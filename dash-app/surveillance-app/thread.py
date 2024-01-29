import cv2
import threading

number_of_cameras = 1


def process_video(camera_index):
    cap = cv2.VideoCapture(camera_index)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        # Process the frame
        # cv2.imshow(f"Camera {camera_index}", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
    cap.release()
    cv2.destroyAllWindows()


# process_video(0)

# For each camera, start a new thread
threads = []
for camera_index in range(number_of_cameras):
    thread = threading.Thread(target=process_video, args=(camera_index,))
    thread.start()
    threads.append(thread)

# Join threads
for thread in threads:
    thread.join()
