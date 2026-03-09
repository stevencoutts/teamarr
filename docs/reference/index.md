---
title: Technical Reference
nav_order: 3
has_children: true
docs_version: "2.3.1"
---

# Technical Reference

Developer documentation covering Teamarr's architecture, data providers, database, and deployment configuration.

## Sections

| Section | Contents |
|---------|----------|
| [Supported Leagues](supported-leagues) | All 81 pre-configured leagues and 240+ discovered soccer leagues, organized by sport |
| [Providers](providers/) | Data provider system — ESPN, MLB Stats, HockeyTech, TheSportsDB — priority chain, API details, rate limiting |
| [Architecture](architecture/) | Detection keyword service, database migrations, stream classification internals |
| [Deployment](deployment/) | Environment variables, Docker configuration, logging |

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, SQLite (WAL mode) |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Providers | ESPN (primary), MLB Stats, HockeyTech, TheSportsDB (fallback) |
