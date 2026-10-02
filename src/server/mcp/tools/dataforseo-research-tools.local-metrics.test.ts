import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { fetchKeywordMetricsForList as FetchKeywordMetricsForList } from "@/server/lib/dataforseo/keyword-metrics";
import { getKeywordMetricsTool } from "./dataforseo-research-tools";
import { makeToolContext, textContent } from "./tool-test-support";

const mocks = vi.hoisted(() => ({
  createDataforseoClient: vi.fn(),
  getProjectForOrganization: vi.fn(),
  fetchSerpLocationsForCountry: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {},
}));

vi.mock("@/server/lib/dataforseo", async () => {
  const keywordMetrics = await vi.importActual<{
    fetchKeywordMetricsForList: typeof FetchKeywordMetricsForList;
  }>("@/server/lib/dataforseo/keyword-metrics");
  return {
    createDataforseoClient: mocks.createDataforseoClient,
    fetchKeywordMetricsForList: keywordMetrics.fetchKeywordMetricsForList,
  };
});

vi.mock("@/server/features/projects/services/ProjectService", () => ({
  ProjectService: {
    getProjectForOrganization: mocks.getProjectForOrganization,
  },
}));

vi.mock("@/server/lib/dataforseo/serp-locations", () => ({
  fetchSerpLocationsForCountry: mocks.fetchSerpLocationsForCountry,
}));

const toolContext = makeToolContext();
const ararat = "Ararat,Victoria,Australia";

const keywordRowsSchema = z
  .object({
    keywords: z.array(z.record(z.string(), z.unknown())),
  })
  .passthrough();

function keywordRows(result: { structuredContent?: unknown }) {
  return keywordRowsSchema.parse(result.structuredContent).keywords;
}

describe("get_keyword_metrics local locationName", () => {
  beforeEach(() => {
    mocks.getProjectForOrganization.mockResolvedValue({
      id: "project_1",
      locationCode: 2036,
      languageCode: "en",
    });
    mocks.fetchSerpLocationsForCountry.mockResolvedValue([
      {
        locationName: ararat,
        locationCode: 1007235,
        locationType: "City",
        displayLabel: "Ararat, Victoria, Australia",
      },
    ]);
  });

  it("returns national metrics with volume_scope national when locationName is omitted", async () => {
    const keywordOverview = vi.fn().mockResolvedValue([
      {
        keyword: "plumber",
        keyword_info: { search_volume: 12000, cpc: 8.1, competition: 0.4 },
        keyword_properties: { keyword_difficulty: 44 },
        search_intent_info: { main_intent: "transactional" },
      },
    ]);
    const adsSearchVolume = vi.fn();
    mocks.createDataforseoClient.mockReturnValue({
      labs: { keywordOverview },
      keywords: { adsSearchVolume },
    });

    const result = await getKeywordMetricsTool.handler(
      { projectId: "project_1", keywords: ["plumber"] },
      toolContext,
    );

    expect(adsSearchVolume).not.toHaveBeenCalled();
    expect(keywordOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: ["plumber"],
        locationCode: 2036,
        languageCode: "en",
      }),
    );
    expect(keywordRows(result)[0]).toMatchObject({
      keyword: "plumber",
      search_volume: 12000,
      keyword_difficulty: 44,
      volume_scope: "national",
    });
    expect(textContent(result)).toContain("(national volume)");
  });

  it("overlays Ararat Google Ads volume while keeping national KD and country locationCode", async () => {
    const keywordOverview = vi.fn().mockResolvedValue([
      {
        keyword: "plumber",
        keyword_info: { search_volume: 12000, cpc: 8.1, competition: 0.4 },
        keyword_properties: { keyword_difficulty: 44 },
        search_intent_info: { main_intent: "transactional" },
      },
    ]);
    const adsSearchVolume = vi.fn().mockResolvedValue([
      {
        keyword: "plumber",
        search_volume: 70,
        cpc: 4.2,
        competition: "MEDIUM",
        competition_index: 35,
      },
    ]);
    mocks.createDataforseoClient.mockReturnValue({
      labs: { keywordOverview },
      keywords: { adsSearchVolume },
    });

    const result = await getKeywordMetricsTool.handler(
      {
        projectId: "project_1",
        keywords: ["plumber"],
        locationCode: 2036,
        locationName: ararat,
      },
      toolContext,
    );

    expect(mocks.fetchSerpLocationsForCountry).toHaveBeenCalledWith("au");
    expect(adsSearchVolume).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: ["plumber"],
        locationCode: 2036,
        languageCode: "en",
        locationName: ararat,
      }),
    );
    expect(keywordOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: ["plumber"],
        locationCode: 2036,
        languageCode: "en",
      }),
    );
    expect(keywordRows(result)[0]).toMatchObject({
      keyword: "plumber",
      search_volume: 70,
      cpc: 4.2,
      competition: 0.35,
      keyword_difficulty: 44,
      main_intent: "transactional",
      volume_scope: "local",
    });
    expect(textContent(result)).toContain("(local volume)");
  });

  it("leaves missing local Ads volume null instead of substituting national volume", async () => {
    const keywordOverview = vi.fn().mockResolvedValue([
      {
        keyword: "plumber",
        keyword_info: { search_volume: 12000, cpc: 8.1 },
        keyword_properties: { keyword_difficulty: 44 },
        search_intent_info: { main_intent: "transactional" },
      },
      {
        keyword: "emergency plumber",
        keyword_info: { search_volume: 5400, cpc: 11.2 },
        keyword_properties: { keyword_difficulty: 21 },
        search_intent_info: { main_intent: "transactional" },
      },
    ]);
    const adsSearchVolume = vi.fn().mockResolvedValue([
      {
        keyword: "plumber",
        search_volume: 70,
        cpc: 4.2,
        competition_index: 35,
      },
    ]);
    mocks.createDataforseoClient.mockReturnValue({
      labs: { keywordOverview },
      keywords: { adsSearchVolume },
    });

    const result = await getKeywordMetricsTool.handler(
      {
        projectId: "project_1",
        keywords: ["plumber", "emergency plumber"],
        locationName: ararat,
      },
      toolContext,
    );

    expect(keywordRows(result)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "plumber",
          search_volume: 70,
          volume_scope: "local",
        }),
        expect.objectContaining({
          keyword: "emergency plumber",
          search_volume: null,
          cpc: null,
          keyword_difficulty: 21,
          volume_scope: "local",
        }),
      ]),
    );
  });

  it("rejects a non-canonical location before any paid metrics call", async () => {
    const keywordOverview = vi.fn();
    const adsSearchVolume = vi.fn();
    mocks.createDataforseoClient.mockReturnValue({
      labs: { keywordOverview },
      keywords: { adsSearchVolume },
    });

    await expect(
      getKeywordMetricsTool.handler(
        {
          projectId: "project_1",
          keywords: ["plumber"],
          locationName: "Not A Real Place,Australia",
        },
        toolContext,
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_LOCATION" });
    expect(adsSearchVolume).not.toHaveBeenCalled();
    expect(keywordOverview).not.toHaveBeenCalled();
  });
});
