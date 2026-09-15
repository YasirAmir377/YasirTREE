import React, { useState, useEffect } from 'react';
import { FamilyMember, TreeSettings, RelationEntry } from '../types';
import { cleanName } from '../utils/treeUtils';
import { 
  ZoomIn, ZoomOut, RotateCcw, Download, 
  Search, Sliders, Sparkles, ChevronDown, ChevronUp, FileText, Printer, ArrowUpDown, LayoutGrid 
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
  onAddChild: (fatherName: string, sonName: string, tags?: string[]) => void;
  onDeleteNode: (personName: string) => void;
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
  // Always center tree on load or when tree data changes
  useEffect(() => {
    handleCenterView();
  }, [treeData.rootsCount, treeData.allPersons.length]);

  const handleReparentNode = (sonName: string, newFatherName: string) => {
    if (!setEntries) return;
    if (sonName === newFatherName) return;

    // Check circularity: newFatherName cannot be a descendant of sonName
    const descendants = new Set<string>();
    const queue = [sonName];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      descendants.add(curr);
      entries.forEach(e => {
        if (e.fatherName === curr && e.sonName) {
          descendants.add(e.sonName);
          queue.push(e.sonName);
        }
      });
    }

    if (descendants.has(newFatherName)) {
      alert(`عذراً، لا يمكن ربط (${sonName}) بأحد أبنائه أو أحفاده (${newFatherName}) لتجنب التداخل الدائري.`);
      return;
    }

    setEntries(prev => {
      const existingIndex = prev.findIndex(e => e.sonName === sonName);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          fatherName: newFatherName
        };
        return updated;
      } else {
        const nextId = prev.length > 0 ? (Math.max(...prev.map(item => parseInt(item.id) || 0)) + 1).toString() : '1';
        const newEntry: RelationEntry = {
          id: nextId,
          sonName: sonName,
          fatherName: newFatherName,
          createdAt: new Date().toISOString()
        };
        return [...prev, newEntry];
      }
    });

    alert(`تم بنجاح سحب وإفلات (${sonName}) ليصبح ابناً لـ (${newFatherName}) وتحديث الغصن والرابط فورياً.`);
  };
  const [showAddChildModal, setShowAddChildModal] = useState<boolean>(false);
  const [showAddParentModal, setShowAddParentModal] = useState<boolean>(false);
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
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

  const [addingFatherName, setAddingFatherName] = useState<string>('');
  const [targetPersonName, setTargetPersonName] = useState<string>('');
  const [newChildName, setNewChildName] = useState<string>('');
  const [newParentName, setNewParentName] = useState<string>('');
  const [selectedChildTags, setSelectedChildTags] = useState<string[]>([]);

  const AVAILABLE_TAG_OPTIONS = ['شهيد', 'طبيب', 'ضابط', 'شيخ', 'تدريسي', 'معلم', 'متوفي'];

  const handleOpenAddModal = (fatherName: string) => {
    setAddingFatherName(fatherName);
    setNewChildName('');
    setSelectedChildTags([]);
    setShowAddChildModal(true);
  };

  const handleOpenAddParentModal = (personName: string) => {
    setTargetPersonName(personName);
    setNewParentName('');
    setShowAddParentModal(true);
  };

  const handleOpenRenameModal = (name: string) => {
    setRenameTargetName(name);
    setNewEditedName(name);
    setShowRenameModal(true);
  };

  const handleRenameNode = (oldName: string, newName: string) => {
    if (!setEntries) return;
    if (!newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    setEntries(prev => prev.map(e => ({
      ...e,
      sonName: e.sonName === oldName ? trimmed : e.sonName,
      fatherName: e.fatherName === oldName ? trimmed : e.fatherName
    })));
  };

  const handleConfirmAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChildName.trim() && addingFatherName) {
      onAddChild(addingFatherName, newChildName.trim(), selectedChildTags);
      setShowAddChildModal(false);
    }
  };

  const handleConfirmAddParent = (e: React.FormEvent) => {
    e.preventDefault();
    if (newParentName.trim() && targetPersonName) {
      // Adding a parent (grandpa/father) above this person: newParentName is father of targetPersonName
      onAddChild(newParentName.trim(), targetPersonName, []);
      setShowAddParentModal(false);
    }
  };
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragStart, setNodeDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    setZoom(1.0);
  };
  const [zoom, setZoom] = useState<number>(1.0); // Standard starting at 100%
  const [pan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialPinchDist, setInitialPinchDist] = useState<number | null>(null);
  const [initialZoomOnPinch, setInitialZoomOnPinch] = useState<number>(1.0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDist(dist);
      setInitialZoomOnPinch(zoom);
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
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setInitialPinchDist(null);
    }
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null); // stores uniqueId
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [isExportingHD, setIsExportingHD] = useState<boolean>(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 3.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.3));
  const handleResetZoom = () => {
    setZoom(1.0); // Reset to standard 100%
  };
  const handleCenterView = () => {
    setZoom(1.0);
    setNodeOffsets({});
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

  const currentFont = settings.fontFamily || 'Amiri';
  const nameScale = settings.nameFontSizeScale || 1.0;
  const branchStyle = settings.branchStyle || 'curved';
  const generationOrder = settings.generationOrder || 'descending';

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

  const getBranchPath = (parentId: string, childId: string, x: number, y: number, childX: number, childY: number, spreadFactor: number) => {
    const parentOffset = nodeOffsets[parentId] || { x: 0, y: 0 };
    const childOffset = nodeOffsets[childId] || { x: 0, y: 0 };

    const actualX = x + parentOffset.x;
    const actualY = y + parentOffset.y;
    const actualChildX = childX + childOffset.x;
    const actualChildY = childY + childOffset.y;

    const startYOffset = generationOrder === 'ascending' ? 15 : -15;
    const endYOffset = generationOrder === 'ascending' ? -15 : 15;

    if (branchStyle === 'straight') {
      return `M ${actualX} ${actualY + startYOffset} L ${actualChildX} ${actualChildY + endYOffset}`;
    }
    if (branchStyle === 'geometric') {
      const midY = (actualY + actualChildY) / 2;
      return `M ${actualX} ${actualY + startYOffset} L ${actualX} ${midY} L ${actualChildX} ${midY} L ${actualChildX} ${actualChildY + endYOffset}`;
    }
    if (branchStyle === 'waved') {
      const midX = (actualX + actualChildX) / 2 + (spreadFactor * 40);
      const midY = (actualY + actualChildY) / 2;
      return `M ${actualX} ${actualY + startYOffset} Q ${midX} ${midY} ${actualChildX} ${actualChildY + endYOffset}`;
    }
    // Default curved
    const ctrlOffset = generationOrder === 'ascending' ? 45 : -45;
    return `M ${actualX} ${actualY + startYOffset} C ${actualX + spreadFactor * 35} ${actualY + ctrlOffset}, ${actualChildX} ${actualChildY - ctrlOffset}, ${actualChildX} ${actualChildY + endYOffset}`;
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

    const yOffset = (generationOrder === 'ascending' ? 140 : -140) * spacingMultiplier * Math.max(1.0, nameScale);

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

    // Dynamic auto-sizing based on name length and font scale (50% to 300%)
    const nameLength = member.name.length;
    const scaleFactor = nameScale;
    const dynamicRx = Math.max(56, nameLength * 8.5) * scaleFactor;
    const dynamicRy = 27 * scaleFactor;
    const dynamicSheikhRadius = Math.max(48, nameLength * 7.5) * scaleFactor;
    const dynamicRectWidth = Math.max(112, nameLength * 14) * scaleFactor;
    const dynamicRectHeight = 40 * scaleFactor;

    return (
      <g key={`${member.uniqueId}-${level}-${x}-${y}`}>
        {/* Organic or geometric branching */}
        {hasChildren && member.children.map((child, idx) => {
          // Robust anti-overlap child spread scaling with child count and name widths
          const hMode = settings.horizontalSpacing || 'normal';
          let hMultiplier = 1.0;
          if (hMode === 'wide') hMultiplier = 1.6;
          if (hMode === 'ultra_wide') hMultiplier = 2.4;

          const baseSpacing = Math.max(450 * nameScale, numChildren * 220 * nameScale) * hMultiplier;
          const childSpread = Math.max(spread * 0.95, baseSpacing);
          const spreadFactor = numChildren === 1 ? 0 : (idx - (numChildren - 1) / 2);
          const childX = x + spreadFactor * childSpread;
          const childY = y + yOffset; // Vertical distance between generations based on order

          return (
            <g key={`branch-${member.uniqueId}-${child.uniqueId}-${idx}`} className="transition-all duration-500 ease-in-out">
              <path
                d={getBranchPath(member.uniqueId, child.uniqueId, x, y, childX, childY, spreadFactor)}
                fill="none"
                stroke={settings.branchColor || '#5c3a21'}
                strokeWidth={Math.max(2, (settings.lineThickness || 3) - level * 0.3)}
                strokeLinecap="round"
                opacity="0.92"
                className="transition-all duration-500 ease-in-out"
              />
              {renderSubTreeSVG(child, childX, childY, childSpread, level + 1)}
            </g>
          );
        })}

        {/* Member Leaf / Node with Auto-Sizing */}
        <g 
          transform={`translate(${x + (nodeOffsets[member.uniqueId]?.x || 0)}, ${y + (nodeOffsets[member.uniqueId]?.y || 0)})`}
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
            e.dataTransfer.setData('text/plain', member.name);
            e.stopPropagation();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const draggedSon = e.dataTransfer.getData('text/plain');
            const targetFather = member.name;
            if (draggedSon && draggedSon !== targetFather) {
              handleReparentNode(draggedSon, targetFather);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPerson(member.uniqueId);
          }}
          onMouseDown={(e) => handleNodeMouseDown(e, member.uniqueId)}
          onTouchStart={(e) => handleNodeTouchStart(e, member.uniqueId)}
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
                stroke={nodeStroke}
                strokeWidth="4"
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
              stroke={nodeStroke}
              strokeWidth={isHighlighted ? "2.5" : "1.5"}
              className="transition-all duration-300 shadow-md hover:brightness-110"
            />
          ) : (
            <rect
              x={-dynamicRectWidth / 2}
              y={-dynamicRectHeight / 2}
              width={dynamicRectWidth}
              height={dynamicRectHeight}
              rx={10 * scaleFactor}
              fill={nodeGreenFill}
              stroke={nodeStroke}
              strokeWidth={isHighlighted ? "2.5" : "1.5"}
              className="transition-all duration-300 shadow-md"
            />
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
                  handleOpenAddModal(member.name);
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
                  handleOpenAddParentModal(member.name);
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
                  onDeleteNode(member.name);
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
          {/* Quick toggle generation order button */}
          <button
            onClick={() => setSettings(prev => ({ ...prev, generationOrder: prev.generationOrder === 'ascending' ? 'descending' : 'ascending' }))}
            className="flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 text-amber-100 text-xs font-medium px-3.5 py-2 rounded-xl border border-amber-600 transition-all cursor-pointer"
            title="تبديل ترتيب الأجيال (تصاعدي / تنازلي)"
          >
            <ArrowUpDown className="w-4 h-4 text-amber-300" />
            <span>{generationOrder === 'ascending' ? 'الترتيب: تصاعدي' : 'الترتيب: تنازلي'}</span>
          </button>

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
              value={settings.title}
              onChange={e => setSettings(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs"
            />
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
              onChange={e => setSettings(prev => ({ ...prev, branchStyle: e.target.value as 'curved' | 'straight' | 'geometric' | 'waved' }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#15110e] border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium"
            >
              <option value="curved">خطوط منحنية طبيعية (Curved)</option>
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
                checked={settings.showAyah}
                onChange={e => setSettings(prev => ({ ...prev, showAyah: e.target.checked }))}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              الآية القرآنية والأحاديث
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-300">
              <input
                type="checkbox"
                checked={settings.showLeaves}
                onChange={e => setSettings(prev => ({ ...prev, showLeaves: e.target.checked }))}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              أوراق بيضاوية
            </label>
          </div>
        </div>
      )}

      {/* Canvas Controls Bar */}
      <div className="bg-white dark:bg-[#1e1915] border border-[#e5dac6] dark:border-[#3d3328] rounded-xl px-4 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="البحث عن اسم..."
              className="pl-3 pr-9 py-1.5 bg-[#fcf8f2] dark:bg-[#28221b] border border-[#d8ccb5] dark:border-[#42372c] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-600 text-stone-800 dark:text-stone-100"
            />
          </div>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-stone-500 hover:text-stone-800 underline">
              مسح البحث
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Name Font Size Scale Controls (A- / A+) */}
          <div className="flex items-center gap-1.5 bg-[#fcf8f2] dark:bg-[#2a231d] rounded-lg border border-stone-300 dark:border-[#483d31] px-2.5 py-1">
            <span className="text-xs font-bold text-stone-600 dark:text-stone-300">حجم الأسماء:</span>
            <button
              onClick={() => setSettings(prev => ({ ...prev, nameFontSizeScale: Math.max(0.5, Number(((prev.nameFontSizeScale || 1.0) - 0.2).toFixed(1))) }))}
              className="px-2 py-0.5 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer hover:bg-amber-100"
              title="تصغير الأسماء"
            >
              A-
            </button>
            <select
              value={Math.round(nameScale * 100)}
              onChange={e => setSettings(prev => ({ ...prev, nameFontSizeScale: Number(e.target.value) / 100 }))}
              className="px-2 py-1 bg-white dark:bg-stone-800 text-amber-900 dark:text-amber-200 rounded border border-stone-300 dark:border-stone-700 text-xs font-mono font-bold cursor-pointer"
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
              className="px-2 py-0.5 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer hover:bg-amber-100"
              title="تكبير الأسماء"
            >
              A+
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-stone-500 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-md">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={handleZoomOut} className="p-2 bg-stone-100 dark:bg-[#2a231d] rounded-lg border border-stone-300 dark:border-[#483d31] cursor-pointer" title="تصغير الشجرة">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleZoomIn} className="p-2 bg-stone-100 dark:bg-[#2a231d] rounded-lg border border-stone-300 dark:border-[#483d31] cursor-pointer" title="تكبير الشجرة">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={handleResetZoom} className="p-2 bg-stone-100 dark:bg-[#2a231d] rounded-lg border border-stone-300 dark:border-[#483d31] cursor-pointer" title="إعادة التعيين لـ 100%">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleCenterView}
              className="flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 text-amber-100 px-3 py-1.5 rounded-lg text-xs font-medium shadow cursor-pointer border border-amber-600"
              title="توسيط الشجرة بالمنتصف وإعادة التعيين"
            >
              <RotateCcw className="w-4 h-4 text-amber-300" />
              <span>توسيط الشجرة بالمنتصف</span>
            </button>
            <button onClick={handleAutoLayout} className="flex items-center gap-1.5 bg-[#5c3a21] hover:bg-[#4a2e1a] text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow cursor-pointer" title="إعادة ترتيب الشجرة تلقائياً ومنع التداخل">
              <LayoutGrid className="w-4 h-4" />
              <span>إعادة ترتيب تلقائي</span>
            </button>
            <button onClick={() => setShowExportModal(true)} className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white px-4 py-1.5 rounded-lg text-xs font-medium shadow cursor-pointer">
              <Download className="w-4 h-4" />
              <span>تصدير أعلى دقة / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Heritage Family Tree SVG Canvas Container (3000 x 2200) */}
      <div 
        className="relative bg-[#f7f1e3] dark:bg-[#181410] border-4 border-[#d4af37]/40 rounded-2xl shadow-2xl overflow-hidden select-none"
        style={{ minHeight: '750px', height: '84vh' }}
        onMouseMove={handleNodeMouseMove}
        onMouseUp={handleNodeMouseUp}
        onMouseLeave={handleNodeMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => {
          handleTouchMove(e);
          handleNodeTouchMove(e);
        }}
        onTouchEnd={(e) => {
          handleTouchEnd(e);
          handleNodeTouchEnd();
        }}
      >
        <div className="absolute inset-3 border-2 border-dashed border-[#b89753]/30 pointer-events-none rounded-xl z-10" />

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

            {/* Ornate Islamic/Arabic Heritage Border */}
            <rect x="25" y="25" width="2950" height="2150" fill="none" stroke="#2b1810" strokeWidth="16" rx="12" />
            <rect x="42" y="42" width="2916" height="2116" fill="none" stroke="#b89753" strokeWidth="4" rx="8" />
            <rect x="52" y="52" width="2896" height="2096" fill="none" stroke="#b89753" strokeWidth="1" rx="6" />

            {/* Top & Bottom Ornate Border Patterns */}
            <g fill="#2b1810">
              <pattern id="islamic-border" x="0" y="0" width="60" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 60 15 L 30 30 L 0 15 Z" fill="none" stroke="#2b1810" strokeWidth="2.5" />
                <circle cx="30" cy="15" r="5" fill="#b89753" />
              </pattern>
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

            {/* Tree Zoom Wrapper - scales only the family tree nodes and branches */}
            <g transform={`translate(1500, 1100) scale(${zoom}) translate(-1500, -1100)`}>
              {/* Render Family Tree */}
              {treeData.roots.length > 0 ? (
                <g transform="translate(0, 0)">
                  {treeData.roots.map((rootNode, i) => {
                    const spacing = 2600 / (treeData.roots.length + 1);
                    const startX = 200 + spacing * (i + 1);
                    const rootY = generationOrder === 'ascending' ? 400 : 1500;
                    return (
                      <g key={`root-${rootNode.name}-${i}`}>
                        {renderSubTreeSVG(rootNode, startX, rootY, 360, 1)}
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
                    onClick={() => handleOpenAddParentModal('')}
                  />
                  <text x="0" y="-32" textAnchor="middle" fill="#ffffff" fontSize="42" fontWeight="bold" className="cursor-pointer pointer-events-none">+</text>
                  <text x="0" y="30" textAnchor="middle" fill="#5c3a21" fontSize="22" fontFamily={`'${currentFont}', sans-serif`} fontWeight="bold">
                    انقر على علامة (+) لإضافة أول جد أو مؤسس للشجرة
                  </text>
                </g>
              )}
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
              handleOpenRenameModal(contextMenu.member!.name);
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full text-right px-4 py-2 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-stone-800 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
            تحرير الاسم / تعديل
          </button>
          <button
            onClick={() => {
              handleOpenAddModal(contextMenu.member!.name);
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full text-right px-4 py-2 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-stone-800 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            إضافة ابن جديد
          </button>
          <button
            onClick={() => {
              onDeleteNode(contextMenu.member!.name);
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
              أدخل الاسم الجديد لـ ({renameTargetName}). سيتم تحديث جميع العلاقات والروابط تلقائياً.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newEditedName.trim() && renameTargetName) {
                handleRenameNode(renameTargetName, newEditedName.trim());
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
