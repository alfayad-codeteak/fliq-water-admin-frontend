"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Autocomplete,
  Circle,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { ChevronDown, Maximize2, Minimize2, Search, X } from "lucide-react";
import { useSession } from "next-auth/react";

import { clientFetch } from "@/lib/api/client-fetch";
import type { CustomerAddressDto, DeliveryZoneDto } from "@/lib/api/types";
import { getGoogleMapsApiKey } from "@/lib/google-maps";
import {
  parseGoogleAddress,
  type ParsedMapAddress,
} from "@/lib/google-maps-address";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LIBRARIES: ("places")[] = ["places"];
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };
const DEFAULT_ZOOM = 12;
const CONTAINER = { width: "100%", height: "100%" };

type Props = {
  lat?: number | null;
  lng?: number | null;
  savedAddresses?: CustomerAddressDto[];
  onAddressPicked: (address: ParsedMapAddress) => void;
};

function pinIcon(color: string, scale = 8): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

export function OrderAddressMap({
  lat,
  lng,
  savedAddresses = [],
  onAddressPicked,
}: Props) {
  const apiKey = getGoogleMapsApiKey();
  const { status } = useSession();
  const { isLoaded, loadError } = useJsApiLoader({
    id: "neer-admin-google-maps",
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const { data: zones = [] } = useQuery({
    queryKey: ["admin-delivery-zones"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/delivery-zones");
      if (!res.ok) return [];
      return res.json() as Promise<DeliveryZoneDto[]>;
    },
    enabled: status === "authenticated" && Boolean(apiKey),
    staleTime: 60_000,
  });

  const activeZones = zones.filter((z) => z.isActive !== false);
  const savedPins = savedAddresses.filter(
    (a) =>
      a.lat != null &&
      a.lng != null &&
      Number.isFinite(Number(a.lat)) &&
      Number.isFinite(Number(a.lng))
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setOpen(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const hasPin =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const center = hasPin
    ? { lat: lat as number, lng: lng as number }
    : activeZones[0]
      ? {
          lat: Number(activeZones[0].centerLat),
          lng: Number(activeZones[0].centerLng),
        }
      : DEFAULT_CENTER;

  useEffect(() => {
    if (!open && !fullscreen) return;
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    const t = window.setTimeout(() => {
      google.maps.event.trigger(map, "resize");
      const bounds = new google.maps.LatLngBounds();
      let n = 0;
      for (const z of activeZones) {
        bounds.extend({ lat: Number(z.centerLat), lng: Number(z.centerLng) });
        n += 1;
      }
      for (const a of savedPins) {
        bounds.extend({ lat: Number(a.lat), lng: Number(a.lng) });
        n += 1;
      }
      if (hasPin) {
        bounds.extend({ lat: lat as number, lng: lng as number });
        n += 1;
      }
      if (n > 1) map.fitBounds(bounds, 48);
      else if (hasPin) map.panTo({ lat: lat as number, lng: lng as number });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, fullscreen, isLoaded, activeZones, savedPins, hasPin, lat, lng]);

  const applyGeocode = useCallback(
    async (nextLat: number, nextLng: number) => {
      if (!isLoaded) return;
      setBusy(true);
      try {
        if (!geocoderRef.current) {
          geocoderRef.current = new google.maps.Geocoder();
        }
        const result = await geocoderRef.current.geocode({
          location: { lat: nextLat, lng: nextLng },
        });
        const place = result.results[0];
        if (!place) return;
        onAddressPicked(
          parseGoogleAddress(
            place.address_components as {
              long_name: string;
              short_name: string;
              types: string[];
            }[],
            place.formatted_address ?? "",
            nextLat,
            nextLng
          )
        );
      } finally {
        setBusy(false);
      }
    },
    [isLoaded, onAddressPicked]
  );

  const movePin = useCallback(
    (nextLat: number, nextLng: number, zoom = 16) => {
      setOpen(true);
      mapRef.current?.panTo({ lat: nextLat, lng: nextLng });
      mapRef.current?.setZoom(zoom);
      void applyGeocode(nextLat, nextLng);
    },
    [applyGeocode]
  );

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    const loc = place?.geometry?.location;
    if (!loc) return;
    movePin(loc.lat(), loc.lng(), 17);
  }, [movePin]);

  if (!apiKey) {
    return (
      <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
        Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to use the address map.
      </p>
    );
  }

  if (loadError) {
    return (
      <p className="text-destructive text-xs font-semibold">
        Google Maps failed to load.
      </p>
    );
  }

  const searchBox = isLoaded ? (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <Autocomplete
        onLoad={(instance) => {
          autocompleteRef.current = instance;
        }}
        onPlaceChanged={onPlaceChanged}
        options={{
          fields: ["geometry", "formatted_address", "address_components"],
          componentRestrictions: { country: "in" },
        }}
      >
        <input
          type="text"
          placeholder="Search area, landmark, or pincode"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
        />
      </Autocomplete>
    </div>
  ) : (
    <div className="flex h-10 items-center rounded-xl bg-slate-100 px-3 text-xs text-slate-500">
      Loading map…
    </div>
  );

  const overlays = isLoaded ? (
    <>
      {activeZones.map((z) => {
        const pos = { lat: Number(z.centerLat), lng: Number(z.centerLng) };
        return (
          <Fragment key={z.id}>
            <Circle
              center={pos}
              radius={Math.max(100, Number(z.radiusKm) * 1000)}
              options={{
                fillColor: "#0284c7",
                fillOpacity: 0.12,
                strokeColor: "#0369a1",
                strokeWeight: 2,
                clickable: false,
              }}
            />
            <Marker
              position={pos}
              title={`Shop · ${z.name}`}
              icon={pinIcon("#0f766e", 9)}
              zIndex={2}
            />
          </Fragment>
        );
      })}
      {savedPins.map((a) => (
        <Marker
          key={a.id}
          position={{ lat: Number(a.lat), lng: Number(a.lng) }}
          title={a.label || a.line1 || "Saved address"}
          icon={pinIcon("#2563eb", 8)}
          zIndex={3}
        />
      ))}
      {hasPin ? (
        <Marker
          position={center}
          draggable
          title="New pin"
          icon={pinIcon("#e11d48", 10)}
          zIndex={4}
          onDragEnd={(e) => {
            if (!e.latLng) return;
            movePin(e.latLng.lat(), e.latLng.lng());
          }}
        />
      ) : null}
    </>
  ) : null;

  const mapCanvas = isLoaded ? (
    <GoogleMap
      mapContainerStyle={CONTAINER}
      center={center}
      zoom={hasPin ? 16 : DEFAULT_ZOOM}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      }}
      onLoad={(map) => {
        mapRef.current = map;
      }}
      onClick={(e) => {
        if (!e.latLng) return;
        movePin(e.latLng.lat(), e.latLng.lng());
      }}
    >
      {overlays}
    </GoogleMap>
  ) : null;

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => {
            setOpen((v) => !v);
            setFullscreen(false);
          }}
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-slate-500 transition-transform",
              open || fullscreen ? "rotate-0" : "-rotate-90"
            )}
          />
          <span className="text-sm font-bold text-slate-800">Map</span>
          <span className="truncate text-xs font-semibold text-slate-500">
            {busy
              ? "Reading address…"
              : hasPin
                ? "Pin set — tap to edit"
                : "Zones, shops, saved pins"}
          </span>
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 px-2"
          onClick={() => {
            setFullscreen((v) => !v);
            setOpen(true);
          }}
        >
          {fullscreen ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
          <span className="ml-1 hidden sm:inline">
            {fullscreen ? "Exit" : "Expand"}
          </span>
        </Button>
      </div>

      {!fullscreen ? searchBox : null}

      {open && !fullscreen ? (
        <div className="relative h-44 overflow-hidden rounded-xl border border-slate-200 sm:h-56 md:h-64">
          {mapCanvas}
        </div>
      ) : null}

      {(open || fullscreen) && isLoaded ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-teal-700" /> Shop
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-sky-700" /> Zone
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-blue-600" /> Saved address
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-rose-600" /> New pin
          </span>
        </div>
      ) : null}

      {fullscreen ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-white">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <p className="min-w-0 flex-1 text-sm font-bold">Drop pin</p>
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={() => setFullscreen(false)}
            >
              Done
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Close map"
              onClick={() => setFullscreen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="border-b px-3 py-2">{searchBox}</div>
          <div className="relative min-h-0 flex-1">{mapCanvas}</div>
          <p className="px-3 py-2 text-xs font-semibold text-slate-500">
            Teal = shop · blue circles = delivery zones · blue dots = saved
            addresses · red = new pin
          </p>
        </div>
      ) : null}

      {!open && !fullscreen ? (
        <p className="text-xs font-semibold text-slate-500">
          Tap Map to see shops, zones, and this customer’s saved pins.
        </p>
      ) : null}
    </div>
  );
}
