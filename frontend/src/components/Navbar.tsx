import React from 'react';
import { Camera, Users, BarChart3, Sparkles, Activity, ShieldCheck, Cpu } from 'lucide-react';
import type { SystemStatus } from '../types';

interface NavbarProps {
  activeTab: 'live' | 'students' | 'reports' | 'vision' | 'benchmark';
  setActiveTab: (tab: 'live' | 'students' | 'reports' | 'vision' | 'benchmark') => void;
  status: SystemStatus | null;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, status }) => {
  const tabs = [
    { id: 'live', label: 'Live Attendance', icon: Camera },
    { id: 'students', label: 'Students Roster', icon: Users },
    { id: 'reports', label: 'Sessions & Reports', icon: BarChart3 },
    { id: 'vision', label: 'Vision Lab', icon: Sparkles },
    { id: 'benchmark', label: 'Evaluation & Config', icon: Activity },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">VisionAttend</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  OpenCV AI
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                YuNet Face Detection &bull; SFace 128-d Biometrics
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* System Status Pill */}
          <div className="hidden lg:flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
              <Cpu className="h-3.5 w-3.5 text-indigo-600" />
              <span className="font-medium">YuNet + SFace</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            {status && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                <span className="font-bold text-slate-900">{status.database.enrolled_students}</span>
                <span className="text-slate-500">Enrolled</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
