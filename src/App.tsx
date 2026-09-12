 import React, { useState, useEffect, useMemo } from 'react';
import { ViewMode, RelationEntry, TreeSettings } from './types';
import { INITIAL_ENTRIES, buildFamilyTree } from './utils/treeUtils';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { EntriesTable } from './components/EntriesTable';
import { FamilyTreeViewer } from './components/FamilyTreeViewer';
import { TreePine, Table, Sparkles, Heart } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewMode>('tree');
  
  // Persistent state for entries
  const [entries, setEntries] = useState<RelationEntry[]>(() => {
    try {
      const saved = localStorage.getItem('heritage_family_tree_entries');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load entries from localStorage', e);
    }
    return INITIAL_ENTRIES;
  });

  // Sync with Firestore on Auth state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const colRef = collection(db, `users/${user.uid}/familyEntries`);
          const snapshot = await getDocs(colRef);
          const cloudEntries: RelationEntry[] = [];
          snapshot.forEach(d => {
            cloudEntries.push(d.data() as RelationEntry);
          });
          if (cloudEntries.length > 0) {
            setEntries(cloudEntries);
          } else if (entries.length > 0) {
            // Upload local entries to cloud
            for (const entry of entries) {
              await setDoc(doc(db, `users/${user.uid}/familyEntries`, entry.id), {
                ...entry,
                userId: user.uid
              });
            }
          }
        } catch (e) {
          console.error("Error fetching from Firestore", e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Tree customization settings
  const [settings, setSettings] = useState<TreeSettings>(() => {
    try {
      const saved = localStorage.getItem('heritage_family_tree_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      title: 'شجرة عائلة النجم',
      subtitle: 'سلسلة الآباء والأبناء التراثية',
      showAyah: true,
      showOrnaments: true,
      showLeaves: true,
      lineThickness: 3,
      layoutStyle: 'heritage',
      ornamentStyle: 'islamic',
      themeColor: 'amber',
      fontFamily: 'Amiri',
      nameFontSizeScale: 1.0,
      branchStyle: 'curved',
      generationOrder: 'descending'
    };
  });

  // Auto-save to localStorage & Firestore if logged in
  useEffect(() => {
    try {
      localStorage.setItem('heritage_family_tree_entries', JSON.stringify(entries));
      if (auth.currentUser) {
        entries.forEach(async (entry) => {
          try {
            await setDoc(doc(db, `users/${auth.currentUser!.uid}/familyEntries`, entry.id), {
              ...entry,
              userId: auth.currentUser!.uid
            });
          } catch (e) {
            console.error("Firestore sync error", e);
          }
        });
      }
    } catch (e) {
      console.error('Failed to save entries', e);
    }
  }, [entries]);

  useEffect(() => {
    try {
      localStorage.setItem('heritage_family_tree_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }, [settings]);

  // Build tree data automatically from entries
  const treeData = useMemo(() => {
    return buildFamilyTree(entries);
  }, [entries]);

  const handleResetData = () => {
    if (window.confirm('هل أنت متأكد من استعادة البيانات التجريبية الافتراضية؟ سيتم استبدال البيانات الحالية.')) {
      setEntries(INITIAL_ENTRIES);
    }
  };

  return (
    <div className="min-h-screen heritage-pattern flex flex-col text-stone-800 dark:text-stone-100">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportClick={() => setActiveTab('tree')}
        onResetData={handleResetData}
        totalPersons={treeData.allPersons.length}
        totalRelations={treeData.totalRelations}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* Statistics Summary Bar */}
        <StatsBar
          totalPersons={treeData.allPersons.length}
          totalRelations={treeData.totalRelations}
          maxGeneration={treeData.maxGeneration}
          rootsCount={treeData.rootsCount}
          largestGenerationSize={treeData.largestGenerationSize}
        />

        {/* View Switcher Container */}
        {activeTab === 'tree' ? (
          <FamilyTreeViewer
            treeData={treeData}
            entries={entries}
            onSwitchToEntries={() => setActiveTab('entries')}
            settings={settings}
            setSettings={setSettings}
          />
        ) : (
          <EntriesTable
            entries={entries}
            setEntries={setEntries}
            onSwitchToTree={() => setActiveTab('tree')}
            onResetData={handleResetData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1e1915] text-stone-400 border-t border-[#3d3328] py-6 px-4 text-xs mt-12 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TreePine className="w-5 h-5 text-amber-500" />
            <span className="font-amiri text-amber-200 text-sm font-bold">شجرة العائلة التراثية — سلسلة الآباء والأبناء</span>
          </div>
          <p className="text-stone-400 text-center">
          برمجة وتصميم | المهندس ياسر المعجون 2020
          </p>
          <div className="text-stone-500">
            جميع الحقوق محفوظة © {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
