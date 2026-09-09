"use client";

import { Fragment, useMemo } from "react";
import { Circle, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { getGoogleMapsApiKey } from "@/lib/google-maps";
import type { DeliveryZoneDto } from "@/lib/api/types";

const LIBRARIES: ("places")[] = ["places"];
const DEFAULT_CENTER = { lat: 11.2588, lng: 75.7804 };
const CONTAINER = { width: "100%", height: "100%" };

export function DeliveryZonesOverviewMap({ zones }: { zones: DeliveryZoneDto[] }) {
  const apiKey = getGoogleMapsApiKey();
  const { isLoaded, loadError } = useJsApiLoader({
    id: "neer-admin-google-maps",
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const center = useMemo(() => {
    const active = zones.filter((z) => z.isActive !== false);
    const src = active.length ? active : zones;
    if (!src.length) return DEFAULT_CENTER;
    const lat = src.reduce((s, z) => s + Number(z.centerLat), 0) / src.length;
    const lng = src.reduce((s, z) => s + Number(z.centerLng), 0) / src.length;
    return { lat, lng };
  }, [zones]);

  if (!apiKey) return null;
  if (loadError) return null;
  if (!isLoaded) {
    return <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-extrabold">Shops and delivery zones</p>
        <p className="text-muted-foreground text-xs font-semibold">
          Pins are shop centers. Circles are areas that can receive orders.
        </p>
      </div>
      <div className="h-72 sm:h-80">
        <GoogleMap
          mapContainerStyle={CONTAINER}
          center={center}
          zoom={zones.length ? 11 : 12}
          options={{
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false,
          }}
        >
          {zones.map((z) => {
            const pos = { lat: Number(z.centerLat), lng: Number(z.centerLng) };
            const on = z.isActive !== false;
            return (
              <Fragment key={z.id}>
                <Marker position={pos} title={`${z.name} (shop)`} />
                <Circle
                  center={pos}
                  radius={Math.max(100, Number(z.radiusKm) * 1000)}
                  options={{
                    fillColor: on ? "#0284c7" : "#94a3b8",
                    fillOpacity: on ? 0.16 : 0.06,
                    strokeColor: on ? "#0369a1" : "#64748b",
                    strokeWeight: on ? 2 : 1,
                    clickable: false,
                  }}
                />
              </Fragment>
            );
          })}
        </GoogleMap>
      </div>
    </div>
  );
}
