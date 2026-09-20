# This fork

This repository is a long-lived fork of [every-app/open-seo](https://github.com/every-app/open-seo). We keep OpenSEO's product and keep adding local SEO and related workflow that we need in production. Upstream may never merge those changes. That is expected.

## Upstream baseline

Current upstream: **v0.1.9** (`84e4705`, 2026-09-17) plus 20 later commits on `upstream/main` (`0ffff93`, `v0.1.9-20-g0ffff93`). Last fork sync: 2026-09-21 on `sync/upstream-2026-09-21`. Previous baseline: **v0.1.8** (`7b9ee0e`), synced 2026-09-13.

Local keyword targeting is still fork-only end-to-end. The market model did not change:

- market = country (`locationCode` + `languageCode`; Australia is `2036` / `en`)
- `locationName` = optional local target (`Ararat,Victoria,Australia`)
- discovery = national
- Google Ads volume = local when `locationName` is set
- provenance is explicit (`volumeScope`)
- local values are never written into country-keyed `keyword_metrics`

SERP location _search ranking_ is now upstream-native (`rankSerpLocations` in `src/shared/serp-location-search.ts`, including AU state abbreviations such as `VIC`). The fork no longer has a separate `filterSerpLocations` substring matcher. Upstream still does not take optional `locationName` through research schema → `resolveMarket` → overlay → UI/cache → MCP.

### 2026-09-21 sync (current upstream/main)

Merged `upstream/main` (`0ffff93`) with `--no-ff`. Kept fork plumbing and took upstream implementation where it improved the same area.

Upstream areas brought in:

- Reports: saved reports, templates, viewer, public share (static HTML, edge cache, social image via `takumi-js`), MCP report/template tools
- Rank tracking: save-time location validation, empty-run handling, `repair:rank-locations`, `rankSerpLocations` (US/CA/AU abbreviations)
- MCP: `z.looseObject` output schemas, client-label/`whoami`, cleanup tools (saved keywords, reports, audits), filtered Search Console results, trimmed tool output, OAuth user-scoped grants
- Skills: `seo-report`, seo-audit shortlist workflow, simplified agent setup; obsolete `webapp-testing` skill removed
- Site/SAM: Sam beta opt-in, self-host telemetry skip for health probes
- Marketing: free discovery tools, About/Why pages, strategy libraries
- Tooling: app version 0.1.9, Vitest 4, pnpm audit overrides
- Migrations: D1 `drizzle/0047_reports.sql`, Postgres `drizzle-pg/0025_reports.sql`

Conflict resolutions (combine, do not drop either side):

- `search_serp_locations`: upstream `rankSerpLocations` + `z.looseObject`, plus fork copy covering `research_keywords` / `get_keyword_metrics` / `get_serp_results` (not only rank trackers)
- location UI server fn: upstream `rankSerpLocations` (replaces fork `filterSerpLocations`)
- `AvailableTools.tsx`: accepted upstream deletion (MCP setup redesign); tool stays registered on the MCP server
- Auto-merged MCP tools kept fork `locationName` / SERP rank fields and took upstream `z.looseObject` + report/cleanup registrations; removed a duplicate `searchSerpLocationsTool` import in `server.ts`

### v0.1.8 sync (2026-09-13)

Merged upstream `v0.1.8` with `--no-ff`. Kept fork plumbing and took upstream implementation where it improved the same area.

Upstream areas brought in:

- rank tracking `match_case`
- GA/GSC account search, clear, and full account removal
- SAM recovery, metering, and reply controls
- site-audit rate-limit pacing and resume
- on-demand SERP depth (20 default, 100 on page-past)
- empty SERP handling (`treatNoResultsAsEmpty`)
- Search Console MCP reporting fixes
- MCP transport `listChanged: false` and DataForSEO HTTP helpers (SDK client removed)
- auth/workspace: last active org, unique member index, team/org UI
- dashboard setup/onboarding rewrite; onboarding chat Durable Object removed
- dependency and Cloudflare tooling updates (`agents` 0.22, `@cloudflare/think` 0.17, audit worker wrangler)

Conflict resolutions (combine, do not drop either side):

- live SERP: upstream HTTP + depth + empty-SERP, plus fork `locationName`
- keyword SERP analysis: upstream depth cache, plus fork `locationName` in query/cache keys
- MCP `get_serp_results`: upstream depth, plus fork type / rankGroup / rankAbsolute / `locationName`
- `serpAnalysisSchema`: both `locationName` and `depth`

No second local-volume overlay was added. Research still discovers nationally, then `overlayLocalKeywordVolumes` calls the shared `fetchKeywordMetricsForList` helper (already location-aware at the DataForSEO layer).

## Remotes

| Remote     | Repo                       | Role                                                                 |
| ---------- | -------------------------- | -------------------------------------------------------------------- |
| `origin`   | `ryanandrewbaker/open-seo` | Our fork. `origin/main` is the production branch once we publish it. |
| `upstream` | `every-app/open-seo`       | OpenSEO source. Fetch it to pick up releases and fixes.              |

```sh
git remote -v
# origin    https://github.com/ryanandrewbaker/open-seo.git
# upstream  https://github.com/every-app/open-seo.git
```

## Why it exists

Upstream OpenSEO is a strong base (MCP, keyword research, rank tracking, audits). Local SEO targeting in DataForSEO needs more than a country `locationCode`:

- A user-selected city such as Ararat or Melbourne must reach the APIs that actually accept local geotargets.
- Keyword _discovery_ stays country-level so a small town does not wipe the idea list.
- Search volume can be city-level via Google Ads `location_name`.
- National numbers must never be labelled as city numbers.

That is first-class behaviour in this fork, not a trial branch.

## What differs from upstream

Keep this list current when we add fork-only work.

### Local SEO targeting

- Optional canonical `locationName` (DataForSEO `location_name`) beside the country market.
- Country `locationCode` + `languageCode` still define the market (Australia remains `2036` / `en`).
- Keyword research UI: country selector plus optional "Target location" search.
- National discovery (Labs related/suggestions/ideas; Ads ideas on Ads-only countries).
- City-level Google Ads volume/CPC overlay; Labs KD/intent stay national.
- `volumeScope: "local" | "national"` on research rows. Missing Ads volume is `null` with `volumeScope: "local"`.
- Local results are not written onto country-keyed `keyword_metrics`.
- Live SERP accepts `location_name` when a local target is set.

### MCP

- `search_serp_locations`: resolve a place name + ISO country to canonical `locationName` and city `locationCode`. Ranking uses upstream `rankSerpLocations`. The fork description still points at keyword research and live SERP, not only rank trackers.
- `research_keywords`, `get_keyword_metrics`, and `get_serp_results` accept that `locationName`.
- `get_serp_results` preserves SERP `type`, `rankGroup`, and `rankAbsolute`.

Rank tracking already had local `locationName` upstream (`drizzle/0029_location_name.sql`). We reused that model instead of inventing a second one.

## Importing upstream changes

Once `origin/main` is published or shared, do not rebase it. Merge upstream in:

```sh
git fetch upstream
git switch main
git merge upstream/main
```

Fix conflicts, run the checks below, then push `origin/main`.

Before the fork is public, rebasing a private feature branch onto `origin/main` or `upstream/main` is fine.

A typical first landing of this work:

```sh
git switch main
git merge feature/local-seo-targeting
# review, run checks, then push origin main when ready
```

Do not squash the MCP location commits and the keyword targeting commits into one blob unless the history is actually messy. The current split is useful: SERP location search, SERP evidence fields, then city-level keyword research.

## After an upstream merge

```sh
pnpm test
pnpm lint
pnpm format:check
pnpm types:check
pnpm build
pnpm ci:check
```

If keyword or MCP files conflicted, also run:

```sh
pnpm exec vitest run \
  src/shared/keyword-locations.test.ts \
  src/server/features/keywords/services/research/research-local-volume.test.ts \
  src/server/features/keywords/services/research/research.local-target.test.ts \
  src/server/lib/dataforseo/keyword-metrics.test.ts \
  src/client/features/keywords/hooks/useKeywordResearchData.test.ts \
  src/server/mcp/tools/search-serp-locations.test.ts \
  src/server/mcp/tools/get-serp-results.test.ts \
  src/server/mcp/tools/tool-text-output.test.ts
```

Smoke the keyword research page: Australia-only search, then the same seed with a city target. Volumes should change (or go null); ideas should not disappear; the banner should say which city the volumes are for.

## Likely conflict areas

These files already carry fork behaviour and change often upstream:

- `src/shared/keyword-locations.ts` (`resolveMarket`, country table)
- `src/server/features/keywords/services/research/` (especially `research.ts`)
- `src/client/features/keywords/` (search bar, query keys, page, controller)
- `src/types/keywords.ts` and `src/types/schemas/keywords.ts`
- `src/server/mcp/schemas.ts` and `src/server/mcp/tools/{research-keywords,dataforseo-research-tools,get-serp-results,search-serp-locations}.ts`
- `src/server/mcp/server.ts` (tool imports; watch for duplicate `searchSerpLocationsTool` after both sides add it)
- `src/shared/serp-location-search.ts` (take upstream ranking; do not revive `filterSerpLocations`)
- `web/content/docs/mcp.md`

When resolving, keep the invariants in "What differs from upstream". Prefer upstream's new helpers if they do the same job. Do not drop `locationName` or `volumeScope` to make a merge quieter.

## Database migrations

OpenSEO ships two schemas. Fork migrations must too.

| Engine      | Schema                    | Migrations    | Generate              |
| ----------- | ------------------------- | ------------- | --------------------- |
| D1 / SQLite | `src/db/app.schema.ts`    | `drizzle/`    | `pnpm db:generate:d1` |
| Postgres    | `src/db/pg/app.schema.ts` | `drizzle-pg/` | `pnpm db:generate:pg` |

`pnpm db:generate` runs both. Commit both SQL files together.

Rules that save pain on upstream merges:

1. Additive columns default to `NULL` so existing rows stay valid.
2. Never edit a migration that has already run in any environment we care about. Add a new file.
3. Upstream will keep adding `drizzle/00xx_*.sql`. If a merge produces two files with the same number, rename **ours** to the next free number and keep upstream's name. Drizzle journals the filename.
4. After renaming, regenerate or hand-check the Postgres twin in `drizzle-pg/` so both engines stay in lockstep.
5. Apply locally with `pnpm db:migrate:local` (and `pnpm db:migrate:pg` if you use Postgres).

Keyword research local targeting currently stores nothing extra on `projects`. Rank tracking already has `location_name`. A later project-default city should be a new nullable column plus matching unique-key care, not a rewrite of country `location_code`.

## Finding fork-only work

```sh
git fetch upstream
git log --oneline upstream/main..HEAD
```

That is the delta on the current branch. On production `main` after we have merged this work, the same command against `upstream/main` is the running list of fork commits.

Subject prefixes we have used so far:

- `feat(mcp):` / `fix(mcp):` / `test(mcp):` for MCP location and SERP evidence
- `feat(keywords):` / `test(keywords):` for city-level research volume

When you add another fork feature, append it to **What differs from upstream** in this file in the same commit. The doc is the map; `git log upstream/main..main` is the audit trail.
