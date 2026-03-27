# blokos — Component Library

Design System as Catalog — component registries with AI skills built-in

TRIGGER when: user asks to create a page, section, layout, or component using this design system.

## Rules

- ONLY use components listed below. Do NOT invent new components.
- Follow the prop types exactly as defined.
- Import components from the paths shown.
- Output native TSX code (Next.js pages/components), NOT JSON specs.

## Available Components

### lesson-path

Zigzag learning path component — displays a list of items in an alternating left/right layout connected by curved path connectors, inspired by Duolingo. Framework-agnostic: works with Next.js, Vite, or any React setup. Card content is fully customizable via renderCard render prop.

**Category:** navigation

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| items | array | Yes | List of items to display in the zigzag path |
| pathColor | string | No | Color of the connector between cards (CSS color, default #1CB0F6) |
| className | string | No | CSS class applied to the outer wrapper |

**Examples:**

*Basic usage with image cards:*
```tsx
<lesson-path items={[{"id":"1","status":"current","groupLabel":"Beginner"},{"id":"2","status":"locked"},{"id":"3","status":"locked"}]} pathColor="#1CB0F6" />
```

*Bible series path:*
```tsx
<lesson-path items={[{"id":"genesis","status":"completed","groupLabel":"Old Testament"},{"id":"exodus","status":"current"},{"id":"leviticus","status":"locked"}]} />
```

---
