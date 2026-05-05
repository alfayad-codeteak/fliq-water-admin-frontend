"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  createDeliveryZoneAction,
  deleteDeliveryZoneAction,
  updateDeliveryZoneAction,
} from "@/lib/actions/delivery-zones";
import { clientFetch } from "@/lib/api/client-fetch";
import type { DeliveryZoneDto } from "@/lib/api/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DeliveryZonesTable({
  initialData,
}: {
  initialData: DeliveryZoneDto[];
}) {
  const queryClient = useQueryClient();
  const { status } = useSession();

  const { data: rows = initialData, isFetching } = useQuery({
    queryKey: ["admin-delivery-zones"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/delivery-zones");
      if (!res.ok) throw new Error("Failed to load delivery zones");
      return res.json() as Promise<DeliveryZoneDto[]>;
    },
    initialData,
    enabled: status === "authenticated",
  });

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<DeliveryZoneDto | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<DeliveryZoneDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {isFetching ? "Refreshing…" : `${rows.length} zone(s)`}
        </p>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Add zone
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table className="min-w-[920px]" aria-busy={isFetching}>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Center</TableHead>
              <TableHead className="text-center">Radius</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  No delivery zones yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.name}</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {formatLatLng(z.centerLat, z.centerLng)}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {formatKm(z.radiusKm)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={z.isActive === false ? "outline" : "default"}>
                      {z.isActive === false ? "Off" : "On"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${z.name}`}
                        onClick={() => setEditRow(z)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${z.name}`}
                        onClick={() => setDeleteRow(z)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New delivery zone</DialogTitle>
            <DialogDescription>
              Add a store center and radius. Lat/lng must be valid coordinates.
            </DialogDescription>
          </DialogHeader>
          <DeliveryZoneForm
            submitLabel="Create zone"
            defaultValues={{
              name: "",
              centerLat: "",
              centerLng: "",
              radiusKm: "10",
              isActive: true,
            }}
            onSubmit={async (v) => {
              const res = await createDeliveryZoneAction(v);
              if (!res.ok) {
                toast.error(firstRootError(res.error) ?? "Create failed");
                return;
              }
              toast.success("Zone created");
              setCreateOpen(false);
              queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit delivery zone</DialogTitle>
            <DialogDescription>Update name, radius, or status.</DialogDescription>
          </DialogHeader>
          {editRow ? (
            <DeliveryZoneForm
              submitLabel="Save changes"
              defaultValues={{
                name: editRow.name ?? "",
                centerLat: String(editRow.centerLat ?? ""),
                centerLng: String(editRow.centerLng ?? ""),
                radiusKm: String(editRow.radiusKm ?? ""),
                isActive: editRow.isActive !== false,
              }}
              onSubmit={async (v) => {
                const res = await updateDeliveryZoneAction(editRow.id, v);
                if (!res.ok) {
                  toast.error(firstRootError(res.error) ?? "Update failed");
                  return;
                }
                toast.success("Zone updated");
                setEditRow(null);
                queryClient.invalidateQueries({
                  queryKey: ["admin-delivery-zones"],
                });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete delivery zone?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes <strong>{deleteRow?.name ?? "this zone"}</strong>{" "}
              permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async () => {
                if (!deleteRow) return;
                setDeleting(true);
                const res = await deleteDeliveryZoneAction(deleteRow.id);
                setDeleting(false);
                if (!res.ok) {
                  toast.error(res.error ?? "Could not delete");
                  return;
                }
                toast.success("Zone removed");
                setDeleteRow(null);
                queryClient.invalidateQueries({
                  queryKey: ["admin-delivery-zones"],
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeliveryZoneForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  defaultValues: {
    name: string;
    centerLat: string;
    centerLng: string;
    radiusKm: string;
    isActive: boolean;
  };
  submitLabel: string;
  onSubmit: (v: {
    name: string;
    centerLat: string;
    centerLng: string;
    radiusKm: string;
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [saving, setSaving] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [name, setName] = React.useState(defaultValues.name);
  const [centerLat, setCenterLat] = React.useState(defaultValues.centerLat);
  const [centerLng, setCenterLng] = React.useState(defaultValues.centerLng);
  const [radiusKm, setRadiusKm] = React.useState(defaultValues.radiusKm);
  const [isActive, setIsActive] = React.useState(defaultValues.isActive);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSubmit({ name, centerLat, centerLng, radiusKm, isActive });
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="dz-name">Name</Label>
        <Input
          id="dz-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Main Store"
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="dz-lat">Center latitude</Label>
          <Input
            id="dz-lat"
            value={centerLat}
            onChange={(e) => setCenterLat(e.target.value)}
            inputMode="decimal"
            placeholder="23.0225"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dz-lng">Center longitude</Label>
          <Input
            id="dz-lng"
            value={centerLng}
            onChange={(e) => setCenterLng(e.target.value)}
            inputMode="decimal"
            placeholder="72.5714"
            required
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
        <p className="text-muted-foreground text-xs">
          Tip: You can auto-fill center lat/lng from your current location.
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={saving || locating}
          onClick={() => {
            if (!("geolocation" in navigator)) {
              toast.error("Geolocation is not supported in this browser");
              return;
            }
            // Some browsers require HTTPS (or localhost) for geolocation.
            if (
              typeof window !== "undefined" &&
              window.location.protocol !== "https:" &&
              window.location.hostname !== "localhost"
            ) {
              toast.error("Location requires HTTPS in production");
              return;
            }

            setLocating(true);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setLocating(false);
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setCenterLat(String(Math.round(lat * 1e6) / 1e6));
                setCenterLng(String(Math.round(lng * 1e6) / 1e6));
                toast.success("Location captured");
              },
              (err) => {
                setLocating(false);
                if (err.code === err.PERMISSION_DENIED) {
                  toast.error("Location permission denied");
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                  toast.error("Location unavailable");
                } else if (err.code === err.TIMEOUT) {
                  toast.error("Location request timed out");
                } else {
                  toast.error("Could not fetch location");
                }
              },
              { enableHighAccuracy: true, timeout: 12_000, maximumAge: 10_000 }
            );
          }}
        >
          {locating ? "Fetching…" : "Use current location"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="dz-radius">Radius (km)</Label>
          <Input
            id="dz-radius"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            inputMode="decimal"
            placeholder="10"
            required
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="grid gap-0.5">
            <Label htmlFor="dz-active">Active</Label>
            <p className="text-muted-foreground text-xs">
              If off, the zone is ignored.
            </p>
          </div>
          <Switch
            id="dz-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            aria-label="Zone active"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function firstRootError(
  error:
    | { root?: string[] }
    | Record<string, string[]>
    | undefined
): string | null {
  if (!error) return null;
  if ("root" in error && Array.isArray(error.root) && error.root[0]) return error.root[0];
  return null;
}

function formatLatLng(lat: number, lng: number): string {
  const a = Number.isFinite(lat) ? lat.toFixed(5) : "—";
  const b = Number.isFinite(lng) ? lng.toFixed(5) : "—";
  return `${a}, ${b}`;
}

function formatKm(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 100) / 100;
  return `${rounded} km`;
}

