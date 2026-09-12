import React from 'react';
import { Users, GitBranch, Layers, Award, Sparkles, UserCheck } from 'lucide-react';

interface StatsBarProps {
  totalPersons: number;
  totalRelations: number;
  maxGeneration: number;
  rootsCount: number;
  largestGenerationSize: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalPersons,
  totalRelations,
  maxGeneration,
  rootsCount,
  largestGenerationSize
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 no-print">
      <div className="bg-[#f5ecdc] dark:bg-[#25201b] border border-[#e2d2b5] dark:border-[#3d3328] rounded-xl p-3.5 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-700/10 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{totalPersons}</div>
          <div className="text-xs text-stone-600 dark:text-stone-400 font-medium">الأفراد</div>
        </div>
      </div>

      <div className="bg-[#f5ecdc] dark:bg-[#25201b] border border-[#e2d2b5] dark:border-[#3d3328] rounded-xl p-3.5 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-700/10 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold">
          <GitBranch className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{totalRelations}</div>
          <div className="text-xs text-stone-600 dark:text-stone-400 font-medium">العلاقات (أب ← ابن)</div>
        </div>
      </div>

      <div className="bg-[#f5ecdc] dark:bg-[#25201b] border border-[#e2d2b5] dark:border-[#3d3328] rounded-xl p-3.5 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-800/10 dark:bg-amber-800/40 text-amber-900 dark:text-amber-200 flex items-center justify-center font-bold">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-950 dark:text-amber-100">{maxGeneration}</div>
          <div className="text-xs text-stone-600 dark:text-stone-400 font-medium">الأجيال</div>
        </div>
      </div>

      <div className="bg-[#f5ecdc] dark:bg-[#25201b] border border-[#e2d2b5] dark:border-[#3d3328] rounded-xl p-3.5 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-700/10 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 flex items-center justify-center font-bold">
          <Award className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-orange-950 dark:text-orange-100">{rootsCount}</div>
          <div className="text-xs text-stone-600 dark:text-stone-400 font-medium">الجذور الأساسية</div>
        </div>
      </div>

      <div className="bg-[#f5ecdc] dark:bg-[#25201b] border border-[#e2d2b5] dark:border-[#3d3328] rounded-xl p-3.5 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-700/10 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 flex items-center justify-center font-bold">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-teal-950 dark:text-teal-100">{largestGenerationSize}</div>
          <div className="text-xs text-stone-600 dark:text-stone-400 font-medium">أوسع جيل</div>
        </div>
      </div>

      <div className="bg-[#f5ecdc] dark:bg-[#25201b] border border-[#e2d2b5] dark:border-[#3d3328] rounded-xl p-3.5 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-900/10 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 flex items-center justify-center font-bold">
          <UserCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-950 dark:text-amber-100">مزامنة</div>
          <div className="text-xs text-stone-600 dark:text-stone-400 font-medium">حفظ تلقائي سحابي</div>
        </div>
      </div>
    </div>
  );
};
