import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { CreditFeature } from "@/shared/billing-credit-features";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import {
  fetchKeywordMetricsForList,
  type KeywordMetricRow,
} from "@/server/lib/dataforseo/keyword-metrics";
import type { ResolvedResearchKeywordsInput } from "@/types/schemas/keywords";
import { normalizeIntent, type EnrichedKeyword } from "./helpers";

/**
 * Discovery stays on the country locationCode. When a local target is set,
 * replace volume/CPC/competition with Google Ads geotargeted metrics and keep
 * Labs KD/intent. Missing Ads rows stay null rather than showing national
 * volume under a city label.
 */
export function applyLocalVolumeOverlay(
  rows: EnrichedKeyword[],
  metrics: KeywordMetricRow[],
): EnrichedKeyword[] {
  const byKeyword = new Map(
    metrics.map((row) => [row.keyword.toLowerCase(), row]),
  );

  return rows.map((row) => {
    const metric = byKeyword.get(row.keyword);
    if (!metric) {
      return {
        ...row,
        searchVolume: null,
        cpc: null,
        competition: null,
        trend: [],
        volumeScope: "local",
      };
    }

    return {
      ...row,
      searchVolume: metric.searchVolume,
      cpc: metric.cpc,
      competition: metric.competition,
      trend: metric.monthlySearches,
      keywordDifficulty: metric.keywordDifficulty ?? row.keywordDifficulty,
      intent: metric.intent ? normalizeIntent(metric.intent) : row.intent,
      volumeScope: "local",
    };
  });
}

export async function overlayLocalKeywordVolumes(
  rows: EnrichedKeyword[],
  input: ResolvedResearchKeywordsInput,
  billingCustomer: BillingCustomerContext,
  creditFeature?: CreditFeature,
): Promise<EnrichedKeyword[]> {
  if (!input.locationName || rows.length === 0) return rows;

  const client = createDataforseoClient(billingCustomer);
  const metrics = await fetchKeywordMetricsForList(client, {
    keywords: rows.map((row) => row.keyword),
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    locationName: input.locationName,
    includeClickstreamData: input.clickstream,
    creditFeature: creditFeature ?? "keyword_research",
  });

  return applyLocalVolumeOverlay(rows, metrics);
}
