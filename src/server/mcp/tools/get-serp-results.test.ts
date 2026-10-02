import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSerpResultsTool } from "./get-serp-results";
import { makeToolContext, textContent } from "./tool-test-support";

const mocks = vi.hoisted(() => ({
  getProjectForOrganization: vi.fn(),
  createDataforseoClient: vi.fn(),
  fetchSerpLocationsForCountry: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: mocks.createDataforseoClient,
  SERP_ANALYSIS_DEPTH: 20,
}));
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

function okItems(result: {
  structuredContent?: { results?: Array<{ ok?: boolean; items?: unknown[] }> };
}) {
  const first = result.structuredContent?.results?.[0];
  if (!first || first.ok !== true) {
    throw new Error("expected a successful SERP result");
  }
  return first.items ?? [];
}

describe("get_serp_results rank evidence", () => {
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

  it("keeps organic and non-organic types distinguishable with both rank fields", async () => {
    const live = vi.fn().mockResolvedValue([
      {
        type: "organic",
        rank_group: 2,
        rank_absolute: 5,
        domain: "example.com",
        title: "Example",
        url: "https://example.com/",
        description: "An organic result",
      },
      {
        type: "local_pack",
        rank_group: 1,
        rank_absolute: 3,
        domain: "maps.google.com",
        title: "Local pack listing",
        url: "https://maps.google.com/?cid=1",
        description: null,
      },
    ]);
    mocks.createDataforseoClient.mockReturnValue({ serp: { live } });

    const result = await getSerpResultsTool.handler(
      { projectId: "project_1", queries: [{ keyword: "newborn photos" }] },
      toolContext,
    );

    expect(okItems(result)).toEqual([
      {
        type: "organic",
        rankGroup: 2,
        rankAbsolute: 5,
        rank: 5,
        domain: "example.com",
        title: "Example",
        url: "https://example.com/",
        description: "An organic result",
      },
      {
        type: "local_pack",
        rankGroup: 1,
        rankAbsolute: 3,
        rank: 3,
        domain: "maps.google.com",
        title: "Local pack listing",
        url: "https://maps.google.com/?cid=1",
        description: null,
      },
    ]);
    const out = textContent(result);
    expect(out).toContain(
      "type | rank_group | rank_absolute | rank | domain | title | url",
    );
    expect(out).toContain("organic | 2 | 5 | 5 | example.com");
    expect(out).toContain("local_pack | 1 | 3 | 3");
  });

  it("falls back to rankGroup when rankAbsolute is missing", async () => {
    const live = vi.fn().mockResolvedValue([
      {
        type: "organic",
        rank_group: 4,
        domain: "example.com",
        title: "Example",
        url: "https://example.com/",
      },
    ]);
    mocks.createDataforseoClient.mockReturnValue({ serp: { live } });

    const result = await getSerpResultsTool.handler(
      { projectId: "project_1", queries: [{ keyword: "seo tools" }] },
      toolContext,
    );

    expect(okItems(result)[0]).toMatchObject({
      type: "organic",
      rankGroup: 4,
      rankAbsolute: null,
      rank: 4,
    });
  });

  it("passes a canonical locationName through to live SERP without replacing the country", async () => {
    const live = vi.fn().mockResolvedValue([]);
    mocks.createDataforseoClient.mockReturnValue({ serp: { live } });

    await getSerpResultsTool.handler(
      {
        projectId: "project_1",
        queries: [
          {
            keyword: "newborn photographer",
            locationCode: 2036,
            locationName: ararat,
          },
        ],
        depth: 100,
      },
      toolContext,
    );

    expect(live).toHaveBeenCalledWith({
      keyword: "newborn photographer",
      locationCode: 2036,
      languageCode: "en",
      locationName: ararat,
      depth: 100,
    });
  });
});
