export const COUNTRIES = [
  { code: "GB", name: "United Kingdom", currency: "GBP", timezone: "Europe/London" },
  { code: "DE", name: "Germany", currency: "EUR", timezone: "Europe/Berlin" },
  { code: "FR", name: "France", currency: "EUR", timezone: "Europe/Paris" },
  { code: "NL", name: "Netherlands", currency: "EUR", timezone: "Europe/Amsterdam" },
  { code: "SE", name: "Sweden", currency: "SEK", timezone: "Europe/Stockholm" },
  { code: "NO", name: "Norway", currency: "NOK", timezone: "Europe/Oslo" },
  { code: "DK", name: "Denmark", currency: "DKK", timezone: "Europe/Copenhagen" },
  { code: "PL", name: "Poland", currency: "PLN", timezone: "Europe/Warsaw" },
  { code: "ES", name: "Spain", currency: "EUR", timezone: "Europe/Madrid" },
  { code: "IT", name: "Italy", currency: "EUR", timezone: "Europe/Rome" },
  { code: "PT", name: "Portugal", currency: "EUR", timezone: "Europe/Lisbon" },
  { code: "BE", name: "Belgium", currency: "EUR", timezone: "Europe/Brussels" },
  { code: "AT", name: "Austria", currency: "EUR", timezone: "Europe/Vienna" },
  { code: "CH", name: "Switzerland", currency: "CHF", timezone: "Europe/Zurich" },
  { code: "US", name: "United States", currency: "USD", timezone: "America/New_York" },
  { code: "CA", name: "Canada", currency: "CAD", timezone: "America/Toronto" },
  { code: "AU", name: "Australia", currency: "AUD", timezone: "Australia/Sydney" },
  { code: "NZ", name: "New Zealand", currency: "NZD", timezone: "Pacific/Auckland" },
  { code: "SG", name: "Singapore", currency: "SGD", timezone: "Asia/Singapore" },
  { code: "IN", name: "India", currency: "INR", timezone: "Asia/Kolkata" },
  { code: "NG", name: "Nigeria", currency: "NGN", timezone: "Africa/Lagos" },
  { code: "GH", name: "Ghana", currency: "GHS", timezone: "Africa/Accra" },
  { code: "ZA", name: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg" },
  { code: "KE", name: "Kenya", currency: "KES", timezone: "Africa/Nairobi" },
  { code: "UG", name: "Uganda", currency: "UGX", timezone: "Africa/Kampala" },
  { code: "TZ", name: "Tanzania", currency: "TZS", timezone: "Africa/Dar_es_Salaam" },
  { code: "RW", name: "Rwanda", currency: "RWF", timezone: "Africa/Kigali" },
  { code: "ET", name: "Ethiopia", currency: "ETB", timezone: "Africa/Addis_Ababa" },
  { code: "Other", name: "Other", currency: "USD", timezone: "UTC" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export function getCountry(code: string) {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1];
}
