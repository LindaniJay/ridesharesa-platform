"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon paths in bundlers
// (use CDN so it works out-of-the-box)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DefaultIcon = (L.Icon.Default as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (DefaultIcon.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function ClickToSetMarker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type AssistProvider = {
  id: string;
  name: string;
  type: "tow" | "mechanic" | "hospital" | "police" | "fuel";
  phone: string;
  position: [number, number];
};

function providerColor(type: AssistProvider["type"]) {
  if (type === "hospital") return "#0f9f5a";
  if (type === "police") return "#078a4d";
  if (type === "fuel") return "#12b86a";
  if (type === "mechanic") return "#0c7a45";
  return "#00a651";
}

function providerLabel(type: AssistProvider["type"]) {
  if (type === "hospital") return "Hospital";
  if (type === "police") return "Police";
  if (type === "fuel") return "Fuel";
  if (type === "mechanic") return "Mechanic";
  return "Tow";
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();

  // Keep the map view synced with GPS/location updates from the parent.
  map.setView(center, Math.max(map.getZoom(), 13), { animate: true });
  return null;
}

function providerIcon(type: AssistProvider["type"]) {
  const label = providerLabel(type).slice(0, 1).toUpperCase();
  const color = providerColor(type);
  return L.divIcon({
    className: "",
    html: `<div style="height:28px;width:28px;border-radius:9999px;background:${color};border:2px solid white;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,.25)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function AssistMap(props: {
  center: [number, number];
  marker: [number, number] | null;
  providers?: AssistProvider[];
  onPick: (lat: number, lng: number) => void;
}) {
  const { center, marker, providers = [], onPick } = props;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="h-[380px] w-full">
        <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
          <RecenterMap center={center} />
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <ClickToSetMarker onPick={onPick} />
          {marker ? <Marker position={marker} /> : null}
          {providers.map((provider) => (
            <Marker key={provider.id} position={provider.position} icon={providerIcon(provider.type)}>
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-xs text-foreground/70">{providerLabel(provider.type)}</div>
                  <a className="text-xs underline" href={`tel:${provider.phone.replace(/\s+/g, "")}`}>
                    Call {provider.phone}
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
