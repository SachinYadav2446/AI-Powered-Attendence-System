"""
Launch script for VisionAttend AI - Classroom Attendance System.

Starts the FastAPI server with the embedded high-performance React UI
and opens the default web browser automatically.
"""

import os
import sys
import webbrowser
import threading
import time
from pathlib import Path

# Ensure current directory is on python path
CURRENT_DIR = Path(__file__).resolve().parent
os.chdir(str(CURRENT_DIR))
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Configurable port (default 8080, can override via CLI arg: e.g. python run.py 8501)
DEFAULT_PORT = 8080
port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else int(os.environ.get("PORT", DEFAULT_PORT))

def open_browser():
    """Wait for server startup and launch browser."""
    time.sleep(2.0)
    webbrowser.open(f"http://127.0.0.1:{port}")

if __name__ == "__main__":
    print("=" * 70)
    print("  VisionAttend AI - Classroom Attendance System (YuNet + SFace)")
    print("=" * 70)
    print(f"Working Directory: {CURRENT_DIR}")
    print(f"Starting Web Application on Port: {port}")
    print(f"Access URL: http://127.0.0.1:{port}")
    print("Press Ctrl+C to terminate.")
    print("=" * 70)

    # Launch browser thread
    threading.Thread(target=open_browser, daemon=True).start()

    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
