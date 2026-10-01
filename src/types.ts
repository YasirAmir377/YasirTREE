export interface RelationEntry {
  id: string;
  personId?: string; // Unique persistent ID for this person node
  sonName: string;
  parentId?: string; // Unique persistent ID of the parent person node (empty if root)
  fatherName: string;
  grandfatherName?: string;
  greatGrandfatherName?: string;
  tags?: string[];
  createdAt: string;
}

export interface FamilyMember {
  uniqueId: string; // The unique person ID (e.g. UUID)
  name: string; // The displayed name (can be duplicate anywhere)
  personId?: string;
  parentId?: string;
  parentName?: string;
  children: FamilyMember[];
  generation: number;
  parents: string[];
  tags?: string[];
}

export type ViewMode = 'tree' | 'entries';

export interface TreeSettings {
  title: string;
  subtitle: string;
  showAyah: boolean;
  showOrnaments: boolean;
  showLeaves: boolean;
  lineThickness: number;
  layoutStyle: 'heritage' | 'hierarchical' | 'compact';
  ornamentStyle: 'islamic' | 'classic' | 'modern';
  themeColor: 'amber' | 'emerald' | 'gold' | 'royal';
  fontFamily: string;
  nameFontSizeScale?: number;
  branchStyle?: 'curved' | 'straight' | 'geometric' | 'waved';
  generationOrder?: 'ascending' | 'descending';
  verticalSpacingMode?: 'normal' | 'extended' | 'super_extended';
  horizontalSpacing?: 'normal' | 'wide' | 'ultra_wide';
  branchColoring?: 'default' | 'branch_groups' | 'custom';
  branchCustomColors?: Record<string, string>; // branch root name -> hex color
  branchColor?: string;
  nodeColoringMode?: 'generation' | 'tags' | 'branch' | 'default';
  hideRootNode?: boolean;
}
