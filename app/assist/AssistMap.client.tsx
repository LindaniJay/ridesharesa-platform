"use client";

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
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

export default function AssistMap(props: {
  center: [number, number];
  marker: [number, number] | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const { center, marker, onPick } = props;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="h-[380px] w-full">
        <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToSetMarker onPick={onPick} />
          {marker ? <Marker position={marker} /> : null}
        </MapContainer>
      </div>
    </div>
  );
}
