"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas";
import { registerOwner } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils } from "lucide-react";
import { toast } from "sonner";
import { generateSubdomain } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      restaurantName: "",
      subdomain: "",
    },
  });

  const restaurantName = form.watch("restaurantName");

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    try {
      const result = await registerOwner(data);

      const signInResult = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (signInResult.error) {
        toast.error("Account created but login failed. Please sign in manually.");
        router.push("/login");
        return;
      }

      toast.success("Restaurant created! Welcome aboard.");
      window.location.href = result.redirectUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Utensils className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Create Your Restaurant</CardTitle>
        <CardDescription>Start your 14-day free trial today</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <RequiredLabel htmlFor="name">Your Name</RequiredLabel>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="email">Email</RequiredLabel>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="password">Password</RequiredLabel>
            <Input id="password" type="password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="restaurantName">Restaurant Name</RequiredLabel>
            <Input
              id="restaurantName"
              {...form.register("restaurantName")}
              onChange={(e) => {
                form.setValue("restaurantName", e.target.value);
                if (!form.getValues("subdomain")) {
                  form.setValue("subdomain", generateSubdomain(e.target.value));
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="subdomain">Subdomain</RequiredLabel>
            <div className="flex items-center gap-2">
              <Input id="subdomain" {...form.register("subdomain")} />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.mydomain.com</span>
            </div>
            {form.formState.errors.subdomain && (
              <p className="text-sm text-destructive">{form.formState.errors.subdomain.message}</p>
            )}
            {restaurantName && (
              <p className="text-xs text-muted-foreground">
                Your menu: {form.watch("subdomain") || generateSubdomain(restaurantName)}.mydomain.com/menu
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Start Free Trial"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline">
            Sign In
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
