---
title: Event Groups
parent: Settings
grand_parent: User Guide
nav_order: 3
docs_version: "2.3.1"
---

# Event Group Settings

Configure defaults for event-based EPG generation.

## Event Matching

### Event Lookahead

How far ahead to match streams to sporting events. Streams are matched to events within this window. Default is 3 days.

Options: 1, 3, 7, 14, or 30 days.

## Exception Keywords

When using [Consolidate mode](channels#stream-consolidation-mode), exception keywords allow special handling for certain streams. Streams matching these terms get sub-consolidated or separated instead of following the default consolidation behavior.

Exception keywords only appear when consolidation mode is set to Consolidate in [Settings > Channels](channels#stream-consolidation-mode).

### Example Use Case

Your IPTV provider carries both English and Spanish streams for the same game. With consolidation enabled, they'd merge into one channel. Adding a "Spanish" exception keyword with "Separate" behavior creates a separate channel for the Spanish stream.

### Keyword Fields

| Field | Description |
|-------|-------------|
| **Label** | Display name (available as `{exception_keyword}` in templates) |
| **Match Terms** | Comma-separated terms to match in stream names |
| **Behavior** | Sub-Consolidate, Separate, or Ignore |

| Behavior | Description |
|----------|-------------|
| **Sub-Consolidate** | Group matching streams together, separate from the main consolidated channel |
| **Separate** | Each matching stream gets its own channel |
| **Ignore** | Skip matching streams entirely |

{: .note }
The default team filter for event groups is configured in [Event Groups > Global Defaults](../event-groups/creating-groups), not in Settings. Stream consolidation mode is in [Settings > Channels](channels#stream-consolidation-mode).
