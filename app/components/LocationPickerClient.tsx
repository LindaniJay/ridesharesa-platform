"use client";

import { useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Marker icon fix
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

export default function LocationPickerClient({
  latitudeName,
  longitudeName,
  initialLat = -33.9249,
  initialLng = 18.4241,
}: {
  latitudeName: string;
  longitudeName: string;
  initialLat?: number;
  initialLng?: number;
}) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);

  const center = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);

  return (
    <div className="space-y-2">
      <input type="hidden" name={latitudeName} value={lat} />
      <input type="hidden" name={longitudeName} value={lng} />

      <div className="h-[320px] w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToSetMarker onPick={(a, b) => {
            setLat(a);
            setLng(b);
          }} />
          <Marker position={[lat, lng]} />
        </MapContainer>
      </div>

      <div className="text-xs text-black/60 dark:text-white/60">
        Click on the map to set the listing location. Current: {lat.toFixed(5)}, {lng.toFixed(5)}
      </div>
    </div>
  );
}
