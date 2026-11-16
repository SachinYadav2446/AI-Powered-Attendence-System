import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Zap,
  Gauge,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Database,
  Layers,
} from 'lucide-react';
import { api } from '../api';
import type { BenchmarkMetrics, SystemStatus } from '../types';

interface BenchmarkViewProps {
  status?: SystemStatus | null;
  onConfigUpdated?: () => void;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({ onConfigUpdated }) => {
  const [metrics, setMetrics] = useState<BenchmarkMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states for config
  const [cosineThresh, setCosineThresh] = useState(0.363);
  const [yunetThresh, setYunetThresh] = useState(0.9);
  const [minFrames, setMinFrames] = useState(3);
  const [metricChoice, setMetricChoice] = useState('cosine');

  useEffect(() => {
    loadConfig();
    loadMetrics();
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await api.getConfig();
      setCosineThresh(cfg.cosine_threshold);
      setYunetThresh(cfg.yunet_score_threshold);
      setMinFrames(cfg.min_frames_seen);
      setMetricChoice(cfg.metric);
    } catch (e: any) {
      console.error('Config load failed:', e);
    }
  };

  const loadMetrics = async () => {
    setLoadingMetrics(true);
    setErrorMsg(null);
    try {
      const data = await api.getBenchmarkMetrics();
      setMetrics(data);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to compute benchmark metrics');
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleRunFullBenchmark = async () => {
    setLoadingMetrics(true);
    setErrorMsg(null);
    try {
      const data = await api.runBenchmark();
      setMetrics(data);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to run full benchmark');
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setSaveSuccess(false);
    try {
      await api.updateConfig({
        cosine_threshold: cosineThresh,
        yunet_score_threshold: yunetThresh,
        min_frames_seen: minFrames,
        metric: metricChoice,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onConfigUpdated?.();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Model Evaluation &amp; Diagnostics</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                CPU Inference Benchmark
              </span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Empirical verification metrics (Precision, Recall, FAR, FRR) and latency profiles across pipeline stages.
            </p>
          </div>

          <button
            onClick={handleRunFullBenchmark}
            disabled={loadingMetrics}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            {loadingMetrics ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                <span>Running Empirical Sweep...</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span>Run Full Benchmark</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Latency & Throughput Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>YuNet Face Detection</span>
            <Cpu className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics ? `${metrics.latency_ms.yunet_detection_mean} ms` : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            P95: {metrics ? `${metrics.latency_ms.yunet_detection_p95} ms` : '--'}
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>SFace Alignment &amp; Embed</span>
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics ? `${metrics.latency_ms.sface_embedding_mean} ms` : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            P95: {metrics ? `${metrics.latency_ms.sface_embedding_p95} ms` : '--'}
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Vectorized DB Scan</span>
            <Database className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics ? `${metrics.latency_ms.db_matching_mean} ms` : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Cosine similarity matching</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Pipeline Throughput</span>
            <Gauge className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 font-mono">
            {metrics ? `~${metrics.latency_ms.throughput_fps} FPS` : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Total E2E: {metrics ? `${metrics.latency_ms.pipeline_total_mean} ms` : '--'}
          </span>
        </div>
      </div>

      {/* Accuracy & Verification Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Empirical Metrics Card */}
        <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              <span>Biometric Accuracy &amp; Error Rates</span>
            </h3>
            {metrics && (
              <span className="text-[11px] font-mono font-medium text-slate-500">{metrics.metrics.total_probes} probes tested</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 block">Verification Accuracy</span>
              <span className="text-2xl font-extrabold text-emerald-700 font-mono mt-1 block">
                {metrics ? `${(metrics.metrics.accuracy * 100).toFixed(1)}%` : '--'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 block">F1-Score</span>
              <span className="text-2xl font-extrabold text-indigo-700 font-mono mt-1 block">
                {metrics ? metrics.metrics.f1_score.toFixed(3) : '--'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 block">Precision</span>
              <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                {metrics ? `${(metrics.metrics.precision * 100).toFixed(1)}%` : '--'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 block">Recall</span>
              <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                {metrics ? `${(metrics.metrics.recall * 100).toFixed(1)}%` : '--'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 block">False Acceptance Rate (FAR)</span>
              <span className="text-xl font-bold text-amber-600 font-mono mt-1 block">
                {metrics ? `${(metrics.metrics.far * 100).toFixed(2)}%` : '--'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Impostors falsely accepted</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 block">False Rejection Rate (FRR)</span>
              <span className="text-xl font-bold text-rose-600 font-mono mt-1 block">
                {metrics ? `${(metrics.metrics.frr * 100).toFixed(2)}%` : '--'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Genuine students rejected</span>
            </div>
          </div>
        </div>

        {/* Runtime Configuration Tuner */}
        <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-indigo-600" />
              <span>Live Runtime Configuration</span>
            </h3>
            {saveSuccess && (
              <span className="text-xs text-emerald-700 font-semibold flex items-center space-x-1 animate-pulse">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Updated Live!</span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Cosine Similarity Threshold</span>
              <span className="font-mono text-indigo-600 font-bold">{cosineThresh.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="0.55"
              step="0.005"
              value={cosineThresh}
              onChange={(e) => setCosineThresh(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Default is 0.363. Higher values require closer facial match.
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>YuNet Detection Score Threshold</span>
              <span className="font-mono text-indigo-600 font-bold">{yunetThresh.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.60"
              max="0.98"
              step="0.02"
              value={yunetThresh}
              onChange={(e) => setYunetThresh(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Default is 0.90. Suppresses low-confidence facial regions.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Distance Metric</label>
              <select
                value={metricChoice}
                onChange={(e) => setMetricChoice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg glass-input text-xs text-slate-900 font-medium cursor-pointer"
              >
                <option value="cosine">Cosine Similarity (Higher = Better)</option>
                <option value="l2">Euclidean L2 Distance (Lower = Better)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Min Frames Seen</label>
              <select
                value={minFrames}
                onChange={(e) => setMinFrames(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg glass-input text-xs text-slate-900 font-medium cursor-pointer"
              >
                <option value={2}>2 Frames</option>
                <option value={3}>3 Frames (Standard)</option>
                <option value={5}>5 Frames (Strict)</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? 'Saving Parameters...' : 'Apply Runtime Parameters'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
