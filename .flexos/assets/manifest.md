---
id: assets-manifest
title: "Asset Manifest"
description: "Registry of all project assets extracted from the FlutterFlow source"
type: assets
subtype: manifest
status: draft
sequence: 1
tags: [assets, images, branding]
relatesTo: ["docs/core/006-design.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

<flex_block type="config">
{
  "assets": [
    { "path": "images/DFWAIC-Black-Transparent-Logo.png", "type": "image", "category": "branding", "description": "DFWAIC organization logo (black on transparent)", "source": "flutterflow_import" },
    { "path": "images/favicon.png", "type": "image", "category": "branding", "description": "Browser favicon", "source": "flutterflow_import" },
    { "path": "images/loading-4802_128.gif", "type": "image", "category": "ui", "description": "Loading spinner animation (128px)", "source": "flutterflow_import" }
  ]
}
</flex_block>

# Asset Manifest

## Inventory

| Asset | Type | Category | Source |
|-------|------|----------|--------|
| DFWAIC-Black-Transparent-Logo.png | PNG Image | Branding | FlutterFlow import |
| favicon.png | PNG Image | Branding | FlutterFlow import |
| loading-4802_128.gif | Animated GIF | UI Element | FlutterFlow import |

**Total: 3 assets** extracted from the original FlutterFlow project.

## Usage Notes

- The DFWAIC logo should be adapted for the COMPASS branding. Consider creating a COMPASS-specific logo that maintains the institutional feel while establishing a distinct identity.
- The favicon should be replaced with a COMPASS-branded icon during the build phase.
- The loading GIF can be replaced with a CSS-based spinner for better performance and customization.

## Licensing

All assets were extracted from the original DFWAIC FlutterFlow project. The organization logo is proprietary to the Dallas Fort Worth Airport Interfaith Chaplaincy. Ensure proper authorization before using in the rebuilt application.

## Missing Assets (To Be Created)

- COMPASS logo (primary branding)
- COMPASS favicon (16x16, 32x32, 192x192)
- Open Graph social image (1200x630)
- Default user avatar placeholder
- Terminal icons (A, B, C, D, E)
- Status indicator icons (on-duty, off-duty, paid, unpaid)
