export interface SystemStatus {
  status: string;
  opencv_version: string;
  python_version: string;
  models: {
    yunet: {
      name: string;
      loaded: boolean;
      path: string;
      score_threshold: number;
    };
    sface: {
      name: string;
      loaded: boolean;
      path: string;
      similarity_threshold: number;
      metric: string;
    };
  };
  database: {
    path: string;
    enrolled_students: number;
    total_sessions: number;
  };
  config: {
    session_sample_duration_sec: number;
    session_min_frames_seen: number;
    default_similarity_metric: string;
  };
}

export interface Student {
  id: number;
  roll_no: string;
  name: string;
  embeddings_count: number;
  enrolled_at: string;
  avatar_url?: string | null;
  photos?: string[];
}

export interface AttendanceRecord {
  roll_no: string;
  name: string;
  status: 'PRESENT' | 'ABSENT';
  confidence: number;
  frames_seen: number;
  timestamp?: string;
}

export interface Session {
  id: number;
  session_id?: number;
  course: string;
  date: string;
  start_time: string;
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
  attendance_pct?: number;
  proof_image_url?: string | null;
}

export interface SessionDetails extends Session {
  csv_download_url?: string | null;
  records: AttendanceRecord[];
}

export interface AttendanceSummary {
  total_enrolled_students: number;
  total_sessions_held: number;
  overall_attendance_rate: number;
  low_attendance_count: number;
  recent_sessions: Session[];
}

export interface CumulativeStudent {
  id: number;
  roll_no: string;
  name: string;
  avatar_url?: string | null;
  total_sessions: number;
  attended: number;
  absent: number;
  attendance_pct: number;
  is_low: boolean;
}

export interface CumulativeReportResponse {
  total_sessions_held: number;
  students: CumulativeStudent[];
}

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceLandmarks {
  right_eye: [number, number];
  left_eye: [number, number];
  nose_tip: [number, number];
  right_mouth: [number, number];
  left_mouth: [number, number];
}

export interface DetectionFace {
  box: FaceBoundingBox;
  landmarks: FaceLandmarks;
  score: number;
}

export interface VisionDetectionResponse {
  count: number;
  latency_ms: number;
  faces: DetectionFace[];
  annotated_image: string;
}

export interface RecognitionFace {
  box: FaceBoundingBox;
  is_known: boolean;
  roll_no: string | null;
  name: string;
  confidence: number;
  score: number;
}

export interface VisionRecognitionResponse {
  count: number;
  known_count: number;
  unknown_count: number;
  latency_ms: number;
  faces: RecognitionFace[];
  annotated_image: string;
}

export interface VisionCompareResponse {
  cosine_similarity: number;
  cosine_threshold: number;
  is_match_cosine: boolean;
  l2_distance: number;
  l2_threshold: number;
  is_match_l2: boolean;
  verdict: 'MATCH' | 'NO MATCH';
}

export interface LiveFrameResponse {
  frame_index: number;
  faces_detected: number;
  faces_in_frame: Array<{
    roll_no: string | null;
    name: string;
    confidence: number;
    frames_accumulated: number;
    is_present_yet: boolean;
  }>;
  cumulative_seen: Record<string, number>;
  min_frames_seen: number;
  annotated_frame: string;
}

export interface BenchmarkMetrics {
  metrics: {
    precision: number;
    recall: number;
    f1_score: number;
    accuracy: number;
    far: number;
    frr: number;
    total_probes: number;
    genuine_probes: number;
    impostor_probes: number;
  };
  latency_ms: {
    yunet_detection_mean: number;
    yunet_detection_p95: number;
    sface_embedding_mean: number;
    sface_embedding_p95: number;
    db_matching_mean: number;
    pipeline_total_mean: number;
    throughput_fps: number;
  };
  evaluation_time_sec: number;
  generated_at: string;
}

export interface RuntimeConfig {
  cosine_threshold: number;
  yunet_score_threshold: number;
  min_frames_seen: number;
  metric: string;
  match_strategy: string;
}
