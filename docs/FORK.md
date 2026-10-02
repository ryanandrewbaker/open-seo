# This fork

This repository is a long-lived fork of [every-app/open-seo](https://github.com/every-app/open-seo). Upstream now owns city and county keyword research. The fork keeps two MCP additions that upstream still omits.

## Upstream baseline

Current upstream: **v0.1.10** (`95c4d10`, 2026-09-30) plus 6 later commits on `upstream/main` (`db8bde17`, `v0.1.10-6-gdb8bde17`). Last fork sync: 2026-10-03 on `refine/upstream-convergence-2026-10-03`. Previous baseline: **v0.1.9** (`84e4705`) plus later `0ffff93`, synced 2026-09-21.

This sync adopted upstream local keyword research (`9961c15`, "Keyword research: city and county search volume") and dropped the fork overlay that used to do the same job.

### What upstream now owns

- Keyword research UI city/county/region targeting (`KeywordAreaField`, location picker, search options, history, URL params)
- `researchLocal()`, `assertLocalResearchLocation()`, `localizeResearchRows()` in `src/server/features/keywords/services/research/local-volume.ts`
- National discovery plus local Google Ads volume/CPC/competition
- Null when Google Ads omits a local row (national volume is not shown as local)
- No local metrics written into country-keyed `keyword_metrics`
- Canonical `locationName` on `research_keywords` and live SERP
- `search_serp_locations` for rank tracking and local research
- Invalid location rejected as `UNKNOWN_LOCATION` before paid research
- Ads-invalid keyword text skipped so one bad keyword does not fail the batch

Market model, unchanged:

- market = country (`locationCode` + `languageCode`; Australia is `2036` / `en`)
- local target = optional canonical `locationName` (`Ararat,Victoria,Australia`)
- `resolveMarket()` returns `{ locationCode, languageCode }` and callers pass `locationName` beside it

Per-row research `volumeScope` was removed. Upstream already surfaces scope through `locationName`, UI copy, history, and MCP text.

### 2026-10-03 convergence

Merged `upstream/main` (`db8bde17`) with `--no-ff`. Conflicted keyword/UI/MCP files took the upstream side, then the two MCP patches below were re-applied.

Upstream areas brought in include v0.1.10 and later: shadcn/UI migration and DaisyUI removal, SAM hidden from the UI, JS-rendered site audits with Cloudflare Browser Rendering, keyword grouping/close variants, rank-check billing holds, MCP annotation fixes, Search Console/Analytics grant uniqueness, dependency advisories, and repo-root flatten (`drizzle/` → `drizzle/sqlite`, `drizzle-pg/` → `drizzle/pg`).

Migrations incorporated (names and order unchanged):

| Engine      | Files                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 / SQLite | `drizzle/sqlite/0048_graceful_white_queen.sql` (crawler credentials), `0049_keyword_step.sql`, `0050_famous_crystal.sql` (Google grant uniqueness) |
| Postgres    | `drizzle/pg/0026_minor_dreadnoughts.sql`, `0027_keyword_step.sql`, `0028_modern_nekra.sql`                                                         |

Deleted from the fork because upstream replaced them:

- `src/server/features/keywords/services/research/research-local-volume.ts` and its tests
- `src/server/features/keywords/services/research/research.local-target.test.ts`
- `src/client/features/keywords/page/KeywordVolumeScopeNotice.tsx`
- fork `locationName` plumbing on `resolveMarket`
- shared `locationNameSchema` in `src/server/mcp/schemas.ts`
- per-row `volumeScope` on research rows

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

## What differs from upstream

### 1. `get_keyword_metrics` local targeting

Upstream `fetchKeywordMetricsForList()` already accepts `locationName`. The MCP tool did not expose it.

- Optional `locationName` on `get_keyword_metrics`
- Country `locationCode` stays national
- Volume/CPC/competition are local Google Ads values
- KD/intent stay national Labs values
- Missing local Ads values stay `null`
- Structured `volume_scope`: `"local"` when `locationName` is set, otherwise `"national"`
- Agents should call `search_serp_locations` and pass the returned `locationName` verbatim
- Invalid locations fail with `UNKNOWN_LOCATION` before the paid call

### 2. `get_serp_results` rank evidence

Upstream already validates `locationName` and returns `type` plus a collapsed `rank`. The fork also returns:

- `type` (nullable)
- `rankGroup` (`rank_group`)
- `rankAbsolute` (`rank_absolute`)
- `rank` = `rankAbsolute ?? rankGroup ?? null`

## Importing upstream changes

Once `origin/main` is published or shared, do not rebase it. Merge upstream in:

```sh
git fetch upstream
git switch main
git merge upstream/main
```

Fix conflicts, run the checks below, then push `origin/main`. Prefer upstream wherever it now implements the same capability. Keep only the two MCP deltas above.

## After an upstream merge

```sh
pnpm test
pnpm lint
pnpm format:check
pnpm types:check
pnpm build
pnpm ci:check
```

If the MCP tools conflicted, also run:

```sh
pnpm exec vitest run \
  src/server/mcp/tools/dataforseo-research-tools.local-metrics.test.ts \
  src/server/mcp/tools/get-serp-results.test.ts \
  src/server/features/keywords/services/research/research.test.ts \
  src/server/lib/dataforseo/keyword-metrics.test.ts
```

## Likely conflict areas

These files already carry the remaining fork behaviour and change often upstream:

- `src/server/mcp/tools/dataforseo-research-tools.ts` (`locationName`, `volume_scope`)
- `src/server/mcp/tools/get-serp-results.ts` (`rankGroup`, `rankAbsolute`)
- `src/server/mcp/tools/search-serp-locations.ts` (mentions `get_keyword_metrics`)
- `web/content/docs/mcp.md`

## Database migrations

OpenSEO ships two schemas. Fork migrations must too.

| Engine      | Schema                    | Migrations        | Generate              |
| ----------- | ------------------------- | ----------------- | --------------------- |
| D1 / SQLite | `src/db/app.schema.ts`    | `drizzle/sqlite/` | `pnpm db:generate:d1` |
| Postgres    | `src/db/pg/app.schema.ts` | `drizzle/pg/`     | `pnpm db:generate:pg` |

`pnpm db:generate` runs both. Commit both SQL files together.

Rules that save pain on upstream merges:

1. Additive columns default to `NULL` so existing rows stay valid.
2. Never edit a migration that has already run in any environment we care about. Add a new file.
3. Upstream will keep adding numbered SQL files. If a merge produces two files with the same number, rename **ours** to the next free number and keep upstream's name. Drizzle journals the filename.
4. After renaming, regenerate or hand-check the Postgres twin so both engines stay in lockstep.
5. Apply locally with `pnpm db:migrate:local` (and `pnpm db:migrate:pg` if you use Postgres).

## Finding fork-only work

```sh
git fetch upstream
git log --oneline upstream/main..HEAD
```

Subject prefixes for the remaining delta:

- `feat(mcp):` local `get_keyword_metrics` targeting and SERP rank evidence
- `docs:` fork baseline

When you add another fork feature, append it to **What differs from upstream** in the same commit.
