import React, { useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "events" | "holidays";
type OrgType = "university" | "government" | "other";

type Organization = {
  id: string;
  name: string;
  type: OrgType;
  website?: string;
  contact?: string;
  tz?: string;
};

type EventType = "Academic" | "Government" | "Conference" | "Workshop" | "Holiday" | "Other";

type EventItem = {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  org: Organization;
  eventType: EventType;
  sourceUrl?: string;
  loc: { name: string; lat: number; lng: number };
  registration?: string;
};

type Filters = {
  q: string;
  orgType: OrgType | "all";
  type: EventType | "all";
  from?: Date | null;
  to?: Date | null;
};

const NC_PLACES = [
  { name: "Raleigh", lat: 35.7796, lng: -78.6382 },
  { name: "Chapel Hill", lat: 35.9132, lng: -79.0558 },
  { name: "Durham", lat: 35.9940, lng: -78.8986 },
  { name: "Charlotte", lat: 35.2271, lng: -80.8431 },
  { name: "Asheville", lat: 35.5951, lng: -82.5515 },
  { name: "Wilmington", lat: 34.2257, lng: -77.9447 },
  { name: "Greensboro", lat: 36.0726, lng: -79.7920 },
];

const ORGS: Organization[] = [
  { id: "unc", name: "UNC Chapel Hill", type: "university", website: "https://www.unc.edu" },
  { id: "ncsu", name: "NC State University", type: "university", website: "https://www.ncsu.edu" },
  { id: "duke", name: "Duke University", type: "university", website: "https://www.duke.edu" },
  { id: "nc-doh", name: "NC Dept. of Health & Human Services", type: "government" },
  { id: "nc-dot", name: "NC Dept. of Transportation", type: "government" },
  { id: "nc-comm", name: "NC Dept. of Commerce", type: "government" },
];

const EVENT_TYPES: EventType[] = [
  "Academic",
  "Government",
  "Conference",
  "Workshop",
  "Holiday",
  "Other",
];

function randBetween(a: number, b: number) { return Math.random() * (b - a) + a; }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function atHour(d: Date, hour: number) { const c = new Date(d); c.setHours(hour, 0, 0, 0); return c; }

function generateMockEvents(count = 160): EventItem[] {
  const out: EventItem[] = [];
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(randBetween(0, 42));
    const baseDay = daysFromNow(dayOffset);
    const startHour = Math.floor(randBetween(8, 20));
    const durationH = Math.ceil(randBetween(1, 4));
    const org = ORGS[Math.floor(randBetween(0, ORGS.length))];
    const place = NC_PLACES[Math.floor(randBetween(0, NC_PLACES.length))];
    const type = EVENT_TYPES[Math.floor(randBetween(0, EVENT_TYPES.length - 1))];

    const start = atHour(baseDay, startHour);
    const end = atHour(baseDay, Math.min(23, startHour + durationH));

    out.push({
      id: `evt_${i}`,
      title: `${type} @ ${org.name}`,
      description: `${type} session hosted by ${org.name} in ${place.name}.` ,
      start,
      end,
      org,
      eventType: type,
      sourceUrl: org.website,
      loc: { ...place },
      registration: Math.random() > 0.6 ? "https://example.com/register" : undefined,
    });
  }

  const spring: EventItem = {
    id: "holiday_spring",
    title: "Spring Break (UNC System)",
    description: "Academic break across several NC universities.",
    start: atHour(daysFromNow(12), 0),
    end: atHour(daysFromNow(17), 23),
    org: ORGS[0],
    eventType: "Holiday",
    sourceUrl: "https://www.northcarolina.edu/",
    loc: { ...NC_PLACES[1] },
  };

  const stateHoliday: EventItem = {
    id: "holiday_state",
    title: "NC State Holiday",
    description: "Observed state holiday.",
    start: atHour(daysFromNow(25), 0),
    end: atHour(daysFromNow(25), 23),
    org: ORGS[3],
    eventType: "Holiday",
    sourceUrl: "https://www.nc.gov/",
    loc: { ...NC_PLACES[0] },
  };

  return out.concat([spring, stateHoliday]);
}

function heatColor(level: number, max: number) {
  if (max <= 0) return "#f3f4f6";
  const t = Math.max(0, Math.min(1, level / max));
  const hue = 265 - t * 70;
  const sat = 60 + t * 30;
  const light = 94 - t * 58;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export default function EventPulseNC() {
  const [view, setView] = useState<ViewMode>("events");
  const [filters, setFilters] = useState<Filters>({ q: "", orgType: "all", type: "all", from: null, to: null });
  const [events] = useState<EventItem[]>(() => generateMockEvents());

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (view === "events" && e.eventType === "Holiday") return false;
      if (view === "holidays" && e.eventType !== "Holiday") return false;
      if (filters.orgType !== "all" && e.org.type !== filters.orgType) return false;
      if (filters.type !== "all" && e.eventType !== filters.type) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const hit = `${e.title} ${e.description ?? ""} ${e.org.name} ${e.loc.name}`.toLowerCase().includes(q);
        if (!hit) return false;
      }
      const inFrom = !filters.from || e.end >= filters.from;
      const inTo = !filters.to || e.start <= filters.to;
      return inFrom && inTo;
    });
  }, [events, filters, view]);

  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    filtered.forEach((e) => {
      const h = e.start.getHours();
      const d = e.start.getDay();
      (grid[d] as number[])[h] += 1;
    });
    const max = (grid as number[][]).flat().reduce((m, v) => Math.max(m, v), 0);
    return { grid, max };
  }, [filtered]);

  const bubbleData = useMemo(() => {
    const map = new Map<EventType, number>();
    filtered.forEach((e) => map.set(e.eventType, (map.get(e.eventType) || 0) + 1));
    const arr = EVENT_TYPES.map((t) => ({ type: t, count: map.get(t) || 0 }));
    return arr.filter((b) => (view === "events" ? (b.type !== "Holiday" && b.count > 0) : b.type === "Holiday"));
  }, [filtered, view]);

  const [mapOpen, setMapOpen] = useState(false);
  const [mapTitle, setMapTitle] = useState<string>("");
  const [mapEvents, setMapEvents] = useState<EventItem[]>([]);

  function openMapForSlot(dayIdx: number, hour: number) {
    const slot = filtered.filter((e) => e.start.getDay() === dayIdx && e.start.getHours() === hour);
    setMapEvents(slot);
    setMapTitle(`${WEEKDAYS[dayIdx]} • ${hour.toString().padStart(2, "0")}:00`);
    setMapOpen(true);
  }

  const onCellContextMenu = (e: React.MouseEvent, dayIdx: number, hour: number) => {
    e.preventDefault();
    openMapForSlot(dayIdx, hour);
  };

  return (
    <div className={"min-h-screen bg-slate-50 text-slate-900 flex flex-col"}>
      <header className={"sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200"}>
        <div className={"mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3"}>
          <Logo />
          <Segmented
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            options={[{ label: "Events", value: "events" }, { label: "Holidays", value: "holidays" }]}
          />
          <div className="ml-auto flex items-center gap-2">
            <input
              aria-label="Search events"
              placeholder="Search…"
              className={"w-56 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"}
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <Select
              label="Org"
              value={filters.orgType}
              options={[
                { label: "All orgs", value: "all" },
                { label: "Universities", value: "university" },
                { label: "Government", value: "government" },
                { label: "Other", value: "other" },
              ]}
              onChange={(v) => setFilters({ ...filters, orgType: v as any })}
            />
            <Select
              label="Type"
              value={filters.type}
              options={[{ label: "All types", value: "all" }, ...EVENT_TYPES.map((t) => ({ label: t, value: t }))]}
              onChange={(v) => setFilters({ ...filters, type: v as any })}
            />
          </div>
        </div>
      </header>

      <main className={"mx-auto max-w-7xl w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-12 gap-6"}>
        <section className={"col-span-12 lg:col-span-4"}>
          <Panel title="Categories">
            <p className="text-sm text-slate-600 mb-3">Click a bubble to filter. Size shows frequency.</p>
            <BubblePanel
              bubbles={bubbleData}
              onBubbleClick={(t) => setFilters({ ...filters, type: t as any })}
              activeType={filters.type}
              mode={view}
            />
            <div className="text-xs text-slate-500 mt-4">Tips: Right‑click any heat cell to open the statewide map for that time.</div>
          </Panel>

          <Panel title="Upcoming Highlights">
            <ul className="divide-y divide-slate-200">
              {filtered
                .filter((e) => (view === "events" ? e.eventType !== "Holiday" : e.eventType === "Holiday"))
                .slice(0, 6)
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .map((e) => (
                  <li key={e.id} className="py-3">
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-xs text-slate-600">{fmtDateTime(e.start)} · {e.loc.name}</div>
                  </li>
                ))}
            </ul>
          </Panel>
        </section>

        <section className={"col-span-12 lg:col-span-8"}>
          <Panel title={view === "events" ? "Heat Map — Events by Time" : "Heat Map — Holidays & Breaks"}>
            <HeatMap grid={heat.grid as number[][]} max={heat.max as number} onCellRightClick={onCellContextMenu} />
            <div className="mt-3 text-xs text-slate-600 flex items-center justify-between">
              <span>Hover to see counts. Right‑click a cell for map.</span>
              <small>{filtered.length} item(s) after filters</small>
            </div>
          </Panel>
        </section>
      </main>

      {mapOpen && (<MapOverlay title={`NC Map — ${mapTitle}`} events={mapEvents} onClose={() => setMapOpen(false)} />)}

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-600">
        EventPulse NC · Prototype UI · Data shown is mock for demo only.
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">EP</div>
      <div className="font-semibold tracking-tight">EventPulse NC</div>
    </div>
  );
}

function Segmented({
  value, onChange, options
}: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <div role="tablist" aria-label="View toggle" className="flex rounded-xl border border-slate-300 p-1 text-sm bg-white shadow-sm">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-lg ${active ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({
  label, value, options, onChange
}: { label: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>
      <select
        className="rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function BubblePanel({
  bubbles,
  onBubbleClick,
  activeType,
  mode,
}: {
  bubbles: { type: EventType; count: number }[];
  onBubbleClick: (t: EventType) => void;
  activeType: string | "all";
  mode: ViewMode;
}) {
  if (!bubbles.length) return <div className="text-sm text-slate-500">No categories to display.</div>;

  const max = Math.max(...bubbles.map((b) => b.count));
  const CELL = 110;          // base cell size
  const MIN_SCALE = 0.6;     // smallest bubble
  const MAX_SCALE = 1.0;     // largest bubble

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
      }}
    >
      {bubbles.map((b) => {
        const t = max > 0 ? b.count / max : 0;
        const scale = MIN_SCALE + t * (MAX_SCALE - MIN_SCALE);
        const active = activeType === b.type;
        const isHoliday = b.type === "Holiday";
        const baseColor = isHoliday ? "bg-emerald-50 border-emerald-200" : "bg-indigo-50 border-indigo-200";
        const textColor = isHoliday ? "text-emerald-700" : "text-indigo-700";

        return (
          <div key={b.type} className="flex items-center justify-center">
            <button
              onClick={() => onBubbleClick(b.type)}
              aria-pressed={active}
              aria-label={`${b.type} (${b.count})`}
              className={[
                "aspect-square rounded-full border",
                baseColor,
                "flex flex-col items-center justify-center",
                "hover:shadow transition-transform duration-200 ease-out",
                active ? "ring-2 ring-offset-2 ring-indigo-500" : "",
              ].join(" ")}
              style={{
                width: CELL,
                height: CELL,
                transform: `scale(${scale})`,
              }}
            >
              <span className={`text-xs font-medium ${textColor}`}>{b.type}</span>
              <span className={`text-[10px] ${textColor}`}>{b.count}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function HeatMap({
  grid, max, onCellRightClick
}: { grid: number[][]; max: number; onCellRightClick: (e: React.MouseEvent, dayIdx: number, hour: number) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-12 text-left text-xs text-slate-500">&nbsp;</th>
            {Array.from({ length: 24 }).map((_, h) => (
              <th key={h} className="text-[10px] text-slate-500 font-normal text-center px-1">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, dayIdx) => (
            <tr key={dayIdx}>
              <th className="text-left text-xs text-slate-600 pr-2 w-12">{WEEKDAYS[dayIdx]}</th>
              {row.map((v, hour) => (
                <td key={hour}>
                  <button
                    title={`${WEEKDAYS[dayIdx]} • ${hour}:00 — ${v} event(s)`}
                    onContextMenu={(e) => onCellRightClick(e, dayIdx, hour)}
                    className="block rounded-md w-6 h-6 sm:w-7 sm:h-7 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ background: heatColor(v, max) }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MapOverlay({ title, events, onClose }: { title: string; events: EventItem[]; onClose: () => void }) {
  const [leafletReady, setLeafletReady] = useState(false);
  const mapDivRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        // @ts-ignore
        const { Map, tileLayer, marker, icon } = L;
        setLeafletReady(true);
        if (mapDivRef.current) {
          const m = new Map(mapDivRef.current, { center: [35.5, -79.0], zoom: 7 });
          tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(m);
          const pin = icon({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", iconSize: [25, 41], iconAnchor: [12, 41] });

          events.forEach((e) => {
            const mk = marker([e.loc.lat, e.loc.lng], { icon: pin }).addTo(m);
            mk.bindPopup(`<b>${escapeHtml(e.title)}</b><br/>${escapeHtml(fmtDateTime(e.start))}<br/>${escapeHtml(e.loc.name)}`);
          });
          cleanup = () => m.remove();
        }
      } catch (err) {
        console.warn("Leaflet unavailable — showing list fallback", err);
        setLeafletReady(false);
      }
    })();
    return () => cleanup?.();
  }, [events]);

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative z-10 m-auto w-[95vw] max-w-6xl h-[80vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm bg-slate-100 hover:bg-slate-200">Close</button>
        </div>
        <div className="grid grid-cols-12 gap-0 flex-1">
          <div className="col-span-12 md:col-span-8 h-full">
            <div ref={mapDivRef} className="h-full w-full" aria-label="NC map" />
            {!leafletReady && (
              <div className="h-full w-full p-6 text-sm text-slate-600">
                <p className="mb-2">Map preview unavailable. Showing list instead.</p>
                <EventList events={events} />
              </div>
            )}
          </div>
          <div className="col-span-12 md:col-span-4 border-l border-slate-200 h-full overflow-auto">
            <div className="p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Events in slot</h4>
              <EventList events={events} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventList({ events }: { events: EventItem[] }) {
  if (!events.length) return <div className="text-sm text-slate-500">No events in this slot.</div>;
  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="rounded-xl border border-slate-200 p-3">
          <div className="text-sm font-medium">{e.title}</div>
          <div className="text-xs text-slate-600">{fmtDateTime(e.start)} · {e.loc.name}</div>
          <div className="text-xs text-slate-600">{e.org.name} • {e.eventType}</div>
          {e.sourceUrl && (<a className="text-xs text-indigo-600 hover:underline" href={e.sourceUrl} target="_blank" rel="noreferrer">Details</a>)}
        </li>
      ))}
    </ul>
  );
}

function fmtDateTime(d: Date) {
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }