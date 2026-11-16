import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Play,
  Square,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Users,
  Eye,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../api';
import type { SessionDetails } from '../types';

interface LiveAttendanceViewProps {
  onSessionRecorded?: () => void;
}

export const LiveAttendanceView: React.FC<LiveAttendanceViewProps> = ({ onSessionRecorded }) => {
  const [mode, setMode] = useState<'webcam' | 'photo'>('webcam');
  const [course, setCourse] = useState('CS-301 Computer Vision');
  const [minFrames, setMinFrames] = useState(3);
  const [durationSec, setDurationSec] = useState(15);

  // Live Webcam State
  const [isScanning, setIsScanning] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [frameCount, setFrameCount] = useState(0);

  // Classroom Photo State
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [upscaleFactor, setUpscaleFactor] = useState(1.0);
  const [tileSize, setTileSize] = useState<number | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Completed Session Result Modal
  const [completedSession, setCompletedSession] = useState<SessionDetails | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);

  // Start / Stop Camera Stream
  useEffect(() => {
    if (mode === 'webcam') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (scanLoopRef.current) clearTimeout(scanLoopRef.current);
    };
  }, [mode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg('Could not access camera. Please check permissions or upload a classroom photo.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Capture frame from video element
  const captureFrameBase64 = (): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // Start Live Scanning Session
  const handleStartSession = async () => {
    if (!course.trim()) {
      setErrorMsg('Please specify a course name');
      return;
    }

    try {
      setErrorMsg(null);
      const initRes = await api.startLiveSession(course, minFrames, durationSec);
      const token = initRes.session_token;
      setSessionToken(token);
      setIsScanning(true);
      isScanningRef.current = true;
      setTimeLeft(durationSec);
      setTally({});
      setFrameCount(0);
      setAnnotatedFrame(null);

      // Countdown timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleCommitSession(token);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Frame sending loop
      const runLoop = async () => {
        if (!isScanningRef.current) return;

        const frameB64 = captureFrameBase64();
        if (frameB64) {
          try {
            const frameRes = await api.sendLiveFrame(token, frameB64);
            setAnnotatedFrame(frameRes.annotated_frame);
            setTally(frameRes.cumulative_seen);
            setFrameCount(frameRes.frame_index);
          } catch (e) {
            console.error('Frame error:', e);
          }
        }

        if (isScanningRef.current) {
          scanLoopRef.current = window.setTimeout(runLoop, 200);
        }
      };

      runLoop();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start session');
      setIsScanning(false);
      isScanningRef.current = false;
    }
  };

  // Commit & Finalize Live Session
  const handleCommitSession = async (tokenOverride?: string) => {
    const token = tokenOverride || sessionToken;
    if (!token) return;

    isScanningRef.current = false;
    setIsScanning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (scanLoopRef.current) clearTimeout(scanLoopRef.current);

    try {
      const summary = await api.commitLiveSession(token);
      setCompletedSession(summary);
      setSessionToken(null);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      onSessionRecorded?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit attendance session');
    }
  };

  // Photo Upload Handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleProcessPhoto = async () => {
    if (!selectedPhoto) {
      setErrorMsg('Please select a photo first');
      return;
    }
    if (!course.trim()) {
      setErrorMsg('Please enter a course name');
      return;
    }

    setIsProcessingPhoto(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('course', course);
      formData.append('image', selectedPhoto);
      formData.append('upscale_factor', upscaleFactor.toString());
      if (tileSize) {
        formData.append('tile_size', tileSize.toString());
      }

      const summary = await api.createSessionFromImage(formData);
      setCompletedSession(summary);
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
      });
      onSessionRecorded?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process classroom image');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Mode Switcher */}
      <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Attendance Scanner</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                Temporal Voting Engine
              </span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Multi-frame verification filters blinks, head turns, motion blur, and ensures authentic classroom attendance.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              onClick={() => {
                if (isScanning) handleCommitSession();
                setMode('webcam');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                mode === 'webcam'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>Live Webcam Scan</span>
            </button>
            <button
              onClick={() => {
                if (isScanning) handleCommitSession();
                setMode('photo');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                mode === 'photo'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="h-4 w-4" />
              <span>Classroom Photo</span>
            </button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Course / Lecture Name</label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g. CS-301 Computer Vision"
              disabled={isScanning}
              className="w-full px-3.5 py-2 rounded-lg glass-input text-sm text-slate-900 font-medium"
            />
          </div>

          {mode === 'webcam' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Scan Duration ({durationSec}s)
                </label>
                <select
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  disabled={isScanning}
                  className="w-full px-3.5 py-2 rounded-lg glass-input text-sm text-slate-900 font-medium cursor-pointer"
                >
                  <option value={10}>10 Seconds (Quick Scan)</option>
                  <option value={15}>15 Seconds (Recommended)</option>
                  <option value={20}>20 Seconds (Thorough Scan)</option>
                  <option value={30}>30 Seconds (Large Class)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Min Frames Required (N &ge; {minFrames})
                </label>
                <select
                  value={minFrames}
                  onChange={(e) => setMinFrames(Number(e.target.value))}
                  disabled={isScanning}
                  className="w-full px-3.5 py-2 rounded-lg glass-input text-sm text-slate-900 font-medium cursor-pointer"
                >
                  <option value={2}>2 Frames (Fast)</option>
                  <option value={3}>3 Frames (Standard Recommended)</option>
                  <option value={5}>5 Frames (Strict Verification)</option>
                </select>
              </div>

              <div className="flex items-end">
                {!isScanning ? (
                  <button
                    onClick={handleStartSession}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-sm cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-white" />
                    <span>Start Attendance Scan</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleCommitSession()}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition shadow-sm cursor-pointer"
                  >
                    <Square className="h-4 w-4 fill-white" />
                    <span>Finish &amp; Save ({timeLeft}s)</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Resolution Upscaling ({upscaleFactor}x)
                </label>
                <select
                  value={upscaleFactor}
                  onChange={(e) => setUpscaleFactor(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg glass-input text-sm text-slate-900 font-medium cursor-pointer"
                >
                  <option value={1.0}>1.0x (Standard Resolution)</option>
                  <option value={1.5}>1.5x (Better for Back Rows)</option>
                  <option value={2.0}>2.0x (4K Ultra-High Res)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tiling Mode (Lecture Hall)</label>
                <select
                  value={tileSize ?? ''}
                  onChange={(e) => setTileSize(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2 rounded-lg glass-input text-sm text-slate-900 font-medium cursor-pointer"
                >
                  <option value="">Disabled (Direct Full Frame)</option>
                  <option value="640">640px Overlapping Grid</option>
                  <option value="960">960px Large Grid</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleProcessPhoto}
                  disabled={!selectedPhoto || isProcessingPhoto}
                  className={`w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-semibold text-sm transition shadow-sm cursor-pointer ${
                    selectedPhoto && !isProcessingPhoto
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isProcessingPhoto ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      <span>Scanning Faces...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Process &amp; Record</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main View Area: Camera + Real-Time HUD */}
      {mode === 'webcam' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Stream & HUD */}
          <div className="lg:col-span-2 glass-panel p-4 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden shadow-xs">
            <div className="w-full relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${isScanning && annotatedFrame ? 'hidden' : 'block'}`}
              />

              {isScanning && annotatedFrame && (
                <img
                  src={annotatedFrame}
                  alt="Live Biometric Detection HUD"
                  className="w-full h-full object-cover block"
                />
              )}

              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning status banner */}
              {isScanning && (
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-indigo-400/50 text-indigo-300 text-xs font-semibold backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping"></span>
                    <span>LIVE SCANNING (Frame #{frameCount})</span>
                  </div>

                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-emerald-400/50 text-emerald-300 text-xs font-semibold backdrop-blur-md">
                    <span>Remaining: {timeLeft}s</span>
                  </div>
                </div>
              )}

              {!isScanning && (
                <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-md bg-slate-900/85 text-slate-300 text-xs border border-slate-700 pointer-events-none">
                  Camera Feed Ready &bull; Press &quot;Start Attendance Scan&quot;
                </div>
              )}
            </div>
          </div>

          {/* Real-time Tally and Recognized Students Drawer */}
          <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 flex flex-col h-[480px] shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center space-x-2">
                <Users className="h-4 w-4 text-indigo-600" />
                <span>Real-Time Tally</span>
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                Goal: &ge; {minFrames} frames
              </span>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-2.5 pr-1">
              {Object.keys(tally).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4">
                  <Eye className="h-8 w-8 mb-2 stroke-1 text-slate-300" />
                  <p className="text-xs font-medium text-slate-600">No students recognized yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Start scan and position faces in front of the camera.
                  </p>
                </div>
              ) : (
                Object.entries(tally).map(([roll, count]) => {
                  const isPresent = count >= minFrames;
                  return (
                    <div
                      key={roll}
                      className={`p-3 rounded-xl border transition flex items-center justify-between ${
                        isPresent
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{roll}</span>
                          {isPresent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                              PRESENT
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isPresent ? 'bg-emerald-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${Math.min(100, (count / minFrames) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {count}/{minFrames} frames
                          </span>
                        </div>
                      </div>

                      {isPresent ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <div className="text-xs text-slate-400 font-mono">verifying...</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {isScanning && (
              <div className="pt-3 border-t border-slate-200 mt-auto">
                <button
                  onClick={() => handleCommitSession()}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
                >
                  Commit Attendance Now
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Classroom Photo Mode */
        <div className="glass-panel p-8 rounded-2xl bg-white border border-slate-200 text-center shadow-xs">
          {!photoPreview ? (
            <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50/70 hover:bg-slate-50">
              <Upload className="h-12 w-12 text-indigo-500 mb-3" />
              <span className="text-base font-semibold text-slate-900">Click or drag &amp; drop a classroom photo</span>
              <span className="text-xs text-slate-500 mt-1 max-w-sm">
                Supports group snapshots, lecture halls, or batch attendance test images (JPG, PNG).
              </span>
              <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            </label>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative max-h-96 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img src={photoPreview} alt="Classroom upload preview" className="max-h-96 w-auto object-contain" />
                <button
                  onClick={() => {
                    setSelectedPhoto(null);
                    setPhotoPreview(null);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleProcessPhoto}
                  disabled={isProcessingPhoto}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-sm flex items-center space-x-2 cursor-pointer"
                >
                  {isProcessingPhoto ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      <span>Detecting &amp; Matching Faces...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Process This Photo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed Session Modal - Fully Visible Anchored Buttons */}
      {completedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Attendance Recorded Successfully!</h3>
                  <p className="text-xs text-slate-500">
                    Session #{completedSession.session_id || completedSession.id} &bull; {completedSession.course}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCompletedSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-xs font-medium text-slate-500">Total Enrolled</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">{completedSession.total_enrolled}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-xs font-semibold text-emerald-700">Present</div>
                  <div className="text-xl font-bold text-emerald-700 mt-0.5">{completedSession.present_count}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                  <div className="text-xs font-semibold text-indigo-700">Attendance Rate</div>
                  <div className="text-xl font-bold text-indigo-700 mt-0.5">
                    {completedSession.attendance_pct ?? completedSession.attendance_rate}%
                  </div>
                </div>
              </div>

              {/* Proof Image Preview */}
              {completedSession.proof_image_url && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">Biometric Proof Snapshot</span>
                    <button
                      onClick={() => setProofModalOpen(true)}
                      className="text-xs text-indigo-600 hover:underline flex items-center space-x-1 cursor-pointer font-medium"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Full Resolution</span>
                    </button>
                  </div>
                  <div
                    onClick={() => setProofModalOpen(true)}
                    className="rounded-xl overflow-hidden border border-slate-200 max-h-40 bg-slate-100 cursor-pointer group relative shadow-xs"
                  >
                    <img
                      src={completedSession.proof_image_url}
                      alt="Proof Snapshot"
                      className="w-full h-40 object-cover group-hover:scale-102 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-lg bg-white/95 text-slate-900 text-xs font-semibold shadow-md">
                        Click to Zoom Proof
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Roster Table */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1.5">Student Verification Roster</span>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Roll No</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Frames</th>
                        <th className="py-2.5 px-3">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {completedSession.records.map((r) => (
                        <tr key={r.roll_no} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{r.roll_no}</td>
                          <td className="py-2 px-3 text-slate-700 font-medium">{r.name}</td>
                          <td className="py-2 px-3">
                            {r.status === 'PRESENT' ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                PRESENT
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                ABSENT
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-medium">{r.frames_seen}</td>
                          <td className="py-2 px-3 text-slate-600 font-mono">{(r.confidence * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Sticky/Pinned Footer: Buttons are ALWAYS visible */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3 flex-shrink-0">
              {completedSession.csv_download_url && (
                <a
                  href={completedSession.csv_download_url}
                  download
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-300 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Download CSV Log</span>
                </a>
              )}
              <button
                onClick={() => setCompletedSession(null)}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
              >
                Close &amp; Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Proof Image Modal */}
      {proofModalOpen && completedSession?.proof_image_url && (
        <div
          onClick={() => setProofModalOpen(false)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden border border-slate-300 bg-white shadow-2xl p-2">
            <img
              src={completedSession.proof_image_url}
              alt="High-Res Biometric Proof"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
            />
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setProofModalOpen(false)}
                className="p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 border border-slate-700 cursor-pointer shadow-md"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
