"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Plus, Trash2, Upload } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  createBannerAction,
  deleteBannerAction,
  updateBannerAction,
} from "@/lib/actions/banners";
import { clientFetch } from "@/lib/api/client-fetch";
import type { BannerDto, ProductDto } from "@/lib/api/types";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableEmptyState } from "@/components/ui/data-table/table-empty-state";

function productThumb(p: ProductDto): string | null {
  const fromList = p.photoUrls?.map((u) => u?.trim()).find(Boolean);
  return (fromList ?? p.photoUrl?.trim()) || null;
}

function ProductOptionThumb({ src, name }: { src: string | null; name: string }) {
  if (!src) {
    return (
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold">
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="size-10 shrink-0 rounded-md border object-cover"
    />
  );
}

function bffImageUrl(banner: BannerDto): string {
  if (banner.imageUrl?.startsWith("http://") || banner.imageUrl?.startsWith("https://")) {
    return banner.imageUrl;
  }
  const path = banner.imageUrl?.startsWith("/api/")
    ? `/api/bff${banner.imageUrl.slice(4)}`
    : `/api/bff/admin/banners/${banner.id}/image`;
  return `${path}?t=${encodeURIComponent(banner.updatedAt)}`;
}

export function BannersTable({ initialData }: { initialData: BannerDto[] }) {
  const queryClient = useQueryClient();
  const { status } = useSession();
  const { data: rows = initialData } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/banners");
      if (!res.ok) throw new Error("Failed to load banners");
      return res.json() as Promise<BannerDto[]>;
    },
    initialData,
    initialDataUpdatedAt: Date.now(),
    enabled: status === "authenticated",
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json() as Promise<ProductDto[]>;
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BannerDto | null>(null);
  const [pending, setPending] = React.useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-banners"] });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add banner
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <TableEmptyState
            icon={ImageIcon}
            title="No banners yet"
            description="Add a banner to show it on the customer home page."
            action={{
              label: "Add banner",
              onClick: () => {
                setEditing(null);
                setOpen(true);
              },
            }}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => {
            const linked = products.find((p) => p.id === b.productId);
            return (
            <li
              key={b.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
            >
              <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bffImageUrl(b)}
                  alt={b.title || "Banner"}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">
                  {b.title || "Untitled banner"}
                </p>
                {linked || b.productName ? (
                  <div className="mt-2 flex items-center gap-2">
                    <ProductOptionThumb
                      src={linked ? productThumb(linked) : null}
                      name={b.productName || linked?.name || "Product"}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {b.productName || linked?.name}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {b.linkUrl}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                    {b.linkUrl || "No product linked"}
                  </p>
                )}
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Sort {b.sortOrder} · {b.isActive ? "Active" : "Hidden"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="font-bold"
                  onClick={() => {
                    setEditing(b);
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="font-bold text-rose-700"
                  onClick={async () => {
                    if (!window.confirm("Delete this banner?")) return;
                    const r = await deleteBannerAction(b.id);
                    if (!r.ok) {
                      toast.error(r.error);
                      return;
                    }
                    toast.success("Banner deleted");
                    refresh();
                  }}
                >
                  <Trash2 className="mr-1 size-4" />
                  Delete
                </Button>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <BannerDialog
        open={open}
        onOpenChange={setOpen}
        banner={editing}
        products={products}
        pending={pending}
        onSubmit={async (form) => {
          setPending(true);
          const r = editing
            ? await updateBannerAction(editing.id, form)
            : await createBannerAction(form);
          setPending(false);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(editing ? "Banner updated" : "Banner added");
          setOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function BannerDialog({
  open,
  onOpenChange,
  banner,
  products,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner: BannerDto | null;
  products: ProductDto[];
  pending: boolean;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const [title, setTitle] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [productId, setProductId] = React.useState("none");
  const [sortOrder, setSortOrder] = React.useState("0");
  const [isActive, setIsActive] = React.useState(true);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const acceptFile = React.useCallback((next: File | undefined | null) => {
    if (!next) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(next.type)) {
      toast.error("Use a JPEG, PNG, or WebP image");
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      toast.error("Image must be 10 MB or smaller");
      return;
    }
    setFile(next);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setTitle(banner?.title ?? "");
    setLinkUrl(banner?.linkUrl && !banner.productId ? banner.linkUrl : "");
    setProductId(banner?.productId || "none");
    setSortOrder(String(banner?.sortOrder ?? 0));
    setIsActive(banner?.isActive ?? true);
    setFile(null);
    setPreview(banner ? bffImageUrl(banner) : null);
  }, [open, banner]);

  React.useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="font-bold">
            {banner ? "Edit banner" : "Add banner"}
          </DialogTitle>
          <DialogDescription className="font-semibold">
            Shown on the customer home page when active.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!banner && !file) {
              toast.error("Choose an image");
              return;
            }
            const form = new FormData();
            form.set("title", title);
            form.set("linkUrl", productId !== "none" ? "" : linkUrl);
            form.set("productId", productId);
            form.set("sortOrder", sortOrder);
            form.set("isActive", isActive ? "true" : "false");
            if (file) form.set("file", file);
            void onSubmit(form);
          }}
        >
          <div className="grid gap-2">
            <Label className="font-bold">Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                acceptFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOver(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                acceptFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={
                dragOver
                  ? "relative flex min-h-40 w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-sky-500 bg-sky-50 text-center outline-none"
                  : "relative flex min-h-40 w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center outline-none hover:border-sky-400 hover:bg-sky-50/60"
              }
            >
              {preview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span className="relative z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow-sm">
                    Drop a new image or click to replace
                  </span>
                </>
              ) : (
                <>
                  <Upload className="mb-2 size-8 text-slate-400" />
                  <span className="text-sm font-bold text-slate-800">
                    Drag and drop banner image
                  </span>
                  <span className="mt-1 text-xs font-semibold text-slate-500">
                    or click to browse · JPEG, PNG, WebP · max 10 MB
                  </span>
                </>
              )}
            </button>
          </div>
          <div className="grid gap-2">
            <Label className="font-bold">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Alt text / admin label"
            />
          </div>
          <div className="grid gap-2">
            <Label className="font-bold">Product</Label>
            <Select
              value={productId}
              onValueChange={(value) => {
                setProductId(typeof value === "string" ? value : "none");
              }}
            >
              <SelectTrigger className="h-14 w-full min-w-0 rounded-lg bg-white px-2 font-bold">
                {(() => {
                  const selected = products.find((p) => p.id === productId);
                  if (!selected) {
                    return (
                      <SelectValue placeholder="Choose a product" />
                    );
                  }
                  return (
                    <span className="flex min-w-0 items-center gap-2">
                      <ProductOptionThumb
                        src={productThumb(selected)}
                        name={selected.name}
                      />
                      <span className="truncate">{selected.name}</span>
                    </span>
                  );
                })()}
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="z-[80] max-h-72 min-w-(--anchor-width)"
              >
                <SelectItem value="none" className="py-2 font-bold">
                  No product
                </SelectItem>
                {products.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="h-auto py-1.5 font-bold"
                  >
                    <span className="flex items-center gap-2">
                      <ProductOptionThumb src={productThumb(p)} name={p.name} />
                      <span className="truncate">{p.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs font-semibold text-slate-500">
              Tap the banner on neerbottle.in to open this product.
            </p>
          </div>
          {productId === "none" ? (
          <div className="grid gap-2">
            <Label className="font-bold">Or custom link (optional)</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://… or /products"
            />
          </div>
          ) : null}
          <div className="grid gap-2">
            <Label className="font-bold">Sort order</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label className="font-bold">Active on home</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingText="Saving…">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
