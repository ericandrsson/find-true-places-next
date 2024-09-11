"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), { ssr: false });

export default function MapView() {
  const searchParams = useSearchParams();
  const [initialCenter, setInitialCenter] = useState({
    lat: 40.7128,
    lng: -74.006,
  });

  useEffect(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (lat && lng) {
      setInitialCenter({ lat: parseFloat(lat), lng: parseFloat(lng) });
    }
  }, [searchParams]);

  return (
    <div className="h-screen pt-16">
      <Map initialCenter={initialCenter} />
    </div>
  );
}
