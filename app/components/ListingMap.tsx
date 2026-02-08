"use client";

import dynamic from "next/dynamic";

const ListingMapClient = dynamic(() => import("@/app/components/ListingMapClient"), {
  ssr: false,
});

export default ListingMapClient;
