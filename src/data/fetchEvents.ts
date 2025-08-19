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

// ---------------- Sources ----------------
// UNC & NCSU (Localist)
const UNC_API  = "https://calendar.unc.edu/api/2/events?days=30&pp=100";
const NCSU_API = "https://calendar.ncsu.edu/api/2/events?days=30&pp=100";

// Duke Events JSON
const DUKE_API = "https://calendar.duke.edu/events/index.json?timeframe=next30days";

// ---------------- Helpers ----------------
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// Return a lowercase array of strings (dropping empties)
function lcArray(input: any): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  return arr
    .flatMap((x) => {
      if (!x) return [];
      if (typeof x === "string") return [x];
      if (typeof x?.name === "string") return [x.name];
      if (typeof x?.title === "string") return [x.title];
      return [];
    })
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Buckets we support
const BUCKETS = ["academic", "government", "conference", "workshop", "holiday"] as const;

// Heuristic: fold various labels/titles/descriptions into our fixed buckets
function normalizeType(labels: string[], title?: string, desc?: string): EventType {
  const text = `${title ?? ""} ${desc ?? ""}`.toLowerCase();

  // Include text keywords in the matching set
  const bag = new Set<string>([
    ...labels.map((s) => s.toLowerCase()),
    ...text.split(/[\s,.:;()]+/).filter(Boolean)
  ]);

  // Grouped keyword tests (order matters; first match wins)
  const isHoliday =
    /holiday|break|recess|no[-\s]?classes|commencement|spring\s*break|fall\s*break|winter\s*break|university\s*closed/.test(
      text
    ) ||
    labels.some((l) => /holiday|break|commencement/.test(l));

  const isWorkshop =
    /workshop|bootcamp|training|hands[-\s]?on|lab/.test(text) ||
    labels.some((l) => /workshop|training|bootcamp/.test(l));

  const isConference =
    /conference|symposium|summit|expo|forum(?!\s*theatre)|colloquium|congress|annual\s*meeting/.test(text) ||
    labels.some((l) => /conference|symposium|summit|colloquium|expo/.test(l));

  const isAcademic =
    /lecture|seminar|talk|panel|colloquium|thesis|dissertation|defen[sc]e|colloq|reading|poster/.test(text) ||
    labels.some((l) => /lecture|seminar|talk|colloquium|panel|thesis|dissertation|defen[sc]e/.test(l)) ||
    // Localist often has "Lectures & Discussions", "Academic Calendar"
    labels.some((l) => /lectures? & discussions?|academic\s*calendar/.test(l));

  const isGovernment =
    /public\s*(hearing|meeting)|city\s*council|board\s*meeting|commission|policy|legislature|general\s*assembly|government/.test(
      text
    ) || labels.some((l) => /government|public meeting|hearing|council|commission|board/.test(l));

  if (isHoliday) return "Holiday";
  if (isWorkshop) return "Workshop";
  if (isConference) return "Conference";
  if (isAcademic) return "Academic";
  if (isGovernment) return "Government";
  return "Other";
}

// ---------------- Mappers ----------------

// Localist → EventItem
function mapLocalist(domain: "unc" | "ncsu", raw: any): EventItem {
  const e = raw?.event ?? raw;

  // Times
  const inst = e?.event_instances?.[0]?.event_instance ?? {};
  const start = inst.start ?? e.start ?? e.start_time;
  const end   = inst.end   ?? e.end   ?? e.end_time;

  // Labels to consider (Localist has several arrays)
  const labels = [
    ...lcArray(e.event_types),
    ...lcArray(e.filters),
    ...lcArray(e.keywords),
    ...lcArray(e.tags),
    ...lcArray(e.categories),
    ...lcArray(e.department),
    ...lcArray(e.departments)
  ];

  const orgName = domain === "unc" ? "UNC–Chapel Hill" : "NC State University";
  const orgSite = domain === "unc" ? "https://www.unc.edu" : "https://www.ncsu.edu";

  return {
    id: `${domain}:${e.id}`,
    title: e.title ?? "Untitled",
    description: e.description_text || e.description || "",
    start: new Date(start),
    end: end ? new Date(end) : undefined,
    org: { id: domain, name: orgName, type: "university", website: orgSite },
    eventType: normalizeType(labels, e.title, e.description_text || e.description),
    sourceUrl: e.localist_url || e.url,
    loc: { name: e.location_name || e.venue_name || e?.venue?.name }
  };
}

// Duke → EventItem
function mapDuke(raw: any): EventItem {
  const start =
    raw?.start?.datetime || raw?.start || raw?.dtstart_iso || raw?.dtstart || raw?.date;
  const end = raw?.end?.datetime || raw?.end || raw?.dtend_iso || raw?.dtend;

  // Duke categories can be strings or objects; also has "type"
  const labels = [
    ...lcArray(raw.categories),
    ...lcArray(raw.type),
    ...lcArray(raw.event_type),
    ...lcArray(raw.group_name),
    ...lcArray(raw.department)
  ];

  return {
    id: `duke:${raw?.id || raw?.uid || raw?.url || Math.random().toString(36).slice(2)}`,
    title: raw?.title || raw?.summary || "Untitled",
    description: raw?.description || "",
    start: new Date(start),
    end: end ? new Date(end) : undefined,
    org: { id: "duke", name: "Duke University", type: "university", website: "https://www.duke.edu" },
    eventType: normalizeType(labels, raw?.title, raw?.description),
    sourceUrl: raw?.url || raw?.link,
    loc: { name: raw?.location || raw?.place }
  };
}

// ---------------- Orchestrator ----------------
export async function fetchUnifiedEvents(): Promise<EventItem[]> {
  const [unc, ncsu, duke] = await Promise.allSettled([
    getJSON<any>(UNC_API),
    getJSON<any>(NCSU_API),
    getJSON<any>(DUKE_API)
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

  // Dedup + sort by start
  const dedup = new Map<string, EventItem>();
  for (const e of out) {
    if (!e.start || isNaN(e.start.getTime())) continue;
    dedup.set(e.id, e);
  }
  return [...dedup.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
