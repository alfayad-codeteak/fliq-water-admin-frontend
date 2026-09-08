import type { Metadata } from "next";

import { auth } from "@/auth";
import { loadBanners } from "@/lib/api/admin-list";
import type { BannerDto } from "@/lib/api/types";
import { BannersTable } from "./banners-table";

export const metadata: Metadata = {
  title: "Banners",
};

export default async function BannersPage() {
  const session = await auth();
  let initial: BannerDto[] = [];
  if (session?.accessToken) {
    initial = await loadBanners();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Banners</h1>
        <p className="text-muted-foreground text-sm">
          Home page carousel. Upload JPEG, PNG, or WebP up to 10 MB.
        </p>
      </div>
      <BannersTable initialData={initial} />
    </div>
  );
}
