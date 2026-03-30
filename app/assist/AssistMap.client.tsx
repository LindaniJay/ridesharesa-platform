"use client";

import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
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
  type: "tow" | "mechanic" | "ambulance" | "police" | "fuel";
  phone: string;
  position: [number, number];
};

function providerColor(type: AssistProvider["type"]) {
  if (type === "ambulance") return "#dc2626";
  if (type === "police") return "#1d4ed8";
  if (type === "fuel") return "#f59e0b";
  if (type === "mechanic") return "#7c3aed";
  return "#0ea5e9";
}

function providerLabel(type: AssistProvider["type"]) {
  if (type === "ambulance") return "Ambulance";
  if (type === "police") return "Police";
  if (type === "fuel") return "Fuel";
  if (type === "mechanic") return "Mechanic";
  return "Tow";
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
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <ClickToSetMarker onPick={onPick} />
          {marker ? <Marker position={marker} /> : null}
          {providers.map((provider) => (
            <CircleMarker
              key={provider.id}
              center={provider.position}
              radius={8}
              pathOptions={{
                color: providerColor(provider.type),
                fillColor: providerColor(provider.type),
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-xs text-foreground/70">{providerLabel(provider.type)}</div>
                  <a className="text-xs underline" href={`tel:${provider.phone.replace(/\s+/g, "")}`}>
                    Call {provider.phone}
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
