/**
 * Type definitions for the application
 */

export interface DeedData {
  apn: string;
  address: string;
  grantee: string;
  grantor: string;
  legalDescription: string;
  recordingDate?: string;
  deedType?: string;
  pageCount?: number;
  success: boolean;
  error?: string;
}

export interface TrustTransferData {
  grantor: string; // Original grantee becomes the grantor
  trustName: string;
  trustDate: string;
  apn: string;
  address: string;
  legalDescription: string;
  county: string;
}

export interface PCORData {
  county: string;
  apn: string;
  address: string;
  grantor: string;
  trustName: string;
}

export interface GeneratedDocument {
  success: boolean;
  pdf: string; // Base64 encoded PDF
  filename: string;
  error?: string;
}

export type County =
  | 'Los Angeles'
  | 'Ventura'
  | 'Riverside'
  | 'San Bernardino'
  | 'Orange';

export const COUNTIES: County[] = [
  'Los Angeles',
  'Ventura',
  'Riverside',
  'San Bernardino',
  'Orange',
];
