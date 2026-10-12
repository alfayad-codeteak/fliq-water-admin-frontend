"use client";

import { toast as sonnerToast } from "sonner";

import { userFacingError } from "@/lib/user-facing-error";

export const toast = {
  success: sonnerToast.success.bind(sonnerToast),
  message: sonnerToast.message.bind(sonnerToast),
  info: sonnerToast.info.bind(sonnerToast),
  warning: sonnerToast.warning.bind(sonnerToast),
  error: (
    message: unknown,
    data?: Parameters<typeof sonnerToast.error>[1],
  ) => sonnerToast.error(userFacingError(message), data),
};
