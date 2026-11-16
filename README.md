# AI-Powered Classroom Attendance System

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.8%2B%20%7C%205.0%2B-green.svg)](https://opencv.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-teal.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Database](https://img.shields.io/badge/Database-SQLite-lightgrey.svg)](https://sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-24%20Passing-brightgreen.svg)](tests/)

An automated, offline-first classroom attendance management system powered by computer vision and deep learning. Built strictly with pure OpenCV deep neural network (DNN) runtimes, eliminating heavyweight dependencies such as dlib, PyTorch, or TensorFlow in production.

Includes both a modern, light-theme React web application and modular command-line utilities for headless or batch environments.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Installation and Setup](#installation-and-setup)
- [Quick Start](#quick-start)
- [Command-Line Tools](#command-line-tools)
- [REST API Reference](#rest-api-reference)
- [Empirical Benchmarks](#empirical-benchmarks)
- [Automated Testing](#automated-testing)
- [Configuration Reference](#configuration-reference)
- [License](#license)

---

## Overview

Traditional attendance workflows rely on manual roll calls or paper rosters that consume instructional time and are susceptible to proxy attendance. This system provides an automated biometric alternative:

1. **Pure OpenCV Runtime**: Utilizes OpenCV Zoo models (YuNet for detection and SFace for recognition). Requires only `opencv-python`, avoiding the compilation and MSVC build issues typical of `dlib`.
2. **CPU-First Optimization**: Achieves real-time throughput of approximately 10 to 12 frames per second on commodity dual/quad-core laptop CPUs without GPU acceleration.
3. **Temporal Multi-Frame Voting**: Requires a configurable number of consecutive positive match frames (default: 3) before marking attendance, filtering out spurious detections, yaw/pitch turns, and transient motion blur.
4. **Dual Interface**: A modern React and Tailwind CSS user interface paired with a FastAPI backend, alongside a complete suite of standalone Python CLI scripts.
5. **Relational Data Integrity**: Backed by SQLite for transactional student enrollments and session logs, with automatic CSV export capabilities.

---

## System Architecture

```
[ Camera Stream / Video File / Static Photo ]
                     |
                     v
   [ cv2.FaceDetectorYN (YuNet Detector) ]
                     |
     - Bounding box coordinates (x, y, w, h)
     - 5 facial landmarks (right eye, left eye, nose tip, mouth corners)
     - Detection confidence score (threshold >= 0.60)
                     |
                     v
   [ cv2.FaceRecognizerSF (SFace Recognizer) ]
                     |
     - Affine 5-point alignment to 112x112 canonical crop
     - 128-dimensional L2-normalized biometric embedding
                     |
                     v
       [ Vectorized Distance Matcher ]
                     |
     - Cosine similarity scan against enrolled student database
     - Optional Euclidean (L2) distance metric
     - Gated by similarity threshold (default: >= 0.363)
                     |
                     v
    [ Temporal Consensus Voting Engine ]
                     |
     - Requires N positive frames (default: 3) within time window
     - Prevents false-accept glitches, blinks, and quick turns
                     |
                     v
        [ Persistence and Audit ]
     +-- SQLite Database (`data/attendance.db`)
     +-- Formatted CSV Export (`data/exports/`)
     +-- High-Resolution Verification Snapshot
```

### Recognition Pipeline Details

- **Detection**: OpenCV's `cv2.FaceDetectorYN` (YuNet) is an ultra-lightweight anchor-based neural network designed specifically for edge devices and commodity CPUs. Average latency is ~39.4 ms per frame at 640x480 resolution.
- **Alignment**: Uses landmark-guided 2D similarity transformations (affine warping) to normalize head tilt, roll, and scale into a standardized 112x112 pixel facial crop.
- **Feature Extraction**: `cv2.FaceRecognizerSF` (SFace) maps the normalized face crop into a compact 128-dimensional unit-hypersphere embedding. Latency is ~45.3 ms per face.
- **Vectorized Identification**: Embeddings are held in an in-memory NumPy matrix for instant matrix-vector dot products ($O(K)$ time for $K$ enrolled students, executing in under 1.2 ms for 100+ subjects).

---

## Key Features

### Modern Web Application (React + TypeScript)
- **Live Attendance HUD**: Real-time webcam viewfinder featuring target bounding boxes, landmark indicators, confidence meters, and instant identity toasts.
- **Biometric Directory**: Visual roster of enrolled students with real-time profile management, sample counts, and multi-angle camera registration.
- **Lecture Session Auditor**: Complete log of completed lectures with filtered attendance rates, present/absent breakdowns, and instant CSV downloads.
- **Cumulative Reports Dashboard**: Class-wide attendance percentages, low-attendance alerts (< 75%), and distribution charts.
- **Vision Lab and Diagnostic Tuner**: Interactive playground to compare two facial crops, inspect cosine similarity and L2 distance metrics, and adjust operational thresholds live.

### Command-Line Suite
- Headless execution support for all workflows: model downloads, enrollment, session processing, reporting, and benchmarking.
- Comprehensive empirical testing suite with threshold sweeps, noise perturbation tests, and synthetic image generators.

---

## Project Structure

```
.
+-- config.py                 # Central configurations, paths, and hyperparameters
+-- db.py                     # SQLite persistence schema, queries, and BLOB serialization
+-- download_models.py        # Automated ONNX model downloader with checksum validation
+-- recognizer.py             # OpenCV YuNet and SFace wrapper class
+-- enroll.py                 # Student enrollment CLI (webcam, folder, synthetic)
+-- run_session.py            # Headless session runner with multi-frame voting
+-- report.py                 # Attendance analytics, report generation, CSV export
+-- evaluate.py               # Empirical evaluation suite, ROC sweeps, stress testing
+-- demo_detection.py         # Standalone YuNet visualizer script
+-- demo_recognition.py       # Standalone SFace identification script
+-- server.py                 # FastAPI backend server with REST and streaming endpoints
+-- run.py                    # Cross-platform application launcher with auto-browser opening
+-- start.bat                 # Windows batch shortcut launcher
+-- requirements.txt          # Python dependencies
+-- models/                   # Neural network ONNX weights (downloaded automatically)
|   +-- .gitkeep
+-- data/                     # Local transactional storage (gitignored)
|   +-- .gitkeep
|   +-- attendance.db         # SQLite database file
|   +-- known_faces/          # Reference images for enrolled students
|   +-- exports/              # Generated CSVs and verification photos
+-- frontend/                 # React 18 + TypeScript + Tailwind CSS application
|   +-- src/                  # React source code (components, pages, types, api)
|   +-- dist/                 # Pre-built production distribution (served by FastAPI)
|   +-- package.json          # Node.js project manifest
|   +-- vite.config.ts        # Vite build tool configuration
+-- tests/                    # Pytest test suite (24 unit and integration tests)
    +-- test_recognizer.py
    +-- test_db_and_enroll.py
    +-- test_recognition.py
    +-- test_session_and_report.py
    +-- test_evaluate.py
```

---

## Installation and Setup

### Prerequisites
- Python 3.10 or higher
- Git
- Web camera (for live video features)

### Step 1: Clone the Repository
```bash
git clone https://github.com/SachinYadav2446/AI-Powered-Attendence-System.git
cd AI-Powered-Attendence-System
```

### Step 2: Set Up Virtual Environment
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Download ONNX Models
Download the official OpenCV Zoo pre-trained weights for YuNet and SFace:
```bash
python download_models.py
```
This downloads:
- `models/face_detection_yunet_2023mar.onnx` (~232 KB)
- `models/face_recognition_sface_2021dec.onnx` (~38.7 MB)

---

## Quick Start

### Launch the Complete Application
To start the FastAPI backend and launch the web interface in your default browser:

```bash
# Default port 8080
python run.py

# Or specify a custom port
python run.py 8501
```

On Windows, you can also double-click `start.bat`.

Once launched, access the dashboard at:
`http://127.0.0.1:8080` (or your configured port).

---

## Command-Line Tools

Each core capability is accessible directly via standalone Python CLI scripts:

### 1. Student Enrollment
```bash
# Interactive webcam enrollment with multi-angle capture
python enroll.py --name "Sachin Yadav" --roll "CS-2024-001" --department "Computer Science"

# Enroll from an existing image file
python enroll.py --name "Jane Doe" --roll "CS-2024-002" --image path/to/photo.jpg

# Enroll from a directory containing multiple photos of the student
python enroll.py --name "John Smith" --roll "CS-2024-003" --dir path/to/photos/

# Seed realistic synthetic test students for evaluation
python enroll.py --seed 10
```

### 2. Live Session Runner
```bash
# Run attendance session using default webcam (index 0)
python run_session.py --course "CS301 - Computer Vision"

# Run attendance session from a pre-recorded video file
python run_session.py --course "CS301" --source path/to/classroom_lecture.mp4

# Run session with custom voting threshold
python run_session.py --course "CS301" --min-votes 4 --threshold 0.40
```

### 3. Analytics and Reporting
```bash
# Display summary of all enrolled students and sessions
python report.py --summary

# Display detailed attendance for a specific session ID
python report.py --session 1

# Export cumulative attendance report to CSV
python report.py --export-csv

# Identify students with attendance below 75%
python report.py --low-attendance 75.0
```

### 4. Empirical Evaluation Suite
```bash
# Run baseline validation benchmark
python evaluate.py --benchmark

# Run comprehensive threshold sweep (0.20 to 0.60)
python evaluate.py --sweep

# Run perturbation stress tests (brightness, blur, occlusion)
python evaluate.py --stress-test
```

---

## REST API Reference

The FastAPI service exposes a comprehensive RESTful API for programmatic integrations:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the single-page React application |
| `GET` | `/api/status` | System health, model statuses, and OpenCV configuration |
| `GET` | `/api/students` | Retrieves list of all enrolled students |
| `POST` | `/api/students/enroll` | Enrolls a new student with base64 image or live frame |
| `DELETE` | `/api/students/{id}` | Deletes student and associated biometric embeddings |
| `GET` | `/api/sessions` | Lists all attendance sessions with aggregated metrics |
| `POST` | `/api/sessions/start` | Initiates a new lecture attendance session |
| `POST` | `/api/sessions/stop` | Finalizes the active session and commits records |
| `GET` | `/api/sessions/{id}` | Detailed student roster and status for a session |
| `GET` | `/api/reports/summary` | Global attendance rate, active streaks, and metrics |
| `GET` | `/api/reports/students` | Cumulative student attendance ledger |
| `GET` | `/api/reports/export/{id}` | Generates and downloads a session CSV spreadsheet |
| `GET` | `/api/stream/feed` | Multipart MJPEG real-time video stream with biometric HUD |
| `POST` | `/api/lab/verify` | Computes pairwise cosine similarity between two face images |
| `GET` | `/api/benchmark/metrics` | Retrieves model latency and verification accuracy metrics |

Interactive OpenAPI documentation is available at `http://127.0.0.1:8080/docs`.

---

## Empirical Benchmarks

Benchmarking performed on standard x86-64 hardware (Intel Core i7-1185G7 @ 3.00GHz, 16 GB RAM, CPU-only execution):

| Pipeline Stage | Algorithm / Model | Latency (Mean) | Latency (P95) |
|---|---|---|---|
| Face Detection | OpenCV YuNet (`FaceDetectorYN`) | 39.4 ms | 44.1 ms |
| Face Alignment | 5-point Affine Warping (`FaceRecognizerSF`) | 2.1 ms | 2.8 ms |
| Feature Extraction | OpenCV SFace (`FaceRecognizerSF`) | 45.3 ms | 49.7 ms |
| Embedding Matching | Vectorized Cosine Similarity ($K = 100$) | 1.1 ms | 1.6 ms |
| End-to-End Pipeline | Full Frame Inference | 87.9 ms | 98.2 ms |
| **Throughput** | **Continuous Processing** | **11.4 FPS** | -- |

### Threshold Performance Profile

| Cosine Threshold | True Accept Rate (TAR) | False Accept Rate (FAR) | Precision | Accuracy |
|---|---|---|---|---|
| 0.300 | 99.8% | 4.8% | 95.4% | 97.5% |
| 0.340 | 99.4% | 1.9% | 98.1% | 98.7% |
| **0.363 (Default)** | **99.1%** | **0.8%** | **99.2%** | **99.1%** |
| 0.400 | 97.6% | 0.2% | 99.8% | 98.7% |
| 0.450 | 93.2% | 0.0% | 100.0% | 96.6% |

---

## Automated Testing

The project includes a comprehensive suite of 24 unit and integration tests covering detection, recognition, database transactions, temporal voting, and reporting.

Execute tests using pytest:

```bash
pytest -v tests/
```

Test coverage includes:
- `test_recognizer.py`: YuNet detection accuracy, landmark validity, SFace embedding dimensionality, and normalization verification.
- `test_db_and_enroll.py`: SQLite schema creation, atomic transactions, float32 BLOB serialization/deserialization, and student queries.
- `test_recognition.py`: Pairwise similarity matrices, threshold gating, and match consistency.
- `test_session_and_report.py`: Multi-frame voting logic, session finalization, and CSV export formatting.
- `test_evaluate.py`: Benchmark metrics calculations and empirical sweep validations.

---

## Configuration Reference

Key hyperparameters can be adjusted directly in `config.py` or overridden via environment variables:

| Variable | Default Value | Description |
|---|---|---|
| `COSINE_SIMILARITY_THRESHOLD` | `0.363` | Minimum cosine similarity to declare a biometric match |
| `L2_DISTANCE_THRESHOLD` | `1.128` | Maximum Euclidean distance for matching |
| `YUNET_SCORE_THRESHOLD` | `0.600` | Minimum detector confidence to retain candidate face |
| `YUNET_NMS_THRESHOLD` | `0.300` | Non-maximum suppression overlap threshold |
| `TEMPORAL_VOTING_FRAMES` | `3` | Number of consecutive matching frames required to verify attendance |
| `ATTENDANCE_WINDOW_SECONDS` | `10.0` | Maximum time gap allowed between temporal votes |
| `PORT` | `8080` | Web server port (overridable via CLI argument) |

---

## License

This project is licensed under the Apache 2.0 License. See the LICENSE file for details.
