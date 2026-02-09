---
id: imports-readme
title: "Imports"
description: "Landing zone for imported content"
type: meta
subtype: readme
status: approved
sequence: 1
tags: [meta, imports]
relatesTo: ["docs/core/000-import.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Imports

This folder is the landing zone for imported content from external sources.

## Import History

| Source | Type | Date | Notes |
|--------|------|------|-------|
| FlutterFlow DFWAIC App Dashboard | flutterflow_import | 2026-02-09 | Original project forensically analyzed, fresh spec generated |

## How Imports Work

1. Raw imported files are placed in subfolders by source type
2. The `/import` command analyzes the source and generates a fresh `.flexos/` spec
3. Original code is NOT migrated — only intent is extracted
4. See `docs/core/000-import.md` for full import analysis

## Source Types

- `github/` — Imported from GitHub repositories
- `figma/` — Imported from Figma design files
- `flutterflow/` — Imported from FlutterFlow projects
