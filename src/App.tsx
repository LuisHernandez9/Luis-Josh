import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { fetchUnifiedEvents, type EventItem } from "./data/fetchEvents";
import { motion } from "framer-motion";
import { X } from "lucide-react";

// Simple constants
type ViewMode = "events" | "holidays";
type OrgType = "university" | "government" | "other";
const EVENT_TYPES: string[] = ["Academic", "Government", "Conference", "Workshop", "Holiday", "Other"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Responsive helpers
function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsSmall(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isSmall;
}

// Utils
function heatColor(level: number, max: number) {
  if (max <= 0) return "#f3f4f6";
  const t = Math.max(0, Math.min(1, level / max));
  const hue = 265 - t * 70;
  const sat = 60 + t * 30;
  const light = 94 - t * 58;
  return `hsl(${hue} ${sat}% ${light}%)`;
}
function fmtDateTime(d: Date) {
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// App
export default function EventPulseNC() {
  const [view, setView] = useState<ViewMode>("events");
  const [filters, setFilters] = useState<{ q: string; orgType: OrgType | "all"; type: string | "all" }>({
    q: "",
    orgType: "all",
    type: "all"
  });

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load live events
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchUnifiedEvents();
        setEvents(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load events");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // QoL: ESC clears the active category filter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFilters((prev) => (prev.type !== "all" ? { ...prev, type: "all" } : prev));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const isHoliday = (e.eventType || "").toLowerCase().includes("holiday");
      if (view === "events" && isHoliday) return false;
      if (view === "holidays" && !isHoliday) return false;

      if (filters.orgType !== "all" && e.org?.type !== filters.orgType) return false;
      if (filters.type !== "all" && (e.eventType || "") !== filters.type) return false;

      if (filters.q) {
        const q = filters.q.toLowerCase();
        const hay = `${e.title} ${e.description ?? ""} ${e.org?.name ?? ""} ${e.loc?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
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
    const map = new Map<string, number>();
    filtered.forEach((e) => map.set(e.eventType || "Other", (map.get(e.eventType || "Other") || 0) + 1));
    const arr = EVENT_TYPES.map((t) => ({ type: t, count: map.get(t) || 0 }));
    return arr.filter((b) => (view === "events" ? (b.type !== "Holiday" && b.count > 0) : b.type === "Holiday"));
  }, [filtered, view]);

  // Map overlay state
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

  // Clicking a bubble toggles the filter (on -> off)
  const handleBubbleClick = (t: string) => {
    setFilters((prev) => ({ ...prev, type: prev.type === t ? "all" : (t as any) }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <Logo />
          <Segmented
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            options={[{ label: "Events", value: "events" }, { label: "Holidays", value: "holidays" }]}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              aria-label="Search events"
              placeholder="Search…"
              className="w-40 sm:w-56 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                { label: "Other", value: "other" }
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

      {/* Main */}
      <main className="mx-auto max-w-7xl w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-12 gap-6">
        {/* Left column */}
        <section className="col-span-12 lg:col-span-4">
          <Panel title="Categories">
            <p className="text-sm text-slate-600 mb-3">
              Click a bubble to filter. <span className="font-medium">Click again to clear</span>. Size shows frequency.
            </p>

            <BubblePanel
              bubbles={bubbleData}
              onBubbleClick={handleBubbleClick}
              activeType={filters.type}
              mode={view}
            />

            <div className="text-xs text-slate-500 mt-4">
              Tip: Right-click any heat cell to open the statewide map for that time. Press <kbd>Esc</kbd> to clear the category.
            </div>

            {loading && <div className="text-sm text-slate-500 mt-2">Loading live events…</div>}
            {error && <div className="text-sm text-rose-600 mt-2">Error: {error}</div>}
          </Panel>

          <Panel title="Upcoming Highlights">
            <ul className="divide-y divide-slate-200">
              {filtered
                .filter((e) =>
                  view === "events"
                    ? !(e.eventType || "").toLowerCase().includes("holiday")
                    : (e.eventType || "").toLowerCase().includes("holiday")
                )
                .slice(0, 6)
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .map((e) => (
                  <li key={e.id} className="py-3">
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-xs text-slate-600">{fmtDateTime(e.start)} · {e.loc?.name ?? e.org?.name}</div>
                  </li>
                ))}
            </ul>
          </Panel>
        </section>

        {/* Right column */}
        <section className="col-span-12 lg:col-span-8">
          <Panel title={view === "events" ? "Heat Map — Events by Time" : "Heat Map — Holidays & Breaks"}>
            <HeatMap grid={heat.grid as number[][]} max={heat.max as number} onCellRightClick={onCellContextMenu} />
            <div className="mt-3 text-xs text-slate-600 flex items-center justify-between">
              <span>Hover to see counts. Right-click a cell for map.</span>
              <small>{filtered.length} item(s) after filters</small>
            </div>
          </Panel>
        </section>
      </main>

      {/* Map Overlay */}
      {mapOpen && <MapOverlay title={`NC Map — ${mapTitle}`} events={mapEvents} onClose={() => setMapOpen(false)} />}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-600">
        EventPulse NC · Live public events · UNC / NCSU / Duke
      </footer>
    </div>
  );
}

// UI bits
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
  bubbles, onBubbleClick, activeType, mode
}: {
  bubbles: { type: string; count: number }[];
  onBubbleClick: (t: string) => void;
  activeType: string | "all";
  mode: ViewMode;
}) {
  if (!bubbles.length) return <div className="text-sm text-slate-500">No categories to display.</div>;
  const max = Math.max(...bubbles.map((b) => b.count));
  const isSmall = useIsSmallScreen();
  const CELL = isSmall ? 88 : 110;

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${Math.min(CELL, 100)}px, 1fr))` }}>
      {bubbles.map((b) => {
        const t = max > 0 ? b.count / max : 0;
        const scale = 0.6 + t * (1.0 - 0.6);
        const active = activeType === b.type;
        const isHoliday = b.type === "Holiday";
        const baseColor = isHoliday ? "bg-emerald-50 border-emerald-200" : "bg-indigo-50 border-indigo-200";
        const textColor = isHoliday ? "text-emerald-700" : "text-indigo-700";

        return (
          <div key={b.type} className="flex items-center justify-center">
            <motion.button
              onClick={() => onBubbleClick(b.type)}
              aria-pressed={active}
              aria-label={`${b.type} (${b.count})`}
              className={[
                "aspect-square rounded-full border",
                baseColor,
                "flex flex-col items-center justify-center",
                "hover:shadow transition-transform duration-200 ease-out",
                active ? "ring-2 ring-offset-2 ring-indigo-500" : ""
              ].join(" ")}
              style={{ width: CELL, height: CELL, transform: `scale(${scale})` }}
              whileHover={{ scale: scale * 1.04 }}
              whileTap={{ scale: scale * 0.96 }}
            >
              <span className={`text-xs font-medium ${textColor}`}>{b.type}</span>
              <span className={`text-[10px] ${textColor}`}>{b.count}</span>
            </motion.button>
          </div>
        );
      })}
    </div>
  );
}

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
                    className="block rounded-md w-8 h-8 md:w-9 md:h-9 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative z-10 m-auto w-[96vw] max-w-6xl h-[90vh] md:h-[80vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <div className="grid grid-cols-12 gap-0 flex-1">
          <div className="col-span-12 md:col-span-8 h-full">
            <MapContainer center={[35.5, -79.0]} zoom={7} className="h-full w-full">
              <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {events.map((e) => (
                <Marker key={e.id} position={[e.loc?.lat ?? 35.5, e.loc?.lng ?? -79.0]}>
                  <Popup>
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-xs text-slate-600">{fmtDateTime(e.start)} · {e.loc?.name ?? e.org?.name ?? ""}</div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
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
          <div className="text-xs text-slate-600">{fmtDateTime(e.start)} · {e.loc?.name ?? e.org?.name}</div>
          <div className="text-xs text-slate-600">{e.org?.name} {e.eventType ? `• ${e.eventType}` : ""}</div>
          {e.sourceUrl && (<a className="text-xs text-indigo-600 hover:underline" href={e.sourceUrl} target="_blank" rel="noreferrer">Details</a>)}
        </li>
      ))}
    </ul>
  );
}
