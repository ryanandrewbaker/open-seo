import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { EnrichedKeyword } from "./helpers";

const mocks = vi.hoisted(() => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  buildCacheKey: vi.fn(),
  fetchResearchRowsBySource: vi.fn(),
  overlayLocalKeywordVolumes: vi.fn(),
  upsertKeywordMetric: vi.fn(),
}));

vi.mock("@/server/lib/r2-cache", () => ({
  CACHE_TTL: { researchResult: 60 },
  buildCacheKey: mocks.buildCacheKey,
  getCached: mocks.getCached,
  setCached: mocks.setCached,
}));

vi.mock("./research-data", () => ({
  fetchResearchRowsBySource: mocks.fetchResearchRowsBySource,
  fetchGoogleAdsResearchRows: vi.fn(),
}));

vi.mock("./research-local-volume", () => ({
  overlayLocalKeywordVolumes: mocks.overlayLocalKeywordVolumes,
}));

vi.mock(
  "@/server/features/keywords/repositories/KeywordResearchRepository",
  () => ({
    KeywordResearchRepository: {
      upsertKeywordMetric: mocks.upsertKeywordMetric,
    },
  }),
);

import { research } from "./research";

const billingCustomer: BillingCustomerContext = {
  organizationId: "org_123",
  userId: "user_123",
  userEmail: "alice@example.com",
};

const nationalRow = (keyword: string): EnrichedKeyword => ({
  keyword,
  searchVolume: 12_000,
  trend: [],
  cpc: 3,
  competition: 0.3,
  keywordDifficulty: 40,
  intent: "informational",
  volumeScope: "national",
});

function discoveryRows(): EnrichedKeyword[] {
  return [
    nationalRow("newborn photographer"),
    nationalRow("newborn photography"),
    nationalRow("baby photographer"),
    nationalRow("newborn photos"),
    nationalRow("newborn photo shoot"),
    nationalRow("newborn portraits"),
  ];
}

const australiaInput = {
  projectId: "project_1",
  keywords: ["newborn photographer"],
  locationCode: 2036,
  languageCode: "en",
  resultLimit: 150 as const,
  mode: "auto" as const,
  clickstream: false,
};

describe("keyword research local targeting", () => {
  beforeEach(() => {
    mocks.getCached.mockReset().mockResolvedValue(null);
    mocks.setCached.mockReset().mockResolvedValue(undefined);
    mocks.buildCacheKey.mockReset().mockResolvedValue("cache-key");
    mocks.fetchResearchRowsBySource
      .mockReset()
      .mockResolvedValue(discoveryRows());
    mocks.overlayLocalKeywordVolumes
      .mockReset()
      .mockImplementation(async (rows: EnrichedKeyword[]) =>
        rows.map((row) => ({ ...row, searchVolume: 40, volumeScope: "local" })),
      );
    mocks.upsertKeywordMetric.mockReset().mockResolvedValue(undefined);
  });

  it("keeps discovery on the country and does not overlay when locationName is omitted", async () => {
    await research(australiaInput, billingCustomer);

    expect(mocks.fetchResearchRowsBySource).toHaveBeenCalledWith(
      expect.objectContaining({
        locationCode: 2036,
        languageCode: "en",
      }),
      billingCustomer,
    );
    expect(
      mocks.fetchResearchRowsBySource.mock.calls[0]?.[0],
    ).not.toHaveProperty("locationName");
    expect(mocks.overlayLocalKeywordVolumes).not.toHaveBeenCalled();
  });

  it("sends the canonical local target into the volume overlay for Ararat", async () => {
    const result = await research(
      {
        ...australiaInput,
        locationName: "Ararat,Victoria,Australia",
      },
      billingCustomer,
    );

    expect(mocks.overlayLocalKeywordVolumes).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        locationCode: 2036,
        locationName: "Ararat,Victoria,Australia",
      }),
      billingCustomer,
      undefined,
    );
    expect(result.rows[0]?.volumeScope).toBe("local");
    expect(result.rows[0]?.searchVolume).toBe(40);
  });

  it("does not persist local volumes onto country-keyed keyword metrics", async () => {
    await research(
      {
        ...australiaInput,
        locationName: "Ararat,Victoria,Australia",
      },
      billingCustomer,
    );

    expect(mocks.upsertKeywordMetric).not.toHaveBeenCalled();
  });
});
