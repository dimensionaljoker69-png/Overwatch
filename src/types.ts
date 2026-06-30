export interface CameraData {
  id: string;
  name: string;
  url: string;
  lat: number;
  lng: number;
}

export interface TriageRecord {
  Procedure_Title?: string;
  Priority_Calculation?: string;
  Instructions?: string;
  [key: string]: any;
}

export interface FrequencyRecord {
  channel: string;
  frequency: string;
  description: string;
  type: 'police' | 'fire' | 'ems' | 'tactical' | 'air';
  status: 'active' | 'monitoring' | 'idle';
  lastActive: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}
