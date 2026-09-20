import { z } from "zod";
import {
  fetchSerpLocationsForCountry,
  type SerpLocationResult,
} from "@/server/lib/dataforseo/serp-locations";
import { mcpResponse } from "@/server/mcp/formatters";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";
import { formatMcpTable, type McpTableColumn } from "@/server/mcp/table";
import { rankSerpLocations } from "@/shared/serp-location-search";

const inputSchema = {
  query: z
    .string()
    .min(1)
    .max(100)
    .describe('Place name, e.g. "Melbourne", "Ararat VIC", or "Portland OR".'),
  countryCode: z
    .string()
    .regex(/^[a-zA-Z]{2}$/, {
      message: "Must be an ISO 3166-1 alpha-2 country code (e.g. 'au', 'us').",
    })
    .describe('Two-letter ISO country code, e.g. "au" or "us".'),
} as const;

const LOCATION_COLUMNS: McpTableColumn<SerpLocationResult>[] = [
  { header: "locationName", value: (loc) => loc.locationName },
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
      "Find the exact DataForSEO location name for local targeting. Returns up to 10 matches; pass the chosen `locationName` verbatim to create_rank_tracker, research_keywords, get_keyword_metrics, or get_serp_results. Keep the country locationCode. Uses no credits.",
    inputSchema,
    outputSchema: z.looseObject({
      locations: z.array(
        z.looseObject({
          locationName: z.string(),
          locationCode: z.number(),
          locationType: z.string(),
        }),
      ),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: async (args: Args) => {
    const all = await fetchSerpLocationsForCountry(args.countryCode);
    const locations = rankSerpLocations(args.query, all, args.countryCode);
    const text =
      locations.length === 0
        ? `No Google locations match "${args.query}" in ${args.countryCode}. Try the city name alone.`
        : `SERP locations (${locations.length}):\n${formatMcpTable(locations, LOCATION_COLUMNS)}`;

    return mcpResponse({ text, structuredContent: { locations } });
  },
};
