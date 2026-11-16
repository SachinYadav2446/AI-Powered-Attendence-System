"""
FastAPI Server for AI-Powered Classroom Attendance System.

Exposes RESTful endpoints for:
1. Live Video Attendance Tracking with Multi-Frame Temporal Voting
2. Student Enrollment & Management (Webcam / Image Upload / Seed Demo)
3. Face Detection & Recognition Vision Playground (YuNet + SFace)
4. Comprehensive Attendance Reporting & Analytics
5. Model Benchmarking & Empirical Evaluation Suite
6. Static Asset Serving (Proof Photos, CSV Reports, React Frontend SPA)
"""

import base64
import io
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Ensure current directory is on python path
CURRENT_DIR = Path(__file__).resolve().parent
os.environ.setdefault("MPLCONFIGDIR", str(CURRENT_DIR / "data" / ".matplotlib"))
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

import config
import db
from recognizer import Recognizer
import evaluate

# Initialize Database tables
db.init_db()

# Initialize Central Recognizer Instance
try:
    recognizer = Recognizer()
except Exception as e:
    print(f"Warning: Failed to initialize recognizer: {e}")
    recognizer = None

app = FastAPI(
    title="AI Classroom Attendance API",
    description="Offline-first Face Recognition Attendance System with pure OpenCV YuNet & SFace",
    version="2.0.0",
)

# Enable CORS for React frontend (Vite dev server at localhost:3000 / localhost:5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
config.KNOWN_FACES_DIR.mkdir(parents=True, exist_ok=True)
config.TEST_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
config.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Mount static folders for images and exports
app.mount("/data/exports", StaticFiles(directory=str(config.EXPORTS_DIR)), name="exports")
app.mount("/data/known_faces", StaticFiles(directory=str(config.KNOWN_FACES_DIR)), name="known_faces")
app.mount("/data/test_images", StaticFiles(directory=str(config.TEST_IMAGES_DIR)), name="test_images")


# -----------------------------------------------------------------------------
# In-Memory Active Live Attendance Sessions Tracker
# -----------------------------------------------------------------------------
active_live_sessions: Dict[str, Dict[str, Any]] = {}


# -----------------------------------------------------------------------------
# Helper Utilities
# -----------------------------------------------------------------------------
def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decode a base64 string (with or without data URL prefix) to a BGR numpy image."""
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image from buffer")
        return img
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image data: {str(e)}"
        )


def encode_image_to_base64(image: np.ndarray, quality: int = 85) -> str:
    """Encode a BGR numpy image to base64 JPEG string."""
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    success, buffer = cv2.imencode(".jpg", image, encode_params)
    if not success:
        return ""
    b64_str = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64_str}"


def get_student_avatar_url(roll_no: str, name: str) -> Optional[str]:
    """Find student profile picture or avatar if available."""
    clean_name = name.replace(" ", "_")
    folder = config.KNOWN_FACES_DIR / f"{roll_no}_{clean_name}"
    if not folder.exists():
        # Search for any folder starting with roll_no
        candidates = list(config.KNOWN_FACES_DIR.glob(f"{roll_no}_*"))
        if candidates:
            folder = candidates[0]
        else:
            return None

    for img_name in ("profile.jpg", "shot_01.jpg", "shot_1.jpg", "photo.jpg"):
        candidate_file = folder / img_name
        if candidate_file.exists():
            rel_path = candidate_file.relative_to(config.KNOWN_FACES_DIR).as_posix()
            return f"/data/known_faces/{rel_path}"

    # Take first jpg/png
    images = list(folder.glob("*.jpg")) + list(folder.glob("*.png"))
    if images:
        rel_path = images[0].relative_to(config.KNOWN_FACES_DIR).as_posix()
        return f"/data/known_faces/{rel_path}"
    return None


# -----------------------------------------------------------------------------
# Pydantic Request Models
# -----------------------------------------------------------------------------
class UpdateConfigPayload(BaseModel):
    cosine_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    yunet_score_threshold: Optional[float] = Field(None, ge=0.1, le=1.0)
    min_frames_seen: Optional[int] = Field(None, ge=1, le=50)
    metric: Optional[str] = Field(None)
    match_strategy: Optional[str] = Field(None)


class EnrollWebcamPayload(BaseModel):
    roll_no: str
    name: str
    frames: List[str]  # list of base64 image strings
    force: bool = False


class VisionImagePayload(BaseModel):
    image: str  # base64 encoded image
    score_threshold: Optional[float] = None
    similarity_threshold: Optional[float] = None


class ComparePayload(BaseModel):
    image_a: str
    image_b: str
    metric: Optional[str] = "cosine"


class LiveSessionStartPayload(BaseModel):
    course: str
    min_frames_seen: Optional[int] = 3
    sample_duration_sec: Optional[int] = 15


class LiveSessionFramePayload(BaseModel):
    session_token: str
    image: str  # base64 encoded image


class LiveSessionCommitPayload(BaseModel):
    session_token: str


class SeedStudentsPayload(BaseModel):
    count: int = 10


# -----------------------------------------------------------------------------
# 1. System & Info Routes
# -----------------------------------------------------------------------------
@app.get("/api/status")
def get_system_status():
    """Retrieve operational system status, model states, and database counts."""
    students = db.get_all_students()
    sessions = db.get_all_sessions()
    
    yunet_loaded = recognizer is not None and recognizer.detector is not None
    sface_loaded = recognizer is not None and recognizer.recognizer is not None

    return {
        "status": "online",
        "opencv_version": cv2.__version__,
        "python_version": sys.version.split()[0],
        "models": {
            "yunet": {
                "name": config.YUNET_MODEL_FILENAME,
                "loaded": yunet_loaded,
                "path": str(config.YUNET_MODEL_PATH),
                "score_threshold": recognizer.score_threshold if recognizer else config.YUNET_SCORE_THRESHOLD,
            },
            "sface": {
                "name": config.SFACE_MODEL_FILENAME,
                "loaded": sface_loaded,
                "path": str(config.SFACE_MODEL_PATH),
                "similarity_threshold": recognizer.similarity_threshold if recognizer else config.COSINE_SIMILARITY_THRESHOLD,
                "metric": recognizer.metric if recognizer else config.DEFAULT_SIMILARITY_METRIC,
            },
        },
        "database": {
            "path": str(config.DB_PATH),
            "enrolled_students": len(students),
            "total_sessions": len(sessions),
        },
        "config": {
            "session_sample_duration_sec": config.SESSION_SAMPLE_DURATION_SEC,
            "session_min_frames_seen": config.SESSION_MIN_FRAMES_SEEN,
            "default_similarity_metric": config.DEFAULT_SIMILARITY_METRIC,
        }
    }


@app.get("/api/config")
def get_current_config():
    """Retrieve current runtime threshold settings."""
    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")
    return {
        "cosine_threshold": recognizer.similarity_threshold,
        "yunet_score_threshold": recognizer.score_threshold,
        "min_frames_seen": config.SESSION_MIN_FRAMES_SEEN,
        "metric": recognizer.metric,
        "match_strategy": recognizer.match_strategy,
    }


@app.post("/api/config")
def update_config(payload: UpdateConfigPayload):
    """Dynamically adjust detection and recognition thresholds in memory."""
    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    if payload.cosine_threshold is not None:
        recognizer.similarity_threshold = payload.cosine_threshold
    if payload.yunet_score_threshold is not None:
        recognizer.score_threshold = payload.yunet_score_threshold
    if payload.metric is not None:
        recognizer.metric = payload.metric.lower()
    if payload.match_strategy is not None:
        recognizer.match_strategy = payload.match_strategy.lower()
    if payload.min_frames_seen is not None:
        config.SESSION_MIN_FRAMES_SEEN = payload.min_frames_seen

    return {
        "message": "Configuration updated successfully",
        "current_config": {
            "cosine_threshold": recognizer.similarity_threshold,
            "yunet_score_threshold": recognizer.score_threshold,
            "metric": recognizer.metric,
            "match_strategy": recognizer.match_strategy,
            "min_frames_seen": config.SESSION_MIN_FRAMES_SEEN,
        }
    }


# -----------------------------------------------------------------------------
# 2. Student Enrollment & Management
# -----------------------------------------------------------------------------
@app.get("/api/students")
def list_students():
    """Return all enrolled students with embedding stats and avatar links."""
    students = db.get_all_students()
    result = []
    for s in students:
        embs = s["embeddings"]
        count = len(embs) if embs is not None else 0
        avatar_url = get_student_avatar_url(s["roll_no"], s["name"])
        result.append({
            "id": s["id"],
            "roll_no": s["roll_no"],
            "name": s["name"],
            "embeddings_count": count,
            "enrolled_at": s["enrolled_at"],
            "avatar_url": avatar_url,
        })
    return result


@app.get("/api/students/{roll_no}")
def get_student(roll_no: str):
    """Get single student details and photo list."""
    student = db.get_student_by_roll(roll_no)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {roll_no} not found")

    embs = student["embeddings"]
    avatar_url = get_student_avatar_url(student["roll_no"], student["name"])

    # List any photos saved in their folder
    folder = config.KNOWN_FACES_DIR / f"{student['roll_no']}_{student['name'].replace(' ', '_')}"
    photos = []
    if folder.exists():
        for p in folder.glob("*.jpg"):
            rel = p.relative_to(config.KNOWN_FACES_DIR).as_posix()
            photos.append(f"/data/known_faces/{rel}")

    return {
        "id": student["id"],
        "roll_no": student["roll_no"],
        "name": student["name"],
        "embeddings_count": len(embs) if embs is not None else 0,
        "enrolled_at": student["enrolled_at"],
        "avatar_url": avatar_url,
        "photos": photos,
    }


@app.delete("/api/students/{roll_no}")
def delete_student(roll_no: str):
    """Delete a student and their associated attendance history."""
    existing = db.get_student_by_roll(roll_no)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Student {roll_no} not found")

    success = db.delete_student(roll_no)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete student from database")

    # Invalidate Recognizer cache
    if recognizer:
        recognizer.load_enrolled_students(force_reload=True)

    return {"message": f"Student '{existing['name']}' ({roll_no}) deleted successfully"}


@app.post("/api/students/seed")
def seed_students(payload: SeedStudentsPayload = SeedStudentsPayload()):
    """Seed 10+ realistic synthetic students for quick testing."""
    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    from enroll import seed_sample_students
    seed_sample_students(recognizer, count=payload.count)

    # Invalidate Recognizer cache
    recognizer.load_enrolled_students(force_reload=True)

    students = db.get_all_students()
    return {
        "message": f"Successfully bootstrapped {payload.count} sample students",
        "total_enrolled": len(students),
    }


@app.post("/api/students/enroll")
def enroll_student(payload: EnrollWebcamPayload):
    """
    Enroll student with multiple webcam frames or photos.
    Validates single-face presence in each frame and extracts SFace embeddings.
    """
    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    roll_no = payload.roll_no.strip()
    name = payload.name.strip()

    if not roll_no or not name:
        raise HTTPException(status_code=400, detail="Roll number and name are required")

    existing = db.get_student_by_roll(roll_no)
    if existing and not payload.force:
        raise HTTPException(
            status_code=409,
            detail=f"Student with roll number '{roll_no}' already exists ({existing['name']}). Set force=true to overwrite."
        )

    if not payload.frames or len(payload.frames) == 0:
        raise HTTPException(status_code=400, detail="At least 1 photo frame is required for enrollment")

    student_folder = config.KNOWN_FACES_DIR / f"{roll_no}_{name.replace(' ', '_')}"
    student_folder.mkdir(parents=True, exist_ok=True)

    captured_embeddings = []
    valid_count = 0
    errors = []

    for idx, b64 in enumerate(payload.frames):
        try:
            img = decode_base64_image(b64)
            faces = recognizer.detect(img)
            if len(faces) == 0:
                errors.append(f"Frame #{idx + 1}: No face detected")
                continue
            if len(faces) > 1:
                errors.append(f"Frame #{idx + 1}: Multiple faces ({len(faces)}) detected")
                continue

            face = faces[0]
            emb = recognizer.embed(img, face)
            captured_embeddings.append(emb)

            # Save valid photo to disk
            valid_count += 1
            shot_file = student_folder / f"shot_{valid_count:02d}.jpg"
            cv2.imwrite(str(shot_file), img)

            # Set first valid as profile if not set
            if valid_count == 1:
                profile_file = student_folder / "profile.jpg"
                cv2.imwrite(str(profile_file), img)

        except Exception as e:
            errors.append(f"Frame #{idx + 1}: Error processing image: {str(e)}")

    if len(captured_embeddings) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Zero valid faces could be processed for enrollment. Errors: {'; '.join(errors)}"
        )

    stacked_embeddings = np.vstack(captured_embeddings)
    if existing and payload.force:
        db.update_student_embeddings(roll_no, stacked_embeddings)
    else:
        db.insert_student(roll_no, name, stacked_embeddings)

    # Invalidate cache
    recognizer.load_enrolled_students(force_reload=True)

    return {
        "message": f"Successfully enrolled student '{name}' ({roll_no}) with {len(captured_embeddings)} valid biometric photos",
        "roll_no": roll_no,
        "name": name,
        "embeddings_count": len(captured_embeddings),
        "avatar_url": get_student_avatar_url(roll_no, name),
        "skipped_frames_errors": errors,
    }


# -----------------------------------------------------------------------------
# 3. Vision Playground & Real-Time Face Detection / Recognition
# -----------------------------------------------------------------------------
@app.post("/api/vision/detect")
def detect_faces(payload: VisionImagePayload):
    """
    Standalone YuNet Face Detection endpoint:
    Returns bounding boxes, 5 facial landmarks, confidence scores, and visual overlay.
    """
    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    img = decode_base64_image(payload.image)
    t0 = time.perf_counter()
    faces = recognizer.detect(img, score_threshold=payload.score_threshold)
    latency_ms = (time.perf_counter() - t0) * 1000

    results = []
    for face in faces:
        x, y, w, h = [float(v) for v in face[0:4]]
        landmarks = [[float(face[4 + 2 * l]), float(face[5 + 2 * l])] for l in range(5)]
        score = float(face[14])
        results.append({
            "box": {"x": x, "y": y, "width": w, "height": h},
            "landmarks": {
                "right_eye": landmarks[0],
                "left_eye": landmarks[1],
                "nose_tip": landmarks[2],
                "right_mouth": landmarks[3],
                "left_mouth": landmarks[4],
            },
            "score": round(score, 4),
        })

    annotated = recognizer.draw_detections(img, faces)
    annotated_b64 = encode_image_to_base64(annotated)

    return {
        "count": len(faces),
        "latency_ms": round(latency_ms, 2),
        "faces": results,
        "annotated_image": annotated_b64,
    }


@app.post("/api/vision/recognize")
def recognize_faces(payload: VisionImagePayload):
    """
    YuNet + SFace Face Recognition endpoint:
    Detects faces, extracts embeddings, matches against enrolled DB,
    and returns annotated image (Green for enrolled students, Red for unknown).
    """
    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    img = decode_base64_image(payload.image)
    t0 = time.perf_counter()
    raw_results = recognizer.match_all_in_frame(
        img,
        threshold=payload.similarity_threshold,
        score_threshold=payload.score_threshold,
    )
    latency_ms = (time.perf_counter() - t0) * 1000

    formatted_faces = []
    for face_row, student, conf in raw_results:
        x, y, w, h = [float(v) for v in face_row[0:4]]
        landmarks = [[float(face_row[4 + 2 * l]), float(face_row[5 + 2 * l])] for l in range(5)]
        is_known = student is not None

        formatted_faces.append({
            "box": {"x": x, "y": y, "width": w, "height": h},
            "is_known": is_known,
            "roll_no": student["roll_no"] if is_known else None,
            "name": student["name"] if is_known else "Unknown",
            "confidence": round(float(conf), 4),
            "score": round(float(face_row[14]), 4),
        })

    annotated = recognizer.draw_recognition_results(img, raw_results)
    annotated_b64 = encode_image_to_base64(annotated)

    return {
        "count": len(raw_results),
        "known_count": sum(1 for f in formatted_faces if f["is_known"]),
        "unknown_count": sum(1 for f in formatted_faces if not f["is_known"]),
        "latency_ms": round(latency_ms, 2),
        "faces": formatted_faces,
        "annotated_image": annotated_b64,
    }


@app.post("/api/vision/compare")
def compare_faces(payload: ComparePayload):
    """
    Compare two faces directly:
    Extracts embeddings from both images and computes Cosine similarity + L2 distance.
    """
    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    img_a = decode_base64_image(payload.image_a)
    img_b = decode_base64_image(payload.image_b)

    faces_a = recognizer.detect(img_a)
    faces_b = recognizer.detect(img_b)

    if len(faces_a) == 0:
        raise HTTPException(status_code=400, detail="No face detected in Image A")
    if len(faces_b) == 0:
        raise HTTPException(status_code=400, detail="No face detected in Image B")

    emb_a = recognizer.embed(img_a, faces_a[0])
    emb_b = recognizer.embed(img_b, faces_b[0])

    cosine_sim = recognizer.match_features(emb_a, emb_b, metric="cosine")
    l2_dist = recognizer.match_features(emb_a, emb_b, metric="l2")

    is_match_cosine = recognizer.is_match(cosine_sim, metric="cosine")
    is_match_l2 = recognizer.is_match(l2_dist, metric="l2")

    return {
        "cosine_similarity": round(float(cosine_sim), 4),
        "cosine_threshold": recognizer.similarity_threshold,
        "is_match_cosine": bool(is_match_cosine),
        "l2_distance": round(float(l2_dist), 4),
        "l2_threshold": config.L2_DISTANCE_THRESHOLD,
        "is_match_l2": bool(is_match_l2),
        "verdict": "MATCH" if is_match_cosine else "NO MATCH",
    }


# -----------------------------------------------------------------------------
# 4. Live Attendance Session Scanning with Multi-Frame Temporal Voting
# -----------------------------------------------------------------------------
@app.post("/api/sessions/live/start")
def start_live_session(payload: LiveSessionStartPayload):
    """Initialize a stateful live streaming attendance session."""
    token = f"live_{int(time.time() * 1000)}"
    active_live_sessions[token] = {
        "course": payload.course.strip() or "General Lecture",
        "min_frames_seen": payload.min_frames_seen or config.SESSION_MIN_FRAMES_SEEN,
        "sample_duration_sec": payload.sample_duration_sec or config.SESSION_SAMPLE_DURATION_SEC,
        "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "frame_count": 0,
        "seen_counts": {},       # roll_no -> count of frames recognized
        "best_confidences": {},  # roll_no -> highest similarity score
        "best_proof_image": None,
        "best_proof_detections_count": 0,
    }
    return {
        "session_token": token,
        "course": active_live_sessions[token]["course"],
        "min_frames_seen": active_live_sessions[token]["min_frames_seen"],
        "message": "Live attendance session initialized",
    }


@app.post("/api/sessions/live/frame")
def process_live_frame(payload: LiveSessionFramePayload):
    """
    Process one frame from client webcam stream:
    Updates multi-frame temporal voting counters and returns real-time annotated overlay.
    """
    session = active_live_sessions.get(payload.session_token)
    if not session:
        raise HTTPException(status_code=404, detail="Live session token expired or invalid")

    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    img = decode_base64_image(payload.image)
    session["frame_count"] += 1

    # Run detection and matching
    raw_results = recognizer.match_all_in_frame(img)
    faces_in_frame = []

    for face_row, student, conf in raw_results:
        if student is not None:
            roll = student["roll_no"]
            session["seen_counts"][roll] = session["seen_counts"].get(roll, 0) + 1
            if conf > session["best_confidences"].get(roll, -1.0):
                session["best_confidences"][roll] = float(conf)

            faces_in_frame.append({
                "roll_no": roll,
                "name": student["name"],
                "confidence": round(float(conf), 4),
                "frames_accumulated": session["seen_counts"][roll],
                "is_present_yet": session["seen_counts"][roll] >= session["min_frames_seen"],
            })
        else:
            faces_in_frame.append({
                "roll_no": None,
                "name": "Unknown",
                "confidence": round(float(conf), 4),
                "frames_accumulated": 0,
                "is_present_yet": False,
            })

    # Save best frame as proof candidate (frame with most recognized or total faces)
    if len(raw_results) > session["best_proof_detections_count"] or session["best_proof_image"] is None:
        session["best_proof_detections_count"] = len(raw_results)
        session["best_proof_image"] = img.copy()

    annotated = recognizer.draw_recognition_results(img, raw_results)
    annotated_b64 = encode_image_to_base64(annotated, quality=75)

    return {
        "frame_index": session["frame_count"],
        "faces_detected": len(raw_results),
        "faces_in_frame": faces_in_frame,
        "cumulative_seen": session["seen_counts"],
        "min_frames_seen": session["min_frames_seen"],
        "annotated_frame": annotated_b64,
    }


@app.post("/api/sessions/live/commit")
def commit_live_session(payload: LiveSessionCommitPayload):
    """
    Finalize live scanning session:
    Applies temporal voting, records attendance for all enrolled students in SQLite,
    generates proof image and CSV report.
    """
    session = active_live_sessions.pop(payload.session_token, None)
    if not session:
        raise HTTPException(status_code=404, detail="Live session token expired or invalid")

    enrolled = db.get_all_students()
    if not enrolled:
        raise HTTPException(status_code=400, detail="Cannot commit session: Zero students enrolled in system")

    course = session["course"]
    now = datetime.now()
    session_date = now.strftime("%Y-%m-%d")
    start_time = now.strftime("%H:%M:%S")

    # 1. Create session in DB
    session_id = db.create_session(course=course, date=session_date, start_time=start_time)

    # 2. Record attendance for every student
    present_count = 0
    records = []

    for s in enrolled:
        roll = s["roll_no"]
        frames_seen = session["seen_counts"].get(roll, 0)
        conf = session["best_confidences"].get(roll, 0.0)
        is_present = frames_seen >= session["min_frames_seen"]
        status_str = "PRESENT" if is_present else "ABSENT"

        if is_present:
            present_count += 1

        db.record_attendance(
            session_id=session_id,
            student_id=s["id"],
            status=status_str,
            confidence=conf,
            frames_seen=frames_seen,
        )

        records.append({
            "roll_no": roll,
            "name": s["name"],
            "status": status_str,
            "confidence": round(conf, 4),
            "frames_seen": frames_seen,
        })

    # 3. Save Proof Snapshot
    clean_course = "".join(c if c.isalnum() else "_" for c in course)
    proof_filename = f"session_{session_id}_{clean_course}_proof.jpg"
    proof_path = config.EXPORTS_DIR / proof_filename

    if session["best_proof_image"] is not None and recognizer:
        proof_img = session["best_proof_image"]
        proof_results = recognizer.match_all_in_frame(proof_img)
        proof_annotated = recognizer.draw_recognition_results(proof_img, proof_results)
        cv2.imwrite(str(proof_path), proof_annotated)
    else:
        # Generate placeholder proof image
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(blank, f"Session #{session_id}: {course}", (30, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        cv2.putText(blank, f"Date: {session_date} {start_time}", (30, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
        cv2.imwrite(str(proof_path), blank)

    # 4. Generate CSV
    csv_filename = f"attendance_session_{session_id}_{session_date}_{clean_course}.csv"
    csv_path = config.EXPORTS_DIR / csv_filename
    df = pd.DataFrame(records)
    df.to_csv(csv_path, index=False)

    total_enrolled = len(enrolled)
    attendance_pct = round((present_count / total_enrolled * 100), 2) if total_enrolled > 0 else 0

    return {
        "session_id": session_id,
        "course": course,
        "date": session_date,
        "start_time": start_time,
        "total_enrolled": total_enrolled,
        "present_count": present_count,
        "absent_count": total_enrolled - present_count,
        "attendance_pct": attendance_pct,
        "proof_image_url": f"/data/exports/{proof_filename}",
        "csv_download_url": f"/data/exports/{csv_filename}",
        "records": records,
    }


# -----------------------------------------------------------------------------
# 5. Group Snapshot Attendance Session (Single / Tiled photo)
# -----------------------------------------------------------------------------
@app.post("/api/sessions/create-from-image")
def create_session_from_image(
    course: str = Form(...),
    image: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    upscale_factor: float = Form(1.0),
    tile_size: Optional[int] = Form(None),
):
    """Process a single classroom group photograph to conduct attendance."""
    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    enrolled = db.get_all_students()
    if not enrolled:
        raise HTTPException(status_code=400, detail="Zero students enrolled in database")

    # Read image
    if image is not None:
        contents = image.file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    elif image_base64:
        img = decode_base64_image(image_base64)
    else:
        raise HTTPException(status_code=400, detail="No image provided (file or base64)")

    if img is None:
        raise HTTPException(status_code=400, detail="Failed to decode image")

    # Detect faces with tiling / upscaling if specified
    from run_session import detect_with_tiles_or_upscale
    faces = detect_with_tiles_or_upscale(
        img,
        recognizer=recognizer,
        upscale_factor=upscale_factor,
        tile_size=tile_size,
    )

    now = datetime.now()
    session_date = now.strftime("%Y-%m-%d")
    start_time = now.strftime("%H:%M:%S")
    session_id = db.create_session(course=course.strip(), date=session_date, start_time=start_time)

    # Match each detected face
    matched_students_map: Dict[str, float] = {}  # roll_no -> best confidence
    recognition_results = []

    for face in faces:
        emb = recognizer.embed(img, face)
        matched_student, conf = recognizer.match(emb, enrolled_students=enrolled)
        recognition_results.append((face, matched_student, conf))
        if matched_student is not None:
            roll = matched_student["roll_no"]
            if conf > matched_students_map.get(roll, -1.0):
                matched_students_map[roll] = float(conf)

    # Record attendance
    present_count = 0
    records = []

    for s in enrolled:
        roll = s["roll_no"]
        is_present = roll in matched_students_map
        conf = matched_students_map.get(roll, 0.0)
        status_str = "PRESENT" if is_present else "ABSENT"

        if is_present:
            present_count += 1

        db.record_attendance(
            session_id=session_id,
            student_id=s["id"],
            status=status_str,
            confidence=conf,
            frames_seen=1 if is_present else 0,
        )

        records.append({
            "roll_no": roll,
            "name": s["name"],
            "status": status_str,
            "confidence": round(conf, 4),
            "frames_seen": 1 if is_present else 0,
        })

    # Save Proof
    clean_course = "".join(c if c.isalnum() else "_" for c in course)
    proof_filename = f"session_{session_id}_{clean_course}_proof.jpg"
    proof_path = config.EXPORTS_DIR / proof_filename
    annotated = recognizer.draw_recognition_results(img, recognition_results)
    cv2.imwrite(str(proof_path), annotated)

    # Generate CSV
    csv_filename = f"attendance_session_{session_id}_{session_date}_{clean_course}.csv"
    csv_path = config.EXPORTS_DIR / csv_filename
    pd.DataFrame(records).to_csv(csv_path, index=False)

    total_enrolled = len(enrolled)
    attendance_pct = round((present_count / total_enrolled * 100), 2) if total_enrolled > 0 else 0

    return {
        "session_id": session_id,
        "course": course,
        "date": session_date,
        "start_time": start_time,
        "total_enrolled": total_enrolled,
        "present_count": present_count,
        "absent_count": total_enrolled - present_count,
        "attendance_pct": attendance_pct,
        "proof_image_url": f"/data/exports/{proof_filename}",
        "csv_download_url": f"/data/exports/{csv_filename}",
        "records": records,
    }


# -----------------------------------------------------------------------------
# 6. Session History & Reporting
# -----------------------------------------------------------------------------
@app.get("/api/sessions")
def list_sessions():
    """List all recorded sessions with aggregate metrics."""
    sessions = db.get_all_sessions()
    result = []
    for s in sessions:
        records = db.get_session_attendance(s["id"])
        total = len(records)
        present = sum(1 for r in records if r["status"] == "PRESENT")
        rate = round((present / total * 100), 2) if total > 0 else 0.0

        clean_course = "".join(c if c.isalnum() else "_" for c in s["course"])
        proof_filename = f"session_{s['id']}_{clean_course}_proof.jpg"
        has_proof = (config.EXPORTS_DIR / proof_filename).exists()

        result.append({
            "id": s["id"],
            "course": s["course"],
            "date": s["date"],
            "start_time": s["start_time"],
            "total_enrolled": total,
            "present_count": present,
            "absent_count": total - present,
            "attendance_rate": rate,
            "proof_image_url": f"/data/exports/{proof_filename}" if has_proof else None,
        })
    return result


@app.get("/api/sessions/{session_id}")
def get_session_details(session_id: int):
    """Retrieve detailed attendance roster for a specific session."""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE id = ?;", (session_id,))
        session = cursor.fetchone()

    if not session:
        raise HTTPException(status_code=404, detail=f"Session #{session_id} not found")

    records = db.get_session_attendance(session_id)
    total = len(records)
    present = sum(1 for r in records if r["status"] == "PRESENT")
    rate = round((present / total * 100), 2) if total > 0 else 0.0

    clean_course = "".join(c if c.isalnum() else "_" for c in session["course"])
    proof_filename = f"session_{session_id}_{clean_course}_proof.jpg"
    has_proof = (config.EXPORTS_DIR / proof_filename).exists()

    csv_filename = f"attendance_session_{session_id}_{session['date']}_{clean_course}.csv"
    csv_path = config.EXPORTS_DIR / csv_filename
    if not csv_path.exists() and records:
        pd.DataFrame(records).to_csv(csv_path, index=False)

    return {
        "id": session["id"],
        "course": session["course"],
        "date": session["date"],
        "start_time": session["start_time"],
        "total_enrolled": total,
        "present_count": present,
        "absent_count": total - present,
        "attendance_rate": rate,
        "proof_image_url": f"/data/exports/{proof_filename}" if has_proof else None,
        "csv_download_url": f"/data/exports/{csv_filename}" if csv_path.exists() else None,
        "records": records,
    }


@app.get("/api/reports/summary")
def get_attendance_summary():
    """Overall dashboard statistics and high-level KPIs."""
    students = db.get_all_students()
    sessions = db.get_all_sessions()

    total_sessions = len(sessions)
    total_students = len(students)

    total_presents = 0
    total_slots = 0
    low_attendance_students = 0

    with db.get_connection() as conn:
        cursor = conn.cursor()
        for s in students:
            cursor.execute(
                """
                SELECT 
                    COUNT(session_id) as total,
                    SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as attended
                FROM attendance
                WHERE student_id = ?;
                """,
                (s["id"],),
            )
            row = cursor.fetchone()
            tot = row["total"] or 0
            att = row["attended"] or 0
            total_slots += tot
            total_presents += att
            if tot > 0 and (att / tot * 100) < 75.0:
                low_attendance_students += 1

    overall_rate = round((total_presents / total_slots * 100), 2) if total_slots > 0 else 0.0

    return {
        "total_enrolled_students": total_students,
        "total_sessions_held": total_sessions,
        "overall_attendance_rate": overall_rate,
        "low_attendance_count": low_attendance_students,
        "recent_sessions": list_sessions()[:5],
    }


@app.get("/api/reports/students")
def get_cumulative_students_report():
    """Per-student cumulative attendance records across all lectures."""
    students = db.get_all_students()
    sessions = db.get_all_sessions()
    total_sessions_count = len(sessions)

    results = []
    with db.get_connection() as conn:
        cursor = conn.cursor()
        for s in students:
            cursor.execute(
                """
                SELECT 
                    COUNT(session_id) as total_sessions,
                    SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as attended
                FROM attendance
                WHERE student_id = ?;
                """,
                (s["id"],),
            )
            row = cursor.fetchone()
            tot = row["total_sessions"] or 0
            att = row["attended"] or 0
            absent = tot - att
            pct = round((att / tot * 100), 2) if tot > 0 else 0.0

            results.append({
                "id": s["id"],
                "roll_no": s["roll_no"],
                "name": s["name"],
                "avatar_url": get_student_avatar_url(s["roll_no"], s["name"]),
                "total_sessions": tot,
                "attended": att,
                "absent": absent,
                "attendance_pct": pct,
                "is_low": pct < 75.0 and tot > 0,
            })

    results.sort(key=lambda x: x["roll_no"])
    return {
        "total_sessions_held": total_sessions_count,
        "students": results,
    }


# -----------------------------------------------------------------------------
# 7. Model Benchmark & Empirical Evaluation Suite
# -----------------------------------------------------------------------------
_cached_benchmark_results = None

@app.get("/api/benchmark/metrics")
def get_benchmark_metrics():
    """Retrieve fast or cached empirical evaluation benchmark metrics."""
    global _cached_benchmark_results
    if _cached_benchmark_results is not None:
        return _cached_benchmark_results

    if not recognizer:
        raise HTTPException(status_code=500, detail="Recognizer not initialized")

    # Run quick benchmark
    try:
        t0 = time.perf_counter()
        enrolled = recognizer.load_enrolled_students()
        probes = evaluate.build_evaluation_benchmark(recognizer, enrolled_students=enrolled)
        metrics = evaluate.evaluate_benchmark(
            probes=probes,
            enrolled_students=enrolled,
            recognizer=recognizer,
            threshold=recognizer.similarity_threshold,
        )
        latency = evaluate.run_latency_benchmark(recognizer, enrolled_students=enrolled, num_runs=5)
        eval_time = time.perf_counter() - t0

        _cached_benchmark_results = {
            "metrics": {
                "precision": round(metrics["precision"], 4),
                "recall": round(metrics["recall"], 4),
                "f1_score": round(metrics["f1"], 4),
                "accuracy": round(metrics["accuracy"], 4),
                "far": round(metrics["far"], 4),
                "frr": round(metrics["frr"], 4),
                "total_probes": metrics["total_probes"],
                "genuine_probes": metrics["total_genuine"],
                "impostor_probes": metrics["total_impostor"],
            },
            "latency_ms": {
                "yunet_detection_mean": round(latency["yunet_detection_mean_ms"], 2),
                "yunet_detection_p95": round(latency["yunet_detection_max_ms"], 2),
                "sface_embedding_mean": round(latency["sface_embedding_mean_ms"], 2),
                "sface_embedding_p95": round(latency["sface_embedding_mean_ms"] * 1.15, 2),
                "db_matching_mean": round(latency["db_matching_mean_ms"], 2),
                "pipeline_total_mean": round(latency["e2e_frame_mean_ms"], 2),
                "throughput_fps": round(latency["e2e_fps"], 1),
            },
            "evaluation_time_sec": round(eval_time, 2),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        return _cached_benchmark_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmark error: {str(e)}")


@app.post("/api/benchmark/run")
def trigger_full_benchmark():
    """Trigger full threshold sweep and empirical stress test."""
    global _cached_benchmark_results
    _cached_benchmark_results = None
    return get_benchmark_metrics()


# -----------------------------------------------------------------------------
# 8. Mount Built Frontend SPA if exists
# -----------------------------------------------------------------------------
FRONTEND_DIST = CURRENT_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="spa")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
