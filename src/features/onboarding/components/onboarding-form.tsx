"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RequiredLabel } from "@/components/ui/required-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { cn, slugify } from "@/lib/utils";
import {
  checkSubdomainAvailabilityAction,
  submitRestaurantOnboarding,
} from "@/features/onboarding/actions";

type SubdomainState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken" }
  | { status: "invalid" };

export function OnboardingForm({ rootDomain }: { rootDomain: string }) {
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [dialCode, setDialCode] = useState("91");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("IN");
  const [subState, setSubState] = useState<SubdomainState>({ status: "idle" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Auto-suggest subdomain from restaurant name until the user edits it directly.
  useEffect(() => {
    if (!subdomainTouched) {
      setSubdomain(slugify(name).replace(/-/g, "").slice(0, 32));
    }
  }, [name, subdomainTouched]);

  // Debounced live subdomain availability check.
  useEffect(() => {
    if (!subdomain) {
      setSubState({ status: "idle" });
      return;
    }
    if (!/^[a-z0-9]{3,32}$/.test(subdomain)) {
      setSubState({ status: "invalid" });
      return;
    }
    setSubState({ status: "checking" });
    const handle = setTimeout(async () => {
      try {
        const result = await checkSubdomainAvailabilityAction(subdomain);
        if (result.reason === "invalid") {
          setSubState({ status: "invalid" });
        } else {
          setSubState({ status: result.available ? "available" : "taken" });
        }
      } catch {
        setSubState({ status: "idle" });
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [subdomain]);

  const sortedCountries = useMemo(() => COUNTRIES, []);

  const canSubmit =
    name.trim().length >= 2 &&
    subState.status === "available" &&
    ownerName.trim().length >= 2 &&
    /.+@.+\..+/.test(ownerEmail) &&
    /^[0-9]{6,15}$/.test(phone) &&
    address.trim().length >= 5 &&
    city.trim().length >= 1 &&
    country.length >= 2 &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Please complete all required fields correctly.");
      return;
    }
    setLoading(true);
    try {
      const result = await submitRestaurantOnboarding({
        name,
        subdomain,
        ownerName,
        ownerEmail,
        dialCode,
        phone,
        address,
        city,
        state: stateRegion,
        postalCode,
        country,
      });
      setDone(result.restaurantName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="h-14 w-14 text-green-500" />
          <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{done}</span> has been submitted. Our team
            will reach out at <span className="font-medium text-foreground">{ownerEmail}</span> with
            your login details to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Restaurant onboarding</CardTitle>
        <CardDescription>
          Tell us about your restaurant and we&apos;ll set up your account. Fields marked with{" "}
          <span className="text-destructive">*</span> are required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Restaurant
            </h3>
            <div className="space-y-2">
              <RequiredLabel htmlFor="name">Restaurant name</RequiredLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Coastal Kitchen"
              />
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="subdomain">Subdomain</RequiredLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => {
                    setSubdomainTouched(true);
                    setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                  }}
                  placeholder="coastalkitchen"
                  className="max-w-[220px]"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <span className="text-sm text-muted-foreground">.{rootDomain}</span>
              </div>
              <SubdomainHint state={subState} subdomain={subdomain} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Owner
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel htmlFor="ownerName">Full name</RequiredLabel>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="ownerEmail">Email</RequiredLabel>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="phone">Phone number</RequiredLabel>
              <div className="flex gap-2">
                <select
                  aria-label="Country code"
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value)}
                  className="h-10 w-[130px] rounded-md border border-input bg-background px-2 text-sm"
                >
                  {sortedCountries.map((c) => (
                    <option key={`${c.code}-${c.dial}`} value={c.dial}>
                      +{c.dial} {c.code}
                    </option>
                  ))}
                </select>
                <Input
                  id="phone"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="9876543210"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Address
            </h3>
            <div className="space-y-2">
              <RequiredLabel htmlFor="address">Street address</RequiredLabel>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Building, street, area"
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel htmlFor="city">City</RequiredLabel>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="state" required={false}>
                  State / Region
                </RequiredLabel>
                <Input
                  id="state"
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="postalCode" required={false}>
                  Postal code
                </RequiredLabel>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="country">Country</RequiredLabel>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {sortedCountries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Create my restaurant"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SubdomainHint({
  state,
  subdomain,
}: {
  state: SubdomainState;
  subdomain: string;
}) {
  if (!subdomain) return null;

  const base = "text-xs";
  switch (state.status) {
    case "checking":
      return (
        <p className={cn(base, "flex items-center gap-1 text-muted-foreground")}>
          <Loader2 className="h-3 w-3 animate-spin" /> Checking availability…
        </p>
      );
    case "available":
      return (
        <p className={cn(base, "flex items-center gap-1 text-green-600")}>
          <CheckCircle2 className="h-3 w-3" /> {subdomain} is available
        </p>
      );
    case "taken":
      return <p className={cn(base, "text-destructive")}>Subdomain already used. Try another.</p>;
    case "invalid":
      return (
        <p className={cn(base, "text-destructive")}>
          Use 3–32 lowercase letters and numbers only.
        </p>
      );
    default:
      return null;
  }
}
