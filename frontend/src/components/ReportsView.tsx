import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Eye,
  Users,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../api';
import type {
  Session,
  SessionDetails,
  AttendanceSummary,
  CumulativeStudent,
} from '../types';

export const ReportsView: React.FC = () => {
  const [subTab, setSubTab] = useState<'sessions' | 'cumulative'>('sessions');
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cumulativeStudents, setCumulativeStudents] = useState<CumulativeStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Selected session for detail view
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [proofZoomOpen, setProofZoomOpen] = useState(false);

  useEffect(() => {
    loadAllReports();
  }, []);

  const loadAllReports = async () => {
    try {
      setLoading(true);
      const [sumData, sessData, cumData] = await Promise.all([
        api.getAttendanceSummary(),
        api.getSessions(),
        api.getCumulativeReport(),
      ]);
      setSummary(sumData);
      setSessions(sessData);
      setCumulativeStudents(cumData.students);
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async (sessionId: number) => {
    setSelectedSessionId(sessionId);
    try {
      const details = await api.getSessionDetails(sessionId);
      setSessionDetails(details);
    } catch (e) {
      console.error('Failed to load session details:', e);
    }
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.course.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.date.includes(searchFilter) ||
      s.id.toString() === searchFilter
  );

  const filteredCumulative = cumulativeStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.roll_no.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Enrolled</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {summary ? summary.total_enrolled_students : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Unique biometric profiles</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sessions Held</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {summary ? summary.total_sessions_held : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Recorded lectures</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Average Attendance</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {summary ? `${summary.overall_attendance_rate}%` : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Aggregate presence rate</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Low Attendance Alert</span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            {summary ? summary.low_attendance_count : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Students falling under 75%</span>
        </div>
      </div>

      {/* Main Container with Tabs */}
      <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          {/* Subtabs */}
          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => {
                setSubTab('sessions');
                setSearchFilter('');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                subTab === 'sessions'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Session History ({sessions.length})</span>
            </button>
            <button
              onClick={() => {
                setSubTab('cumulative');
                setSearchFilter('');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                subTab === 'cumulative'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Student Cumulative Summary</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={
                subTab === 'sessions' ? 'Filter by course or date...' : 'Filter by student name or roll...'
              }
              className="w-full pl-9 pr-3 py-1.5 rounded-lg glass-input text-xs text-slate-900 font-medium placeholder-slate-400"
            />
          </div>
        </div>

        {/* Content Tabs */}
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading attendance reports...</p>
          </div>
        ) : subTab === 'sessions' ? (
          /* Sessions History Table */
          <div className="mt-6 overflow-x-auto">
            {filteredSessions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-700">No lecture sessions recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Run a live webcam scan or process a classroom group photo to log your first session.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Session ID</th>
                    <th className="py-3 px-4">Course Name</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Present / Total</th>
                    <th className="py-3 px-4">Attendance Rate</th>
                    <th className="py-3 px-4">Proof Photo</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">#{s.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{s.course}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="flex items-center space-x-1.5 font-medium">
                          <span>{s.date}</span>
                          <span className="text-slate-300">&bull;</span>
                          <span className="text-slate-500 font-mono">{s.start_time}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">
                          {s.present_count} / {s.total_enrolled}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${s.attendance_rate}%` }}
                            />
                          </div>
                          <span className="font-mono text-emerald-700 font-bold">{s.attendance_rate}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {s.proof_image_url ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Available
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenSession(s.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Cumulative Student Table */
          <div className="mt-6 overflow-x-auto">
            {filteredCumulative.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Users className="h-10 w-10 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-xs">No student attendance records found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-4">Total Sessions</th>
                    <th className="py-3 px-4">Attended</th>
                    <th className="py-3 px-4">Missed</th>
                    <th className="py-3 px-4">Attendance Rate</th>
                    <th className="py-3 px-4 text-right">Status Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCumulative.map((c) => (
                    <tr key={c.roll_no} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt={c.name} className="h-8 w-8 rounded-lg object-cover border border-slate-200 shadow-xs" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[11px]">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-bold text-slate-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{c.roll_no}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{c.total_sessions}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">{c.attended}</td>
                      <td className="py-3 px-4 font-bold text-rose-700">{c.absent}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.is_low ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${c.attendance_pct}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono font-bold ${c.is_low ? 'text-rose-600' : 'text-emerald-700'}`}
                          >
                            {c.attendance_pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.is_low ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            LOW ATTENDANCE (&lt;75%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            GOOD
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Session Details Modal - Pinned Action Bar Always Visible */}
      {selectedSessionId && sessionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-white flex-shrink-0">
              <div>
                <span className="text-xs font-mono text-indigo-600 font-bold">SESSION #{sessionDetails.id}</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">{sessionDetails.course}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conducted on {sessionDetails.date} at {sessionDetails.start_time}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSessionId(null);
                  setSessionDetails(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[11px] font-medium text-slate-500">Total Enrolled</span>
                  <span className="block text-lg font-bold text-slate-900 mt-0.5">{sessionDetails.total_enrolled}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[11px] font-semibold text-emerald-700">Present</span>
                  <span className="block text-lg font-bold text-emerald-700 mt-0.5">
                    {sessionDetails.present_count}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                  <span className="text-[11px] font-semibold text-indigo-700">Attendance Rate</span>
                  <span className="block text-lg font-bold text-indigo-700 mt-0.5">{sessionDetails.attendance_rate}%</span>
                </div>
              </div>

              {/* Proof Image Box */}
              {sessionDetails.proof_image_url && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">Verification Proof Snapshot</span>
                    <button
                      onClick={() => setProofZoomOpen(true)}
                      className="text-xs text-indigo-600 hover:underline flex items-center space-x-1 cursor-pointer font-semibold"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Expand High-Res Proof</span>
                    </button>
                  </div>
                  <div
                    onClick={() => setProofZoomOpen(true)}
                    className="rounded-xl overflow-hidden border border-slate-200 max-h-40 bg-slate-100 cursor-pointer relative group shadow-xs"
                  >
                    <img
                      src={sessionDetails.proof_image_url}
                      alt="Proof Image"
                      className="w-full h-40 object-cover group-hover:scale-102 transition"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-lg bg-white/95 text-slate-900 text-xs font-bold shadow-md">
                        Click to View Full Resolution
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Roster */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1.5">Student Verification Records</span>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 sticky top-0 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Roll No</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Frames Seen</th>
                        <th className="py-2.5 px-3">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {sessionDetails.records.map((r) => (
                        <tr key={r.roll_no} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono text-indigo-600 font-bold">{r.roll_no}</td>
                          <td className="py-2 px-3 text-slate-800 font-medium">{r.name}</td>
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
                          <td className="py-2 px-3 font-mono text-slate-600">{(r.confidence * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Pinned Bottom Action Bar: Always Visible */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              {sessionDetails.csv_download_url ? (
                <a
                  href={sessionDetails.csv_download_url}
                  download
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-300 shadow-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Download Session CSV</span>
                </a>
              ) : <div />}
              <button
                onClick={() => {
                  setSelectedSessionId(null);
                  setSessionDetails(null);
                }}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Zoom Modal */}
      {proofZoomOpen && sessionDetails?.proof_image_url && (
        <div
          onClick={() => setProofZoomOpen(false)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden border border-slate-300 bg-white shadow-2xl p-2">
            <img
              src={sessionDetails.proof_image_url}
              alt="High-Res Biometric Proof"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
