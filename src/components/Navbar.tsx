import React from 'react';
import { ViewMode } from '../types';
import { TreePine, Table, Download, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: ViewMode;
  setActiveTab: (tab: ViewMode) => void;
  onExportClick: () => void;
  onResetData: () => void;
  totalPersons: number;
  totalRelations: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onExportClick,
  onResetData,
  totalPersons,
  totalRelations
}) => {
  return (
    <header className="bg-[#1e1915] text-[#fcf8f2] border-b border-[#3d3328] shadow-lg sticky top-0 z-50 no-print">
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
            <p className="text-xs text-stone-400">إدارة الأنساب والعلاقات التراثية بدقة</p>
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
          <div className="hidden lg:flex items-center gap-3 text-xs text-stone-300 bg-[#2a231d] px-3 py-1.5 rounded-lg border border-[#483d31]">
            <span>الأفراد: <strong className="text-amber-300">{totalPersons}</strong></span>
            <span className="text-stone-500">|</span>
            <span>العلاقات: <strong className="text-amber-300">{totalRelations}</strong></span>
          </div>

          <button
            onClick={onExportClick}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-medium px-3.5 py-2 rounded-lg shadow transition-all border border-amber-500/40 cursor-pointer"
            title="تصدير الشجرة بجودة عالية SVG / PDF"
          >
            <Download className="w-4 h-4" />
            <span>تصدير الشجرة</span>
          </button>
        </div>
      </div>
    </header>
  );
};
