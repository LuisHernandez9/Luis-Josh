// src/data/fetchEvents.ts
export type RawEvent = any;

export type UnifiedEvent = {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  eventType?: string;
  org: { id: string; name: string; type?: string; website?: string };
  sourceUrl?: string;
  loc?: { name?: string; lat?: number; lng?: number };
};

// -------- UNC & NCSU (Localist API) --------
// Localist API docs: https://developer.localist.com/doc/api
// UNC & NCSU run Localist, so they expose /api/2/events with JSON.
const UNC_API = "https://calendar.unc.edu/api/2/events?days=30&pp=100";
const NCSU_API = "https://calendar.ncsu.edu/api/2/events?days=30&pp=100";

// -------- Duke Events JSON --------
// Duke’s URL builder provides JSON/ICS/etc.
// Ref: https://api-catalog.oit.duke.edu/apis/6  and URL builder.
const DUKE_API = "https://calendar.duke.edu/events/index.json?timeframe=next30days";

// Simple helper
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// Localist shape → unified
function fromLocalist(domain: "unc" | "ncsu", ev: any): UnifiedEvent {
  const e = ev.event ?? ev; // Localist wraps as {event:{...}}
  const start = e?.event_instances?.[0]?.event_instance?.start ?? e?.start_time ?? e?.start;
  const end = e?.event_instances?.[0]?.event_instance?.end ?? e?.end_time ?? e?.end;

  return {
    id: `${domain}:${e.id}`,
    title: e.title,
    description: e.description_text || e.description,
    start: new Date(start),
    end: end ? new Date(end) : undefined,
    eventType: e.event_types?.[0]?.name || e.type,
    org: {
      id: domain,
      name: domain === "unc" ? "UNC–Chapel Hill" : "NC State University",
      type: "university",
      website: domain === "unc" ? "https://www.unc.edu" : "https://www.ncsu.edu",
    },
    sourceUrl: e.localist_url || e.url,
    loc: { name: e.location_name || e.venue_name || e.venue?.name },
  };
}

// Duke JSON → unified
function fromDuke(ev: any): UnifiedEvent {
  // Duke JSON typically includes DTSTART/DTEND or ISO strings, plus title, link, location
  const start = ev?.start?.datetime || ev?.start || ev?.dtstart_iso || ev?.dtstart || ev?.date;
  const end = ev?.end?.datetime || ev?.end || ev?.dtend_iso || ev?.dtend;
  return {
    id: `duke:${ev?.id || ev?.uid || ev?.url}`,
    title: ev?.title || ev?.summary || "",
    description: ev?.description,
    start: new Date(start),
    end: end ? new Date(end) : undefined,
    eventType: ev?.type || ev?.categories?.[0],
    org: {
      id: "duke",
      name: "Duke University",
      type: "university",
      website: "https://www.duke.edu",
    },
    sourceUrl: ev?.url || ev?.link,
    loc: { name: ev?.location || ev?.place },
  };
}

export async function fetchUnifiedEvents(): Promise<UnifiedEvent[]> {
  const [unc, ncsu, duke] = await Promise.allSettled([
    getJSON<any>(UNC_API),
    getJSON<any>(NCSU_API),
    getJSON<any>(DUKE_API),
  ]);

  const list: UnifiedEvent[] = [];

  if (unc.status === "fulfilled") {
    // Localist returns { events: [ {event:{...}}, ... ] }
    const arr = unc.value?.events ?? unc.value;
    if (Array.isArray(arr)) list.push(...arr.map((e) => fromLocalist("unc", e)));
  }

  if (ncsu.status === "fulfilled") {
    const arr = ncsu.value?.events ?? ncsu.value;
    if (Array.isArray(arr)) list.push(...arr.map((e) => fromLocalist("ncsu", e)));
  }

  if (duke.status === "fulfilled") {
    // Duke returns { events: [...] } or an array depending on builder options
    const arr = duke.value?.events ?? duke.value;
    if (Array.isArray(arr)) list.push(...arr.map(fromDuke));
  }

  // Deduplicate by id + sort by start ascending
  const dedup = new Map<string, UnifiedEvent>();
  for (const e of list) {
    if (!Number.isFinite(e.start.getTime())) continue;
    dedup.set(e.id, e);
  }

  return [...dedup.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
