"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Shield } from "lucide-react";

import { loginSchema, type LoginValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

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
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-muted/40 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="border-border/80 shadow-lg">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Shield className="size-6" aria-hidden />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Sign in to ProAdmin
            </CardTitle>
            <CardDescription>
              Sign in with owner or admin credentials.
            </CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <CardContent className="grid gap-4">
              {formError ? (
                <p
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {formError}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone (10 digits)</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="9876543210"
                  maxLength={10}
                  aria-invalid={!!form.formState.errors.phone}
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
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!form.formState.errors.password}
                  {...form.register("password")}
                />
                {form.formState.errors.password ? (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
                aria-busy={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Signing in…" : "Continue"}
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                Ensure your backend URL is set in the app environment.
              </p>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
