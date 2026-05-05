"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyJwtButton() {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="gap-2"
      disabled={!token}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(token);
          toast.success("JWT copied");
        } catch {
          toast.error("Copy failed");
        }
      }}
    >
      <Copy className="size-4" aria-hidden />
      Copy JWT
    </Button>
  );
}

