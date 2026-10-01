import { RelationEntry, FamilyMember } from '../types';

export const INITIAL_ENTRIES: RelationEntry[] = [
  { id: '1', personId: 'p-maajoun', parentId: 'p-najm', sonName: 'معجون', fatherName: 'نجم', grandfatherName: '', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '2', personId: 'p-ahmed', parentId: 'p-rahim', sonName: 'أحمد', fatherName: 'رحيم', grandfatherName: 'معجون', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '3', personId: 'p-rahim', parentId: 'p-maajoun', sonName: 'رحيم', fatherName: 'معجون', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '4', personId: 'p-yasser', parentId: 'p-aamer', sonName: 'ياسر', fatherName: 'عامر', grandfatherName: 'مهدى', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '5', personId: 'p-taha', parentId: 'p-aamer', sonName: 'طه', fatherName: 'عامر', grandfatherName: 'مهدى', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '6', personId: 'p-saleh-1', parentId: 'p-najm', sonName: 'صالح', fatherName: 'نجم', grandfatherName: '', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '7', personId: 'p-abrar', parentId: 'p-mohammed', sonName: 'ابرار', fatherName: 'محمد', grandfatherName: 'معجون', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '8', personId: 'p-aamer', parentId: 'p-mahdi-1', sonName: 'عامر', fatherName: 'مهدى', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '9', personId: 'p-mohammed', parentId: 'p-maajoun', sonName: 'محمد', fatherName: 'معجون', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '10', personId: 'p-saher', parentId: 'p-maajoun', sonName: 'ساهر', fatherName: 'معجون', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '11', personId: 'p-mustafa', parentId: 'p-aamer', sonName: 'مصطفى', fatherName: 'عامر', grandfatherName: 'مهدى', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '12', personId: 'p-hamza', parentId: 'p-saher', sonName: 'حمزة', fatherName: 'ساهر', grandfatherName: 'معجون', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '13', personId: 'p-mahdi-1', parentId: 'p-najm', sonName: 'مهدى', fatherName: 'نجم', grandfatherName: '', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '14', personId: 'p-ibrahim', parentId: 'p-saher', sonName: 'ابراهيم', fatherName: 'ساهر', grandfatherName: 'معجون', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '15', personId: 'p-awab', parentId: 'p-mahdi-1', sonName: 'اواب', fatherName: 'مهدى', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '16', personId: 'p-irfan', parentId: 'p-saleh-2', sonName: 'عرفان', fatherName: 'صالح', grandfatherName: 'مهدي', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
  { id: '17', personId: 'p-saleh-2', parentId: 'p-mahdi-1', sonName: 'صالح', fatherName: 'مهدى', grandfatherName: 'نجم', greatGrandfatherName: '', createdAt: new Date().toISOString() },
  { id: '18', personId: 'p-mahdi-2', parentId: 'p-saleh-2', sonName: 'مهدي', fatherName: 'صالح', grandfatherName: 'مهدي', greatGrandfatherName: 'نجم', createdAt: new Date().toISOString() },
];

export function cleanName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes entries to ensure every person has a persistent unique ID
 * and links to their parent by ID.
 */
export function ensureEntryIds(entries: RelationEntry[]): RelationEntry[] {
  const nameToId = new Map<string, string>();

  // Pass 1: ensure personId exists
  const normalized = entries.map((entry, idx) => {
    const personId = entry.personId || `p-${entry.id || idx}-${Math.random().toString(36).substring(2, 7)}`;
    const sonName = cleanName(entry.sonName);
    if (sonName && !nameToId.has(sonName)) {
      nameToId.set(sonName, personId);
    }
    return {
      ...entry,
      personId,
      sonName
    };
  });

  // Pass 2: resolve parentId if missing
  return normalized.map(entry => {
    let parentId = entry.parentId;
    const cleanFather = cleanName(entry.fatherName);
    if (!parentId && cleanFather) {
      const fatherEntry = normalized.find(e => cleanName(e.sonName) === cleanFather);
      if (fatherEntry) {
        parentId = fatherEntry.personId;
      } else {
        parentId = `root-${cleanFather}`;
      }
    }
    return {
      ...entry,
      parentId
    };
  });
}

/**
 * Builds the hierarchical family tree strictly based on unique IDs.
 * Duplicate names are supported naturally anywhere in the tree.
 */
export function buildFamilyTree(rawEntries: RelationEntry[]): {
  roots: FamilyMember[];
  allPersons: string[];
  totalRelations: number;
  maxGeneration: number;
  generationsCount: number;
  largestGenerationSize: number;
  rootsCount: number;
} {
  if (!rawEntries || rawEntries.length === 0) {
    return {
      roots: [],
      allPersons: [],
      totalRelations: 0,
      maxGeneration: 0,
      generationsCount: 0,
      largestGenerationSize: 0,
      rootsCount: 0
    };
  }

  const entries = ensureEntryIds(rawEntries);

  interface NodeData {
    uniqueId: string;
    name: string;
    parentId?: string;
    tags?: string[];
  }

  const nodeMap = new Map<string, NodeData>();
  const childrenMap = new Map<string, string[]>(); // parentId -> childIds

  // 1. Add all person nodes from entries
  entries.forEach(e => {
    const pid = e.personId || e.id;
    const name = cleanName(e.sonName);
    if (!pid || !name) return;

    nodeMap.set(pid, {
      uniqueId: pid,
      name: name,
      parentId: e.parentId || undefined,
      tags: e.tags
    });
  });

  // 2. Add root ancestors that are referenced as parentId but not sons (e.g. Najm)
  entries.forEach(e => {
    if (e.parentId && !nodeMap.has(e.parentId)) {
      const fatherName = cleanName(e.fatherName) || 'المؤسس';
      nodeMap.set(e.parentId, {
        uniqueId: e.parentId,
        name: fatherName,
        parentId: undefined
      });
    }
  });

  // 3. Build parent-child relationships
  nodeMap.forEach(node => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      if (!childrenMap.has(node.parentId)) {
        childrenMap.set(node.parentId, []);
      }
      childrenMap.get(node.parentId)!.push(node.uniqueId);
    }
  });

  // 4. Find root nodes (nodes without a parent or whose parent is not in nodeMap)
  const rootIds: string[] = [];
  nodeMap.forEach(node => {
    if (!node.parentId || !nodeMap.has(node.parentId)) {
      rootIds.push(node.uniqueId);
    }
  });

  if (rootIds.length === 0 && nodeMap.size > 0) {
    rootIds.push(nodeMap.keys().next().value!);
  }

  // 5. Recursively build FamilyMember tree
  function buildHierarchy(id: string, gen: number, visited: Set<string>): FamilyMember {
    const node = nodeMap.get(id)!;
    const newVisited = new Set(visited).add(id);
    const childIds = childrenMap.get(id) || [];
    const children: FamilyMember[] = [];

    childIds.forEach(childId => {
      // Prevent infinite loops strictly by ID
      if (!newVisited.has(childId) && nodeMap.has(childId)) {
        children.push(buildHierarchy(childId, gen + 1, newVisited));
      }
    });

    return {
      uniqueId: node.uniqueId,
      name: node.name,
      personId: node.uniqueId,
      parentId: node.parentId,
      children,
      generation: gen,
      parents: node.parentId ? [node.parentId] : [],
      tags: node.tags
    };
  }

  const roots: FamilyMember[] = rootIds.map(rid => buildHierarchy(rid, 1, new Set()));

  // 6. Calculate statistics
  const genMap = new Map<number, number>();
  let maxGen = 1;
  const allPersonNames: string[] = [];

  function traverseForStats(node: FamilyMember) {
    if (node.generation > maxGen) maxGen = node.generation;
    genMap.set(node.generation, (genMap.get(node.generation) || 0) + 1);
    allPersonNames.push(node.name);
    node.children.forEach(c => traverseForStats(c));
  }

  roots.forEach(r => traverseForStats(r));

  let largestGenSize = 0;
  genMap.forEach(count => {
    if (count > largestGenSize) largestGenSize = count;
  });

  return {
    roots,
    allPersons: allPersonNames,
    totalRelations: entries.length,
    maxGeneration: maxGen,
    generationsCount: genMap.size || 1,
    largestGenerationSize: largestGenSize || 1,
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
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `family_tree_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
