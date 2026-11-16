import type {
  SystemStatus,
  Student,
  Session,
  SessionDetails,
  AttendanceSummary,
  CumulativeReportResponse,
  VisionDetectionResponse,
  VisionRecognitionResponse,
  VisionCompareResponse,
  LiveFrameResponse,
  BenchmarkMetrics,
  RuntimeConfig,
} from './types';

const API_BASE = '/api';

export const api = {
  // 1. System & Config
  getStatus: async (): Promise<SystemStatus> => {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Failed to fetch system status');
    return res.json();
  },

  getConfig: async (): Promise<RuntimeConfig> => {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error('Failed to fetch configuration');
    return res.json();
  },

  updateConfig: async (payload: Partial<RuntimeConfig>): Promise<any> => {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update configuration');
    return res.json();
  },

  // 2. Students
  getStudents: async (): Promise<Student[]> => {
    const res = await fetch(`${API_BASE}/students`);
    if (!res.ok) throw new Error('Failed to load students');
    return res.json();
  },

  getStudent: async (rollNo: string): Promise<Student> => {
    const res = await fetch(`${API_BASE}/students/${encodeURIComponent(rollNo)}`);
    if (!res.ok) throw new Error(`Failed to load student ${rollNo}`);
    return res.json();
  },

  enrollStudent: async (payload: {
    roll_no: string;
    name: string;
    frames: string[];
    force?: boolean;
  }): Promise<any> => {
    const res = await fetch(`${API_BASE}/students/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to enroll student');
    return data;
  },

  seedStudents: async (count: number = 10): Promise<any> => {
    const res = await fetch(`${API_BASE}/students/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to seed sample students');
    return data;
  },

  deleteStudent: async (rollNo: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/students/${encodeURIComponent(rollNo)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to delete student');
    return data;
  },

  // 3. Vision Playground
  detectFaces: async (image: string, scoreThreshold?: number): Promise<VisionDetectionResponse> => {
    const res = await fetch(`${API_BASE}/vision/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, score_threshold: scoreThreshold }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Face detection failed');
    return data;
  },

  recognizeFaces: async (
    image: string,
    similarityThreshold?: number,
    scoreThreshold?: number
  ): Promise<VisionRecognitionResponse> => {
    const res = await fetch(`${API_BASE}/vision/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        similarity_threshold: similarityThreshold,
        score_threshold: scoreThreshold,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Face recognition failed');
    return data;
  },

  compareFaces: async (imageA: string, imageB: string, metric: string = 'cosine'): Promise<VisionCompareResponse> => {
    const res = await fetch(`${API_BASE}/vision/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_a: imageA, image_b: imageB, metric }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Face comparison failed');
    return data;
  },

  // 4. Live Sessions
  startLiveSession: async (course: string, minFramesSeen: number = 3, sampleDurationSec: number = 15): Promise<any> => {
    const res = await fetch(`${API_BASE}/sessions/live/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course,
        min_frames_seen: minFramesSeen,
        sample_duration_sec: sampleDurationSec,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to initialize live session');
    return data;
  },

  sendLiveFrame: async (sessionToken: string, image: string): Promise<LiveFrameResponse> => {
    const res = await fetch(`${API_BASE}/sessions/live/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken, image }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to process live frame');
    return data;
  },

  commitLiveSession: async (sessionToken: string): Promise<SessionDetails> => {
    const res = await fetch(`${API_BASE}/sessions/live/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to finalize attendance session');
    return data;
  },

  createSessionFromImage: async (formData: FormData): Promise<SessionDetails> => {
    const res = await fetch(`${API_BASE}/sessions/create-from-image`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to process classroom image');
    return data;
  },

  // 5. Sessions & Reports
  getSessions: async (): Promise<Session[]> => {
    const res = await fetch(`${API_BASE}/sessions`);
    if (!res.ok) throw new Error('Failed to load sessions');
    return res.json();
  },

  getSessionDetails: async (sessionId: number): Promise<SessionDetails> => {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    if (!res.ok) throw new Error(`Failed to load session #${sessionId}`);
    return res.json();
  },

  getAttendanceSummary: async (): Promise<AttendanceSummary> => {
    const res = await fetch(`${API_BASE}/reports/summary`);
    if (!res.ok) throw new Error('Failed to load attendance summary');
    return res.json();
  },

  getCumulativeReport: async (): Promise<CumulativeReportResponse> => {
    const res = await fetch(`${API_BASE}/reports/students`);
    if (!res.ok) throw new Error('Failed to load cumulative student report');
    return res.json();
  },

  // 6. Benchmark & Diagnostics
  getBenchmarkMetrics: async (): Promise<BenchmarkMetrics> => {
    const res = await fetch(`${API_BASE}/benchmark/metrics`);
    if (!res.ok) throw new Error('Failed to retrieve benchmark metrics');
    return res.json();
  },

  runBenchmark: async (): Promise<BenchmarkMetrics> => {
    const res = await fetch(`${API_BASE}/benchmark/run`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to run benchmark suite');
    return res.json();
  },
};
