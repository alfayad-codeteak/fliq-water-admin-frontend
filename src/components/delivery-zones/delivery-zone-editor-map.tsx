"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Autocomplete,
  Circle,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { Search } from "lucide-react";
import { getGoogleMapsApiKey } from "@/lib/google-maps";

const LIBRARIES: ("places")[] = ["places"];
const DEFAULT_CENTER = { lat: 11.2588, lng: 75.7804 };
const CONTAINER = { width: "100%", height: "100%" };

type Props = {
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number;
  onCenterChange: (lat: number, lng: number) => void;
};

export function DeliveryZoneEditorMap({
  centerLat,
  centerLng,
  radiusKm,
  onCenterChange,
}: Props) {
  const apiKey = getGoogleMapsApiKey();
  const { isLoaded, loadError } = useJsApiLoader({
    id: "neer-admin-google-maps",
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const center = useMemo(() => {
    if (
      centerLat != null &&
      centerLng != null &&
      Number.isFinite(centerLat) &&
      Number.isFinite(centerLng)
    ) {
      return { lat: centerLat, lng: centerLng };
    }
    return DEFAULT_CENTER;
  }, [centerLat, centerLng]);

  const radiusM = Math.max(100, (Number.isFinite(radiusKm) ? radiusKm : 5) * 1000);

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onCenterChange(e.latLng.lat(), e.latLng.lng());
    },
    [onCenterChange],
  );

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    const loc = place?.geometry?.location;
    if (!loc) return;
    const lat = loc.lat();
    const lng = loc.lng();
    onCenterChange(lat, lng);
    mapRef.current?.panTo({ lat, lng });
  }, [onCenterChange]);

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-xs font-semibold text-amber-900">
        Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to admin{" "}
        <code>.env.local</code>, enable Maps JavaScript API + Places, then restart
        the admin app.
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="text-destructive text-sm font-semibold">
        Google Maps failed to load. Check the API key and HTTP referrer restrictions
        (include localhost:3005).
      </p>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
        Loading map…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Autocomplete
          onLoad={(instance) => {
            autocompleteRef.current = instance;
          }}
          onPlaceChanged={onPlaceChanged}
          options={{
            fields: ["geometry", "formatted_address", "name"],
            componentRestrictions: { country: "in" },
          }}
        >
          <input
            type="text"
            placeholder="Search shop area…"
            className="h-10 w-full rounded-md border bg-white pr-3 pl-9 text-sm outline-none"
          />
        </Autocomplete>
      </div>
      <div className="relative h-64 overflow-hidden rounded-xl border">
        <GoogleMap
          mapContainerStyle={CONTAINER}
          center={center}
          zoom={radiusKm > 20 ? 10 : radiusKm > 8 ? 12 : 13}
          options={{
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          }}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          onClick={onMapClick}
        >
          <Marker
            position={center}
            draggable
            title="Shop / zone center"
            onDragEnd={(e) => {
              if (!e.latLng) return;
              onCenterChange(e.latLng.lat(), e.latLng.lng());
            }}
          />
          <Circle
            center={center}
            radius={radiusM}
            options={{
              fillColor: "#0284c7",
              fillOpacity: 0.18,
              strokeColor: "#0369a1",
              strokeWeight: 2,
              clickable: false,
            }}
          />
        </GoogleMap>
      </div>
      <p className="text-muted-foreground text-xs font-semibold">
        Click the map or drag the shop pin. The circle is the delivery zone.
      </p>
    </div>
  );
}
