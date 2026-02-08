"use client";

import dynamic from "next/dynamic";

const LocationPickerClient = dynamic(() => import("@/app/components/LocationPickerClient"), {
  ssr: false,
});

export default LocationPickerClient;
