import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSerpResultsTool } from "./get-serp-results";
import { makeToolContext, textContent } from "./tool-test-support";

const mocks = vi.hoisted(() => ({
  getProjectForOrganization: vi.fn(),
  createDataforseoClient: vi.fn(),
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

const toolContext = makeToolContext();

function okItems(result: {
  structuredContent?: { results?: Array<{ ok?: boolean; items?: unknown[] }> };
}) {
  const first = result.structuredContent?.results?.[0];
  if (!first || first.ok !== true) {
    throw new Error("expected a successful SERP result");
  }
  return first.items ?? [];
}

describe("get_serp_results MCP evidence", () => {
  beforeEach(() => {
    mocks.getProjectForOrganization.mockResolvedValue({
      id: "project_1",
      locationCode: 2840,
      languageCode: "en",
    });
  });

  it("preserves type, rankGroup, and rankAbsolute for organic items", async () => {
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
    ]);
    mocks.createDataforseoClient.mockReturnValue({ serp: { live } });

    const result = await getSerpResultsTool.handler(
      { projectId: "project_1", queries: [{ keyword: "seo tools" }] },
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
    ]);
  });

  it("preserves a non-organic SERP type instead of relabelling it organic", async () => {
    const live = vi.fn().mockResolvedValue([
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

    const [item] = okItems(result);
    expect(item).toMatchObject({
      type: "local_pack",
      rankGroup: 1,
      rankAbsolute: 3,
      rank: 3,
    });
    expect(item).not.toMatchObject({ type: "organic" });
  });

  it("exposes type and both rank fields in the text table", async () => {
    const live = vi.fn().mockResolvedValue([
      {
        type: "organic",
        rank_group: 2,
        rank_absolute: 5,
        domain: "example.com",
        title: "Example",
        url: "https://example.com/",
        description: "desc",
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

    const out = textContent(result);
    expect(out).toContain(
      "type | rank_group | rank_absolute | domain | title | url",
    );
    expect(out).not.toMatch(/^rank \| domain \| title \| url$/m);
    expect(out).toContain(
      "organic | 2 | 5 | example.com | Example | https://example.com/",
    );
    expect(out).toContain("local_pack | 1 | 3");
  });

  it("does not invent a type when DataForSEO omits one", async () => {
    const live = vi.fn().mockResolvedValue([
      {
        rank_group: 1,
        rank_absolute: 1,
        domain: "example.com",
        title: "Unknown block",
        url: "https://example.com/unknown",
      },
    ]);
    mocks.createDataforseoClient.mockReturnValue({ serp: { live } });

    const result = await getSerpResultsTool.handler(
      { projectId: "project_1", queries: [{ keyword: "mystery" }] },
      toolContext,
    );

    const [item] = okItems(result);
    expect(item).toMatchObject({ type: null, rankGroup: 1, rankAbsolute: 1 });
  });

  it("passes a canonical locationName through to live SERP without replacing the country", async () => {
    const live = vi.fn().mockResolvedValue([]);
    mocks.createDataforseoClient.mockReturnValue({ serp: { live } });
    mocks.getProjectForOrganization.mockResolvedValue({
      id: "project_1",
      locationCode: 2036,
      languageCode: "en",
    });

    await getSerpResultsTool.handler(
      {
        projectId: "project_1",
        queries: [
          {
            keyword: "newborn photographer",
            locationCode: 2036,
            locationName: "Ararat,Victoria,Australia",
          },
        ],
      },
      toolContext,
    );

    expect(live).toHaveBeenCalledWith({
      keyword: "newborn photographer",
      locationCode: 2036,
      languageCode: "en",
      locationName: "Ararat,Victoria,Australia",
      depth: 20,
    });
  });
});
