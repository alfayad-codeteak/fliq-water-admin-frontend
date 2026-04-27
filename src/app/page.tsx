"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();

  React.useEffect(() => {
    if (status === "loading") return;
    const target = status === "authenticated" ? "/dashboard" : "/login";
    const timer = window.setTimeout(() => {
      router.replace(target);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [router, status]);

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background px-4 overflow-hidden">
      
      {/* Center Content */}
      <div className="flex flex-col items-center gap-5 z-10">
        <div className="relative h-54 w-54  sm:h-28 sm:w-28">
          <Image
            src="/fliq-admin-icon.png"
            alt="Fliq Admin"
            fill
            priority
            className="rounded-2xl object-cover"
          />
        </div>
        <p className="text-muted-foreground text-sm">Loading Fliq Admin...</p>
      </div>

      {/* Bottom GIF */}
      <div className="absolute bottom-0 left-0 w-full h-32 sm:h-40 md:hidden">
        <Image
          src="/water.gif"
          alt="Water animation"
          fill
          className="object-cover"
          priority
        />
      </div>

    </main>
  );
}