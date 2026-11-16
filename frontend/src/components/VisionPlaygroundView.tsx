import React, { useState } from 'react';
import {
  Eye,
  Sliders,
  CheckCircle2,
  XCircle,
  Upload,
  Layers,
  Fingerprint,
} from 'lucide-react';
import { api } from '../api';
import type {
  VisionDetectionResponse,
  VisionRecognitionResponse,
  VisionCompareResponse,
} from '../types';

export const VisionPlaygroundView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'detect' | 'recognize' | 'compare'>('detect');

  // Detection Tab State
  const [detectImg, setDetectImg] = useState<string | null>(null);
  const [scoreThresh, setScoreThresh] = useState(0.9);
  const [detectResult, setDetectResult] = useState<VisionDetectionResponse | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Recognition Tab State
  const [recogImg, setRecogImg] = useState<string | null>(null);
  const [simThresh, setSimThresh] = useState(0.363);
  const [recogResult, setRecogResult] = useState<VisionRecognitionResponse | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Compare Tab State
  const [compareImgA, setCompareImgA] = useState<string | null>(null);
  const [compareImgB, setCompareImgB] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<VisionCompareResponse | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Image Upload helper
  const handleImageFile = (file: File, setter: (b64: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Run Detection
  const runDetection = async (imgB64?: string) => {
    const target = imgB64 || detectImg;
    if (!target) return;
    setIsDetecting(true);
    setErrorMsg(null);
    try {
      const res = await api.detectFaces(target, scoreThresh);
      setDetectResult(res);
    } catch (e: any) {
      setErrorMsg(e.message || 'Detection failed');
    } finally {
      setIsDetecting(false);
    }
  };

  // Run Recognition
  const runRecognition = async (imgB64?: string) => {
    const target = imgB64 || recogImg;
    if (!target) return;
    setIsRecognizing(true);
    setErrorMsg(null);
    try {
      const res = await api.recognizeFaces(target, simThresh);
      setRecogResult(res);
    } catch (e: any) {
      setErrorMsg(e.message || 'Recognition failed');
    } finally {
      setIsRecognizing(false);
    }
  };

  // Run 1:1 Compare
  const runCompare = async () => {
    if (!compareImgA || !compareImgB) {
      setErrorMsg('Please upload both Image A and Image B');
      return;
    }
    setIsComparing(true);
    setErrorMsg(null);
    try {
      const res = await api.compareFaces(compareImgA, compareImgB);
      setCompareResult(res);
    } catch (e: any) {
      setErrorMsg(e.message || 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Subtabs */}
      <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Computer Vision Laboratory</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                Pure OpenCV Pipeline
              </span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Test and visualize OpenCV YuNet landmark geometry, SFace deep feature embeddings, and 1:1 biometric matching.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => {
                setActiveTab('detect');
                setErrorMsg(null);
              }}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'detect'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>YuNet Detection</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('recognize');
                setErrorMsg(null);
              }}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'recognize'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Fingerprint className="h-3.5 w-3.5" />
              <span>SFace Recognition</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('compare');
                setErrorMsg(null);
              }}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'compare'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>1:1 Comparison</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {errorMsg}
          </div>
        )}
      </div>

      {/* 1. YUNET DETECTION TAB */}
      {activeTab === 'detect' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls & Upload */}
          <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-indigo-600" />
              <span>YuNet Parameters</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1.5">
                <span>Score Threshold</span>
                <span className="font-mono text-indigo-600 font-bold">{scoreThresh.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="0.99"
                step="0.01"
                value={scoreThresh}
                onChange={(e) => setScoreThresh(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                Filters low-confidence face candidates before NMS.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">Upload Test Image</label>
              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50/70 hover:bg-slate-50">
                <Upload className="h-8 w-8 text-indigo-500 mb-2" />
                <span className="text-xs text-slate-800 font-semibold">Choose photo or drop here</span>
                <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0], (b64) => {
                        setDetectImg(b64);
                        runDetection(b64);
                      });
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Landmark color legend */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px]">
              <span className="font-bold text-slate-700 block mb-1">5 Facial Landmarks Legend:</span>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                <span className="text-slate-600 font-medium">Right Eye</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                <span className="text-slate-600 font-medium">Left Eye</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
                <span className="text-slate-600 font-medium">Nose Tip</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-500"></span>
                <span className="text-slate-600 font-medium">Right Mouth Corner</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600 font-medium">Left Mouth Corner</span>
              </div>
            </div>

            <button
              onClick={() => runDetection()}
              disabled={!detectImg || isDetecting}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isDetecting ? 'Running YuNet...' : 'Re-Run Detection'}
            </button>
          </div>

          {/* Visual Output */}
          <div className="lg:col-span-2 glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Detection Output</h3>
              {detectResult && (
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-slate-600 font-medium">
                    Faces Detected: <b className="text-slate-900">{detectResult.count}</b>
                  </span>
                  <span className="text-slate-600 font-medium">
                    Latency: <b className="text-indigo-600 font-mono font-bold">{detectResult.latency_ms} ms</b>
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 mt-4 flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 overflow-hidden min-h-[360px] relative shadow-inner">
              {detectResult ? (
                <img
                  src={detectResult.annotated_image}
                  alt="YuNet Annotated Faces"
                  className="max-h-[500px] w-auto object-contain rounded-lg"
                />
              ) : detectImg ? (
                <img src={detectImg} alt="Source" className="max-h-[500px] w-auto object-contain rounded-lg" />
              ) : (
                <div className="text-center text-slate-400 p-8">
                  <Eye className="h-10 w-10 text-slate-300 mx-auto mb-2 stroke-1" />
                  <p className="text-xs font-medium text-slate-600">Upload a photograph to visualize YuNet face detection.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. SFACE RECOGNITION TAB */}
      {activeTab === 'recognize' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Fingerprint className="h-4 w-4 text-indigo-600" />
              <span>SFace Matching Controls</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1.5">
                <span>Cosine Similarity Threshold</span>
                <span className="font-mono text-indigo-600 font-bold">{simThresh.toFixed(3)}</span>
              </label>
              <input
                type="range"
                min="0.2"
                max="0.6"
                step="0.005"
                value={simThresh}
                onChange={(e) => setSimThresh(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                Official OpenCV Zoo recommended threshold: <b>0.363</b>.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">Probe Photograph</label>
              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50/70 hover:bg-slate-50">
                <Upload className="h-8 w-8 text-indigo-500 mb-2" />
                <span className="text-xs text-slate-800 font-semibold">Select probe photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0], (b64) => {
                        setRecogImg(b64);
                        runRecognition(b64);
                      });
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <button
              onClick={() => runRecognition()}
              disabled={!recogImg || isRecognizing}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isRecognizing ? 'Matching...' : 'Match Against Enrolled Database'}
            </button>
          </div>

          <div className="lg:col-span-2 glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Recognition Result</h3>
              {recogResult && (
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-emerald-700 font-bold">
                    Recognized: <b>{recogResult.known_count}</b>
                  </span>
                  <span className="text-rose-700 font-bold">
                    Unknown: <b>{recogResult.unknown_count}</b>
                  </span>
                  <span className="text-slate-600 font-mono font-medium">{recogResult.latency_ms} ms</span>
                </div>
              )}
            </div>

            <div className="flex-1 mt-4 flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 overflow-hidden min-h-[360px] shadow-inner">
              {recogResult ? (
                <img
                  src={recogResult.annotated_image}
                  alt="SFace Recognition Output"
                  className="max-h-[500px] w-auto object-contain rounded-lg"
                />
              ) : recogImg ? (
                <img src={recogImg} alt="Source" className="max-h-[500px] w-auto object-contain rounded-lg" />
              ) : (
                <div className="text-center text-slate-400 p-8">
                  <Fingerprint className="h-10 w-10 text-slate-300 mx-auto mb-2 stroke-1" />
                  <p className="text-xs font-medium text-slate-600">Upload a photo to test SFace identification against enrolled students.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. 1:1 COMPARISON TAB */}
      {activeTab === 'compare' && (
        <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image A */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Identity A Photo</span>
              <div className="relative aspect-square rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                {compareImgA ? (
                  <img src={compareImgA} alt="Face A" className="w-full h-full object-cover" />
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4 text-center hover:bg-slate-100 transition">
                    <Upload className="h-8 w-8 text-indigo-500 mb-2" />
                    <span className="text-xs text-slate-800 font-semibold">Select Image A</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImageFile(e.target.files[0], setCompareImgA);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Image B */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Identity B Photo</span>
              <div className="relative aspect-square rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                {compareImgB ? (
                  <img src={compareImgB} alt="Face B" className="w-full h-full object-cover" />
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4 text-center hover:bg-slate-100 transition">
                    <Upload className="h-8 w-8 text-indigo-500 mb-2" />
                    <span className="text-xs text-slate-800 font-semibold">Select Image B</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImageFile(e.target.files[0], setCompareImgB);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={runCompare}
              disabled={!compareImgA || !compareImgB || isComparing}
              className="px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isComparing ? 'Computing 128-d Distance...' : 'Compare 1:1 Identities'}
            </button>
          </div>

          {/* Verdict Card */}
          {compareResult && (
            <div
              className={`p-5 rounded-2xl border text-center transition ${
                compareResult.verdict === 'MATCH'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Biometric Decision</div>
              <div className="text-3xl font-extrabold mt-1 tracking-tight flex items-center justify-center space-x-2">
                {compareResult.verdict === 'MATCH' ? (
                  <>
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    <span className="text-emerald-700">GENUINE MATCH</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-7 w-7 text-rose-600" />
                    <span className="text-rose-700">DIFFERENT IDENTITIES</span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mt-4 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-slate-500 block text-[11px] font-semibold">Cosine Similarity</span>
                  <span className="font-mono text-base font-extrabold text-slate-900 mt-0.5 block">
                    {compareResult.cosine_similarity.toFixed(4)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Threshold &ge; {compareResult.cosine_threshold}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-slate-500 block text-[11px] font-semibold">L2 Distance</span>
                  <span className="font-mono text-base font-extrabold text-slate-900 mt-0.5 block">
                    {compareResult.l2_distance.toFixed(4)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Threshold &le; {compareResult.l2_threshold}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
