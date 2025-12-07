export interface UserSettings {
  aiEnabled: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  settings?: UserSettings;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  name: string;
  text: string;
  createdAt: string;
}

export interface Code {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  color?: string;
   flags?: string[];
}

export interface Segment {
  id: string;
  documentId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  createdBy: string;
  createdAt: string;
}

export interface CodedSegment {
  id: string;
  segmentId: string;
  codeId: string;
  createdAt: string;
}

export interface Settings {
  id: 'default';
  aiEnabled: boolean;
  aiSuggestionLimit?: number;
}

export interface DbSchema {
  users: User[];
  projects: Project[];
  documents: Document[];
  codes: Code[];
  segments: Segment[];
  codedSegments: CodedSegment[];
  settings: Settings[];
}
