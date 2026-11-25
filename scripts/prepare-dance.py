"""Local-only reference analysis. Runtime needs only the generated JSON/audio."""
import argparse, json, os, subprocess
from pathlib import Path
import cv2
import numpy as np
import mediapipe as mp
import imageio_ffmpeg

parser = argparse.ArgumentParser()
parser.add_argument("video")
parser.add_argument("--model", required=True)
parser.add_argument("--probe", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
out = root / "assets" / "dance"
out.mkdir(parents=True, exist_ok=True)
cap = cv2.VideoCapture(args.video)
duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
opts = mp.tasks.vision.PoseLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=args.model),
    running_mode=mp.tasks.vision.RunningMode.IMAGE,
    num_poses=8, min_pose_detection_confidence=.25,
    min_pose_presence_confidence=.25,
)
fps = 12
times = [0.5, 4, 8, 12, 18, 24] if args.probe else list(np.arange(0, duration, 1/fps))
frames, valid = [], 0
with mp.tasks.vision.PoseLandmarker.create_from_options(opts) as detector:
    for index, time in enumerate(times):
        cap.set(cv2.CAP_PROP_POS_MSEC, float(time)*1000)
        ok, frame = cap.read()
        if not ok: frames.append(None); continue
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        result = detector.detect(image)
        candidates = []
        for landmarks, world in zip(result.pose_landmarks, result.pose_world_landmarks):
            visibility = float(np.mean([landmarks[j].visibility for j in [11,12,13,14,15,16,23,24,25,26,27,28]]))
            center = (landmarks[23].x + landmarks[24].x)/2
            # Favor a complete central adult dancer; ignore the tiny foreground mascot.
            height = abs((landmarks[27].y+landmarks[28].y)/2 - landmarks[0].y)
            score = visibility + min(.6, height) - abs(center-.5)*.3
            if height > .25 and visibility > .25:
                candidates.append((score, world, visibility))
        if candidates:
            _, pose, visibility = max(candidates, key=lambda item:item[0])
            frames.append([[round(p.x,5),round(-p.y,5),round(-p.z,5),round(p.visibility,3)] for p in pose])
            valid += 1
        else: frames.append(None)
        if args.probe or index % 36 == 0:
            print(json.dumps({"frame":index,"time":round(float(time),3),"detected":len(result.pose_landmarks),"usable":bool(candidates)}), flush=True)
cap.release()
if args.probe: raise SystemExit(0)
if valid < len(frames)*.35:
    raise RuntimeError(f"Too few reliable poses: {valid}/{len(frames)}; use authored choreography instead of claiming a capture")
good = np.array([i for i,p in enumerate(frames) if p is not None])
samples = np.array([frames[i] for i in good])
timeline = np.arange(len(frames))
data = np.empty((len(frames),33,4))
for joint in range(33):
    for axis in range(4):
        data[:,joint,axis] = np.interp(timeline,good,samples[:,joint,axis])
# Smooth detector jitter without shifting the musical timeline.
for _ in range(2):
    data[1:-1,:,:3] = data[:-2,:,:3]*.2 + data[1:-1,:,:3]*.6 + data[2:,:,:3]*.2
payload = {"source":"User-supplied FDown 402b reference", "duration":round(duration,6), "fps":fps,
           "method":"Local MediaPipe pose estimate, interpolated and smoothed; not original animation data",
           "validFrames":valid, "totalFrames":len(frames), "frames":np.round(data,5).tolist()}
(out / "reference-402b-motion.json").write_text(json.dumps(payload,separators=(',',':')), encoding="utf-8")
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),"-hide_banner","-loglevel","error","-y","-i",args.video,
                "-vn","-ac","2","-ar","44100","-codec:a","libmp3lame","-b:a","160k",str(out / "reference-402b.mp3")], check=True)
print(json.dumps({"duration":duration,"frames":len(frames),"valid":valid,"output":str(out)}),flush=True)
