import cv2

cap = cv2.VideoCapture(0)

frame_count = 0
fps = 20
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

print(fps, width, height)


gst_simple = (
    "appsrc ! "
    "videoconvert ! "
    "vp8enc ! "
    "webmmux streamable=true ! "
    # "filesink location=minimum.webm"
    # "autovideosink"
    "tcpserversink host=localhost port=5000 recover-policy=keyframe sync-method=latest-keyframe"
)

out = cv2.VideoWriter(gst_simple, cv2.CAP_GSTREAMER, fps, (width, height), True)

while True:
    frame_count += 1
    # read a frame from the video
    ret, frame = cap.read()

    if not ret:
        break

    cv2.imshow("frame", frame)
    out.write(frame)

    # check for quit signal
    if cv2.pollKey() == ord("q"):
        break

cap.release()
out.release()
cv2.destroyAllWindows()
cv2.waitKey(1)
