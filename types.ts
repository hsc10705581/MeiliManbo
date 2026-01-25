export interface ResourceMetadata {
  description: string;
  source: string;
  fileSize: number; // in MB
  category: string;
  rating: number;
  tags: string[]; // 新增：标签数组
}

export interface Resource {
  id: string;
  name: string;
  image?: string; // base64 string
  metadata: ResourceMetadata;
  createdAt: string;
  updatedAt: string;
}

export enum ViewMode {
  GRID = 'GRID',
  LIST = 'LIST'
}

export interface SearchHit {
  id: string;
  score: number;
}