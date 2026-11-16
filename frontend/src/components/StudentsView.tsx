import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Trash2,
  Sparkles,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  RefreshCw,
  Eye,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../api';
import type { Student } from '../types';

interface StudentsViewProps {
  onStudentsChanged?: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({ onStudentsChanged }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Enrollment Modal State
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollMode, setEnrollMode] = useState<'webcam' | 'upload'>('webcam');
  const [newRollNo, setNewRollNo] = useState('');
  const [newName, setNewName] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(true);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Webcam Capture State for Enrollment
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);

  // Photo Inspection Modal
  const [inspectStudent, setInspectStudent] = useState<Student | null>(null);

  const poses = [
    'Look straight directly at camera',
    'Turn head slightly to the left',
    'Turn head slightly to the right',
    'Tilt head slightly upwards',
    'Natural expression / gentle smile',
  ];

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await api.getStudents();
      setStudents(data);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load students roster');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedStudents = async () => {
    if (!confirm('Bootstrap 10 realistic sample students with biometric embeddings for testing?')) {
      return;
    }
    setSeeding(true);
    try {
      await api.seedStudents(10);
      await loadStudents();
      onStudentsChanged?.();
      confetti({ particleCount: 70, spread: 60 });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to seed sample students');
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (rollNo: string, name: string) => {
    if (!confirm(`Are you sure you want to delete student '${name}' (${rollNo}) and their records?`)) {
      return;
    }
    try {
      await api.deleteStudent(rollNo);
      await loadStudents();
      onStudentsChanged?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete student');
    }
  };

  // Start webcam for enrollment
  useEffect(() => {
    if (enrollModalOpen && enrollMode === 'webcam') {
      startEnrollCamera();
    } else {
      stopEnrollCamera();
    }
    return () => {
      stopEnrollCamera();
    };
  }, [enrollModalOpen, enrollMode]);

  const startEnrollCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.error('Camera error during enrollment:', e);
    }
  };

  const stopEnrollCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const captureEnrollShot = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL('image/jpeg', 0.85);

    setCapturedFrames((prev) => [...prev, b64]);
    setCurrentPoseIndex((prev) => (prev + 1) % poses.length);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCapturedFrames((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const submitEnrollment = async () => {
    if (!newRollNo.trim() || !newName.trim()) {
      setErrorMsg('Roll number and full name are required');
      return;
    }
    if (capturedFrames.length === 0) {
      setErrorMsg('Please capture or upload at least 1 photo for biometric embedding extraction');
      return;
    }
    if (!consentAgreed) {
      setErrorMsg('Biometric consent must be acknowledged to proceed with local enrollment');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.enrollStudent({
        roll_no: newRollNo.trim(),
        name: newName.trim(),
        frames: capturedFrames,
        force: forceOverwrite,
      });

      confetti({ particleCount: 75, spread: 70 });
      setEnrollModalOpen(false);
      setNewRollNo('');
      setNewName('');
      setCapturedFrames([]);
      await loadStudents();
      onStudentsChanged?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Biometric enrollment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Students Biometric Directory</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                {students.length} Enrolled
              </span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Store 128-dimensional mathematical feature vectors locally in SQLite. Pure offline privacy.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSeedStudents}
              disabled={seeding}
              className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 text-sm font-semibold transition flex items-center space-x-2 cursor-pointer shadow-xs"
            >
              {seeding ? (
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
              ) : (
                <Sparkles className="h-4 w-4 text-indigo-600" />
              )}
              <span>Seed 10 Sample Students</span>
            </button>

            <button
              onClick={() => {
                setCapturedFrames([]);
                setEnrollModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition shadow-sm flex items-center space-x-2 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Enroll New Student</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student roll number (e.g. CS101) or full name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 placeholder-slate-400 font-medium"
          />
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Students Grid */}
      {loading ? (
        <div className="glass-panel p-16 rounded-2xl bg-white border border-slate-200 text-center shadow-xs">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading student biometrics...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl bg-white border border-slate-200 text-center shadow-xs">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No students found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'No enrolled student matches your search query.'
              : 'The biometric database is currently empty. Click "Seed 10 Sample Students" or enroll someone via webcam!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredStudents.map((student) => (
            <div
              key={student.roll_no}
              className="glass-card p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center space-x-3">
                  {student.avatar_url ? (
                    <img
                      src={student.avatar_url}
                      alt={student.name}
                      className="h-12 w-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                      {student.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-sm text-slate-900 truncate">{student.name}</h4>
                    <span className="text-xs font-mono font-semibold text-indigo-600">{student.roll_no}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Biometrics</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[11px] font-semibold">
                    {student.embeddings_count} vectors
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {new Date(student.enrolled_at).toLocaleDateString()}
                </span>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={async () => {
                      const full = await api.getStudent(student.roll_no);
                      setInspectStudent(full);
                    }}
                    title="View details & photos"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(student.roll_no, student.name)}
                    title="Delete student"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enrollment Slide-over / Modal - Anchored Buttons Always Visible */}
      {enrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Enroll New Student Identity</h3>
                  <p className="text-xs text-slate-500">
                    Captures 5-10 varied angles to build an invariant multi-embedding profile.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Inputs: Roll & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Roll Number / Student ID</label>
                  <input
                    type="text"
                    value={newRollNo}
                    onChange={(e) => setNewRollNo(e.target.value.toUpperCase())}
                    placeholder="e.g. CS111"
                    className="w-full px-3.5 py-2 rounded-lg glass-input text-sm text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Devesh Singh"
                    className="w-full px-3.5 py-2 rounded-lg glass-input text-sm text-slate-900 font-medium"
                  />
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setEnrollMode('webcam')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    enrollMode === 'webcam'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Webcam Capture</span>
                </button>
                <button
                  onClick={() => setEnrollMode('upload')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    enrollMode === 'upload'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Photos</span>
                </button>
              </div>

              {/* Camera / Upload Section */}
              {enrollMode === 'webcam' ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />

                    {/* Pose guidance overlay banner */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-slate-900/90 text-indigo-300 border border-indigo-400/40 text-xs font-semibold backdrop-blur-md">
                        Prompt: {poses[currentPoseIndex]}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-900/90 text-slate-300 border border-slate-700 text-xs font-mono">
                        {capturedFrames.length} captured
                      </span>
                    </div>

                    <div className="absolute bottom-3 flex items-center space-x-3">
                      <button
                        onClick={captureEnrollShot}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-md flex items-center space-x-2 cursor-pointer"
                      >
                        <Camera className="h-4 w-4" />
                        <span>Take Photo ({capturedFrames.length}/5)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-8 text-center bg-slate-50/70">
                  <Upload className="h-10 w-10 text-indigo-500 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-slate-800 block">Upload 1 to 10 Face Photos</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Ensure exactly one face per image for successful alignment.
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="mt-3 text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
              )}

              {/* Captured Photos Strip */}
              {capturedFrames.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Captured Photos ({capturedFrames.length})
                    </span>
                    <button
                      onClick={() => setCapturedFrames([])}
                      className="text-[11px] text-rose-600 hover:underline cursor-pointer font-semibold"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex space-x-2 overflow-x-auto pb-2">
                    {capturedFrames.map((frame, idx) => (
                      <div key={idx} className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                        <img src={frame} alt={`Capture ${idx}`} className="h-full w-full object-cover" />
                        <button
                          onClick={() => setCapturedFrames((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-slate-900/80 text-white cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Informed Consent Disclosure Notice */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-700 font-bold">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Biometric Informed Consent &amp; Privacy Guarantee</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  By enrolling, you consent to computing and storing 128-dimensional biometric embeddings in your local
                  SQLite database (`data/attendance.db`). No raw photos or features are ever transmitted to external servers.
                </p>
                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentAgreed}
                      onChange={(e) => setConsentAgreed(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold">I confirm student consent for local biometric verification</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceOverwrite}
                      onChange={(e) => setForceOverwrite(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-[11px]">Overwrite if student roll number already exists</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Pinned Bottom Action Bar: Always Fully Visible */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3 flex-shrink-0">
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                onClick={submitEnrollment}
                disabled={isSubmitting || capturedFrames.length === 0 || !consentAgreed}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-sm ${
                  isSubmitting || capturedFrames.length === 0 || !consentAgreed
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    <span>Extracting Embeddings...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Complete Enrollment ({capturedFrames.length} photos)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Student Photos Drawer / Modal */}
      {inspectStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[85vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-center space-x-3">
                {inspectStudent.avatar_url ? (
                  <img
                    src={inspectStudent.avatar_url}
                    alt={inspectStudent.name}
                    className="h-10 w-10 rounded-xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                    {inspectStudent.name.slice(0, 2)}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{inspectStudent.name}</h3>
                  <span className="text-xs font-mono font-bold text-indigo-600">{inspectStudent.roll_no}</span>
                </div>
              </div>
              <button
                onClick={() => setInspectStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between text-xs p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-600 font-medium">Total Biometric Embeddings</span>
                <span className="font-mono text-indigo-600 font-bold">{inspectStudent.embeddings_count} vectors</span>
              </div>

              {inspectStudent.photos && inspectStudent.photos.length > 0 ? (
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-2">Stored Reference Photos:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {inspectStudent.photos.map((photo, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-xs">
                        <img src={photo} alt="Stored biometric shot" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No raw photo files saved for this identity.</p>
              )}
            </div>

            {/* Pinned Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end flex-shrink-0">
              <button
                onClick={() => setInspectStudent(null)}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
