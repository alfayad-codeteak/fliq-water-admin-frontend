"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { loginSchema, type LoginValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="bg-background relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.95_0.02_250)_0%,transparent_55%)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="bg-card rounded-xl border p-6 shadow-sm sm:p-8">
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <div className="relative size-9 overflow-hidden rounded-lg border">
              <Image
                src="/neerbottle-admin-icon.avif"
                alt="Neerbottle"
                fill
                className="object-cover"
                sizes="36px"
                priority
              />
            </div>
            <span className="text-foreground text-[22px] font-semibold tracking-tight">
              Neerbottle
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
                className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
                role="alert"
              >
                {formError}
              </motion.p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9876543210"
                maxLength={10}
                disabled={isSubmitting}
                aria-invalid={!!form.formState.errors.phone}
                className="h-11"
                {...form.register("phone")}
              />
              {form.formState.errors.phone ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.phone.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  aria-invalid={!!form.formState.errors.password}
                  className="h-11 pr-10"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center focus:outline-none"
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
              loadingText="Signing in…"
              className="mt-1 h-11 w-full"
            >
              Sign in
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
