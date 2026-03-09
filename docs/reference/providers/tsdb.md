---
title: TSDB
parent: Providers
grand_parent: Technical Reference
nav_order: 5
docs_version: "2.3.1"
---

# TheSportsDB Provider

TheSportsDB (TSDB) is a community-driven sports data API. Teamarr uses it as a fallback provider (priority 100) for leagues not covered by ESPN, including Australian sports, rugby, cricket, boxing, CFL, and Scandinavian leagues.

## API Details

| | |
|---|---|
| **Base URL** | `https://www.thesportsdb.com/api/v1/json/{api_key}/{endpoint}` |
| **Auth** | API key in URL path (`123` for free tier) |
| **Priority** | 100 (last resort) |
| **Rate Limit** | 30 req/min free, 100 req/min premium |

## API Tiers

| | Free | Premium |
|---|---|---|
| **API Key** | `123` (default) | Your own key (6+ digits) |
| **Rate Limit** | 30 req/min | 100 req/min |
| **Events per Query** | 5 per day per league | Full coverage |
| **Team Search** | 10 teams | 3,000 teams |
| **Cost** | Free | ~$9/month |

### Free Tier Leagues

These leagues have low enough event volume to work within free tier limits:

- CFL, Unrivaled, AFL, NRL, Super Rugby, Norwegian Hockey, Boxing

### Premium Tier Leagues

These leagues have high event volume and require a premium key for full coverage:

- IPL, BBL, SA20 (cricket)
- Svenska Cupen (soccer)

The `tsdb_tier` column in `schema.sql` classifies each league as `free` or `premium`.

## Configuration

Add your premium key in **Settings > System > TheSportsDB API Key**. The key takes effect immediately (no restart required). The league picker shows a crown icon on premium-tier leagues and warns if you select one without a key configured.

Get a key at [thesportsdb.com/pricing](https://www.thesportsdb.com/pricing).

## Supported Leagues

| League | Code | TSDB ID | Sport | Tier |
|--------|------|---------|-------|------|
| Canadian Football League | `cfl` | 4405 | Football | Free |
| Unrivaled | `unrivaled` | 5622 | Basketball | Free |
| Australian Football League | `afl` | 4456 | Australian Football | Free |
| National Rugby League | `nrl` | 4416 | Rugby | Free |
| Super Rugby Pacific | `super-rugby` | 4551 | Rugby | Free |
| Norwegian Fjordkraft-ligaen | `norwegian-hockey` | 4926 | Hockey | Free |
| Boxing | `boxing` | 4445 | Boxing | Free |
| Indian Premier League | `ipl` | 4460 | Cricket | Premium |
| Big Bash League | `bbl` | 4461 | Cricket | Premium |
| SA20 | `sa20` | 5532 | Cricket | Premium |
| Svenska Cupen | `svenska-cupen` | 4756 | Soccer | Premium |

## Event Resolution

TSDB uses a three-step fallback chain when fetching events:

1. **`eventsday.php`** — date-specific lookup (primary, works for most leagues)
2. **`eventsnextleague.php`** — upcoming events filtered by date (fallback)
3. **`eventsround.php`** — full round/season events filtered by date (last resort, used for leagues like Unrivaled)

## Rate Limiting

Teamarr enforces rate limits **preemptively** using a sliding window limiter — it tracks request timestamps and waits before approaching the limit, rather than waiting for 429 responses.

If the API does return HTTP 429, Teamarr retries with exponential backoff (5s → 10s → 20s → 40s → 80s).

Rate limit statistics (total requests, preemptive waits, reactive waits) are tracked and available for UI feedback.

## TSDB League Configuration

Each TSDB league requires **two** identifiers in `schema.sql`:

| Column | Used By | Example |
|--------|---------|---------|
| `provider_league_id` | `eventsnextleague.php`, `lookupleague.php` | `5159` |
| `provider_league_name` | `eventsday.php`, `search_all_teams.php` | `Canadian OHL` |

These must match TSDB's internal data exactly. Use `search_all_leagues.php` to discover correct values.

## Cache TTLs

| Data | TTL |
|------|-----|
| Teams | 24 hours |
| Next events | 1 hour |
| Past games | 7 days |
| Today's games | 30 minutes |
| Tomorrow's games | 4 hours |
| 3-7 days out | 8 hours |
| 8+ days out | 24 hours |

## File Locations

| File | Purpose |
|------|---------|
| `teamarr/providers/tsdb/provider.py` | TSDBProvider class |
| `teamarr/providers/tsdb/client.py` | HTTP client with preemptive rate limiting |

For detailed API endpoint documentation, see the [TSDB API Reference](tsdb-api).
