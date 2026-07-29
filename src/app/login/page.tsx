"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { loginSchema, type LoginValues } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    const result = await signIn("credentials", {
      phone: values.phone,
      password: values.password,
      redirect: false,
    });
    if (result?.error) {
      setFormError("Invalid phone or password, or not an admin/owner account.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-black px-4 py-10">
      {/* Soft vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,transparent_55%)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Blueprint dashed frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -inset-y-10 sm:-inset-x-14 sm:-inset-y-14"
        >
          <div className="absolute inset-0 border border-dashed border-white/15" />
          <span className="absolute -top-px -left-px size-3 border-t border-l border-white/35" />
          <span className="absolute -top-px -right-px size-3 border-t border-r border-white/35" />
          <span className="absolute -bottom-px -left-px size-3 border-b border-l border-white/35" />
          <span className="absolute -right-px -bottom-px size-3 border-r border-b border-white/35" />
          <span className="absolute top-0 left-1/2 h-2 w-px -translate-x-1/2 bg-white/20" />
          <span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-white/20" />
          <span className="absolute top-1/2 left-0 h-px w-2 -translate-y-1/2 bg-white/20" />
          <span className="absolute top-1/2 right-0 h-px w-2 -translate-y-1/2 bg-white/20" />
        </div>

        <div className="relative flex flex-col px-1 py-2">
          {/* Brand */}
          <div className="mb-10 flex items-center justify-center gap-2.5">
            <div className="relative size-9 overflow-hidden rounded-[8px] ring-1 ring-white/15">
              <Image
                src="/fliq-admin-icon.png"
                alt="Fliq"
                fill
                className="object-cover"
                sizes="36px"
                priority
              />
            </div>
            <span className="text-[22px] font-semibold tracking-tight text-white">
              Fliq
            </span>
          </div>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-5"
          >
            {formError ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                role="alert"
              >
                {formError}
              </motion.p>
            ) : null}

            {/* Phone */}
            <div className="grid gap-2">
              <label
                htmlFor="phone"
                className="text-[13px] font-medium text-zinc-400"
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9876543210"
                maxLength={10}
                disabled={isSubmitting}
                aria-invalid={!!form.formState.errors.phone}
                className={cn(
                  "h-11 w-full rounded-md border bg-[#0d0d0d] px-3 text-[14px] text-white outline-none transition-colors placeholder:text-zinc-600",
                  "border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  form.formState.errors.phone &&
                    "border-red-500/50 focus:border-red-400 focus:ring-red-400/40"
                )}
                {...form.register("phone")}
              />
              {form.formState.errors.phone ? (
                <p className="text-xs text-red-400">
                  {form.formState.errors.phone.message}
                </p>
              ) : null}
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <label
                htmlFor="password"
                className="text-[13px] font-medium text-zinc-400"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  aria-invalid={!!form.formState.errors.password}
                  className={cn(
                    "h-11 w-full rounded-md border bg-[#0d0d0d] pl-3 pr-10 text-[14px] text-white outline-none transition-colors placeholder:text-zinc-600",
                    "border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    form.formState.errors.password &&
                      "border-red-500/50 focus:border-red-400 focus:ring-red-400/40"
                  )}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="text-xs text-red-400">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={cn(
                "relative mt-1 h-11 w-full overflow-hidden rounded-lg text-[14px] font-semibold text-white transition-all",
                "bg-gradient-to-b from-zinc-600 to-zinc-800 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
                "hover:from-zinc-500 hover:to-zinc-700",
                "active:from-zinc-700 active:to-zinc-900",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center gap-2 transition-opacity duration-200",
                  isSubmitting ? "opacity-0" : "opacity-100"
                )}
              >
                Sign in
              </span>

              {isSubmitting ? (
                <span className="absolute inset-0 flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Signing in…</span>
                </span>
              ) : null}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
