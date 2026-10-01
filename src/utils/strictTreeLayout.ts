import { FamilyMember, TreeSettings } from '../types';

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  generation: number;
}

export interface StrictTreeLayoutResult {
  positions: Map<string, NodePosition>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  totalWidth: number;
  totalHeight: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

interface ContourLevel {
  left: number;
  right: number;
}

interface SubtreeLayout {
  positions: Map<string, { relX: number; depth: number; width: number; height: number }>;
  contour: ContourLevel[];
  width: number;
}

/**
 * Calculates dynamic node width based on Arabic name length
 * to ensure ample room for labels and borders without clipping.
 */
export function getNodeWidth(name: string): number {
  const len = (name || '').trim().length;
  // Node width matching dynamicRx (Math.max(56, len * 8.5) * 2) + 16px safety padding
  return Math.max(128, len * 17 + 24);
}

export function getNodeHeight(): number {
  return 44;
}

/**
 * Computes a mathematically guaranteed non-crossing, non-overlapping tree layout
 * based on the Reingold-Tilford / Walker contour-merging algorithm.
 * 
 * Guarantees:
 * 1. Zero crossing lines: Sibling and cousin subtrees are partitioned into disjoint horizontal spans.
 * 2. Zero node overlaps: Every node on generation g is separated from its neighbors by at least minGap.
 */
export function computeStrictTreeLayout(
  roots: FamilyMember[],
  settings: TreeSettings,
  generationOrder: 'ascending' | 'descending' = 'ascending'
): StrictTreeLayoutResult {
  const positions = new Map<string, NodePosition>();

  if (!roots || roots.length === 0) {
    return {
      positions,
      minX: 1500,
      maxX: 1500,
      minY: 1100,
      maxY: 1100,
      totalWidth: 0,
      totalHeight: 0
    };
  }

  // Determine horizontal gap between adjacent nodes
  const hMode = settings.horizontalSpacing || 'normal';
  let minGap = 55;
  if (hMode === 'wide') minGap = 95;
  if (hMode === 'ultra_wide') minGap = 160;

  // Determine vertical spacing per generation
  const vMode = settings.verticalSpacingMode || 'normal';
  let vMultiplier = 1.0;
  if (vMode === 'extended') vMultiplier = 1.4;
  if (vMode === 'super_extended') vMultiplier = 1.9;
  const yStep = 150 * vMultiplier;

  // Recursive post-order subtree layout with depth-level contour tracking
  function layoutSubtree(node: FamilyMember): SubtreeLayout {
    const nodeWidth = getNodeWidth(node.name);
    const nodeHeight = getNodeHeight();
    const halfWidth = nodeWidth / 2;

    // Base case: Leaf node (no children)
    if (!node.children || node.children.length === 0) {
      const posMap = new Map<string, { relX: number; depth: number; width: number; height: number }>();
      posMap.set(node.uniqueId, { relX: 0, depth: 0, width: nodeWidth, height: nodeHeight });
      return {
        positions: posMap,
        contour: [{ left: -halfWidth, right: halfWidth }],
        width: nodeWidth
      };
    }

    // Step 1: Recursively layout each child
    const childLayouts = node.children.map(child => layoutSubtree(child));

    // Step 2: Pack sibling subtrees side-by-side using contour collision resolution
    const childShifts: number[] = [];
    const combinedContour: ContourLevel[] = [];

    childLayouts.forEach((childLayout, idx) => {
      if (idx === 0) {
        childShifts.push(0);
        childLayout.contour.forEach(level => {
          combinedContour.push({ left: level.left, right: level.right });
        });
      } else {
        const prevLayout = childLayouts[idx - 1];
        const prevShift = childShifts[idx - 1];

        // Minimum distance based on immediate sibling node widths
        let requiredShift = prevShift + (prevLayout.width + childLayout.width) / 2 + minGap;

        // Check all common depth levels to prevent cousin / descendant subtree collisions
        const maxCommonDepth = Math.min(combinedContour.length, childLayout.contour.length);
        for (let d = 0; d < maxCommonDepth; d++) {
          const leftBoundOfChild = childLayout.contour[d].left;
          const rightBoundOfCombined = combinedContour[d].right;
          // We need: (shift + leftBoundOfChild) - rightBoundOfCombined >= minGap
          const depthShift = rightBoundOfCombined - leftBoundOfChild + minGap;
          if (depthShift > requiredShift) {
            requiredShift = depthShift;
          }
        }

        childShifts.push(requiredShift);

        // Merge child's contour into combined contour
        for (let d = 0; d < childLayout.contour.length; d++) {
          const shiftedLeft = requiredShift + childLayout.contour[d].left;
          const shiftedRight = requiredShift + childLayout.contour[d].right;

          if (d < combinedContour.length) {
            combinedContour[d].right = Math.max(combinedContour[d].right, shiftedRight);
          } else {
            combinedContour.push({ left: shiftedLeft, right: shiftedRight });
          }
        }
      }
    });

    // Step 3: Position parent node at midpoint of first and last child
    const firstChildX = childShifts[0];
    const lastChildX = childShifts[childShifts.length - 1];
    const childrenMidpoint = (firstChildX + lastChildX) / 2;
    const parentX = childrenMidpoint;

    // Shift all children so parent is centered at relX = 0
    const mergedPositions = new Map<string, { relX: number; depth: number; width: number; height: number }>();
    mergedPositions.set(node.uniqueId, { relX: 0, depth: 0, width: nodeWidth, height: nodeHeight });

    childLayouts.forEach((childLayout, idx) => {
      const childOffset = childShifts[idx] - parentX;
      childLayout.positions.forEach((pos, id) => {
        mergedPositions.set(id, {
          relX: pos.relX + childOffset,
          depth: pos.depth + 1,
          width: pos.width,
          height: pos.height
        });
      });
    });

    // Step 4: Build parent's combined contour (depth 0 is parent, depth 1..N are children shifted)
    const parentContour: ContourLevel[] = [
      { left: -halfWidth, right: halfWidth }
    ];

    combinedContour.forEach((level) => {
      parentContour.push({
        left: level.left - parentX,
        right: level.right - parentX
      });
    });

    // Ensure depth 0 contour accommodates parent width
    parentContour[0].left = Math.min(parentContour[0].left, -halfWidth);
    parentContour[0].right = Math.max(parentContour[0].right, halfWidth);

    const totalSubtreeWidth = Math.max(
      nodeWidth,
      parentContour.reduce((maxW, c) => Math.max(maxW, c.right - c.left), 0)
    );

    return {
      positions: mergedPositions,
      contour: parentContour,
      width: totalSubtreeWidth
    };
  }

  // Layout all root trees side-by-side using the same contour-pack technique
  const rootLayouts = roots.map(root => layoutSubtree(root));
  const rootShifts: number[] = [];
  const forestContour: ContourLevel[] = [];

  rootLayouts.forEach((rLayout, idx) => {
    if (idx === 0) {
      rootShifts.push(0);
      rLayout.contour.forEach(lvl => {
        forestContour.push({ left: lvl.left, right: lvl.right });
      });
    } else {
      const prevLayout = rootLayouts[idx - 1];
      const prevShift = rootShifts[idx - 1];
      let requiredShift = prevShift + (prevLayout.width + rLayout.width) / 2 + minGap * 1.5;

      const maxCommonDepth = Math.min(forestContour.length, rLayout.contour.length);
      for (let d = 0; d < maxCommonDepth; d++) {
        const depthShift = forestContour[d].right - rLayout.contour[d].left + minGap * 1.5;
        if (depthShift > requiredShift) {
          requiredShift = depthShift;
        }
      }

      rootShifts.push(requiredShift);

      for (let d = 0; d < rLayout.contour.length; d++) {
        const shiftedLeft = requiredShift + rLayout.contour[d].left;
        const shiftedRight = requiredShift + rLayout.contour[d].right;
        if (d < forestContour.length) {
          forestContour[d].right = Math.max(forestContour[d].right, shiftedRight);
        } else {
          forestContour.push({ left: shiftedLeft, right: shiftedRight });
        }
      }
    }
  });

  // Collect all relative positions with root shifts applied
  const combinedRawPositions = new Map<string, { relX: number; depth: number; width: number; height: number }>();
  rootLayouts.forEach((rLayout, idx) => {
    const shift = rootShifts[idx];
    rLayout.positions.forEach((pos, id) => {
      combinedRawPositions.set(id, {
        ...pos,
        relX: pos.relX + shift
      });
    });
  });

  // Calculate horizontal bounds
  let rawMinX = Infinity;
  let rawMaxX = -Infinity;
  combinedRawPositions.forEach(pos => {
    rawMinX = Math.min(rawMinX, pos.relX - pos.width / 2);
    rawMaxX = Math.max(rawMaxX, pos.relX + pos.width / 2);
  });

  const totalWidth = rawMaxX - rawMinX;
  // Center tree horizontally in the 3000px canvas (canvas center is 1500)
  const canvasCenter = 1500;
  const offsetX = canvasCenter - (rawMinX + rawMaxX) / 2;

  // Determine base vertical origin
  // Ascending: Root ancestors at top (y = 400), children branch downwards (+yStep)
  // Descending: Root ancestors at bottom (y = 1550), children branch upwards (-yStep)
  const baseRootY = generationOrder === 'ascending' ? 380 : 1550;
  const yDirection = generationOrder === 'ascending' ? 1 : -1;

  let minFinalX = Infinity;
  let maxFinalX = -Infinity;
  let minFinalY = Infinity;
  let maxFinalY = -Infinity;

  combinedRawPositions.forEach((pos, id) => {
    const finalX = Math.round(pos.relX + offsetX);
    const finalY = Math.round(baseRootY + pos.depth * yStep * yDirection);

    minFinalX = Math.min(minFinalX, finalX - pos.width / 2);
    maxFinalX = Math.max(maxFinalX, finalX + pos.width / 2);
    minFinalY = Math.min(minFinalY, finalY - pos.height / 2);
    maxFinalY = Math.max(maxFinalY, finalY + pos.height / 2);

    positions.set(id, {
      x: finalX,
      y: finalY,
      width: pos.width,
      height: pos.height,
      generation: pos.depth + 1
    });
  });

  return {
    positions,
    minX: minFinalX,
    maxX: maxFinalX,
    minY: minFinalY,
    maxY: maxFinalY,
    totalWidth: maxFinalX - minFinalX,
    totalHeight: maxFinalY - minFinalY,
    canvasWidth: 3000,
    canvasHeight: 2200
  };
}
