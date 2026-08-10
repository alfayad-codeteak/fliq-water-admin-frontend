"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

type SubmitButtonProps = Omit<ButtonProps, "type" | "loading"> & {
  /** Shown while the parent form action is pending. Defaults to children. */
  loadingText?: ReactNode;
};

/** Submit button that auto-shows loading while a React form `action` runs. */
export function SubmitButton({
  children,
  loadingText,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      loading={pending}
      loadingText={loadingText}
      disabled={disabled || pending}
      {...props}
    >
      {children}
    </Button>
  );
}
