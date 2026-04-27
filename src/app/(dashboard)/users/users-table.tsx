"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  createAdminUser,
  deleteAdminAction,
  updateAdminAction,
} from "@/lib/actions/users";
import { clientFetch } from "@/lib/api/client-fetch";
import type { AdminUserDto, FeatureKey } from "@/lib/api/types";
import { FEATURE_KEYS } from "@/lib/api/types";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function PermissionBadges({ keys }: { keys: FeatureKey[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <Badge key={k} variant="secondary" className="text-xs font-normal">
          {k}
        </Badge>
      ))}
    </div>
  );
}

function PermissionFields({
  name,
  defaultSelected,
}: {
  name: string;
  defaultSelected?: FeatureKey[];
}) {
  const selected = new Set(defaultSelected ?? []);
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">Permissions</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURE_KEYS.map((key) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              name={name}
              value={key}
              defaultChecked={selected.has(key)}
              className="border-input accent-primary size-4 rounded"
            />
            {key}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function UsersTable({
  initialData,
  canManage,
  currentUserId,
}: {
  initialData: AdminUserDto[];
  canManage: boolean;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const { status } = useSession();
  const { data: rows = initialData, isFetching } = useQuery({
    queryKey: ["owner-admins"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/owner/admins");
      if (res.status === 403) return [];
      if (!res.ok) throw new Error("Failed to load admins");
      return res.json() as Promise<AdminUserDto[]>;
    },
    initialData,
    enabled: canManage && status === "authenticated",
  });

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<AdminUserDto | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<AdminUserDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const columns = React.useMemo<ColumnDef<AdminUserDto>[]>(
    () => [
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.phone}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.original.name ?? "—",
      },
      {
        id: "permissions",
        header: "Permissions",
        cell: ({ row }) => (
          <PermissionBadges keys={row.original.permissions} />
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), "MMM d, yyyy"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${row.original.phone}`}
              disabled={!canManage || row.original.id === currentUserId}
              onClick={() => setEditRow(row.original)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${row.original.phone}`}
              disabled={!canManage || row.original.id === currentUserId}
              onClick={() => setDeleteRow(row.original)}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [canManage, currentUserId]
  );

  const table = useReactTable({
    data: canManage ? rows : [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  if (!canManage) {
    return (
      <p className="text-muted-foreground text-sm">
        This section is restricted to accounts with the{" "}
        <strong>owner</strong> role.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Filter by phone, name, or permission…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
          aria-label="Filter admins"
        />
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          New admin
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table className="min-w-[920px]" aria-busy={isFetching}>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(
                          h.column.columnDef.header,
                          h.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  No admins yet — create one with the button above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount() || 1}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create admin</DialogTitle>
            <DialogDescription>Create a new admin user.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 py-2"
            action={async (fd) => {
              const r = await createAdminUser(fd);
              if (!r.ok) {
                toast.error("Could not create admin");
                return;
              }
              toast.success("Admin created");
              setCreateOpen(false);
              queryClient.invalidateQueries({ queryKey: ["owner-admins"] });
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="c-phone">Phone (10 digits)</Label>
              <Input
                id="c-phone"
                name="phone"
                inputMode="numeric"
                maxLength={10}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-password">Password</Label>
              <Input
                id="c-password"
                name="password"
                type="password"
                minLength={6}
                required
              />
            </div>
            <PermissionFields name="permissions" />
            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit admin</DialogTitle>
            <DialogDescription>Update this admin user.</DialogDescription>
          </DialogHeader>
          {editRow ? (
            <form
              className="grid gap-4 py-2"
              action={async (fd) => {
                fd.set("id", editRow.id);
                const r = await updateAdminAction(fd);
                if (!r.ok) {
                  toast.error("Update failed");
                  return;
                }
                toast.success("Admin updated");
                setEditRow(null);
                queryClient.invalidateQueries({ queryKey: ["owner-admins"] });
              }}
            >
              <input type="hidden" name="id" value={editRow.id} />
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={editRow.phone} readOnly disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-name">Name</Label>
                <Input
                  id="e-name"
                  name="name"
                  defaultValue={editRow.name}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-password">New password (optional)</Label>
                <Input
                  id="e-password"
                  name="password"
                  type="password"
                  minLength={6}
                  placeholder="Leave blank to keep"
                />
              </div>
              <PermissionFields
                name="permissions"
                defaultSelected={editRow.permissions}
              />
              <DialogFooter>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong>{deleteRow?.name ?? deleteRow?.phone ?? "this admin"}</strong>.
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
                const res = await deleteAdminAction(deleteRow.id);
                setDeleting(false);
                if (!res.ok) {
                  toast.error(res.error ?? "Could not delete admin");
                  return;
                }
                toast.success("Staff deleted");
                setDeleteRow(null);
                queryClient.invalidateQueries({ queryKey: ["owner-admins"] });
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
