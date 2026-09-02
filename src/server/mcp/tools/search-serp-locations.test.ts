import { beforeEach, describe, expect, it, vi } from "vitest";
import { objectSchema } from "@/server/mcp/output-schemas";
import { SERP_LOCATION_SEARCH_LIMIT } from "@/server/lib/dataforseo/serp-locations";
import type * as serpLocationsModule from "@/server/lib/dataforseo/serp-locations";
import { searchSerpLocationsTool } from "./search-serp-locations";
import { makeToolContext, textContent } from "./tool-test-support";

const melbourne = {
  locationCode: 1000567,
  locationName: "Melbourne,Victoria,Australia",
  locationType: "City",
  displayLabel: "Melbourne, Victoria",
};

const sydney = {
  locationCode: 1000142,
  locationName: "Sydney,New South Wales,Australia",
  locationType: "City",
  displayLabel: "Sydney, New South Wales",
};

const mocks = vi.hoisted(() => ({
  fetchSerpLocationsForCountry: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: {} }));

vi.mock("@/server/lib/dataforseo/serp-locations", async (importOriginal) => {
  const actual = await importOriginal<typeof serpLocationsModule>();
  return {
    ...actual,
    fetchSerpLocationsForCountry: mocks.fetchSerpLocationsForCountry,
  };
});

const toolContext = makeToolContext();
const inputSchema = objectSchema(searchSerpLocationsTool.config.inputSchema);

describe("search_serp_locations MCP tool", () => {
  beforeEach(() => {
    mocks.fetchSerpLocationsForCountry.mockReset();
    mocks.fetchSerpLocationsForCountry.mockResolvedValue([melbourne, sydney]);
  });

  it("returns matching location identity fields for a valid search", async () => {
    const result = await searchSerpLocationsTool.handler(
      { query: "Melbourne", countryCode: "au" },
      toolContext,
    );

    expect(mocks.fetchSerpLocationsForCountry).toHaveBeenCalledWith("au");
    expect(result.structuredContent?.locations).toEqual([melbourne]);
    const out = textContent(result);
    expect(out).toContain("1000567");
    expect(out).toContain("Melbourne, Victoria");
    expect(out).toContain("City");
  });

  it("matches place names case-insensitively", async () => {
    const result = await searchSerpLocationsTool.handler(
      { query: "melbourne", countryCode: "AU" },
      toolContext,
    );

    expect(result.structuredContent?.locations).toEqual([melbourne]);
  });

  it("caps results instead of returning the full country list", async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      locationCode: 2000000 + i,
      locationName: `Melbourne Suburb ${i},Victoria,Australia`,
      locationType: "City",
      displayLabel: `Melbourne Suburb ${i}`,
    }));
    mocks.fetchSerpLocationsForCountry.mockResolvedValue(many);

    const result = await searchSerpLocationsTool.handler(
      { query: "Melbourne", countryCode: "au" },
      toolContext,
    );

    const locations = result.structuredContent?.locations;
    expect(Array.isArray(locations)).toBe(true);
    expect(locations).toHaveLength(SERP_LOCATION_SEARCH_LIMIT);
    expect(locations?.length).toBeLessThan(many.length);
  });

  it("returns an empty locations array when nothing matches", async () => {
    const result = await searchSerpLocationsTool.handler(
      { query: "Atlantis", countryCode: "au" },
      toolContext,
    );

    expect(result.structuredContent?.locations).toEqual([]);
    expect(textContent(result)).toContain("No SERP locations matched");
  });

  it("rejects invalid ISO country codes on the input schema", () => {
    expect(
      inputSchema.safeParse({ query: "Melbourne", countryCode: "australia" })
        .success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({ query: "Melbourne", countryCode: "AUS" }).success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({ query: "Melbourne", countryCode: "" }).success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({ query: "Melbourne", countryCode: "au" }).success,
    ).toBe(true);
  });
});
