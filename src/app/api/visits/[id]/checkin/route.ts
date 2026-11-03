import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/visits/:id/checkin — caregiver arrives at the home.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { lat, lng, photoUrl } = body as {
    lat?: number;
    lng?: number;
    photoUrl?: string;
  };

  // Fetch the visit + patient home coordinates for the geofence check.
  const { data: visit } = await supabase
    .from("visits")
    .select("id, patient_id, status")
    .eq("id", id)
    .single();

  if (!visit) return NextResponse.json({ error: "visit not found" }, { status: 404 });
  if (visit.status !== "assigned") {
    return NextResponse.json({ error: `visit is ${visit.status}` }, { status: 409 });
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("lat, lng, geofence_m")
    .eq("id", visit.patient_id)
    .single();

  let distanceM: number | null = null;
  if (lat != null && lng != null && patient?.lat != null && patient?.lng != null) {
    distanceM = haversine(lat, lng, Number(patient.lat), Number(patient.lng));
  }

  const { data, error } = await supabase
    .from("visits")
    .update({
      status: "checked_in",
      check_in_at: new Date().toISOString(),
      check_in_lat: lat ?? null,
      check_in_lng: lng ?? null,
      check_in_photo_url: photoUrl ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    visit: data,
    geofence: {
      distance_m: distanceM,
      within: distanceM == null ? null : distanceM <= (patient?.geofence_m ?? 200),
    },
  });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
