export interface RelationEntry {
  id: string;
  sonName: string;
  fatherName: string;
  grandfatherName?: string;
  greatGrandfatherName?: string;
  tags?: string[];
  createdAt: string;
}

export interface FamilyMember {
  name: string;
  children: FamilyMember[];
  generation: number;
  parents: string[];
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
  branchStyle?: 'curved' | 'straight' | 'geometric';
  generationOrder?: 'ascending' | 'descending';
}
