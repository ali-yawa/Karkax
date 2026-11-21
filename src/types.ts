export type ScreenEdge = 'left' | 'right' | 'top' | 'bottom';

export interface LocalInfo {
  id: string;
  name: string;
  os: 'macos' | 'windows' | 'linux';
  ip: string;
  port: number;
  pin: string;
  fingerprint: string;
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  os: 'macos' | 'windows' | 'linux';
  ip: string;
  port: number;
  pin: string;
  fingerprint: string;
  edge: ScreenEdge;
}

export interface SharingFeatures {
  input: boolean;
  clipboard: boolean;
  files: boolean;
  audio: boolean;
}

export type NavTab = 'devices' | 'quic' | 'input' | 'locales';
