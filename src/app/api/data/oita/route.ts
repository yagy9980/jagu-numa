import { NextRequest, NextResponse } from "next/server";

type MachineRow = {
  play_date: string;
  city?: string | null;
  shop_name: string;
  machine_name: string;
  machine_number: string;
  category?: "slot" | "pachinko" | "unknown";
  total_spins?: number | null;
  start_count?: number | null;
  jackpot_count?: number | null;
  first_hit_count?: number | null;
  bb?: number | null;
  rb?: number | null;
  art_at?: number | null;
  combined_probability?: number | null;
  net_coins?: number | null;
  net_balls?: number | null;
  payout_rate?: number | null;
  final_spins?: number | null;
  slump_summary?: string | null;
  source_name: string;
  source_url?: string | null;
  raw_data?: Record<string, unknown>;
};

const required = ["play_date", "shop_name", "machine_name", "machine_number", "source_name"] as const;

export async function POST(request: NextRequest) {
  const secret = process.env.DATA_INGEST_SECRET;
  const supplied = request.headers.get("x-ingest-secret");
  if (!secret || supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase server settings are missing" }, { status: 500 });
  }

  let body: { rows?: MachineRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000) {
    return NextResponse.json({ error: "rows must contain 1-1000 records" }, { status: 400 });
  }

  for (const row of rows) {
    if (required.some((key) => !row[key])) {
      return NextResponse.json({ error: "Required field is missing" }, { status: 400 });
    }
  }

  const normalized = rows.map((row) => ({
    ...row,
    prefecture: "大分県",
    category: row.category ?? "unknown",
    raw_data: row.raw_data ?? {},
  }));

  const response = await fetch(
    `${url}/rest/v1/oita_machine_daily?on_conflict=play_date,shop_name,machine_name,machine_number,source_name`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(normalized),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Supabase write failed", detail }, { status: 502 });
  }

  return NextResponse.json({ ok: true, count: normalized.length });
}
