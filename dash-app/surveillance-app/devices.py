import cv2


def enumerate_video_devices():
    devices = []
    for i in range(10):  # assuming maximum of 10 video devices
        cap = cv2.VideoCapture(i)
        if not cap.isOpened():
            break
        device_info = {}
        device_info["index"] = i
        device_info["name"] = cap.get(cv2.CAP_PROP_BACKEND)  # Name of the backend
        device_info["unique_id"] = cap.get(cv2.CAP_PROP_GUID)
        devices.append(device_info)
        cap.release()
    return devices


def print_video_devices(devices):
    for device in devices:
        print("Index:", device["index"])
        print("Name:", device["name"])
        print("Unique ID:", device["unique_id"])
        print()


# Enumerate video devices
video_devices = enumerate_video_devices()

# Print information about video devices
print("Available Video Input Devices:")
print_video_devices(video_devices)
