import React, { useState, useMemo } from 'react';
import { RelationEntry } from '../types';
import { exportToCSV, cleanName } from '../utils/treeUtils';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { 
  Plus, Trash2, Edit2, Search, FileSpreadsheet, Upload, Download, 
  Sparkles, Check, X, RefreshCw, AlertCircle, Tag, CheckSquare, Square
} from 'lucide-react';

interface EntriesTableProps {
  entries: RelationEntry[];
  setEntries: React.Dispatch<React.SetStateAction<RelationEntry[]>>;
  onSwitchToTree: () => void;
  onResetData: () => void;
}

const AVAILABLE_TAGS = [
  'شيخ', 'استاذ', 'معلم', 'مدرس', 'ضابط', 'جندي', 'طالب', 'متوفي', 'شهيد'
];

export const EntriesTable: React.FC<EntriesTableProps> = ({
  entries,
  setEntries,
  onSwitchToTree,
  onResetData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'id' | 'sonName' | 'fatherName'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // New entry form state (الابن, الأب, الجد, والد الجد)
  const [newSon, setNewSon] = useState('');
  const [newFather, setNewFather] = useState('');
  const [newGrandfather, setNewGrandfather] = useState('');
  const [newGreatGrandfather, setNewGreatGrandfather] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSon, setEditSon] = useState('');
  const [editFather, setEditFather] = useState('');
  const [editGrandfather, setEditGrandfather] = useState('');
  const [editGreatGrandfather, setEditGreatGrandfather] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  // Bulk paste modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Clear all data handler
  const handleClearAllData = async () => {
    if (window.confirm('⚠️ تحذير خطير: هل أنت متأكد تماماً من مسح جميع البيانات من الداتا الرئيسية، وتفريغ جدول البيانات، وتصفير الشجرة بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
      setEntries([]);
      try {
        localStorage.removeItem('heritage_family_tree_entries');
        if (auth.currentUser) {
          const snap = await getDocs(collection(db, `users/${auth.currentUser.uid}/familyEntries`));
          for (const d of snap.docs) {
            await deleteDoc(d.ref);
          }
        }
      } catch (e) {
        console.error("Failed to delete from Firestore", e);
      }
      setNewSon('');
      setNewFather('');
      setNewGrandfather('');
      setNewGreatGrandfather('');
      setNewTags([]);
    }
  };

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const query = searchTerm.toLowerCase();
      return (
        e.id.toLowerCase().includes(query) ||
        (e.sonName && e.sonName.toLowerCase().includes(query)) ||
        (e.fatherName && e.fatherName.toLowerCase().includes(query)) ||
        (e.grandfatherName && e.grandfatherName.toLowerCase().includes(query)) ||
        (e.greatGrandfatherName && e.greatGrandfatherName.toLowerCase().includes(query)) ||
        (e.tags && e.tags.some(t => t.toLowerCase().includes(query)))
      );
    }).sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (sortField === 'id') {
        return sortDirection === 'asc' 
          ? parseInt(valA) - parseInt(valB) 
          : parseInt(valB) - parseInt(valA);
      }
      const comp = valA.localeCompare(valB, 'ar');
      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [entries, searchTerm, sortField, sortDirection]);

  const toggleNewTag = (tag: string) => {
    setNewTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleEditTag = (tag: string) => {
    setEditTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    const s = cleanName(newSon);
    const f = cleanName(newFather);
    const gf = cleanName(newGrandfather);
    const ggf = cleanName(newGreatGrandfather);

    if (!s) return;

    const nextId = entries.length > 0 ? (Math.max(...entries.map(item => parseInt(item.id) || 0)) + 1).toString() : '1';
    const newEntry: RelationEntry = {
      id: nextId,
      sonName: s,
      fatherName: f,
      grandfatherName: gf,
      greatGrandfatherName: ggf,
      tags: newTags,
      createdAt: new Date().toISOString()
    };

    setEntries(prev => [...prev, newEntry]);
    setNewSon('');
    setNewFather('');
    setNewGrandfather('');
    setNewGreatGrandfather('');
    setNewTags([]);
  };

  const handleDelete = (id: string) => {
    setEntries(prev => prev.filter(item => item.id !== id));
  };

  const startEdit = (entry: RelationEntry) => {
    setEditingId(entry.id);
    setEditSon(entry.sonName || '');
    setEditFather(entry.fatherName || '');
    setEditGrandfather(entry.grandfatherName || '');
    setEditGreatGrandfather(entry.greatGrandfatherName || '');
    setEditTags(entry.tags || []);
  };

  const saveEdit = (id: string) => {
    const s = cleanName(editSon);
    const f = cleanName(editFather);
    const gf = cleanName(editGrandfather);
    const ggf = cleanName(editGreatGrandfather);
    if (!s) return;

    setEntries(prev => prev.map(item => item.id === id ? { 
      ...item, 
      sonName: s, 
      fatherName: f, 
      grandfatherName: gf, 
      greatGrandfatherName: ggf,
      tags: editTags
    } : item));
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSort = (field: 'id' | 'sonName' | 'fatherName') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleBulkPaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n');
    let maxId = entries.length > 0 ? Math.max(...entries.map(item => parseInt(item.id) || 0)) : 0;
    const newEntries: RelationEntry[] = [...entries];

    lines.forEach(line => {
      const parts = line.split(/\t|,/).map(p => p.trim());
      if (parts.length >= 2) {
        let startIndex = 0;
        if (!isNaN(Number(parts[0])) && parts.length >= 3) {
          startIndex = 1;
        }
        const s = cleanName(parts[startIndex] || '');
        const f = cleanName(parts[startIndex + 1] || '');
        const gf = cleanName(parts[startIndex + 2] || '');
        const ggf = cleanName(parts[startIndex + 3] || '');

        if (s) {
          maxId++;
          newEntries.push({
            id: maxId.toString(),
            sonName: s,
            fatherName: f,
            grandfatherName: gf,
            greatGrandfatherName: ggf,
            tags: [],
            createdAt: new Date().toISOString()
          });
        }
      }
    });

    setEntries(newEntries);
    setPasteText('');
    setShowPasteModal(false);
  };

  const cleanAllNames = () => {
    setEntries(prev => prev.map(e => ({
      ...e,
      sonName: cleanName(e.sonName),
      fatherName: cleanName(e.fatherName),
      grandfatherName: cleanName(e.grandfatherName || ''),
      greatGrandfatherName: cleanName(e.greatGrandfatherName || '')
    })));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#f5ecdc] dark:bg-[#25201b] border border-[#e2d2b5] dark:border-[#3d3328] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold font-amiri text-amber-950 dark:text-amber-100">جدول الإدخالات التسلسلي</h2>
            <span className="bg-amber-800 text-amber-100 text-xs px-2.5 py-0.5 rounded-full">الابن ← الأب ← الجد ← والد الجد</span>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            أدخل التسلسل مع تمييز الألقاب والصفات (شيخ، أستاذ، ضابط، متوفي، شهيد، إلخ) عبر قائمة الاختيار.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onSwitchToTree}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-white font-medium px-5 py-2.5 rounded-xl shadow transition-all cursor-pointer border border-amber-600"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            عرض الشجرة (من الأسفل للأعلى)
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-[#1e1915] border border-[#e5dac6] dark:border-[#3d3328] rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[260px] flex-1 sm:flex-none">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث عن اسم أو لقب..."
              className="w-full pl-4 pr-10 py-2 bg-[#fcf8f2] dark:bg-[#28221b] border border-[#d8ccb5] dark:border-[#42372c] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 text-stone-800 dark:text-stone-100 placeholder-stone-400"
            />
          </div>
          <div className="text-xs text-stone-500">
            عرض {filteredEntries.length} من أصل {entries.length} سجل
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span>لصق من Excel</span>
          </button>

          <button
            onClick={() => exportToCSV(entries)}
            className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-[#2a231d] dark:hover:bg-[#382f27] text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-[#483d31] px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-stone-500" />
            <span>تصدير CSV</span>
          </button>

          <button
            onClick={cleanAllNames}
            className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-[#2a231d] dark:hover:bg-[#382f27] text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-[#483d31] px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">تنظيف الأسماء</span>
          </button>

          <button
            onClick={onResetData}
            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">بيانات تجريبية</span>
          </button>

          <button
            onClick={handleClearAllData}
            className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow"
            title="مسح جميع البيانات وتصفير الشجرة بالكامل"
          >
            <Trash2 className="w-4 h-4" />
            <span>مسح وتصفير الكل</span>
          </button>
        </div>
      </div>

      {/* Add New Row Form */}
      <form onSubmit={handleAddRow} className="bg-amber-50/70 dark:bg-[#221c17] border border-amber-200 dark:border-[#42372c] rounded-xl p-4 shadow-sm space-y-4">
        <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-amber-700" />
          <span>إضافة تسلسل جديد مع تحديد الألقاب والصفات:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            value={newSon}
            onChange={e => setNewSon(e.target.value)}
            placeholder="الابن (مطلوب)"
            className="px-3.5 py-2 bg-white dark:bg-[#1a1512] border border-amber-300 dark:border-[#524438] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 text-stone-800 dark:text-stone-100"
          />
          <input
            type="text"
            value={newFather}
            onChange={e => setNewFather(e.target.value)}
            placeholder="الأب (اختياري)"
            className="px-3.5 py-2 bg-white dark:bg-[#1a1512] border border-amber-300 dark:border-[#524438] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 text-stone-800 dark:text-stone-100"
          />
          <input
            type="text"
            value={newGrandfather}
            onChange={e => setNewGrandfather(e.target.value)}
            placeholder="الجد (اختياري)"
            className="px-3.5 py-2 bg-white dark:bg-[#1a1512] border border-amber-300 dark:border-[#524438] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 text-stone-800 dark:text-stone-100"
          />
          <input
            type="text"
            value={newGreatGrandfather}
            onChange={e => setNewGreatGrandfather(e.target.value)}
            placeholder="والد الجد (اختياري)"
            className="px-3.5 py-2 bg-white dark:bg-[#1a1512] border border-amber-300 dark:border-[#524438] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 text-stone-800 dark:text-stone-100"
          />
        </div>

        {/* Checkbox Checklist for Tags */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-amber-700" />
            <span>تمييز الألقاب والصفات (اختر ما ينطبق):</span>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {AVAILABLE_TAGS.map(tag => {
              const isChecked = newTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleNewTag(tag)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    isChecked 
                      ? 'bg-amber-800 text-white border-amber-900 shadow-xs' 
                      : 'bg-white dark:bg-[#1a1512] text-stone-700 dark:text-stone-300 border-amber-200 dark:border-stone-700 hover:bg-amber-100/50'
                  }`}
                >
                  {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-amber-200" /> : <Square className="w-3.5 h-3.5 text-stone-400" />}
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!newSon.trim() || !newFather.trim()}
            className="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium text-sm shadow transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة التسلسل</span>
          </button>
        </div>
      </form>

      {/* Excel-like Table Container */}
      <div className="bg-white dark:bg-[#1e1915] border border-[#e5dac6] dark:border-[#3d3328] rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-[#f5ecdc] dark:bg-[#27211b] text-amber-950 dark:text-amber-200 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-[#e2d2b5] dark:border-[#3d3328]">
              <tr>
                <th className="px-4 py-3.5 cursor-pointer hover:bg-amber-100/60" onClick={() => handleSort('id')}>ID</th>
                <th className="px-4 py-3.5 cursor-pointer hover:bg-amber-100/60" onClick={() => handleSort('sonName')}>الابن</th>
                <th className="px-4 py-3.5 cursor-pointer hover:bg-amber-100/60" onClick={() => handleSort('fatherName')}>الأب</th>
                <th className="px-4 py-3.5">الجد</th>
                <th className="px-4 py-3.5">والد الجد</th>
                <th className="px-4 py-3.5">الألقاب والصفات</th>
                <th className="px-4 py-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e7d5] dark:divide-[#2f2720] text-sm">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-amber-600/60" />
                      <p>لا توجد إدخالات مطابقة أو تم تصفير الشجرة.</p>
                      <button onClick={onResetData} className="mt-2 text-xs text-amber-700 underline font-medium">
                        تحميل البيانات التجريبية
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isEditing = editingId === entry.id;

                  return (
                    <tr key={entry.id} className="hover:bg-amber-50/50 dark:hover:bg-[#241e17] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-stone-500 font-semibold">{entry.id}</td>
                      <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editSon}
                            onChange={e => setEditSon(e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-[#120f0d] border border-amber-600 rounded text-sm"
                          />
                        ) : (
                          <span className="text-amber-900 dark:text-amber-200 font-bold">{entry.sonName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFather}
                            onChange={e => setEditFather(e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-[#120f0d] border border-amber-600 rounded text-sm"
                          />
                        ) : (
                          <span>{entry.fatherName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGrandfather}
                            onChange={e => setEditGrandfather(e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-[#120f0d] border border-amber-600 rounded text-sm"
                          />
                        ) : (
                          <span>{entry.grandfatherName || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGreatGrandfather}
                            onChange={e => setEditGreatGrandfather(e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-[#120f0d] border border-amber-600 rounded text-sm"
                          />
                        ) : (
                          <span>{entry.greatGrandfatherName || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {AVAILABLE_TAGS.map(tag => {
                              const isChecked = editTags.includes(tag);
                              return (
                                <button
                                  type="button"
                                  key={tag}
                                  onClick={() => toggleEditTag(tag)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${
                                    isChecked ? 'bg-amber-800 text-white border-amber-900' : 'bg-stone-100 text-stone-600 border-stone-300'
                                  }`}
                                >
                                  {tag} {isChecked ? '✓' : ''}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {entry.tags && entry.tags.length > 0 ? (
                              entry.tags.map(t => (
                                <span key={t} className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 text-[10px] px-2 py-0.5 rounded-md font-medium">
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-stone-400 text-xs">—</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => saveEdit(entry.id)} className="p-1.5 bg-emerald-700 text-white rounded text-xs cursor-pointer">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={cancelEdit} className="p-1.5 bg-stone-500 text-white rounded text-xs cursor-pointer">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => startEdit(entry)} className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 rounded cursor-pointer" title="تعديل">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(entry.id)} className="p-1.5 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 rounded cursor-pointer" title="حذف">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear Data Button at Bottom of Entries Page */}
      <div className="flex justify-end pt-2 pb-6">
        <button
          onClick={handleClearAllData}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-xs font-semibold shadow transition-all cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>مسح جميع البيانات من الداتا الرئيسية تماماً وتفريغ جدول البيانات وتصفير الشجرة</span>
        </button>
      </div>

      {/* Bulk Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcf8f2] dark:bg-[#1e1915] border border-amber-300 dark:border-[#483d31] rounded-2xl p-6 max-w-xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-amiri text-amber-950 dark:text-amber-100">لصق تسلسل العائلة من Excel</h3>
              <button onClick={() => setShowPasteModal(false)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 mb-3">
              انسخ الأعمدة بالترتيب: (الابن، الأب، الجد، والد الجد) والصقها هنا.
            </p>
            <textarea
              rows={8}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="محمد	أحمد	رحيم	معجون"
              className="w-full p-3 font-mono text-xs bg-white dark:bg-[#120f0d] border border-amber-300 dark:border-[#524438] rounded-xl focus:outline-none"
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium cursor-pointer">
                إلغاء
              </button>
              <button onClick={handleBulkPaste} className="px-5 py-2 bg-amber-700 text-white rounded-xl text-xs font-medium shadow cursor-pointer flex items-center gap-1.5">
                <Upload className="w-4 h-4" />
                <span>استيراد التسلسل</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
