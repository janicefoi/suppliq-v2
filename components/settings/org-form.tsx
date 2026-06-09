"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { updateOrganization } from "@/lib/actions/settings";
import type { OrgDetail } from "@/lib/actions/settings";

const INDUSTRIES = [
  "Retail / General Trade",
  "Automotive",
  "Hardware & Construction",
  "Pharmacy / Healthcare",
  "Electronics",
  "Agriculture",
  "Hospitality",
  "Fashion & Apparel",
  "Wholesale & Distribution",
  "Manufacturing",
  "Other",
];

const CURRENCIES = [
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "UGX", label: "UGX — Ugandan Shilling" },
  { code: "TZS", label: "TZS — Tanzanian Shilling" },
  { code: "RWF", label: "RWF — Rwandan Franc" },
  { code: "NGN", label: "NGN — Nigerian Naira" },
  { code: "GHS", label: "GHS — Ghanaian Cedi" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
];

const TIMEZONES = [
  { value: "Africa/Nairobi",       label: "East Africa Time (EAT +3)" },
  { value: "Africa/Kampala",       label: "East Africa Time — Kampala (+3)" },
  { value: "Africa/Dar_es_Salaam", label: "East Africa Time — Dar es Salaam (+3)" },
  { value: "Africa/Kigali",        label: "East Africa Time — Kigali (+3)" },
  { value: "Africa/Johannesburg",  label: "South Africa Standard Time (+2)" },
  { value: "Africa/Cairo",         label: "Eastern European Time — Cairo (+2)" },
  { value: "Africa/Lagos",         label: "West Africa Time (WAT +1)" },
  { value: "Africa/Accra",         label: "Greenwich Mean Time — Accra (+0)" },
  { value: "UTC",                  label: "UTC (+0)" },
];

const COUNTRIES = [
  { code: "KE", label: "Kenya" },
  { code: "UG", label: "Uganda" },
  { code: "TZ", label: "Tanzania" },
  { code: "RW", label: "Rwanda" },
  { code: "NG", label: "Nigeria" },
  { code: "ZA", label: "South Africa" },
  { code: "GH", label: "Ghana" },
  { code: "ET", label: "Ethiopia" },
  { code: "ZM", label: "Zambia" },
  { code: "ZW", label: "Zimbabwe" },
  { code: "OTHER", label: "Other" },
];

export function OrgForm({ org }: { org: OrgDetail }) {
  const [name,     setName]     = useState(org.name);
  const [industry, setIndustry] = useState(org.industry ?? "");
  const [currency, setCurrency] = useState(org.currency);
  const [timezone, setTimezone] = useState(org.timezone);
  const [country,  setCountry]  = useState(org.country);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  function touch() { setSuccess(false); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    const result = await updateOrganization({
      name,
      industry: industry || undefined,
      currency,
      timezone,
      country,
    });
    setLoading(false);
    if (!result.success) { setError(result.error); } else { setSuccess(true); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => { setName(e.target.value); touch(); }}
          maxLength={200}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Industry</Label>
        <Select value={industry} onValueChange={(v) => { setIndustry(v); touch(); }}>
          <SelectTrigger>
            <SelectValue placeholder="Select industry…" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((ind) => (
              <SelectItem key={ind} value={ind}>{ind}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={country} onValueChange={(v) => { setCountry(v); touch(); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={(v) => { setCurrency(v); touch(); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={(v) => { setTimezone(v); touch(); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-500 text-xs uppercase tracking-wide">URL Slug</Label>
        <Input
          value={org.slug}
          disabled
          className="font-mono text-sm text-slate-400 bg-slate-50"
        />
        <p className="text-xs text-slate-400">
          The slug is set at registration and cannot be changed.
        </p>
      </div>

      {error   && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Organization settings saved.</p>}

      <Button type="submit" disabled={loading} size="sm">
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
