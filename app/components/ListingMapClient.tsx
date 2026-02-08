"use client";

import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

export type MapListing = {
  id: string;
  title: string;
  city: string;
  latitude: number;
  longitude: number;
  dailyRateCents: number;
  currency: string;
};

export default function ListingMapClient({ listings }: { listings: MapListing[] }) {
  const center: [number, number] = listings.length
    ? [listings[0].latitude, listings[0].longitude]
    : [-33.9249, 18.4241];

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
      <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {listings.map((l) => (
          <Marker key={l.id} position={[l.latitude, l.longitude]}>
            <Popup>
              <div className="space-y-1">
                <div className="font-medium">{l.title}</div>
                <div className="text-sm">{l.city}</div>
                <div className="text-sm">
                  {(l.dailyRateCents / 100).toFixed(0)} {l.currency} / day
                </div>
                <Link className="text-sm underline" href={`/listings/${l.id}`}>
                  View
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
