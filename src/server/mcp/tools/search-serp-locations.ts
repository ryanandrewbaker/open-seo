import { z } from "zod";
import type { SerpLocationResult } from "@/server/lib/dataforseo/serp-locations";
import { type ToolContext } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";
import { formatMcpTable, type McpTableColumn } from "@/server/mcp/table";

/** ISO 3166-1 alpha-2, e.g. "us" — DataForSEO rejects country names. */
const countryCodeSchema = z
  .string()
  .regex(/^[a-z]{2}$/i, {
    message: "Must be an ISO 3166-1 alpha-2 country code (e.g. 'au', 'us').",
  })
  .describe("ISO 3166-1 alpha-2 country code, e.g. 'au' or 'US'.");

const inputSchema = {
  query: z
    .string()
    .min(1)
    .max(100)
    .describe("Place name to search, e.g. 'Melbourne'."),
  countryCode: countryCodeSchema,
} as const;

const locationOutputSchema = z
  .object({
    locationCode: z.number(),
    locationName: z.string(),
    locationType: z.string(),
    displayLabel: z.string(),
  })
  .passthrough();

const LOCATION_COLUMNS: McpTableColumn<SerpLocationResult>[] = [
  { header: "locationCode", value: (loc) => loc.locationCode },
  { header: "type", value: (loc) => loc.locationType },
  { header: "displayLabel", value: (loc) => loc.displayLabel },
];

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

export const searchSerpLocationsTool = {
  name: "search_serp_locations",
  config: {
    title: "Search SERP locations",
    description:
      "Search DataForSEO Google SERP locations by place name and ISO country code. Use this before supplying locationName to research_keywords, get_keyword_metrics, or get_serp_results when the canonical name is not already verified. Returns up to 10 matches. Uses no credits — the location list is cached.",
    inputSchema,
    outputSchema: {
      locations: z.array(locationOutputSchema),
      ...optionalMetaOutputSchema,
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: async (args: Args, _context: ToolContext) => {
    // Lazy-load the country location list so tool registration does not pull
    // the KV-backed cache module into every MCP request's eager graph.
    const { fetchSerpLocationsForCountry, filterSerpLocations } =
      await import("@/server/lib/dataforseo/serp-locations");
    const locations = filterSerpLocations(
      await fetchSerpLocationsForCountry(args.countryCode),
      args.query,
    );
    const text =
      locations.length === 0
        ? `No SERP locations matched "${args.query}" in ${args.countryCode}.`
        : `SERP locations (${locations.length}):\n${formatMcpTable(locations, LOCATION_COLUMNS)}`;

    return mcpResponse({
      text,
      structuredContent: { locations },
    });
  },
};
