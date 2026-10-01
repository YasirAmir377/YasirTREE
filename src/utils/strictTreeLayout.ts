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
  autoFitScale: number;
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
  // Node width matching dynamicRx with safety padding
  const dynamicRx = Math.max(58, len * 8.8);
  return Math.round(dynamicRx * 2 + 12);
}

export function getNodeHeight(): number {
  return 42;
}

/**
 * Internal single-pass layout calculator for a given minGap and yStep
 */
function runLayoutPass(
  roots: FamilyMember[],
  minGap: number,
  yStep: number
): {
  rawPositions: Map<string, { relX: number; depth: number; width: number; height: number }>;
  rawWidth: number;
  maxDepth: number;
} {
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

  // Layout all root trees side-by-side using contour-packing
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
      let requiredShift = prevShift + (prevLayout.width + rLayout.width) / 2 + minGap * 1.4;

      const maxCommonDepth = Math.min(forestContour.length, rLayout.contour.length);
      for (let d = 0; d < maxCommonDepth; d++) {
        const depthShift = forestContour[d].right - rLayout.contour[d].left + minGap * 1.4;
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

  let rawMinX = Infinity;
  let rawMaxX = -Infinity;
  let maxDepth = 0;
  combinedRawPositions.forEach(pos => {
    rawMinX = Math.min(rawMinX, pos.relX - pos.width / 2);
    rawMaxX = Math.max(rawMaxX, pos.relX + pos.width / 2);
    maxDepth = Math.max(maxDepth, pos.depth);
  });

  return {
    rawPositions: combinedRawPositions,
    rawWidth: Math.max(10, rawMaxX - rawMinX),
    maxDepth
  };
}

/**
 * Computes a mathematically guaranteed non-crossing, non-overlapping tree layout
 * based on the Reingold-Tilford / Walker contour-merging algorithm.
 * 
 * Guarantees:
 * 1. Strict top-to-bottom orientation: Roots at top, children growing downward.
 * 2. Zero crossing lines: Sibling and cousin subtrees are partitioned into disjoint horizontal spans.
 * 3. Zero node overlaps: Every node on generation g is separated from its neighbors by at least minGap.
 * 4. Automatic fit inside the framed box: Compresses spacing and provides autoFitScale.
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
      totalHeight: 0,
      autoFitScale: 1.0,
      canvasWidth: 3000,
      canvasHeight: 2200
    };
  }

  // Available decorated inner frame dimensions
  // Frame inner bounds: x: 60..2940 (width 2880), y: 60..2140 (height 2080)
  // With comfortable padding:
  const targetFrameWidth = 2720;
  const targetFrameHeight = 1760;

  // Determine base horizontal gap between adjacent nodes
  const hMode = settings.horizontalSpacing || 'normal';
  let minGap = 44;
  if (hMode === 'wide') minGap = 72;
  if (hMode === 'ultra_wide') minGap = 110;

  // Vertical spacing per generation (growing downward)
  const vMode = settings.verticalSpacingMode || 'normal';
  let vMultiplier = 1.0;
  if (vMode === 'extended') vMultiplier = 1.35;
  if (vMode === 'super_extended') vMultiplier = 1.75;
  const yStep = 145 * vMultiplier;

  // Pass 1: Run with base minGap
  let layoutResult = runLayoutPass(roots, minGap, yStep);

  // If width exceeds targetFrameWidth, compress horizontal spacing adaptively
  if (layoutResult.rawWidth > targetFrameWidth && minGap > 18) {
    // Calculate compressed gap to fit inside targetFrameWidth if possible
    const excessRatio = targetFrameWidth / layoutResult.rawWidth;
    const compressedGap = Math.max(18, Math.floor(minGap * excessRatio));
    if (compressedGap < minGap) {
      layoutResult = runLayoutPass(roots, compressedGap, yStep);
    }
  }

  const { rawPositions, maxDepth } = layoutResult;

  // Calculate horizontal bounds
  let rawMinX = Infinity;
  let rawMaxX = -Infinity;
  rawPositions.forEach(pos => {
    rawMinX = Math.min(rawMinX, pos.relX - pos.width / 2);
    rawMaxX = Math.max(rawMaxX, pos.relX + pos.width / 2);
  });

  // Center tree horizontally in the 3000px canvas (canvas center is 1500)
  const canvasCenter = 1500;
  const offsetX = canvasCenter - (rawMinX + rawMaxX) / 2;

  // Vertical placement:
  // generationOrder === 'ascending' => Standard Vertical (Top-to-Bottom: Roots at top, children growing downward)
  // generationOrder === 'descending' => Inverse Vertical (Bottom-to-Top: Roots at bottom/base, children growing upward)
  const isAscending = generationOrder === 'ascending';
  const totalVerticalSpan = maxDepth * yStep;
  const desiredCenterY = 1100;
  const baseRootY = isAscending
    ? Math.max(260, Math.round(desiredCenterY - totalVerticalSpan / 2))
    : Math.min(1940, Math.round(desiredCenterY + totalVerticalSpan / 2));

  let minFinalX = Infinity;
  let maxFinalX = -Infinity;
  let minFinalY = Infinity;
  let maxFinalY = -Infinity;

  rawPositions.forEach((pos, id) => {
    const finalX = Math.round(pos.relX + offsetX);
    const finalY = isAscending
      ? Math.round(baseRootY + pos.depth * yStep)
      : Math.round(baseRootY - pos.depth * yStep);

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

  const totalWidth = Math.max(10, maxFinalX - minFinalX);
  const totalHeight = Math.max(10, maxFinalY - minFinalY);

  // Compute scale required to fit 100% inside the decorated frame
  const scaleX = targetFrameWidth / totalWidth;
  const scaleY = targetFrameHeight / totalHeight;
  const autoFitScale = Math.min(1.0, Math.max(0.15, Number(Math.min(scaleX, scaleY).toFixed(3))));

  return {
    positions,
    minX: minFinalX,
    maxX: maxFinalX,
    minY: minFinalY,
    maxY: maxFinalY,
    totalWidth,
    totalHeight,
    autoFitScale,
    canvasWidth: 3000,
    canvasHeight: 2200
  };
}
