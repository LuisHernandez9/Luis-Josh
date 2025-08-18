// src/data/fetchEvents.ts

export type OrgType = "university" | "government" | "other";
export type EventType = "Academic" | "Government" | "Conference" | "Workshop" | "Holiday" | "Other";

export type EventItem = {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  org: { id: string; name: string; type: OrgType; website?: string };
  eventType?: EventType | string;
  sourceUrl?: string;
  loc: { name?: string; lat?: number; lng?: number };
  registration?: string;
};

// --- Sources ---
// UNC & NCSU = Localist JSON API
const UNC_API  = "https://calendar.unc.edu/api/2/events?days=30&pp=100";
const NCSU_API = "https://calendar.ncsu.edu/api/2/events?days=30&pp=100";

// Duke = Events JSON (30-day window)
const DUKE_API = "https://calendar.duke.edu/events/index.json?timeframe=next30days";

// Generic fetch helper
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// --- Mappers ---
function mapLocalist(domain: "unc" | "ncsu", raw: any): EventItem {
  const e = raw?.event ?? raw;
  const inst = e?.event_instances?.[0]?.event_instance ?? {};
  const start = inst.start ?? e.start ?? e.start_time;
  const end   = inst.end   ?? e.end   ?? e.end_time;

  const orgName = domain === "unc" ? "UNC–Chapel Hill" : "NC State University";
  const orgSite = domain === "unc" ? "https://www.unc.edu" : "https://www.ncsu.edu";

  return {
    id: `${domain}:${e.id}`,
    title: e.title ?? "Untitled",
    description: e.description_text || e.description || "",
    start: new Date(start),
    end: end ? new Date(end) : undefined,
    org: { id: domain, name: orgName, type: "university", website: orgSite },
    eventType: e?.event_types?.[0]?.name || e?.type || "Other",
    sourceUrl: e.localist_url || e.url,
    loc: { name: e.location_name || e.venue_name || e?.venue?.name },
  };
}

function mapDuke(raw: any): EventItem {
  const start = raw?.start?.datetime || raw?.start || raw?.dtstart_iso || raw?.dtstart || raw?.date;
  const end   = raw?.end?.datetime   || raw?.end   || raw?.dtend_iso   || raw?.dtend;

  return {
    id: `duke:${raw?.id || raw?.uid || raw?.url || Math.random().toString(36).slice(2)}`,
    title: raw?.title || raw?.summary || "Untitled",
    description: raw?.description || "",
    start: new Date(start),
    end: end ? new Date(end) : undefined,
    org: { id: "duke", name: "Duke University", type: "university", website: "https://www.duke.edu" },
    eventType: raw?.type || (Array.isArray(raw?.categories) ? raw.categories[0] : "Other"),
    sourceUrl: raw?.url || raw?.link,
    loc: { name: raw?.location || raw?.place },
  };
}

// --- Orchestrator ---
export async function fetchUnifiedEvents(): Promise<EventItem[]> {
  const [unc, ncsu, duke] = await Promise.allSettled([
    getJSON<any>(UNC_API),
    getJSON<any>(NCSU_API),
    getJSON<any>(DUKE_API),
  ]);

  const out: EventItem[] = [];

  if (unc.status === "fulfilled") {
    const arr = unc.value?.events ?? unc.value;
    if (Array.isArray(arr)) out.push(...arr.map((e) => mapLocalist("unc", e)));
  }
  if (ncsu.status === "fulfilled") {
    const arr = ncsu.value?.events ?? ncsu.value;
    if (Array.isArray(arr)) out.push(...arr.map((e) => mapLocalist("ncsu", e)));
  }
  if (duke.status === "fulfilled") {
    const arr = duke.value?.events ?? duke.value;
    if (Array.isArray(arr)) out.push(...arr.map(mapDuke));
  }

  // Dedup + sort
  const dedup = new Map<string, EventItem>();
  for (const e of out) {
    if (!e.start || isNaN(e.start.getTime())) continue;
    dedup.set(e.id, e);
  }
  return [...dedup.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
