import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ai } from "@/lib/ai/client";
import { MarketClient } from "@/components/insights/market-client";

export const metadata = { title: "Market Intelligence | SUPPLIQ" };

export type NewsArticle = {
  title: string;
  url: string;
  content: string;
  published_at: string | null;
  source: string;
  summary: string;
  relevance_score: number;
  impact: "positive" | "negative" | "neutral";
  tags: string[];
};

export type CommodityPrice = {
  commodity: string;
  price: number;
  currency: string;
  change_pct_24h: number | null;
  source: string;
  fetched_at: string;
};

export type PriceAlert = {
  commodity: string;
  change_pct: number;
  message: string;
  severity: "warning" | "info";
};

export default async function MarketPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  const orgId = session.user.organizationId;

  // Fetch both endpoints in parallel — news can be slow (Claude enrichment)
  // so the two independent fetches overlap.
  const [newsResult, marketResult] = await Promise.all([
    ai.get<{ articles: NewsArticle[]; count: number }>(
      `/intelligence/news?organization_id=${orgId}&limit=5`
    ),
    ai.get<{
      commodities: Record<string, CommodityPrice>;
      fx_rates: Record<string, CommodityPrice>;
      alerts: PriceAlert[];
      fetched_at: string;
      base_currency: string;
    }>(`/intelligence/market-prices/${orgId}`),
  ]);

  const unavailable = (!newsResult.ok && newsResult.unavailable)
    || (!marketResult.ok && marketResult.unavailable);

  return (
    <MarketClient
      articles={newsResult.ok ? newsResult.data.articles : []}
      commodities={marketResult.ok ? marketResult.data.commodities : {}}
      fxRates={marketResult.ok ? marketResult.data.fx_rates : {}}
      alerts={marketResult.ok ? marketResult.data.alerts : []}
      baseCurrency={marketResult.ok ? marketResult.data.base_currency : (session.user.currency ?? "EUR")}
      fetchedAt={marketResult.ok ? marketResult.data.fetched_at : null}
      unavailable={unavailable}
      newsUnavailable={!newsResult.ok}
      marketUnavailable={!marketResult.ok}
    />
  );
}
