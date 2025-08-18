import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "framer-motion";
import { X } from "lucide-react";

// Types
type EventItem = {
  id: string;
  name: string;
  date: string;
  org: string;
  orgType: "university" | "government" | "other";
  type: string;
  lat: number;
  lon: number;
};

type UnifiedEvent = EventItem;

// Mock data (replace later with real API)
const EVENT_TYPES = ["Lecture", "Workshop", "Seminar", "Festival"];

// Responsive hook
function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsSmall(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isSmall;
}

// Select component
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// HeatMap
function HeatMap({ events }: { events: EventItem[] }) {
  const grouped = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.date] = (acc[e.date] || 0) + 1;
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort();
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 p-2">
        {dates.map((d) => (
          <button
            key={d}
            className="block rounded-md w-8 h-8 md:w-9 md:h-9 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title={`${d}: ${grouped[d]} events`}
          >
            {grouped[d]}
          </button>
        ))}
      </div>
    </div>
  );
}

// BubblePanel
function BubblePanel({ events }: { events: EventItem[] }) {
  const isSmall = useIsSmallScreen();
  const CELL = isSmall ? 88 : 110;

  return (
    <div
      className="grid gap-4 p-4 justify-center"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${CELL}px, 1fr))` }}
    >
      {events.map((e) => (
        <motion.div
          key={e.id}
          layout
          className="rounded-full shadow-md border border-slate-200 bg-white flex flex-col items-center justify-center p-3"
        >
          <div className="text-xs text-slate-600">{e.type}</div>
          <div className="font-semibold text-sm text-center">{e.name}</div>
          <div className="text-xs text-slate-500">{e.date}</div>
        </motion.div>
      ))}
    </div>
  );
}

// MapOverlay
function MapOverlay({
  events,
  onClose,
}: {
  events: EventItem[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="relative z-10 m-auto w-[96vw] max-w-6xl h-[90vh] md:h-[80vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <button
          aria-label="Close map"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 bg-white rounded-full p-1 shadow-md hover:bg-slate-100"
        >
          <X className="w-5 h-5 text-slate-700" />
        </button>
        <MapContainer
          center={[35.7796, -78.6382]}
          zoom={7}
          className="flex-1 w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {events.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lon]}>
              <Popup>
                <div className="font-semibold">{e.name}</div>
                <div>{e.date}</div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

// Main app
export default function EventPulseNC() {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [filters, setFilters] = useState({
    q: "",
    orgType: "all",
    type: "all",
  });
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    // Replace this mock fetch with real API fetch later
    const mock: UnifiedEvent[] = [
      {
        id: "1",
        name: "Climate Talk",
        date: "2025-08-20",
        org: "UNC",
        orgType: "university",
        type: "Lecture",
        lat: 35.9,
        lon: -79.05,
      },
      {
        id: "2",
        name: "Policy Forum",
        date: "2025-08-22",
        org: "NC Gov",
        orgType: "government",
        type: "Seminar",
        lat: 35.78,
        lon: -78.64,
      },
    ];
    setEvents(mock);
  }, []);

  const filtered = events.filter((e) => {
    return (
      (filters.q === "" ||
        e.name.toLowerCase().includes(filters.q.toLowerCase())) &&
      (filters.orgType === "all" || e.orgType === filters.orgType) &&
      (filters.type === "all" || e.type === filters.type)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="p-4 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-800">Event Pulse NC</h1>
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
              { label: "Other", value: "other" },
            ]}
            onChange={(v) => setFilters({ ...filters, orgType: v as any })}
          />
          <Select
            label="Type"
            value={filters.type}
            options={[
              { label: "All types", value: "all" },
              ...EVENT_TYPES.map((t) => ({ label: t, value: t })),
            ]}
            onChange={(v) => setFilters({ ...filters, type: v as any })}
          />
          <button
            onClick={() => setShowMap(true)}
            className="rounded-xl bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            Map
          </button>
        </div>
      </header>

      <HeatMap events={filtered} />
      <BubblePanel events={filtered} />

      {showMap && <MapOverlay events={filtered} onClose={() => setShowMap(false)} />}
    </div>
  );
}
