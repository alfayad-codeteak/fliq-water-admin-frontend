"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="max-w-lg border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="text-destructive size-5" aria-hidden />
          <CardTitle>Products unavailable</CardTitle>
        </div>
        <CardDescription>
          The catalog could not be loaded. Retry or check the database
          connection.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{error.message}</p>
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={() => reset()}>
          Retry
        </Button>
      </CardFooter>
    </Card>
  );
}
