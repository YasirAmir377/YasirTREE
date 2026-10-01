import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FamilyMember, TreeSettings, RelationEntry } from '../types';
import { cleanName } from '../utils/treeUtils';
import { computeStrictTreeLayout } from '../utils/strictTreeLayout';
import { 
  ZoomIn, ZoomOut, RotateCcw, Download, 
  Search, Sliders, Sparkles, ChevronDown, ChevronUp, FileText, Printer, ArrowUpDown, LayoutGrid,
  ArrowDown, ArrowUp
} from 'lucide-react';

interface FamilyTreeViewerProps {
  treeData: {
    roots: FamilyMember[];
    allPersons: string[];
    totalRelations: number;
    maxGeneration: number;
    generationsCount: number;
    largestGenerationSize: number;
    rootsCount: number;
  };
  entries: RelationEntry[];
  setEntries: React.Dispatch<React.SetStateAction<RelationEntry[]>>;
  onSwitchToEntries: () => void;
  settings: TreeSettings;
  setSettings: React.Dispatch<React.SetStateAction<TreeSettings>>;
  onAddChild: (fatherIdOrName: string, sonName: string, tags?: string[], parentId?: string) => void;
  onDeleteNode: (personIdOrName: string, displayName?: string) => void;
}

export const FamilyTreeViewer: React.FC<FamilyTreeViewerProps> = ({
  treeData,
  entries,
  setEntries,
  onSwitchToEntries,
  settings,
  setSettings,
  onAddChild,
  onDeleteNode
}) => {
  const currentFont = settings.fontFamily || 'Amiri';
  const nameScale = settings.nameFontSizeScale || 1.0;
  const branchStyle = settings.branchStyle || 'curved';
  const generationOrder = settings.generationOrder || 'ascending'; // 'ascending' = Top-to-Bottom (standard vertical), 'descending' = Bottom-to-Top (inverted vertical)

  // Compute mathematically guaranteed non-crossing, non-overlapping tree layout
  const strictLayout = useMemo(() => {
    return computeStrictTreeLayout(treeData.roots, settings, generationOrder);
  }, [treeData.roots, settings, generationOrder]);

  const [zoom, setZoom] = useState<number>(() => {
    return strictLayout.autoFitScale || (typeof window !== 'undefined' && window.innerWidth < 768 ? 0.45 : 1.0);
  });
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Automatically fit the whole tree inside the frame width:
  // Recalculates whenever nodes are added, removed, or moved
  useEffect(() => {
    if (strictLayout.autoFitScale) {
      setZoom(strictLayout.autoFitScale);
      setPan({ x: 0, y: 0 });
    }
  }, [treeData.rootsCount, treeData.allPersons.length, entries.length, strictLayout.autoFitScale]);

  // Recalculate fit on screen / window resize
  useEffect(() => {
    const handleResize = () => {
      if (strictLayout.autoFitScale) {
        setZoom(prev => Math.min(prev, strictLayout.autoFitScale));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [strictLayout.autoFitScale]);

  // Mouse wheel smooth zoom handler (confined inside container)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom(prev => Math.min(3.5, Math.max(0.15, Number((prev * zoomFactor).toFixed(3)))));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const handleReparentNode = (sonId: string, targetFatherId: string, targetFatherName: string) => {
    if (!setEntries) return;
    if (!sonId || !targetFatherId || sonId === targetFatherId) return;

    // Check circularity strictly by ID: targetFatherId cannot be a descendant of sonId
    const descendants = new Set<string>();
    const queue = [sonId];
    while (queue.length > 0) {
      const currId = queue.shift()!;
      descendants.add(currId);
      entries.forEach(e => {
        const pid = e.personId || e.id;
        if (e.parentId === currId && !descendants.has(pid)) {
          descendants.add(pid);
          queue.push(pid);
        }
      });
    }

    if (descendants.has(targetFatherId)) {
      alert('عذراً، لا يمكن ربط الشخص بأحد أبنائه أو أحفاده لتجنب التداخل الدائري.');
      return;
    }

    // Look up target father's ancestry
    const fatherEntry = entries.find(e => (e.personId || e.id) === targetFatherId);
    const newGrandfather = fatherEntry?.fatherName || '';
    const newGreatGrandfather = fatherEntry?.grandfatherName || '';

    setEntries(prev => {
      let found = false;
      const updated = prev.map(entry => {
        const pid = entry.personId || entry.id;
        // Update direct child
        if (pid === sonId) {
          found = true;
          return {
            ...entry,
            parentId: targetFatherId,
            fatherName: targetFatherName,
            grandfatherName: newGrandfather,
            greatGrandfatherName: newGreatGrandfather
          };
        }
        // Update downstream children
        if (entry.parentId === sonId) {
          return {
            ...entry,
            grandfatherName: targetFatherName,
            greatGrandfatherName: newGrandfather
          };
        }
        return entry;
      });

      if (!found) {
        const nextId = prev.length > 0 ? (Math.max(...prev.map(item => parseInt(item.id) || 0)) + 1).toString() : '1';
        updated.push({
          id: nextId,
          personId: sonId,
          parentId: targetFatherId,
          sonName: 'فرد',
          fatherName: targetFatherName,
          grandfatherName: newGrandfather,
          greatGrandfatherName: newGreatGrandfather,
          createdAt: new Date().toISOString()
        });
      }

      return updated;
    });

    setNodeOffsets({});
    setBranchOffsets({});
    setSelectedBranch(null);
  };
  const [showAddChildModal, setShowAddChildModal] = useState<boolean>(false);
  const [showAddParentModal, setShowAddParentModal] = useState<boolean>(false);
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
  const [showInsertModal, setShowInsertModal] = useState<boolean>(false);
  const [insertBranchInfo, setInsertBranchInfo] = useState<{ parentId: string; childId: string; parentName: string; childName: string } | null>(null);
  const [insertPersonName, setInsertPersonName] = useState<string>('');
  const [insertPersonTags, setInsertPersonTags] = useState<string[]>([]);
  const [renameTargetId, setRenameTargetId] = useState<string>('');
  const [renameTargetName, setRenameTargetName] = useState<string>('');
  const [newEditedName, setNewEditedName] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    member: FamilyMember | null;
  }>({ visible: false, x: 0, y: 0, member: null });

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  const [addingFatherId, setAddingFatherId] = useState<string>('');
  const [addingFatherName, setAddingFatherName] = useState<string>('');
  const [targetPersonId, setTargetPersonId] = useState<string>('');
  const [targetPersonName, setTargetPersonName] = useState<string>('');
  const [newChildName, setNewChildName] = useState<string>('');
  const [newParentName, setNewParentName] = useState<string>('');
  const [selectedChildTags, setSelectedChildTags] = useState<string[]>([]);

  const AVAILABLE_TAG_OPTIONS = ['شهيد', 'طبيب', 'ضابط', 'شيخ', 'تدريسي', 'معلم', 'متوفي'];

  const handleOpenAddModal = (fatherId: string, fatherName: string) => {
    setAddingFatherId(fatherId);
    setAddingFatherName(fatherName);
    setNewChildName('');
    setSelectedChildTags([]);
    setShowAddChildModal(true);
  };

  const handleOpenAddParentModal = (personId: string, personName: string) => {
    setTargetPersonId(personId);
    setTargetPersonName(personName);
    setNewParentName('');
    setShowAddParentModal(true);
  };

  const handleOpenRenameModal = (personId: string, name: string) => {
    setRenameTargetId(personId);
    setRenameTargetName(name);
    setNewEditedName(name);
    setShowRenameModal(true);
  };

  const handleRenameNode = (personId: string, newName: string) => {
    if (!setEntries) return;
    if (!newName.trim()) return;
    const trimmed = newName.trim();
    setEntries(prev => prev.map(e => {
      const pid = e.personId || e.id;
      if (pid === personId) {
        return { ...e, sonName: trimmed };
      }
      if (e.parentId === personId) {
        return { ...e, fatherName: trimmed };
      }
      return e;
    }));
  };

  const handleConfirmAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChildName.trim() && addingFatherName) {
      onAddChild(addingFatherName, newChildName.trim(), selectedChildTags, addingFatherId);
      setShowAddChildModal(false);
    }
  };

  const handleConfirmAddParent = (e: React.FormEvent) => {
    e.preventDefault();
    if (newParentName.trim() && targetPersonId) {
      const newParentId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newParentEntry: RelationEntry = {
        id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        personId: newParentId,
        sonName: newParentName.trim(),
        fatherName: '',
        createdAt: new Date().toISOString()
      };
      setEntries(prev => {
        const updated = prev.map(e => {
          const pid = e.personId || e.id;
          if (pid === targetPersonId) {
            return {
              ...e,
              parentId: newParentId,
              fatherName: newParentName.trim()
            };
          }
          return e;
        });
        return [newParentEntry, ...updated];
      });
      setShowAddParentModal(false);
    }
  };

  const handleConfirmInsertPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!insertBranchInfo || !insertPersonName.trim() || !setEntries) return;

    const parentId = insertBranchInfo.parentId;
    const childId = insertBranchInfo.childId;
    const parentName = insertBranchInfo.parentName.trim();
    const childName = insertBranchInfo.childName.trim();
    const newName = insertPersonName.trim();

    // Look up parent's ancestry
    const parentEntry = entries.find(entry => (entry.personId || entry.id) === parentId);
    const parentFather = parentEntry?.fatherName || '';
    const parentGrandfather = parentEntry?.grandfatherName || '';

    // 1. Create entry for newPerson as child of parentId (with unique ID)
    const newPersonId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newPersonEntry: RelationEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      personId: newPersonId,
      parentId: parentId,
      sonName: newName,
      fatherName: parentName,
      grandfatherName: parentFather,
      greatGrandfatherName: parentGrandfather,
      tags: insertPersonTags,
      createdAt: new Date().toISOString()
    };

    // 2. Update child's entry so child now has newPersonId as parentId
    setEntries(prev => {
      let childFound = false;
      const updated = prev.map(entry => {
        const pid = entry.personId || entry.id;
        if (pid === childId) {
          childFound = true;
          return {
            ...entry,
            parentId: newPersonId,
            fatherName: newName,
            grandfatherName: parentName,
            greatGrandfatherName: parentFather
          };
        }
        if (entry.parentId === childId) {
          return {
            ...entry,
            grandfatherName: newName,
            greatGrandfatherName: parentName
          };
        }
        return entry;
      });

      if (!childFound) {
        updated.push({
          id: `entry-${Date.now() + 1}-${Math.random().toString(36).substring(2, 6)}`,
          personId: childId,
          parentId: newPersonId,
          sonName: childName,
          fatherName: newName,
          grandfatherName: parentName,
          greatGrandfatherName: parentFather,
          createdAt: new Date().toISOString()
        });
      }

      return [newPersonEntry, ...updated];
    });

    setNodeOffsets({});
    setBranchOffsets({});
    setSelectedBranch(null);
    setShowInsertModal(false);
    setInsertBranchInfo(null);
    setInsertPersonName('');
    setInsertPersonTags([]);
  };
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragStart, setNodeDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [branchOffsets, setBranchOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingBranchKey, setDraggingBranchKey] = useState<string | null>(null);
  const branchDragStartRef = useRef<{ clientX: number, clientY: number, startX: number, startY: number }>({ clientX: 0, clientY: 0, startX: 0, startY: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchMovedRef = useRef<boolean>(false);

  const handleBranchMouseDown = (e: React.MouseEvent, branchKey: string) => {
    e.stopPropagation();
    setDraggingBranchKey(branchKey);
    const current = branchOffsets[branchKey] || { x: 0, y: 0 };
    branchDragStartRef.current = { clientX: e.clientX, clientY: e.clientY, startX: current.x, startY: current.y };
  };

  const handleBranchMouseMove = (e: React.MouseEvent) => {
    if (!draggingBranchKey) return;
    const dx = (e.clientX - branchDragStartRef.current.clientX) / zoom;
    const dy = (e.clientY - branchDragStartRef.current.clientY) / zoom;
    setBranchOffsets(prev => ({
      ...prev,
      [draggingBranchKey]: {
        x: branchDragStartRef.current.startX + dx,
        y: branchDragStartRef.current.startY + dy
      }
    }));
  };

  const handleBranchMouseUp = () => {
    setDraggingBranchKey(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, uniqueId: string) => {
    e.stopPropagation();
    setDraggingNodeId(uniqueId);
    const current = nodeOffsets[uniqueId] || { x: 0, y: 0 };
    setNodeDragStart({ x: e.clientX - current.x, y: e.clientY - current.y });
  };

  const handleNodeMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId) return;
    let newX = e.clientX - nodeDragStart.x;
    let newY = e.clientY - nodeDragStart.y;
    newX = Math.max(-900, Math.min(900, newX));
    newY = Math.max(-750, Math.min(750, newY));
    setNodeOffsets(prev => ({
      ...prev,
      [draggingNodeId]: { x: newX, y: newY }
    }));
  };

  const handleNodeMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleNodeTouchStart = (e: React.TouchEvent, uniqueId: string) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      setDraggingNodeId(uniqueId);
      const current = nodeOffsets[uniqueId] || { x: 0, y: 0 };
      setNodeDragStart({ x: e.touches[0].clientX - current.x, y: e.touches[0].clientY - current.y });
    }
  };

  const handleNodeTouchMove = (e: React.TouchEvent) => {
    if (!draggingNodeId || e.touches.length !== 1) return;
    let newX = e.touches[0].clientX - nodeDragStart.x;
    let newY = e.touches[0].clientY - nodeDragStart.y;
    newX = Math.max(-900, Math.min(900, newX));
    newY = Math.max(-750, Math.min(750, newY));
    setNodeOffsets(prev => ({
      ...prev,
      [draggingNodeId]: { x: newX, y: newY }
    }));
  };

  const handleNodeTouchEnd = () => {
    setDraggingNodeId(null);
  };

  const handleAutoLayout = () => {
    setNodeOffsets({});
    setBranchOffsets({});
    setPan({ x: 0, y: 0 });
    setZoom(strictLayout.autoFitScale || 1.0);
    if (containerRef.current) {
      containerRef.current.scrollTo({
        left: (containerRef.current.scrollWidth - containerRef.current.clientWidth) / 2,
        top: 0,
        behavior: 'smooth'
      });
    }
  };
  const [initialPinchDist, setInitialPinchDist] = useState<number | null>(null);
  const [initialZoomOnPinch, setInitialZoomOnPinch] = useState<number>(1.0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ clientX: number; clientY: number; startPanX: number; startPanY: number }>({
    clientX: 0,
    clientY: 0,
    startPanX: 0,
    startPanY: 0
  });

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't initiate background pan if clicking on an interactive node, branch button, or modal
    if (target.tagName === 'svg' || target.tagName === 'rect' || target === containerRef.current || target.classList?.contains('canvas-bg')) {
      setIsPanning(true);
      setPanStart({
        clientX: e.clientX,
        clientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y
      });
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const svgElement = document.getElementById('heritage-tree-svg');
    const svgRect = svgElement ? svgElement.getBoundingClientRect() : null;
    const svgScale = svgRect && svgRect.width > 0 ? (3000 / svgRect.width) : 1;
    const dx = (e.clientX - panStart.clientX) * svgScale;
    const dy = (e.clientY - panStart.clientY) * svgScale;
    const maxPanX = 2500 * Math.max(1, zoom);
    const maxPanY = 1800 * Math.max(1, zoom);
    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, panStart.startPanX + dx)),
      y: Math.max(-maxPanY, Math.min(maxPanY, panStart.startPanY + dy))
    });
  };

  const handleContainerMouseUp = () => {
    setIsPanning(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDist(dist);
      setInitialZoomOnPinch(zoom);
    } else if (e.touches.length === 1) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'svg' || target.tagName === 'rect' || target === containerRef.current) {
        setIsPanning(true);
        setPanStart({
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY,
          startPanX: pan.x,
          startPanY: pan.y
        });
      }
    } else {
      setInitialPinchDist(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = dist / initialPinchDist;
      const newZoom = Math.min(Math.max(initialZoomOnPinch * scaleFactor, 0.3), 3.5);
      setZoom(newZoom);
    } else if (e.touches.length === 1 && isPanning) {
      const svgElement = document.getElementById('heritage-tree-svg');
      const svgRect = svgElement ? svgElement.getBoundingClientRect() : null;
      const svgScale = svgRect && svgRect.width > 0 ? (3000 / svgRect.width) : 1;
      const dx = (e.touches[0].clientX - panStart.clientX) * svgScale;
      const dy = (e.touches[0].clientY - panStart.clientY) * svgScale;
      const maxPanX = 2500 * Math.max(1, zoom);
      const maxPanY = 1800 * Math.max(1, zoom);
      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, panStart.startPanX + dx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, panStart.startPanY + dy))
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setInitialPinchDist(null);
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null); // stores uniqueId
  const [selectedBranch, setSelectedBranch] = useState<{
    parentId: string;
    childId: string;
    parentName: string;
    childName: string;
  } | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [isExportingHD, setIsExportingHD] = useState<boolean>(false);

  const handleRemoveBranchRelation = (childId: string) => {
    if (!setEntries) return;
    setEntries(prev => prev.map(e => {
      const pid = e.personId || e.id;
      if (pid === childId) {
        return {
          ...e,
          parentId: undefined,
          fatherName: '',
          grandfatherName: '',
          greatGrandfatherName: ''
        };
      }
      return e;
    }));
    setSelectedBranch(null);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('text/plain');
      const data = JSON.parse(raw);
      if (data.personId && setEntries) {
        setEntries(prev => prev.map(item => {
          const pid = item.personId || item.id;
          if (pid === data.personId) {
            return {
              ...item,
              parentId: undefined,
              fatherName: '',
              grandfatherName: '',
              greatGrandfatherName: ''
            };
          }
          return item;
        }));
        setSelectedBranch(null);
      }
    } catch {
      // fallback
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(Number((prev + 0.15).toFixed(2)), 3.5));
  const handleZoomOut = () => setZoom(prev => Math.max(Number((prev - 0.15).toFixed(2)), 0.25));
  const handleResetZoom = () => {
    setZoom(strictLayout.autoFitScale || 1.0);
    setPan({ x: 0, y: 0 });
  };
  const handleCenterView = () => {
    setZoom(strictLayout.autoFitScale || 1.0);
    setPan({ x: 0, y: 0 });
    setNodeOffsets({});
    setBranchOffsets({});
    if (containerRef.current) {
      containerRef.current.scrollTo({
        left: (containerRef.current.scrollWidth - containerRef.current.clientWidth) / 2,
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const handleExportSVG = () => {
    const svgElement = document.getElementById('heritage-tree-svg');
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `شجرة_العائلة_التراثية_${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  // Ultra HD High Resolution PNG/PDF Export
  const handleExportUltraHD = async () => {
    const svgElement = document.getElementById('heritage-tree-svg');
    if (!svgElement) return;

    setIsExportingHD(true);
    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        // 4x Ultra High Resolution Canvas (12000 x 8800 px)
        const canvas = document.createElement('canvas');
        canvas.width = 12000;
        canvas.height = 8800;
        const context = canvas.getContext('2d');
        if (!context) {
          setIsExportingHD(false);
          return;
        }
        context.fillStyle = '#f7f1e3';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (!blob) {
            setIsExportingHD(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `شجرة_العائلة_التراثية_عالية_الدقة_جدا_${new Date().toISOString().slice(0, 10)}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setIsExportingHD(false);
          setShowExportModal(false);
        }, 'image/png', 1.0);
      };
      image.src = blobURL;
    } catch (e) {
      console.error("HD Export failed", e);
      setIsExportingHD(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // Helper functions for member tags checking
  const getMemberTags = (name: string): string[] => {
    const entry = entries.find(e => 
      e.sonName === name ||
      e.fatherName === name ||
      e.grandfatherName === name ||
      e.greatGrandfatherName === name
    );
    return entry?.tags || [];
  };

  const checkIsSheikh = (name: string): boolean => {
    const clean = name.trim();
    return clean.includes('ناصر') || clean.includes('الشيخ ناصر') || getMemberTags(name).includes('شيخ');
  };
  const checkIsProfessor = (name: string): boolean => {
    const tags = getMemberTags(name);
    return tags.includes('استاذ') || tags.includes('أستاذ');
  };
  const checkIsDeceased = (name: string): boolean => {
    const tags = getMemberTags(name);
    return tags.includes('متوفي') || tags.includes('متوفى');
  };
  const checkIsMartyr = (name: string): boolean => {
    const tags = getMemberTags(name);
    return tags.includes('شهيد');
  };
  const checkIsTeacher = (name: string): boolean => {
    const tags = getMemberTags(name);
    return tags.includes('معلم') || tags.includes('مدرس');
  };
  const checkIsStudent = (name: string): boolean => {
    const tags = getMemberTags(name);
    return tags.includes('طالب');
  };

  const getNodeStroke = (name: string, isSheikhNode: boolean): string => {
    if (isSheikhNode) return '#d4af37';
    if (checkIsProfessor(name)) return '#ffffff'; // الاستاذ: محيط الدائرة خط أبيض
    if (checkIsDeceased(name)) return '#121212'; // المتوفي: محيط الدائرة خط أسود
    if (checkIsTeacher(name)) return '#eab308'; // المعلم: لون خط أصفر
    if (checkIsStudent(name)) return '#ca8a04'; // طالب: لون الخط أصفر غامق
    return '#d4af37'; // default gold
  };

  const getTextFill = (name: string): string => {
    return '#ffffff';
  };

  const getBranchPath = (parentId: string, childId: string, actualX: number, actualY: number, actualChildX: number, actualChildY: number) => {
    const isTopToBottom = actualChildY >= actualY;
    const startYOffset = isTopToBottom ? 22 : -22;
    const endYOffset = isTopToBottom ? -22 : 22;

    if (branchStyle === 'straight') {
      return `M ${actualX} ${actualY + startYOffset} L ${actualChildX} ${actualChildY + endYOffset}`;
    }
    if (branchStyle === 'geometric') {
      const midY = (actualY + actualChildY) / 2;
      return `M ${actualX} ${actualY + startYOffset} L ${actualX} ${midY} L ${actualChildX} ${midY} L ${actualChildX} ${actualChildY + endYOffset}`;
    }
    if (branchStyle === 'waved') {
      const midX = (actualX + actualChildX) / 2;
      const midY = (actualY + actualChildY) / 2;
      return `M ${actualX} ${actualY + startYOffset} Q ${midX} ${midY} ${actualChildX} ${actualChildY + endYOffset}`;
    }
    if (branchStyle === 'draggable') {
      const branchKey = `${parentId}-${childId}`;
      const offset = branchOffsets[branchKey] || { x: 0, y: 0 };
      const midX = (actualX + actualChildX) / 2 + offset.x;
      const midY = (actualY + actualChildY) / 2 + offset.y;
      return `M ${actualX} ${actualY + startYOffset} Q ${midX} ${midY} ${actualChildX} ${actualChildY + endYOffset}`;
    }
    // Default smooth curved (strictly monotonic in Y, strictly within [min(x1, x2), max(x1, x2)] to never cross)
    const midY = (actualY + actualChildY) / 2;
    return `M ${actualX} ${actualY + startYOffset} C ${actualX} ${midY}, ${actualChildX} ${midY}, ${actualChildX} ${actualChildY + endYOffset}`;
  };

  // Organic recursive tree renderer matching the reference heritage poster design
  const getGenerationGreen = (lvl: number, isHighlighted: boolean): string => {
    if (isHighlighted) return '#15803d';
    const greens = [
      '#0e381b', // Gen 1
      '#144a24', // Gen 2
      '#1b5c2e', // Gen 3
      '#227139', // Gen 4
      '#2a8645', // Gen 5
      '#329b52', // Gen 6
      '#3ab05e'  // Gen 7+
    ];
    return greens[Math.min(lvl - 1, greens.length - 1)];
  };

  const renderSubTreeSVG = (member: FamilyMember, x: number, y: number, spread: number, level: number): React.ReactNode => {
    const isHighlighted = selectedPerson === member.uniqueId || (searchQuery && member.name.includes(searchQuery));
    const hasChildren = member.children && member.children.length > 0;
    const numChildren = member.children.length;
    const isSheikh = checkIsSheikh(member.name);
    const nodeStroke = getNodeStroke(member.name, isSheikh);
    const textFill = getTextFill(member.name);
    const verticalMode = settings.verticalSpacingMode || 'normal';
    let spacingMultiplier = 1.0;
    if (verticalMode === 'extended') spacingMultiplier = 1.4;
    if (verticalMode === 'super_extended') spacingMultiplier = 1.9;

    const yOffset = (generationOrder === 'ascending' ? 140 : -140) * spacingMultiplier;

    // Node coloring logic based on generation, tags, branch, or default
    const nodeColoringMode = settings.nodeColoringMode || 'generation';
    let nodeGreenFill = getGenerationGreen(level, isHighlighted);

    if (!isHighlighted) {
      if (nodeColoringMode === 'tags') {
        const memberEntry = entries.find(e => cleanName(e.sonName) === cleanName(member.name));
        const tags = memberEntry?.tags || [];
        if (tags.includes('شهيد')) nodeGreenFill = '#b91c1c'; // Red
        else if (tags.includes('شيخ')) nodeGreenFill = '#b45309'; // Amber/Brown
        else if (tags.includes('أستاذ') || tags.includes('دكتور')) nodeGreenFill = '#1e3a8a'; // Blue
        else if (tags.includes('حاج')) nodeGreenFill = '#047857'; // Emerald
        else if (tags.includes('طبيب') || tags.includes('مهندس')) nodeGreenFill = '#6d28d9'; // Purple
        else nodeGreenFill = '#334155'; // Slate
      } else if (nodeColoringMode === 'branch') {
        const branchColors = ['#1e3a8a', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490'];
        const hash = member.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        nodeGreenFill = branchColors[hash % branchColors.length];
      } else if (nodeColoringMode === 'default') {
        nodeGreenFill = '#1b4d2e';
      } else {
        nodeGreenFill = getGenerationGreen(level, isHighlighted);
      }
    }

    // Dynamic auto-sizing based on name length (independent of font scale)
    const nameLength = member.name.length;
    const dynamicRx = Math.max(56, nameLength * 8.5);
    const dynamicRy = 27;
    const dynamicSheikhRadius = Math.max(48, nameLength * 7.5);
    const dynamicRectWidth = Math.max(112, nameLength * 14);
    const dynamicRectHeight = 40;

    const memberPos = strictLayout.positions.get(member.uniqueId);
    const actualNodeX = (memberPos ? memberPos.x : x) + (nodeOffsets[member.uniqueId]?.x || 0);
    const actualNodeY = (memberPos ? memberPos.y : y) + (nodeOffsets[member.uniqueId]?.y || 0);

    const isSelectedBranchChild = selectedBranch && selectedBranch.childId === member.uniqueId;
    const isSelectedBranchParent = selectedBranch && selectedBranch.parentId === member.uniqueId;
    const isValidBranchTarget = selectedBranch && !isSelectedBranchChild && !isSelectedBranchParent;

    return (
      <g key={`${member.uniqueId}-${level}-${x}-${y}`}>
        {/* Organic or geometric branching */}
        {hasChildren && member.children.map((child, idx) => {
          const childPos = strictLayout.positions.get(child.uniqueId);
          const childDefaultX = actualNodeX + (idx - (numChildren - 1) / 2) * 160;
          const childDefaultY = actualNodeY + (generationOrder === 'ascending' ? 150 : -150);
          const actualChildX = (childPos ? childPos.x : childDefaultX) + (nodeOffsets[child.uniqueId]?.x || 0);
          const actualChildY = (childPos ? childPos.y : childDefaultY) + (nodeOffsets[child.uniqueId]?.y || 0);

          const isBranchSelected = selectedBranch && selectedBranch.parentId === member.uniqueId && selectedBranch.childId === child.uniqueId;
          const branchPathStr = getBranchPath(member.uniqueId, child.uniqueId, actualNodeX, actualNodeY, actualChildX, actualChildY);
          const midX = (actualNodeX + actualChildX) / 2;
          const midY = (actualNodeY + actualChildY) / 2;

          return (
            <g 
              key={`branch-${member.uniqueId}-${child.uniqueId}-${idx}`} 
              className="transition-all duration-300 ease-in-out cursor-pointer"
            >
              {/* Wide transparent hit-area path for easy click and selection */}
              <path
                d={branchPathStr}
                fill="none"
                stroke="transparent"
                strokeWidth={26}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBranch({
                    parentId: member.uniqueId,
                    childId: child.uniqueId,
                    parentName: member.name,
                    childName: child.name
                  });
                }}
              />
              {/* Visible Branch line */}
              <path
                d={branchPathStr}
                fill="none"
                stroke={isBranchSelected ? '#f59e0b' : (settings.branchColor || '#5c3a21')}
                strokeWidth={isBranchSelected ? Math.max(6, (settings.lineThickness || 3) + 3) : Math.max(2, (settings.lineThickness || 3) - level * 0.2)}
                strokeLinecap="round"
                strokeDasharray={isBranchSelected ? '8,4' : undefined}
                opacity={isBranchSelected ? "1" : "0.92"}
                className={`transition-all duration-300 ease-in-out hover:stroke-amber-400 drop-shadow-md ${isBranchSelected ? 'animate-pulse' : ''}`}
                style={{ filter: isBranchSelected ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.9))' : undefined }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBranch({
                    parentId: member.uniqueId,
                    childId: child.uniqueId,
                    parentName: member.name,
                    childName: child.name
                  });
                }}
              />
              {/* Selected Branch Action Badge with Midpoint "+" Button, Move Handle & Disconnect */}
              {isBranchSelected && (
                <g 
                  transform={`translate(${midX}, ${midY})`}
                  className="cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <rect
                    x="-125"
                    y="-21"
                    width="250"
                    height="42"
                    rx="21"
                    fill="#1b1511"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    className="shadow-2xl drop-shadow-xl"
                  />

                  {/* "+" Button to Insert Missing Person in the middle of this branch */}
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      setInsertBranchInfo({
                        parentId: member.uniqueId,
                        childId: child.uniqueId,
                        parentName: member.name,
                        childName: child.name
                      });
                      setInsertPersonName('');
                      setInsertPersonTags([]);
                      setShowInsertModal(true);
                    }}
                    title={`إدراج شخص مفقود في منتصف هذا الغصن (بين ${member.name} و ${child.name})`}
                    className="cursor-pointer hover:scale-115 transition-transform"
                    transform="translate(-75, 0)"
                  >
                    <circle cx="0" cy="0" r="14" fill="#059669" stroke="#ffffff" strokeWidth="2" className="shadow-lg" />
                    <text x="0" y="4.5" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">+</text>
                    <text x="36" y="4" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="bold">إدراج شخص</text>
                  </g>

                  {/* Divider line */}
                  <line x1="8" y1="-12" x2="8" y2="12" stroke="#4a3b2f" strokeWidth="1.5" />

                  {/* Draggable re-attach handle */}
                  <g
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ personId: child.uniqueId, personName: child.name }));
                      setSelectedBranch({
                        parentId: member.uniqueId,
                        childId: child.uniqueId,
                        parentName: member.name,
                        childName: child.name
                      });
                      e.stopPropagation();
                    }}
                    title="اسحب هذا المقبض وأفلته فوق أي شخص لربط الغصن به، أو انقر على اسم الأب الجديد مباشرة"
                    className="cursor-grab active:cursor-grabbing hover:scale-115 transition-transform"
                    transform="translate(38, 0)"
                  >
                    <circle cx="0" cy="0" r="13" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                    <path d="M -4 -2.5 L 0 -6.5 L 4 -2.5 M 0 -6 L 0 6 M -4 2.5 L 0 6.5 L 4 2.5" stroke="#1e1814" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <text x="24" y="4" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="bold">نقل</text>
                  </g>

                  {/* Disconnect button */}
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBranchRelation(child.uniqueId);
                    }}
                    title="فصل هذا الغصن وتحويله إلى شجرة مستقلة"
                    className="cursor-pointer hover:scale-115 transition-transform"
                    transform="translate(95, 0)"
                  >
                    <circle cx="0" cy="0" r="12" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
                    <text x="0" y="4.5" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="bold">×</text>
                  </g>
                </g>
              )}
              {branchStyle === 'draggable' && (() => {
                const branchKey = `${member.uniqueId}-${child.uniqueId}`;
                const offset = branchOffsets[branchKey] || { x: 0, y: 0 };
                const curMidX = midX + offset.x;
                const curMidY = midY + offset.y;
                return (
                  <circle
                    cx={curMidX}
                    cy={curMidY}
                    r="8"
                    fill="#d4af37"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="cursor-grab hover:scale-125 transition-transform shadow-lg"
                    onMouseDown={(e) => handleBranchMouseDown(e, branchKey)}
                    title="اسحب هذا المقبض لتمطيط وتحريك الغصن بحرية"
                  />
                );
              })()}
              {renderSubTreeSVG(child, childPos?.x || actualChildX, childPos?.y || actualChildY, 0, level + 1)}
            </g>
          );
        })}

        {/* Member Leaf / Node with Auto-Sizing */}
        {!(level === 1 && settings.hideRootNode) && (
          <g 
            transform={`translate(${actualNodeX}, ${actualNodeY})`}
          draggable={true}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              member: member
            });
          }}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ personId: member.uniqueId, personName: member.name }));
            e.stopPropagation();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const raw = e.dataTransfer.getData('text/plain');
              const data = JSON.parse(raw);
              const draggedSonId = data.personId;
              if (draggedSonId && draggedSonId !== member.uniqueId) {
                handleReparentNode(draggedSonId, member.uniqueId, member.name);
                setSelectedBranch(null);
              }
            } catch {
              // fallback
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (selectedBranch) {
              if (selectedBranch.childId === member.uniqueId) {
                alert('لا يمكن ربط الشخص بنفسه.');
                return;
              }
              if (selectedBranch.parentId === member.uniqueId) {
                alert(`(${selectedBranch.childName}) مرتبط بالفعل كابن لـ (${member.name}).`);
                setSelectedBranch(null);
                return;
              }
              handleReparentNode(selectedBranch.childId, member.uniqueId, member.name);
              return;
            }
            setSelectedPerson(member.uniqueId);
          }}
          onMouseDown={(e) => {
            if (selectedBranch) return; // In branch move mode, prioritize click to re-attach
            handleNodeMouseDown(e, member.uniqueId);
          }}
          onTouchStart={(e) => {
            handleNodeTouchStart(e, member.uniqueId);
            touchMovedRef.current = false;
            const touch = e.touches[0];
            if (touch) {
              longPressTimerRef.current = setTimeout(() => {
                if (!touchMovedRef.current) {
                  setContextMenu({
                    visible: true,
                    x: touch.clientX,
                    y: touch.clientY,
                    member: member
                  });
                }
              }, 650);
            }
          }}
          onTouchMove={(e) => {
            handleNodeTouchMove(e);
            touchMovedRef.current = true;
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }}
          onTouchEnd={() => {
            handleNodeTouchEnd();
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }}
          style={{ cursor: 'grab', transition: draggingNodeId === member.uniqueId ? 'none' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
          title="اسحب هذه العقدة وأفلتها فوق أي شخص آخر لتغيير الأب وإعادة ربط الغصن تلقائياً"
        >
          {isSheikh ? (
            /* Perfectly circular ornate frame ONLY for Sheikh with dynamic auto-fit radius */
            <g>
              <circle
                cx="0"
                cy="0"
                r={dynamicSheikhRadius}
                fill={nodeGreenFill}
                stroke={isValidBranchTarget ? "#10b981" : nodeStroke}
                strokeWidth={isValidBranchTarget ? "5" : "4"}
                strokeDasharray={isValidBranchTarget ? "6 3" : undefined}
                className="transition-all duration-300 shadow-2xl hover:brightness-110"
              />
              <circle
                cx="0"
                cy="0"
                r={dynamicSheikhRadius - 6}
                fill="none"
                stroke="#fef08a"
                strokeWidth="2"
                strokeDasharray="6 3"
                opacity="0.95"
              />
              <circle
                cx="0"
                cy="0"
                r={dynamicSheikhRadius - 12}
                fill="none"
                stroke={nodeStroke}
                strokeWidth="1"
                opacity="0.8"
              />
            </g>
          ) : settings.showLeaves ? (
            <ellipse
              cx="0"
              cy="0"
              rx={dynamicRx}
              ry={dynamicRy}
              fill={nodeGreenFill}
              stroke={isValidBranchTarget ? "#10b981" : (isHighlighted ? "#fbbf24" : nodeStroke)}
              strokeWidth={isValidBranchTarget ? "3.5" : (isHighlighted ? "2.5" : "1.5")}
              strokeDasharray={isValidBranchTarget ? "5 3" : undefined}
              className="transition-all duration-300 shadow-md hover:brightness-110"
            />
          ) : (
            <rect
              x={-dynamicRectWidth / 2}
              y={-dynamicRectHeight / 2}
              width={dynamicRectWidth}
              height={dynamicRectHeight}
              rx={10}
              fill={nodeGreenFill}
              stroke={isValidBranchTarget ? "#10b981" : (isHighlighted ? "#fbbf24" : nodeStroke)}
              strokeWidth={isValidBranchTarget ? "3.5" : (isHighlighted ? "2.5" : "1.5")}
              strokeDasharray={isValidBranchTarget ? "5 3" : undefined}
              className="transition-all duration-300 shadow-md"
            />
          )}

          {isValidBranchTarget && (
            <g transform="translate(0, -32)" className="pointer-events-none">
              <rect x="-44" y="-10" width="88" height="20" rx="10" fill="#047857" stroke="#ffffff" strokeWidth="1.5" className="shadow-lg" />
              <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">انقر للربط هنا</text>
            </g>
          )}

          <text
            x="0"
            y="0"
            dominantBaseline="central"
            textAnchor="middle"
            fill={textFill}
            fontSize={(isSheikh ? 15 : 14) * nameScale}
            fontWeight="bold"
            fontFamily={`'${currentFont}', sans-serif`}
            className="select-none pointer-events-none drop-shadow"
          >
            {member.name}
          </text>

          {/* Plus (+) button at the bottom and Delete (x) button at the top */}
          {selectedPerson === member.uniqueId && (
            <>
              {/* Plus (+) button at the bottom center */}
              <g 
                transform={`translate(0, ${isSheikh ? dynamicSheikhRadius + 14 : 32})`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenAddModal(member.uniqueId, member.name);
                }}
                style={{ cursor: 'pointer' }}
                title="إضافة ابن جديد تحت هذا الشخص"
              >
                <circle cx="0" cy="0" r="14" fill="#b89753" stroke="#ffffff" strokeWidth="2" className="hover:scale-110 transition-transform shadow-lg" />
                <text x="0" y="4.5" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">+</text>
              </g>

              {/* Plus (+) button at the top center to add a father/grandfather above */}
              <g 
                transform={`translate(0, ${isSheikh ? -(dynamicSheikhRadius + 14) : -32})`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenAddParentModal(member.uniqueId, member.name);
                }}
                style={{ cursor: 'pointer' }}
                title="إضافة أب أو جد أعلى هذا الشخص"
              >
                <circle cx="0" cy="0" r="14" fill="#1b4d2e" stroke="#ffffff" strokeWidth="2" className="hover:scale-110 transition-transform shadow-lg" />
                <text x="0" y="4.5" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">+</text>
              </g>

              {/* Delete (x) button on the side */}
              <g 
                transform={`translate(${dynamicRx - 10}, -30)`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNode(member.uniqueId, member.name);
                }}
                style={{ cursor: 'pointer' }}
                title="حذف الفرد وجميع فروعه"
              >
                <circle cx="0" cy="0" r="14" fill="#991b1b" stroke="#ffffff" strokeWidth="2" className="hover:scale-110 transition-transform shadow-lg" />
                <text x="0" y="4.5" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">×</text>
              </g>
            </>
          )}
        </g>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="bg-[#f5ecdc] dark:bg-[#25201b] border border-[#e2d2b5] dark:border-[#3d3328] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold font-amiri text-amber-950 dark:text-amber-100">شجرة العائلة التراثية</h2>
            <span className="bg-emerald-800 text-emerald-100 text-xs px-2.5 py-0.5 rounded-full">الاحتواء التلقائي وحجم 100%</span>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            أحجام الدوائر تتناسب تلقائياً مع طول الأسماء لضمان عدم القص. العرض يبدأ بحجم 100% قياسي.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Top-to-Bottom vertical orientation indicator */}
          <div
            className="flex items-center gap-1.5 bg-amber-900/80 text-amber-100 text-xs font-medium px-3.5 py-2 rounded-xl border border-amber-600/70 shadow-xs select-none"
            title="الهيكل الرأسي: الجذور بالأعلى وتنمو الأجيال للأسفل"
          >
            <ArrowUpDown className="w-4 h-4 text-amber-300" />
            <span>الهيكل: رأسي (من الأعلى للأسفل)</span>
          </div>

          <button
            onClick={() => setShowSettingsPanel(prev => !prev)}
            className="flex items-center gap-1.5 bg-[#332a22] hover:bg-[#43372e] text-stone-200 text-xs font-medium px-4 py-2 rounded-xl border border-[#524438] transition-all cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>خيارات العرض</span>
            {showSettingsPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onSwitchToEntries}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-white font-medium px-4 py-2 rounded-xl shadow transition-all cursor-pointer border border-amber-600 text-xs"
          >
            <FileText className="w-4 h-4" />
            <span>جدول الإدخالات ←</span>
          </button>
        </div>
      </div>

      {/* Settings Panel Drawer */}
      {showSettingsPanel && (
        <div className="bg-[#f5ecdc] dark:bg-[#221c17] border border-[#e2d2b5] dark:border-[#3d3328] rounded-2xl p-5 shadow-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 transition-all">
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">عنوان اللوحة</label>
            <input
              type="text"
              value={settings.title || ''}
              onChange={e => setSettings(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs"
            />
          </div>

          {/* Structure Mode Options: Vertical or Inverted Vertical */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">خيارات الهيكل واتجاه النمو</label>
            <select
              value={settings.generationOrder || 'ascending'}
              onChange={e => setSettings(prev => ({ ...prev, generationOrder: e.target.value as 'ascending' | 'descending' }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium"
            >
              <option value="ascending">هيكل رأسي (من الأعلى للأسفل - الجد بالأعلى)</option>
              <option value="descending">عكس الرأسي (من الأسفل للأعلى - الجد بالقاعدة)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">الامتداد الطولي للشجرة</label>
            <select
              value={settings.verticalSpacingMode || 'normal'}
              onChange={e => setSettings(prev => ({ ...prev, verticalSpacingMode: e.target.value as 'normal' | 'extended' | 'super_extended' }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium"
            >
              <option value="normal">عادي (متوازن)</option>
              <option value="extended">طولي ممتد (مسافات واسعة)</option>
              <option value="super_extended">طولي جداً (متباعد للغاية لمنع التداخل)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">التباعد الأفقي (منع تداخل الدوائر)</label>
            <select
              value={settings.horizontalSpacing || 'normal'}
              onChange={e => setSettings(prev => ({ ...prev, horizontalSpacing: e.target.value as 'normal' | 'wide' | 'ultra_wide' }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium"
            >
              <option value="normal">عادي (متوازن)</option>
              <option value="wide">واسع (لمنع تداخل الدوائر)</option>
              <option value="ultra_wide">واسع جداً (متباعد تماماً)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">تصنيف الدوائر والألوان</label>
            <select
              value={settings.branchColoring || 'default'}
              onChange={e => setSettings(prev => ({ ...prev, branchColoring: e.target.value as 'default' | 'branch_groups' | 'custom' }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium"
            >
              <option value="default">ألوان الأجيال التراثية (تدرجات الأخضر)</option>
              <option value="branch_groups">تصنيف الفروع بألوان مميزة (لكل فرع لون)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">الخط العربي التراثي</label>
            <select
              value={currentFont}
              onChange={e => setSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium"
            >
              <option value="Amiri">خط الأميري (Amiri)</option>
              <option value="Tajawal">خط التجوال (Tajawal)</option>
              <option value="El Messiri">خط المسيري (El Messiri)</option>
              <option value="Cairo">خط القاهرة (Cairo)</option>
              <option value="Reem Kufi">خط ريم كوفي (Reem Kufi)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">أنماط وتوجيه خطوط الربط</label>
            <select
              value={branchStyle}
              onChange={e => setSettings(prev => ({ ...prev, branchStyle: e.target.value as 'curved' | 'straight' | 'geometric' | 'waved' | 'twisted' | 'draggable' }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium"
            >
              <option value="curved">خطوط منحنية طبيعية (Curved)</option>
              <option value="twisted">أغصان ملتوية وعضوية (Twisted)</option>
              <option value="draggable">أغصان متحركة (قابل للتحريك والتمطيط)</option>
              <option value="waved">خطوط متعرجة / شلالية (Waved)</option>
              <option value="straight">خطوط مستقيمة (Straight)</option>
              <option value="geometric">خطوط هندسية (Geometric)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">نظام تلوين العقد (Nodes)</label>
            <select
              value={settings.nodeColoringMode || 'generation'}
              onChange={e => setSettings(prev => ({ ...prev, nodeColoringMode: e.target.value as 'generation' | 'tags' | 'branch' | 'default' }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium"
            >
              <option value="generation">حسب مستوى الجيل (Generation)</option>
              <option value="tags">حسب نوع العلامات والوسوم (Tags)</option>
              <option value="branch">حسب الفرع العائلي (Branch)</option>
              <option value="default">لون موحد افتراضي</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">سماكة الفروع والأغصان</label>
            <select
              value={settings.lineThickness}
              onChange={e => setSettings(prev => ({ ...prev, lineThickness: Number(e.target.value) }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs"
            >
              <option value={10}>فروع (10px)</option>
              <option value={20}>فروع (20px)</option>
              <option value={25}>فروع (25px)</option>
              <option value={50}>فروع سميكة جداً (50px)</option>
            </select>
          </div>

          <div className="flex items-center gap-4 pt-2 sm:col-span-2 lg:col-span-5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-300">
              <input
                type="checkbox"
                checked={!!settings.showAyah}
                onChange={e => setSettings(prev => ({ ...prev, showAyah: e.target.checked }))}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              الآية القرآنية والأحاديث
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-300">
              <input
                type="checkbox"
                checked={!!settings.showLeaves}
                onChange={e => setSettings(prev => ({ ...prev, showLeaves: e.target.checked }))}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              أوراق بيضاوية
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-300">
              <input
                type="checkbox"
                checked={!!settings.hideRootNode}
                onChange={e => setSettings(prev => ({ ...prev, hideRootNode: e.target.checked }))}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              إخفاء الجذر الرئيسي
            </label>
          </div>
        </div>
      )}

      {/* Canvas Controls Bar */}
      <div className="bg-white dark:bg-[#1e1915] border border-[#e5dac6] dark:border-[#3d3328] rounded-xl px-4 py-2.5 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="relative w-full lg:w-auto">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="البحث عن اسم..."
              className="w-full lg:w-auto pl-3 pr-9 py-1.5 bg-[#fcf8f2] dark:bg-[#28221b] border border-[#d8ccb5] dark:border-[#42372c] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-600 text-stone-800 dark:text-stone-100"
            />
          </div>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-stone-500 hover:text-stone-800 underline whitespace-nowrap">
              مسح البحث
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end overflow-x-auto pb-1 lg:pb-0">
          {/* Structure Orientation Options: Vertical or Inverted Vertical */}
          <div className="flex items-center gap-1 bg-[#fcf8f2] dark:bg-[#2a231d] rounded-lg border border-amber-300/80 dark:border-[#483d31] p-0.5 shrink-0 shadow-xs">
            <span className="text-[11px] font-bold text-amber-950 dark:text-amber-200 px-1.5">الهيكل:</span>
            <button
              onClick={() => setSettings(prev => ({ ...prev, generationOrder: 'ascending' }))}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                (settings.generationOrder || 'ascending') === 'ascending'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
              }`}
              title="هيكل رأسي: يبدأ بالأجداد في الأعلى ويتفرع هبوطاً للأبناء"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>رأسي (أعلى)</span>
            </button>
            <button
              onClick={() => setSettings(prev => ({ ...prev, generationOrder: 'descending' }))}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                settings.generationOrder === 'descending'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
              }`}
              title="عكس الرأسي: يبدأ بالأجداد في القاعدة بالأسفل ويتفرع صعوداً للأعلى"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>عكس الرأسي (أسفل)</span>
            </button>
          </div>

          {/* Name Font Size Scale Controls (A- / A+) */}
          <div className="flex items-center gap-1 bg-[#fcf8f2] dark:bg-[#2a231d] rounded-lg border border-stone-300 dark:border-[#483d31] px-2 py-1 shrink-0">
            <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300">حجم الأسماء:</span>
            <button
              onClick={() => setSettings(prev => ({ ...prev, nameFontSizeScale: Math.max(0.5, Number(((prev.nameFontSizeScale || 1.0) - 0.2).toFixed(1))) }))}
              className="px-1.5 py-0.5 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer hover:bg-amber-100"
              title="تصغير الأسماء"
            >
              A-
            </button>
            <select
              value={Math.round(nameScale * 100)}
              onChange={e => setSettings(prev => ({ ...prev, nameFontSizeScale: Number(e.target.value) / 100 }))}
              className="px-1.5 py-0.5 bg-white dark:bg-stone-800 text-amber-900 dark:text-amber-200 rounded border border-stone-300 dark:border-stone-700 text-xs font-mono font-bold cursor-pointer"
            >
              <option value="50">50%</option>
              <option value="100">100%</option>
              <option value="150">150%</option>
              <option value="180">180%</option>
              <option value="200">200%</option>
              <option value="220">220%</option>
              <option value="240">240%</option>
              <option value="260">260%</option>
              <option value="280">280%</option>
              <option value="300">300%</option>
            </select>
            <button
              onClick={() => setSettings(prev => ({ ...prev, nameFontSizeScale: Math.min(3.0, Number(((prev.nameFontSizeScale || 1.0) + 0.2).toFixed(1))) }))}
              className="px-1.5 py-0.5 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer hover:bg-amber-100"
              title="تكبير الأسماء"
            >
              A+
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <span className="text-xs font-mono text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={handleZoomOut} className="p-1.5 bg-stone-100 dark:bg-[#2a231d] rounded-lg border border-stone-300 dark:border-[#483d31] cursor-pointer" title="تصغير الشجرة">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleZoomIn} className="p-1.5 bg-stone-100 dark:bg-[#2a231d] rounded-lg border border-stone-300 dark:border-[#483d31] cursor-pointer" title="تكبير الشجرة">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={handleResetZoom} className="p-1.5 bg-stone-100 dark:bg-[#2a231d] rounded-lg border border-stone-300 dark:border-[#483d31] cursor-pointer" title="إعادة التعيين لـ 100%">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleCenterView}
              className="flex items-center gap-1 bg-amber-800 hover:bg-amber-900 text-amber-100 px-2.5 py-1.5 rounded-lg text-xs font-medium shadow cursor-pointer border border-amber-600 whitespace-nowrap"
              title="ملاءمة الشجرة بالكامل داخل الإطار وتوسيطها تلقائياً"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
              <span>ملاءمة وتوسيط داخل الإطار</span>
            </button>
            <button onClick={handleAutoLayout} className="flex items-center gap-1 bg-[#5c3a21] hover:bg-[#4a2e1a] text-white px-2.5 py-1.5 rounded-lg text-xs font-medium shadow cursor-pointer whitespace-nowrap" title="إعادة ترتيب الشجرة تلقائياً ومنع التداخل">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>إعادة ترتيب تلقائي</span>
            </button>
            <button onClick={() => setShowExportModal(true)} className="flex items-center gap-1 bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow cursor-pointer whitespace-nowrap">
              <Download className="w-3.5 h-3.5" />
              <span>تصدير HD / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Heritage Family Tree SVG Canvas Container (3000 x 2200) */}
      <div 
        ref={containerRef}
        className="relative bg-[#f7f1e3] dark:bg-[#181410] border-4 border-[#d4af37]/40 rounded-2xl shadow-2xl overflow-auto select-none cursor-grab active:cursor-grabbing"
        style={{ minHeight: '750px', height: '84vh' }}
        onMouseDown={handleContainerMouseDown}
        onMouseMove={(e) => {
          handleContainerMouseMove(e);
          handleNodeMouseMove(e);
          handleBranchMouseMove(e);
        }}
        onMouseUp={() => {
          handleContainerMouseUp();
          handleNodeMouseUp();
          handleBranchMouseUp();
        }}
        onMouseLeave={() => {
          handleContainerMouseUp();
          handleNodeMouseUp();
          handleBranchMouseUp();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => {
          handleTouchMove(e);
          handleNodeTouchMove(e);
        }}
        onTouchEnd={(e) => {
          handleTouchEnd(e);
          handleNodeTouchEnd();
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleCanvasDrop(e);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onClick={() => {
          setSelectedBranch(null);
          setSelectedPerson(null);
        }}
      >
        <div className="absolute inset-3 border-2 border-dashed border-[#b89753]/30 pointer-events-none rounded-xl z-10" />

        {/* Floating Active Branch Interaction Banner */}
        {selectedBranch && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-stone-900/95 dark:bg-black/95 text-stone-100 px-5 py-2.5 rounded-full shadow-2xl border-2 border-amber-400 backdrop-blur-md animate-in fade-in slide-in-from-top-4 select-none">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold font-amiri">
              الغصن المحدد: <span className="text-amber-300 font-extrabold text-sm">{selectedBranch.childName}</span> (ابن {selectedBranch.parentName})
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setInsertBranchInfo({
                  parentId: selectedBranch.parentId,
                  childId: selectedBranch.childId,
                  parentName: selectedBranch.parentName,
                  childName: selectedBranch.childName
                });
                setInsertPersonName('');
                setInsertPersonTags([]);
                setShowInsertModal(true);
              }}
              className="flex items-center gap-1.5 text-xs text-emerald-950 bg-emerald-400 hover:bg-emerald-300 font-bold px-3 py-1 rounded-full transition-all cursor-pointer shadow hover:scale-105"
              title="إدراج شخص مفقود بينهما في منتصف الغصن"
            >
              <span className="text-sm font-extrabold">+</span>
              <span>إدراج شخص بالمنتصف</span>
            </button>
            <span className="text-[11px] text-amber-200 bg-amber-950/70 px-3 py-1 rounded-full border border-amber-500/40">
              أو انقر على أي اسم لنقل الغصن إليه
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedBranch(null);
              }}
              className="text-xs text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 px-2.5 py-1 rounded-full transition-all cursor-pointer border border-stone-600"
            >
              إلغاء ✕
            </button>
          </div>
        )}

        {/* Floating Zoom & Center Controls Overlay */}
        <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2 bg-[#fcf8f2]/90 dark:bg-[#1e1915]/90 backdrop-blur-md p-2 rounded-2xl border border-amber-300/60 dark:border-stone-700 shadow-xl">
          <button 
            onClick={handleZoomIn} 
            className="p-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl transition-all shadow cursor-pointer flex items-center justify-center"
            title="تكبير (Zoom In)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="text-center font-mono text-xs font-bold text-stone-700 dark:text-stone-300 py-0.5">
            {Math.round(zoom * 100)}%
          </div>
          <button 
            onClick={handleZoomOut} 
            className="p-2.5 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl transition-all shadow cursor-pointer flex items-center justify-center"
            title="تصغير (Zoom Out)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <div className="h-[1px] bg-stone-300 dark:bg-stone-700 my-0.5" />
          <button 
            onClick={handleCenterView} 
            className="p-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl transition-all shadow cursor-pointer flex items-center justify-center"
            title="توسيط الشجرة"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div 
          className="w-full h-full flex items-center justify-center"
        >
          <svg
            id="heritage-tree-svg"
            viewBox="0 0 3000 2200"
            className="w-full h-full max-w-[2900px] max-h-[2100px] drop-shadow-xl"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background Parchment Fill */}
            <rect width="3000" height="2200" fill="#fcf7ee" rx="20" />

            <defs>
              <pattern id="islamic-border" x="0" y="0" width="60" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 60 15 L 30 30 L 0 15 Z" fill="none" stroke="#2b1810" strokeWidth="2.5" />
                <circle cx="30" cy="15" r="5" fill="#b89753" />
              </pattern>
              {/* Inner Heritage Frame Clip Path - strictly contains all nodes and branches inside the designated frame */}
              <clipPath id="heritageTreeClip">
                <rect x="58" y="58" width="2884" height="2084" rx="10" />
              </clipPath>
            </defs>

            {/* Tree Zoom & Pan Group - strictly contained within designated frame */}
            <g clipPath="url(#heritageTreeClip)">
              <g transform={`translate(${1500 + pan.x}, ${1100 + pan.y}) scale(${zoom}) translate(-1500, -1100)`}>
                {/* Render Family Tree */}
                {treeData.roots.length > 0 ? (
                  <g transform="translate(0, 0)">
                    {treeData.roots.map((rootNode, i) => {
                      const rootPos = strictLayout.positions.get(rootNode.uniqueId);
                      const startX = rootPos ? rootPos.x : 1500;
                      const rootY = rootPos ? rootPos.y : (generationOrder === 'ascending' ? 380 : 1550);
                      return (
                        <g key={`root-${rootNode.name}-${i}`}>
                          {renderSubTreeSVG(rootNode, startX, rootY, 0, 1)}
                        </g>
                      );
                    })}
                  </g>
                ) : (
                  <g transform="translate(1500, 1100)">
                    <circle
                      cx="0"
                      cy="-40"
                      r="45"
                      fill="#1b4d2e"
                      stroke="#d4af37"
                      strokeWidth="3"
                      className="cursor-pointer hover:scale-110 transition-transform shadow-2xl"
                      onClick={() => handleOpenAddParentModal('', '')}
                    />
                    <text x="0" y="-32" textAnchor="middle" fill="#ffffff" fontSize="42" fontWeight="bold" className="cursor-pointer pointer-events-none">+</text>
                    <text x="0" y="30" textAnchor="middle" fill="#5c3a21" fontSize="22" fontFamily={`'${currentFont}', sans-serif`} fontWeight="bold">
                      انقر على علامة (+) لإضافة أول جد أو مؤسس للشجرة
                    </text>
                  </g>
                )}
              </g>
            </g>

            {/* Ornate Islamic/Arabic Heritage Border (Framing the tree cleanly) */}
            <rect x="25" y="25" width="2950" height="2150" fill="none" stroke="#2b1810" strokeWidth="16" rx="12" />
            <rect x="42" y="42" width="2916" height="2116" fill="none" stroke="#b89753" strokeWidth="4" rx="8" />
            <rect x="52" y="52" width="2896" height="2096" fill="none" stroke="#b89753" strokeWidth="1" rx="6" />

            {/* Top & Bottom Ornate Border Patterns */}
            <g fill="#2b1810">
              <rect x="60" y="28" width="2880" height="18" fill="url(#islamic-border)" />
              <rect x="60" y="2154" width="2880" height="18" fill="url(#islamic-border)" />
              <rect x="28" y="60" width="18" height="2080" fill="url(#islamic-border)" />
              <rect x="2954" y="60" width="18" height="2080" fill="url(#islamic-border)" />
            </g>

            {/* Top Header Vintage Frames */}
            {settings.showAyah && (
              <>
                <g transform="translate(140, 75)">
                  <path d="M 15 0 L 520 0 Q 540 0 540 20 L 540 100 Q 540 120 520 120 L 15 120 Q 0 120 0 100 L 0 20 Q 0 0 15 0 Z" fill="#f5ecdc" stroke="#b89753" strokeWidth="3" />
                  <path d="M 22 7 L 518 7 Q 533 7 533 22 L 533 98 Q 533 113 518 113 L 22 113 Q 7 113 7 98 L 7 22 Q 7 7 22 7 Z" fill="none" stroke="#b89753" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="270" y="68" textAnchor="middle" fill="#2b1810" fontSize="18" fontFamily={`'${currentFont}', serif`} fontWeight="bold">
                    قال تعالى: ﴿مِنْ أَنْفُسِكُمْ أَزْوَاجًا وَبَنِينَ وَحَفَدَةً﴾
                  </text>
                </g>

                <g transform="translate(2320, 75)">
                  <path d="M 15 0 L 520 0 Q 540 0 540 20 L 540 100 Q 540 120 520 120 L 15 120 Q 0 120 0 100 L 0 20 Q 0 0 15 0 Z" fill="#f5ecdc" stroke="#b89753" strokeWidth="3" />
                  <path d="M 22 7 L 518 7 Q 533 7 533 22 L 533 98 Q 533 113 518 113 L 22 113 Q 7 113 7 98 L 7 22 Q 7 7 22 7 Z" fill="none" stroke="#b89753" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="270" y="68" textAnchor="middle" fill="#2b1810" fontSize="18" fontFamily={`'${currentFont}', serif`} fontWeight="bold">
                    عن النبي ﷺ: «أكرموا أولادكم وأحسنوا أدبهم»
                  </text>
                </g>
              </>
            )}

            {/* Center Top Vintage Title Banner */}
            <g transform="translate(1500, 115)">
              <rect x="-320" y="-42" width="640" height="84" rx="20" fill="#f5ecdc" stroke="#b89753" strokeWidth="3" />
              <rect x="-310" y="-34" width="620" height="68" rx="14" fill="none" stroke="#b89753" strokeWidth="1" strokeDasharray="4 3" />
              <text x="0" y="6" textAnchor="middle" fill="#2b1810" fontSize="28" fontFamily={`'${currentFont}', serif`} fontWeight="bold">
                {settings.title || 'شجرة العائلة الكريمة'}
              </text>
              {settings.subtitle && (
                <text x="0" y="26" textAnchor="middle" fill="#8c6239" fontSize="13" fontFamily={`'${currentFont}', sans-serif`}>
                  {settings.subtitle}
                </text>
              )}
            </g>

            {/* Bottom Right Vintage Frame with Color Legend */}
            <g transform="translate(2320, 2010)">
              <path d="M 15 0 L 540 0 Q 555 0 555 15 L 555 90 Q 555 105 540 105 L 15 105 Q 0 105 0 90 L 0 15 Q 0 0 15 0 Z" fill="#f5ecdc" stroke="#b89753" strokeWidth="2.5" />
              <text x="275" y="32" textAnchor="middle" fill="#2b1810" fontSize="15" fontFamily={`'${currentFont}', sans-serif`} fontWeight="bold">
                دليل الألقاب والصفات:
              </text>
              <text x="480" y="70" textAnchor="middle" fill="#1b4d2e" fontSize="12">شيخ (دائرة مزخرفة)</text>
              <text x="350" y="70" textAnchor="middle" fill="#1b4d2e" fontSize="12">أستاذ (خط أبيض)</text>
              <text x="220" y="70" textAnchor="middle" fill="#1b4d2e" fontSize="12">متوفي (خط أسود)</text>
              <text x="90" y="70" textAnchor="middle" fill="#ff4d4d" fontSize="12" fontWeight="bold">شهيد (اسم أحمر)</text>
            </g>
          </svg>
        </div>
      </div>

      {/* Export Modal for Ultra HD PNG & PDF */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcf8f2] dark:bg-[#1e1915] border border-amber-300 dark:border-[#483d31] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-xl font-bold font-amiri text-amber-950 dark:text-amber-100 mb-1">
              تصدير شجرة العائلة فائقة الدقة (Ultra HD & PDF)
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              اختر طريقة التصدير المناسبة للطباعة الفاخرة بالحجم الكبير ودقة تامة (4 أضعاف الدقة الأصلية):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button 
                onClick={handleExportUltraHD}
                disabled={isExportingHD}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
              >
                <Download className="w-6 h-6 text-amber-200" />
                <span>{isExportingHD ? 'جاري المعالجة...' : 'تصدير صورة Ultra HD (PNG)'}</span>
              </button>

              <button 
                onClick={handlePrintPDF}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-[#332a22] hover:bg-[#43372e] text-stone-100 rounded-xl text-xs font-bold transition-all cursor-pointer border border-amber-600/50 shadow"
              >
                <Printer className="w-6 h-6 text-amber-400" />
                <span>طباعة / حفظ كملف PDF عالي الدقة</span>
              </button>

              <button 
                onClick={handleExportSVG}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
              >
                <FileText className="w-6 h-6 text-stone-600 dark:text-stone-300" />
                <span>تصدير متجة (SVG الأصلي)</span>
              </button>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-amber-200 dark:border-stone-700">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-5 py-2 bg-stone-300 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-medium cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Child Modal with Tags Selection */}
      {showAddChildModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcf8f2] dark:bg-[#1e1915] border border-amber-300 dark:border-[#483d31] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-xl font-bold font-amiri text-amber-950 dark:text-amber-100">
              إضافة ابن جديد لـ ({addingFatherName})
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              أدخل اسم الفرد الجديد واختر الصفات والمهن:
            </p>

            <form onSubmit={handleConfirmAddChild} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">اسم الابن الجديد:</label>
                <input 
                  type="text"
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  placeholder="مثال: أحمد"
                  autoFocus
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">السمات والمهن (اختياري):</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAG_OPTIONS.map(tag => {
                    const isSelected = selectedChildTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedChildTags(prev => 
                            isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                          isSelected 
                            ? 'bg-amber-800 text-amber-100 border-amber-600 shadow-xs' 
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-amber-100 dark:hover:bg-stone-700'
                        }`}
                      >
                        {tag} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-amber-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setShowAddChildModal(false)}
                  className="px-4 py-2 bg-stone-300 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-amber-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
                >
                  إضافة للشجرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Parent/Ancestor Modal */}
      {showAddParentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcf8f2] dark:bg-[#1e1915] border border-amber-300 dark:border-[#483d31] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-xl font-bold font-amiri text-amber-950 dark:text-amber-100">
              إضافة أب أو جد أعلى لـ ({targetPersonName})
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              أدخل اسم الوالد أو الجد الأكبر ليتم ربطه مباشرة فوق هذا الشخص:
            </p>

            <form onSubmit={handleConfirmAddParent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">اسم الأب أو الجد (الأعلى):</label>
                <input 
                  type="text"
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
                  placeholder="مثال: نجم أو محمد"
                  autoFocus
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-amber-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setShowAddParentModal(false)}
                  className="px-4 py-2 bg-stone-300 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-emerald-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
                >
                  إضافة أب أعلى
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Insert Missing Person in the Middle of Branch Modal */}
      {showInsertModal && insertBranchInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcf8f2] dark:bg-[#1e1915] border border-amber-300 dark:border-[#483d31] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-stone-700 pb-3">
              <h3 className="text-lg font-bold font-amiri text-amber-950 dark:text-amber-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm font-bold">+</span>
                إدراج شخص مفقود في منتصف الغصن
              </h3>
              <button
                onClick={() => setShowInsertModal(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-100/60 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-300/60 text-xs text-stone-700 dark:text-stone-300 space-y-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                موقع الإدراج في شجرة العائلة:
              </p>
              <div className="flex items-center gap-2 font-bold text-stone-800 dark:text-stone-100 pt-1 flex-wrap">
                <span className="bg-stone-200 dark:bg-stone-800 px-2 py-0.5 rounded">{insertBranchInfo.parentName} (الأعلى)</span>
                <span>←</span>
                <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded shadow-xs">الشخص الجديد</span>
                <span>←</span>
                <span className="bg-stone-200 dark:bg-stone-800 px-2 py-0.5 rounded">{insertBranchInfo.childName} (الأسفل)</span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 pt-1">
                سيكون الشخص الجديد ابناً لـ ({insertBranchInfo.parentName}) ووالداً لـ ({insertBranchInfo.childName}).
              </p>
            </div>

            <form onSubmit={handleConfirmInsertPerson} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  اسم الشخص الجديد <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={insertPersonName}
                  onChange={(e) => setInsertPersonName(e.target.value)}
                  placeholder="مثال: عبد الله، سالم، حسن..."
                  className="w-full px-3 py-2 bg-white dark:bg-[#15110e] border border-amber-300 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  الصفات والمهن (اختياري)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TAG_OPTIONS.map((tag) => {
                    const isSelected = insertPersonTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => {
                          setInsertPersonTags(prev => 
                            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-amber-700 border-amber-800 text-white shadow-xs'
                            : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-amber-50'
                        }`}
                      >
                        {tag} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/80 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setShowInsertModal(false)}
                  className="px-4 py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow flex items-center gap-1.5"
                >
                  <span className="font-extrabold text-sm">+</span>
                  <span>إدراج في الغصن وحفظ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Context Menu Popup */}
      {contextMenu.visible && contextMenu.member && (
        <div
          className="fixed z-50 bg-white dark:bg-[#1e1713] border border-stone-300 dark:border-stone-700 rounded-xl shadow-2xl py-2 w-56 animate-in fade-in zoom-in-95 text-stone-800 dark:text-stone-200"
          style={{ top: `${Math.min(contextMenu.y, window.innerHeight - 250)}px`, left: `${Math.min(contextMenu.x, window.innerWidth - 230)}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-stone-200 dark:border-stone-800 text-xs font-bold text-amber-900 dark:text-amber-300 truncate">
            {contextMenu.member.name}
          </div>
          <button
            onClick={() => {
              handleOpenRenameModal(contextMenu.member!.uniqueId, contextMenu.member!.name);
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full text-right px-4 py-2 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-stone-800 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
            تحرير الاسم / تعديل
          </button>
          <button
            onClick={() => {
              handleOpenAddModal(contextMenu.member!.uniqueId, contextMenu.member!.name);
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full text-right px-4 py-2 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-stone-800 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            إضافة ابن جديد
          </button>
          <button
            onClick={() => {
              onDeleteNode(contextMenu.member!.uniqueId, contextMenu.member!.name);
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full text-right px-4 py-2 text-xs font-semibold hover:bg-red-50 dark:hover:bg-stone-900/50 text-red-600 dark:text-red-400 flex items-center gap-2 cursor-pointer transition-colors border-t border-stone-100 dark:border-stone-800"
          >
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            حذف العقدة وفروعها
          </button>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcf8f2] dark:bg-[#1e1915] border border-amber-300 dark:border-[#483d31] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-xl font-bold font-amiri text-amber-950 dark:text-amber-100">
              تحرير وتعديل اسم الفرد
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              أدخل الاسم الجديد لـ ({renameTargetName}).
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newEditedName.trim() && renameTargetId) {
                handleRenameNode(renameTargetId, newEditedName.trim());
                setShowRenameModal(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">الاسم الجديد:</label>
                <input
                  type="text"
                  value={newEditedName}
                  onChange={(e) => setNewEditedName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  autoFocus
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-amber-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="px-4 py-2 bg-stone-300 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-amber-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
                >
                  حفظ التعديل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
