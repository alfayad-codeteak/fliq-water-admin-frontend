"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <p className="text-muted-foreground text-sm font-medium">404</p>
          <CardTitle className="text-2xl">Page not found</CardTitle>
          <CardDescription>
            The page you requested does not exist or was moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Check the URL or return to your dashboard.
          </p>
        </CardContent>
        <CardFooter className="justify-center gap-2">
          <Link
            href="/dashboard"
            className={buttonVariants()}
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline" })}
          >
            Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
