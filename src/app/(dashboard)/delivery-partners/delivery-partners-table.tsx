"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Plus, Trash2, Truck, UserCheck, Users } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  createDeliveryPartnerAction,
  deleteDeliveryPartnerAction,
  updateDeliveryPartnerAction,
} from "@/lib/actions/delivery-partners";
import { clientFetch } from "@/lib/api/client-fetch";
import type { DeliveryPartnerDto } from "@/lib/api/types";
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
import { SubmitButton } from "@/components/ui/submit-button";
import { TableEmptyState } from "@/components/ui/data-table/table-empty-state";
import { TableFilterChips } from "@/components/ui/data-table/table-filter-chips";
import { TablePagination } from "@/components/ui/data-table/table-pagination";
import { TableSearchInput } from "@/components/ui/data-table/table-search-input";
import { TableSkeletonRows } from "@/components/ui/data-table/table-skeleton-rows";
import { TableStatCards } from "@/components/ui/data-table/table-stat-cards";
import {
  RightSidebar,
  RightSidebarActions,
} from "@/components/ui/right-sidebar";
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

type AvailFilter = "all" | "available" | "off";

export function DeliveryPartnersTable({
  initialData,
}: {
  initialData: DeliveryPartnerDto[];
}) {
  const queryClient = useQueryClient();
  const { status } = useSession();
  const { data: rows = initialData, isFetching, isLoading } = useQuery({
    queryKey: ["admin-delivery-partners"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/delivery-partners");
      if (!res.ok) throw new Error("Failed to load delivery partners");
      return res.json() as Promise<DeliveryPartnerDto[]>;
    },
    initialData,
    initialDataUpdatedAt: Date.now(),
    enabled: status === "authenticated",
  });

  const [search, setSearch] = React.useState("");
  const [availFilter, setAvailFilter] = React.useState<AvailFilter>("all");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<DeliveryPartnerDto | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<DeliveryPartnerDto | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);

  const stats = React.useMemo(() => {
    const available = rows.filter((p) => p.isAvailable !== false).length;
    return { total: rows.length, available, off: rows.length - available };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((p) => {
      if (availFilter === "available" && p.isAvailable === false) return false;
      if (availFilter === "off" && p.isAvailable !== false) return false;
      if (!q) return true;
      const hay = [p.name, p.phone, p.vehicleType, p.vehicleNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, availFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(
    pageIndex * pageSize,
    pageIndex * pageSize + pageSize
  );

  React.useEffect(() => {
    setPageIndex(0);
  }, [search, availFilter, pageSize]);

  const filterChips = [
    { id: "all", label: "All", count: stats.total },
    { id: "available", label: "Available", count: stats.available },
    { id: "off", label: "Off duty", count: stats.off },
  ];

  return (
    <div className="space-y-5">
      <TableStatCards
        items={[
          { label: "Total partners", value: stats.total, icon: Users },
          { label: "Available", value: stats.available, icon: UserCheck },
          { label: "Off duty", value: stats.off, icon: Truck },
          {
            label: "Showing",
            value: filtered.length,
            icon: Truck,
          },
        ]}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, phone, or vehicle…"
            aria-label="Search delivery partners"
          />
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add partner
          </Button>
        </div>
        <TableFilterChips
          chips={filterChips}
          activeId={availFilter}
          onChange={(id) => setAvailFilter(id as AvailFilter)}
        />
      </div>

      <div className="space-y-3">
        <div className="overflow-x-auto">
          <Table className="min-w-[920px]" aria-busy={isFetching}>
            <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 text-xs">Name</TableHead>
                <TableHead className="h-11 text-xs">Phone</TableHead>
                <TableHead className="h-11 text-xs">Vehicle</TableHead>
                <TableHead className="h-11 text-xs">Available</TableHead>
                <TableHead className="h-11 text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                <TableSkeletonRows colSpan={5} />
              ) : paged.length ? (
                paged.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-sm">{p.phone}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[12rem] truncate text-sm">
                      {[p.vehicleType, p.vehicleNumber].filter(Boolean).join(" · ") ||
                        "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.isAvailable === false ? "outline" : "default"}
                      >
                        {p.isAvailable === false ? "Off duty" : "Available"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${p.name}`}
                          onClick={() => setEditRow(p)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => setDeleteRow(p)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5}>
                    <TableEmptyState
                      icon={Truck}
                      title="No delivery partners found"
                      description={
                        search || availFilter !== "all"
                          ? "Try adjusting your search or filters."
                          : "Add your first delivery partner to start assigning orders."
                      }
                      action={
                        !search && availFilter === "all"
                          ? {
                              label: "Add partner",
                              onClick: () => setCreateOpen(true),
                            }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          pageIndex={pageIndex}
          pageCount={pageCount}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel="partner"
          isFetching={isFetching}
          onPageSizeChange={setPageSize}
          onPrevious={() => setPageIndex((p) => Math.max(0, p - 1))}
          onNext={() => setPageIndex((p) => p + 1)}
          canPrevious={pageIndex > 0}
          canNext={pageIndex < pageCount - 1}
        />
      </div>

      <RightSidebar
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New delivery partner"
        description="Creates a login (role delivery partner). Save the password — it is not shown again."
        size="sm"
      >
        <CreatePartnerForm
          onDone={() => {
            setCreateOpen(false);
            queryClient.invalidateQueries({
              queryKey: ["admin-delivery-partners"],
            });
          }}
        />
      </RightSidebar>

      <RightSidebar
        open={!!editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        title="Edit partner"
        description="Update profile, vehicle, availability, or last known location."
        size="sm"
      >
        {editRow ? (
          <EditPartnerForm
            partner={editRow}
            onDone={() => {
              setEditRow(null);
              queryClient.invalidateQueries({
                queryKey: ["admin-delivery-partners"],
              });
            }}
          />
        ) : null}
      </RightSidebar>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete partner?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes{" "}
              <strong>{deleteRow?.name ?? "this partner"}</strong> and their login
              permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              loading={deleting}
              loadingText="Deleting…"
              onClick={async () => {
                if (!deleteRow || deleting) return;
                setDeleting(true);
                const res = await deleteDeliveryPartnerAction(deleteRow.id);
                setDeleting(false);
                if (!res.ok) {
                  toast.error(res.error ?? "Could not delete");
                  return;
                }
                toast.success("Partner removed");
                setDeleteRow(null);
                queryClient.invalidateQueries({
                  queryKey: ["admin-delivery-partners"],
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

function CreatePartnerForm({ onDone }: { onDone: () => void }) {
  return (
    <form
      className="grid gap-4"
      action={async (fd) => {
        const phone = String(fd.get("phone") ?? "").replace(/\D/g, "").slice(-10);
        const name = String(fd.get("name") ?? "").trim();
        const password = String(fd.get("password") ?? "");
        const vehicleType = String(fd.get("vehicleType") ?? "").trim();
        const vehicleNumber = String(fd.get("vehicleNumber") ?? "").trim();
        if (phone.length !== 10) {
          toast.error("Phone must be exactly 10 digits");
          return;
        }
        if (!name) {
          toast.error("Name is required");
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }
        const r = await createDeliveryPartnerAction({
          phone,
          name,
          password,
          vehicleType: vehicleType || undefined,
          vehicleNumber: vehicleNumber || undefined,
        });
        if (!r.ok) {
          toast.error(r.error ?? "Create failed");
          return;
        }
        toast.success("Partner created — share phone + password for first login");
        onDone();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="dp-phone">Phone (10 digits)</Label>
        <Input
          id="dp-phone"
          name="phone"
          inputMode="numeric"
          maxLength={10}
          required
          placeholder="9876543210"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dp-name">Name</Label>
        <Input id="dp-name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dp-pass">Password (min 6)</Label>
        <Input
          id="dp-pass"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="dp-vtype">Vehicle type</Label>
          <Input id="dp-vtype" name="vehicleType" placeholder="Bike" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dp-vnum">Vehicle number</Label>
          <Input id="dp-vnum" name="vehicleNumber" placeholder="KL-01-AB-1234" />
        </div>
      </div>
      <RightSidebarActions>
        <SubmitButton loadingText="Creating…">Create</SubmitButton>
      </RightSidebarActions>
    </form>
  );
}

function EditPartnerForm({
  partner,
  onDone,
}: {
  partner: DeliveryPartnerDto;
  onDone: () => void;
}) {
  const [available, setAvailable] = React.useState(
    partner.isAvailable !== false
  );

  return (
    <form
      className="grid gap-4"
      action={async (fd) => {
        const name = String(fd.get("name") ?? "").trim();
        const vehicleType = String(fd.get("vehicleType") ?? "").trim();
        const vehicleNumber = String(fd.get("vehicleNumber") ?? "").trim();
        const latRaw = String(fd.get("lat") ?? "").trim();
        const lngRaw = String(fd.get("lng") ?? "").trim();
        const patch: Parameters<typeof updateDeliveryPartnerAction>[1] = {
          name,
          vehicleType,
          vehicleNumber,
          isAvailable: available,
        };
        if (latRaw) {
          const n = Number(latRaw);
          if (Number.isFinite(n)) patch.currentLat = n;
        }
        if (lngRaw) {
          const n = Number(lngRaw);
          if (Number.isFinite(n)) patch.currentLng = n;
        }
        const r = await updateDeliveryPartnerAction(partner.id, patch);
        if (!r.ok) {
          toast.error(r.error ?? "Update failed");
          return;
        }
        toast.success("Partner updated");
        onDone();
      }}
    >
      <p className="text-muted-foreground font-mono text-xs">
        Partner id: {partner.id}
        {partner.createdAt
          ? ` · since ${format(new Date(partner.createdAt), "MMM d, yyyy")}`
          : null}
      </p>
      <div className="grid gap-2">
        <Label htmlFor="ed-name">Name</Label>
        <Input
          id="ed-name"
          name="name"
          required
          defaultValue={partner.name}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ed-vtype">Vehicle type</Label>
          <Input
            id="ed-vtype"
            name="vehicleType"
            defaultValue={partner.vehicleType ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ed-vnum">Vehicle number</Label>
          <Input
            id="ed-vnum"
            name="vehicleNumber"
            defaultValue={partner.vehicleNumber ?? ""}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="ed-avail"
          checked={available}
          onCheckedChange={setAvailable}
        />
        <Label htmlFor="ed-avail" className="cursor-pointer">
          Available for new assignments
        </Label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ed-lat">Latitude (optional)</Label>
          <Input
            id="ed-lat"
            name="lat"
            type="text"
            inputMode="decimal"
            placeholder={partner.currentLat != null ? String(partner.currentLat) : ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ed-lng">Longitude (optional)</Label>
          <Input
            id="ed-lng"
            name="lng"
            type="text"
            inputMode="decimal"
            placeholder={partner.currentLng != null ? String(partner.currentLng) : ""}
          />
        </div>
      </div>
      <RightSidebarActions>
        <SubmitButton loadingText="Saving…">Save</SubmitButton>
      </RightSidebarActions>
    </form>
  );
}
