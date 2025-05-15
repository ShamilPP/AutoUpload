#!/bin/bash

# Path to your video
VIDEO_PATH="video\video.mp4"

# Your YouTube RTMP URL and Stream Key (replace YOUR_STREAM_KEY)
RTMP_URL="rtmp://a.rtmp.youtube.com/live2/uyzy-yefe-rmdt-q393-3pha"

# Run ffmpeg with loop and stream options
ffmpeg -re -stream_loop -1 -i "$VIDEO_PATH" \
-c:v libx264 -preset veryfast -maxrate 3000k -bufsize 6000k \
-pix_fmt yuv420p -g 50 -c:a aac -b:a 128k -ar 44100 \
-f flv "$RTMP_URL"

#  chmod +x infinite-live-stream.sh
#  ./infinite-live-stream.sh
