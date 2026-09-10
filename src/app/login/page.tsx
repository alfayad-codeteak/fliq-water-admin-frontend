"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { loginSchema, type LoginValues } from "@/lib/validations/auth";
import { saveAuthToStorage } from "@/lib/auth-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("Signing in…");

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const isSubmitting = busy || form.formState.isSubmitting;

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    setBusy(true);
    setBusyText("Signing in…");
    try {
      const result = await signIn("credentials", {
        phone: values.phone,
        password: values.password,
        redirect: false,
      });
      if (result?.error) {
        setFormError("Invalid phone or password, or not an admin/owner account.");
        setBusy(false);
        return;
      }

      setBusyText("Opening dashboard…");
      const session = await getSession();
      if (session?.user) {
        saveAuthToStorage({
          id: session.user.id,
          phone: session.user.phone,
          role: session.user.role,
          permissions: session.user.permissions,
        });
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setFormError("Unable to sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#f4f6f8] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_-10%,rgba(2,132,199,0.12),transparent_55%)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px]"
      >
        <div className="rounded-2xl border border-black/[0.06] bg-white p-7 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.28)] sm:p-8">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="relative size-12 overflow-hidden rounded-2xl border border-black/[0.06] shadow-sm">
              <Image
                src="/icon-512x512.png"
                alt="Neerbottle"
                fill
                className="object-cover"
                sizes="48px"
                priority
              />
            </div>
            <h1 className="text-foreground mt-4 text-[22px] font-semibold tracking-tight">
              Neerbottle
            </h1>
            <p className="text-muted-foreground mt-1 text-[13px]">
              Sign in to the admin console
            </p>
          </div>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            {formError ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-destructive/25 bg-destructive/[0.07] text-destructive rounded-lg border px-3 py-2.5 text-[13px] leading-snug"
                role="alert"
              >
                {formError}
              </motion.p>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="phone" className="text-[13px] font-medium">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile"
                maxLength={10}
                disabled={isSubmitting}
                aria-invalid={!!form.formState.errors.phone}
                className="h-11 rounded-xl px-3.5 text-[15px] placeholder:text-foreground/28"
                {...form.register("phone")}
              />
              {form.formState.errors.phone ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.phone.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  aria-invalid={!!form.formState.errors.password}
                  className="h-11 rounded-xl px-3.5 pr-11 text-[15px] placeholder:text-foreground/28"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground/70 hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              loadingText={busyText}
              className="mt-2 h-11 w-full rounded-xl text-[15px] font-semibold"
            >
              Sign in
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
