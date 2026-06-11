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
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "CHF", label: "CHF - Swiss Franc" },
  { code: "SEK", label: "SEK - Swedish Krona" },
  { code: "NOK", label: "NOK - Norwegian Krone" },
  { code: "DKK", label: "DKK - Danish Krone" },
  { code: "PLN", label: "PLN - Polish Zloty" },
  { code: "CZK", label: "CZK - Czech Koruna" },
  { code: "HUF", label: "HUF - Hungarian Forint" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "JPY", label: "JPY - Japanese Yen" },
  { code: "CNY", label: "CNY - Chinese Yuan" },
  { code: "NGN", label: "NGN - Nigerian Naira" },
  { code: "ZAR", label: "ZAR - South African Rand" },
  { code: "KES", label: "KES - Kenyan Shilling" },
];

const TIMEZONES = [
  { value: "Europe/London",       label: "GMT/BST - London (+0/+1)" },
  { value: "Europe/Paris",        label: "CET/CEST - Paris, Berlin, Rome (+1/+2)" },
  { value: "Europe/Berlin",       label: "CET/CEST - Berlin (+1/+2)" },
  { value: "Europe/Amsterdam",    label: "CET/CEST - Amsterdam (+1/+2)" },
  { value: "Europe/Warsaw",       label: "CET/CEST - Warsaw (+1/+2)" },
  { value: "Europe/Stockholm",    label: "CET/CEST - Stockholm (+1/+2)" },
  { value: "Europe/Madrid",       label: "CET/CEST - Madrid (+1/+2)" },
  { value: "Europe/Rome",         label: "CET/CEST - Rome (+1/+2)" },
  { value: "Europe/Zurich",       label: "CET/CEST - Zurich (+1/+2)" },
  { value: "Europe/Athens",       label: "EET/EEST - Athens (+2/+3)" },
  { value: "Europe/Helsinki",     label: "EET/EEST - Helsinki (+2/+3)" },
  { value: "America/New_York",    label: "EST/EDT - New York (-5/-4)" },
  { value: "America/Chicago",     label: "CST/CDT - Chicago (-6/-5)" },
  { value: "America/Los_Angeles", label: "PST/PDT - Los Angeles (-8/-7)" },
  { value: "Asia/Dubai",          label: "Gulf Standard Time (+4)" },
  { value: "Asia/Singapore",      label: "Singapore Time (+8)" },
  { value: "Africa/Nairobi",      label: "East Africa Time (+3)" },
  { value: "Africa/Lagos",        label: "West Africa Time (+1)" },
  { value: "UTC",                 label: "UTC (+0)" },
];

const COUNTRIES = [
  { code: "GB", label: "United Kingdom" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
  { code: "CH", label: "Switzerland" },
  { code: "AT", label: "Austria" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "PL", label: "Poland" },
  { code: "CZ", label: "Czech Republic" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "PT", label: "Portugal" },
  { code: "IE", label: "Ireland" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "NG", label: "Nigeria" },
  { code: "ZA", label: "South Africa" },
  { code: "KE", label: "Kenya" },
  { code: "OTHER", label: "Other" },
];

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-3 border-b border-slate-100">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  );
}

export function OrgForm({ org }: { org: OrgDetail }) {
  const [name,     setName]     = useState(org.name);
  const [industry, setIndustry] = useState(org.industry ?? "");
  const [phone,    setPhone]    = useState(org.phone ?? "");
  const [email,    setEmail]    = useState(org.email ?? "");
  const [address,  setAddress]  = useState(org.address ?? "");
  const [website,  setWebsite]  = useState(org.website ?? "");
  const [taxId,    setTaxId]    = useState(org.taxId ?? "");
  const [country,  setCountry]  = useState(org.country);
  const [currency, setCurrency] = useState(org.currency);
  const [timezone, setTimezone] = useState(org.timezone);
  const [vatRate,  setVatRate]  = useState(String(org.vatRate));
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
      phone:    phone    || undefined,
      email:    email    || undefined,
      address:  address  || undefined,
      website:  website  || undefined,
      taxId:    taxId    || undefined,
      country,
      currency,
      timezone,
      vatRate:  Number(vatRate) || 0,
    });
    setLoading(false);
    if (!result.success) { setError(result.error); } else { setSuccess(true); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Section 1: Identity */}
      <div className="space-y-4">
        <SectionHeading
          title="Identity"
          description="How your organization appears across the platform and on receipts."
        />
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Organization name *</Label>
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
              <SelectValue placeholder="Select industry..." />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Section 2: Contact details */}
      <div className="space-y-4">
        <SectionHeading
          title="Contact details"
          description="Shown on receipts, invoices, and purchase orders."
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-phone">Phone <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              id="org-phone"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); touch(); }}
              placeholder="e.g. +33 1 23 45 67 89"
              maxLength={50}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-email">Email <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              id="org-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); touch(); }}
              placeholder="e.g. contact@mybusiness.com"
              maxLength={200}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="org-address">Address <span className="text-slate-400 font-normal">(optional)</span></Label>
          <Input
            id="org-address"
            value={address}
            onChange={(e) => { setAddress(e.target.value); touch(); }}
            placeholder="e.g. 12 Rue de Rivoli, 75001 Paris"
            maxLength={300}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="org-website">Website <span className="text-slate-400 font-normal">(optional)</span></Label>
          <Input
            id="org-website"
            value={website}
            onChange={(e) => { setWebsite(e.target.value); touch(); }}
            placeholder="e.g. https://mybusiness.com"
            maxLength={200}
          />
        </div>
      </div>

      {/* Section 3: Regional & Tax */}
      <div className="space-y-4">
        <SectionHeading
          title="Regional and tax settings"
          description="Controls currency, timezone, and how VAT is calculated and displayed."
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select value={country} onValueChange={(v) => { setCountry(v); touch(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-vat">VAT rate (%)</Label>
            <Input
              id="org-vat"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={vatRate}
              onChange={(e) => { setVatRate(e.target.value); touch(); }}
              placeholder="e.g. 20"
            />
            <p className="text-[11px] text-slate-400">Used on receipts and when calculating VAT from totals.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-taxid">Tax / VAT reg. no. <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              id="org-taxid"
              value={taxId}
              onChange={(e) => { setTaxId(e.target.value); touch(); }}
              placeholder="e.g. FR12345678900"
              maxLength={50}
            />
            <p className="text-[11px] text-slate-400">Printed on receipts and invoices.</p>
          </div>
        </div>
      </div>

      {/* Section 4: Internal */}
      <div className="space-y-4">
        <SectionHeading
          title="Internal"
          description="System-level settings that cannot be changed after registration."
        />
        <div className="space-y-1.5">
          <Label className="text-slate-500 text-xs uppercase tracking-wide">URL Slug</Label>
          <Input
            value={org.slug}
            disabled
            className="font-mono text-sm text-slate-400 bg-slate-50"
          />
          <p className="text-xs text-slate-400">Set at registration and cannot be changed.</p>
        </div>
      </div>

      {error   && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Organization settings saved.</p>}

      <Button type="submit" disabled={loading} size="sm">
        {loading ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
