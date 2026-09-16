import React, { useRef } from 'react';
import { ViewMode } from '../types';
import { TreePine, Table, Upload, Download, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: ViewMode;
  setActiveTab: (tab: ViewMode) => void;
  onExportClick: () => void;
  onResetData: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  totalPersons: number;
  totalRelations: number;
  syncStatus?: 'saved' | 'syncing' | 'offline';
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onExportClick,
  onResetData,
  onImportJson,
  totalPersons,
  totalRelations,
  syncStatus = 'saved'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="bg-[#1e1915] text-[#fcf8f2] border-b border-[#3d3328] shadow-lg sticky top-0 z-50 no-print">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        className="hidden"
        onChange={onImportJson}
      />
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-md border border-amber-500/40 text-amber-100">
            <TreePine className="w-7 h-7 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-amiri tracking-wide text-amber-100">شجرة العائلة التراثية</h1>
              <span className="text-xs bg-amber-900/80 text-amber-200 border border-amber-600/50 px-2 py-0.5 rounded-full font-medium">سلسلة الآباء والأبناء</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-stone-400">إدارة الأنساب والعلاقات التراثية بدقة</p>
              {/* Firestore Sync Status Indicator */}
              {syncStatus === 'syncing' ? (
                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-900/60 text-amber-200 border border-amber-600/40 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  جاري المزامنة...
                </span>
              ) : syncStatus === 'offline' ? (
                <span className="inline-flex items-center gap-1 text-[10px] bg-stone-800 text-stone-300 border border-stone-600 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                  محلي
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-950/80 text-emerald-200 border border-emerald-600/50 px-2 py-0.5 rounded-full shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  تم الحفظ في Firestore
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-[#2a231d] p-1.5 rounded-xl border border-[#483d31] shadow-inner">
          <button
            onClick={() => setActiveTab('tree')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
              activeTab === 'tree'
                ? 'bg-amber-700 text-white shadow-md border border-amber-600'
                : 'text-stone-300 hover:text-white hover:bg-[#382f27]'
            }`}
          >
            <TreePine className="w-4 h-4" />
            شجرة العائلة (اللوحة التراثية)
          </button>
          <button
            onClick={() => setActiveTab('entries')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
              activeTab === 'entries'
                ? 'bg-amber-700 text-white shadow-md border border-amber-600'
                : 'text-stone-300 hover:text-white hover:bg-[#382f27]'
            }`}
          >
            <Table className="w-4 h-4" />
            جدول الإدخالات (أب ← ابن)
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-emerald-100 text-xs font-semibold px-3.5 py-2 rounded-xl border border-emerald-600 transition-all cursor-pointer shadow"
            title="استيراد ملف JSON لتعبئة الشجرة فورياً"
          >
            <Upload className="w-4 h-4 text-emerald-300" />
            <span>استيراد JSON</span>
          </button>

          <div className="hidden lg:flex items-center gap-3 text-xs text-stone-300 bg-[#2a231d] px-3 py-1.5 rounded-lg border border-[#483d31]">
            <span>الأفراد: <strong className="text-amber-300">{totalPersons}</strong></span>
            <span className="text-stone-500">|</span>
            <span>العلاقات: <strong className="text-amber-300">{totalRelations}</strong></span>
          </div>
        </div>
      </div>
    </header>
  );
};
