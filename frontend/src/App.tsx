import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LiveAttendanceView } from './components/LiveAttendanceView';
import { StudentsView } from './components/StudentsView';
import { ReportsView } from './components/ReportsView';
import { VisionPlaygroundView } from './components/VisionPlaygroundView';
import { BenchmarkView } from './components/BenchmarkView';
import { api } from './api';
import type { SystemStatus } from './types';
import { Shield, Cpu, Database, CheckCircle2 } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'live' | 'students' | 'reports' | 'vision' | 'benchmark'>('live');
  const [status, setStatus] = useState<SystemStatus | null>(null);

  const refreshStatus = async () => {
    try {
      const data = await api.getStatus();
      setStatus(data);
    } catch (e) {
      console.error('Status fetch failed:', e);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Sleek Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} status={status} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'live' && <LiveAttendanceView onSessionRecorded={refreshStatus} />}
        {activeTab === 'students' && <StudentsView onStudentsChanged={refreshStatus} />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'vision' && <VisionPlaygroundView />}
        {activeTab === 'benchmark' && <BenchmarkView status={status} onConfigUpdated={refreshStatus} />}
      </main>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-indigo-600" />
            <span className="text-slate-700 font-medium">VisionAttend AI &bull; Classroom Attendance System</span>
          </div>

          <div className="flex items-center space-x-6 text-[11px]">
            <div className="flex items-center space-x-1.5 text-slate-600">
              <Cpu className="h-3.5 w-3.5 text-slate-500" />
              <span>YuNet + SFace (ONNX Zoo)</span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-600">
              <Database className="h-3.5 w-3.5 text-slate-500" />
              <span>SQLite Relational DB</span>
            </div>
            <div className="flex items-center space-x-1.5 text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Offline &amp; Private</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
