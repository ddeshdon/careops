// Shared domain types matching supabase/schema.sql

export type Role = "operator" | "caregiver" | "family" | "admin";

export type VisitStatus =
  | "assigned"
  | "checked_in"
  | "checked_out"
  | "completed"
  | "cancelled";

export type CareRecordKind = "vital" | "medication" | "note" | "photo" | "event";

export interface Organization {
  id: string;
  name: string;
  line_official_id: string | null;
  promptpay_receiver_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string | null;
  role: Role;
  full_name: string;
  phone: string | null;
  line_user_id: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  org_id: string;
  full_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  geofence_m: number;
  care_notes: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  org_id: string;
  patient_id: string;
  caregiver_id: string | null;
  status: VisitStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  check_in_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_photo_url: string | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface CareRecord {
  id: string;
  visit_id: string;
  org_id: string;
  kind: CareRecordKind;
  payload: Record<string, unknown>;
  recorded_at: string;
  created_by: string | null;
  prev_digest: string | null;
  digest: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  patient_id: string | null;
  visit_id: string | null;
  amount: number;
  status: "pending" | "paid";
  promptpay_payload: string | null;
  created_at: string;
}

// Payload shapes (kept loose on purpose; validated in API routes)
export interface VitalPayload {
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  temp?: number;
  spo2?: number;
  glucose?: number;
}

export interface MedicationPayload {
  name: string;
  dose?: string;
  given_at: string;
  scanned?: boolean;
}

export interface NotePayload {
  text: string;
  source?: "voice" | "text";
}
