---
id: content-manifest
title: "Content Manifest"
description: "Index of all project content including team profiles, briefing, and seed data"
type: content
subtype: manifest
status: draft
sequence: 1
tags: [content, manifest]
relatesTo: ["docs/core/001-vision.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

<flex_block type="instructions">
This manifest indexes all content files for the COMPASS project. Content includes team profiles, project briefing, and any seed data needed for development and testing.
</flex_block>

<flex_block type="config">
{
  "content": [
    { "id": "team", "file": "content/team.md", "type": "collection", "description": "Team member profiles" },
    { "id": "briefing", "file": "content/briefing.md", "type": "info", "description": "Background context and domain knowledge for AI agents" }
  ]
}
</flex_block>

# Content Manifest

## Available Content

| Content | Type | Description |
|---------|------|-------------|
| [Team](team.md) | Collection | Team member profiles and roles |
| [Briefing](briefing.md) | Info | Background context for the chaplaincy domain |

## Content Strategy

COMPASS is an internal admin tool — content needs are minimal:
- **Team profiles** for the development team
- **Domain briefing** providing context about airport chaplaincy operations
- No public-facing marketing content needed
- No blog or CMS requirements
