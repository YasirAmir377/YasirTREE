import { RelationEntry, FamilyMember } from '../types';

export const INITIAL_ENTRIES: RelationEntry[] = [
  { id: '1', sonName: 'معجون', fatherName: 'نجم', grandfatherName: '', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '2', sonName: 'أحمد', fatherName: 'رحيم', grandfatherName: 'معجون', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '3', sonName: 'رحيم', fatherName: 'معجون', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '4', sonName: 'ياسر', fatherName: 'عامر', grandfatherName: 'مهدى', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '5', sonName: 'طه', fatherName: 'عامر', grandfatherName: 'مهدى', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '6', sonName: 'صالح', fatherName: 'نجم', grandfatherName: '', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '7', sonName: 'ابرار', fatherName: 'محمد', grandfatherName: 'معجون', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '8', sonName: 'عامر', fatherName: 'مهدى', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '9', sonName: 'محمد', fatherName: 'معجون', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '10', sonName: 'ساهر', fatherName: 'معجون', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '11', sonName: 'مصطفى', fatherName: 'عامر', grandfatherName: 'مهدى', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '12', sonName: 'حمزة', fatherName: 'ساهر', grandfatherName: 'معجون', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '13', sonName: 'مهدى', fatherName: 'نجم', grandfatherName: '', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '14', sonName: 'ابراهيم', fatherName: 'ساهر', grandfatherName: 'معجون', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '15', sonName: 'اواب', fatherName: 'مهدى', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '16', sonName: 'عرفان', fatherName: 'صالح مهدي', grandfatherName: 'مهدي', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '17', sonName: 'صالح', fatherName: 'مهدي', grandfatherName: 'صالح', greatGrandfatherName: '', createdAt: new Date().toISOString() },
];

export function cleanName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
}

export function buildFamilyTree(entries: RelationEntry[]): {
  roots: FamilyMember[];
  allPersons: string[];
  totalRelations: number;
  maxGeneration: number;
  generationsCount: number;
  largestGenerationSize: number;
  rootsCount: number;
} {
  const allPersonsSet = new Set<string>();
  const childrenMap = new Map<string, Set<string>>(); // parent -> set of sons
  const parentMap = new Map<string, Set<string>>(); // son -> set of parents

  function addRelation(parent: string, son: string) {
    const p = cleanName(parent);
    const s = cleanName(son);
    if (!p || !s || p === s) return;

    allPersonsSet.add(p);
    allPersonsSet.add(s);

    if (!childrenMap.has(p)) childrenMap.set(p, new Set());
    childrenMap.get(p)!.add(s);

    if (!parentMap.has(s)) parentMap.set(s, new Set());
    parentMap.get(s)!.add(p);
  }

  entries.forEach(e => {
    const son = cleanName(e.sonName);
    const father = cleanName(e.fatherName);
    const grandfather = cleanName(e.grandfatherName || '');
    const greatGrandfather = cleanName(e.greatGrandfatherName || '');

    if (greatGrandfather && grandfather) {
      addRelation(greatGrandfather, grandfather);
    }
    if (grandfather && father) {
      addRelation(grandfather, father);
    }
    if (father && son) {
      addRelation(father, son);
    }
  });

  const allPersons = Array.from(allPersonsSet);
  const totalRelations = entries.length;

  // Find roots (persons with no parents in the entries)
  const roots: string[] = [];
  allPersons.forEach(person => {
    const parents = parentMap.get(person);
    if (!parents || parents.size === 0) {
      roots.push(person);
    }
  });

  if (roots.length === 0 && allPersons.length > 0) {
    roots.push(allPersons[0]);
  }

  // Build recursive tree allowing same names across different branches with dynamic leaf count calculation
  function buildNode(name: string, currentGen: number, ancestorChain: string[]): FamilyMember {
    const newAncestorChain = [...ancestorChain, name];

    const sonNames = childrenMap.get(name) || new Set<string>();
    const children: FamilyMember[] = [];

    sonNames.forEach(sonName => {
      // Prevent infinite loops only if this exact person is an ancestor in the direct line
      if (!ancestorChain.includes(sonName)) {
        children.push(buildNode(sonName, currentGen + 1, newAncestorChain));
      }
    });

    const uniqueId = `${name}-${ancestorChain.join('-')}-${currentGen}-${Math.random().toString(36).substring(2, 6)}`;

    return {
      uniqueId,
      name,
      children,
      generation: currentGen,
      parents: Array.from(parentMap.get(name) || [])
    };
  }

  const rootMembers: FamilyMember[] = roots.map(rootName => buildNode(rootName, 1, []));

  // Calculate stats per generation
  const genMap = new Map<number, number>();
  let maxGen = 1;

  function traverseForStats(node: FamilyMember) {
    if (node.generation > maxGen) maxGen = node.generation;
    genMap.set(node.generation, (genMap.get(node.generation) || 0) + 1);
    node.children.forEach(c => traverseForStats(c));
  }

  rootMembers.forEach(r => traverseForStats(r));

  let largestGenSize = 0;
  genMap.forEach(count => {
    if (count > largestGenSize) largestGenSize = count;
  });

  return {
    roots: rootMembers,
    allPersons,
    totalRelations,
    maxGeneration: maxGen,
    generationsCount: genMap.size || 1,
    largestGenerationSize: largestGenSize || allPersons.length,
    rootsCount: roots.length
  };
}

export function exportToCSV(entries: RelationEntry[]) {
  const headers = ['ID', 'الابن', 'الأب', 'الجد', 'والد الجد'];
  const rows = entries.map(e => [
    e.id, 
    `"${(e.sonName || '').replace(/"/g, '""')}"`, 
    `"${(e.fatherName || '').replace(/"/g, '""')}"`,
    `"${(e.grandfatherName || '').replace(/"/g, '""')}"`,
    `"${(e.greatGrandfatherName || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `شجرة_العائلة_التسلسلية_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
