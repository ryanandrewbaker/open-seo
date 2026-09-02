import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeywordMetricRow } from "@/server/lib/dataforseo/keyword-metrics";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { EnrichedKeyword } from "./helpers";

const mocks = vi.hoisted(() => ({
  fetchKeywordMetricsForList: vi.fn(),
  createDataforseoClient: vi.fn(() => ({})),
}));

vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: mocks.createDataforseoClient,
}));

vi.mock("@/server/lib/dataforseo/keyword-metrics", () => ({
  fetchKeywordMetricsForList: mocks.fetchKeywordMetricsForList,
}));

import {
  applyLocalVolumeOverlay,
  overlayLocalKeywordVolumes,
} from "./research-local-volume";

function nationalRow(
  keyword: string,
  overrides: Partial<EnrichedKeyword> = {},
): EnrichedKeyword {
  return {
    keyword,
    searchVolume: 10_000,
    trend: [{ year: 2026, month: 1, searchVolume: 10_000 }],
    cpc: 4.5,
    competition: 0.4,
    keywordDifficulty: 42,
    intent: "commercial",
    volumeScope: "national",
    ...overrides,
  };
}

function metric(
  keyword: string,
  overrides: Partial<KeywordMetricRow> = {},
): KeywordMetricRow {
  return {
    keyword,
    searchVolume: 80,
    cpc: 2.1,
    competition: 0.2,
    competitionLevel: "LOW",
    keywordDifficulty: 42,
    intent: "commercial",
    monthlySearches: [{ year: 2026, month: 1, searchVolume: 80 }],
    ...overrides,
  };
}

const billingCustomer: BillingCustomerContext = {
  organizationId: "org_123",
  userId: "user_123",
  userEmail: "alice@example.com",
};

describe("applyLocalVolumeOverlay", () => {
  it("replaces national volume with local Ads metrics and marks scope local", () => {
    const rows = applyLocalVolumeOverlay(
      [nationalRow("newborn photographer")],
      [metric("newborn photographer")],
    );

    expect(rows[0]).toMatchObject({
      keyword: "newborn photographer",
      searchVolume: 80,
      cpc: 2.1,
      competition: 0.2,
      keywordDifficulty: 42,
      volumeScope: "local",
    });
  });

  it("does not label national volume as city volume when Ads omits a keyword", () => {
    const rows = applyLocalVolumeOverlay(
      [nationalRow("newborn photographer melbourne")],
      [],
    );

    expect(rows[0]).toMatchObject({
      keyword: "newborn photographer melbourne",
      searchVolume: null,
      cpc: null,
      competition: null,
      trend: [],
      keywordDifficulty: 42,
      intent: "commercial",
      volumeScope: "local",
    });
  });
});

describe("overlayLocalKeywordVolumes", () => {
  beforeEach(() => {
    mocks.fetchKeywordMetricsForList.mockReset();
    mocks.createDataforseoClient.mockClear();
  });

  it("sends locationName into keyword metrics for Ararat", async () => {
    mocks.fetchKeywordMetricsForList.mockResolvedValue([
      metric("newborn photographer"),
    ]);

    await overlayLocalKeywordVolumes(
      [nationalRow("newborn photographer")],
      {
        projectId: "project_1",
        keywords: ["newborn photographer"],
        locationCode: 2036,
        languageCode: "en",
        locationName: "Ararat,Victoria,Australia",
        resultLimit: 150,
        mode: "auto",
        clickstream: false,
      },
      billingCustomer,
    );

    expect(mocks.fetchKeywordMetricsForList).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        locationCode: 2036,
        languageCode: "en",
        locationName: "Ararat,Victoria,Australia",
        keywords: ["newborn photographer"],
      }),
    );
  });

  it("skips the overlay when no local target is set", async () => {
    const rows = [nationalRow("newborn photographer")];
    const result = await overlayLocalKeywordVolumes(
      rows,
      {
        projectId: "project_1",
        keywords: ["newborn photographer"],
        locationCode: 2036,
        languageCode: "en",
        resultLimit: 150,
        mode: "auto",
        clickstream: false,
      },
      billingCustomer,
    );

    expect(result).toBe(rows);
    expect(mocks.fetchKeywordMetricsForList).not.toHaveBeenCalled();
  });
});
