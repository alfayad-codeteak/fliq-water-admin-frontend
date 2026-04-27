"use client";

import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground flex min-h-svh flex-col items-center justify-center gap-4 p-6 font-sans antialiased">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md text-center text-sm">
          A critical error occurred. Please refresh the page or try again later.
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof reset === "function") {
              reset();
            } else {
              window.location.reload();
            }
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
