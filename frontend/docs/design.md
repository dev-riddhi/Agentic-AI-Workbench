# Industrial Design System & UX Standards — Sovereign Agentic AI Workbench

## 1. Design Philosophy: "Air-Gapped Sovereign Cyber-Industrialism"

The visual language of the Sovereign Agentic AI Workbench balances **high-stakes industrial precision** with **cutting-edge aesthetic depth**.

It merges two complementary modern design paradigms:
1. **Dark Neo-Brutalism**: Sharp, structural high-contrast borders (1px solid Zinc 800/700), monospaced telemetry readouts, high-density data tables, and tactile click physics.
2. **Cyber Glassmorphism**: Frosted translucent paneling (`backdrop-blur-md` with `bg-zinc-900/60`), ambient specular highlights, neon glow states for active engines, and depth layering.

> **Core Feeling**: Stepping inside an air-gapped industrial flight deck or deep-space mission control room — utilitarian, deterministic, visually stunning, and responsive.

---

## 2. Color Grading & Palette Tokens

### 2.1 The Canvas Spectrum (Deep Zinc)
| Token Name | Hex Code | Purpose |
|---|---|---|
| `zinc-950` (Void) | `#09090b` | Root canvas background for entire viewport. |
| `zinc-900` (Obsidian) | `#18181b` | Primary card background with 60%-80% opacity blur. |
| `zinc-850` (Basalt) | `#202023` | Secondary nested panels, code editors, and input wells. |
| `zinc-800` (Slate Edge) | `#27272a` | Structural borders, dividing rules, card borders. |
| `zinc-700` (Muted Edge) | `#3f3f46` | Hover borders and interactive outlines. |

### 2.2 Semantic Neon Accents
* **Electric Cyan (`cyan-500`: `#06b6d4`, `cyan-400`: `#22d3ee`)**:
  * Represents AI reasoning, LLM generation, streaming tokens, active selection, and primary action buttons.
  * Glow signature: `box-shadow: 0 0 20px -5px rgba(6, 182, 212, 0.35)`.
* **Sovereign Emerald (`emerald-500`: `#10b981`, `emerald-400`: `#34d399`)**:
  * Represents healthy system states, 0.0 KB air-gap verification, running agent threads, and completed executions.
  * Glow signature: `box-shadow: 0 0 15px -3px rgba(16, 185, 129, 0.35)`.
* **Telemetry Amber (`amber-500`: `#f59e0b`, `amber-400`: `#fbbf24`)**:
  * Represents scheduled cron triggers, background downloads in progress, and non-blocking warnings.
* **Alert Crimson (`rose-500`: `#f43f5e`, `rose-400`: `#fb7185`)**:
  * Represents worker thread aborts, decommission actions, offline llama-server, and error alerts.
* **Knowledge Violet (`indigo-500`: `#6366f1`, `violet-400`: `#a78bfa`)**:
  * Represents RAG vector indexing, document attachments, and semantic retrieval pipelines.

---

## 3. Typography Hierarchy

### 3.1 Font Families
* **Primary Sans (`var(--font-geist-sans)`, Inter)**:
  * Used for: Titles, navigation links, form labels, body text, buttons.
  * Attributes: Crisp rendering at small sizes (12px-14px), high legibility on dark surfaces.
* **Telemetry Monospace (`var(--font-geist-mono)`, JetBrains Mono)**:
  * Used for: Model names, quantization badges (`Q4_K_M`), tool names, token counts, timestamps, cron schedules, UUIDs, and stdout terminal streams.
  * Attributes: Tabular numbers (`font-variant-numeric: tabular-nums`) so numbers do not jump during live updates.

### 3.2 Type Scale
| Level | Tailwind Class | Size / Leading | Weight | Usage |
|---|---|---|---|---|
| **Display 1** | `text-3xl tracking-tight` | 30px / 36px | Bold (700) | Major dashboard titles |
| **Heading 2** | `text-xl tracking-tight` | 20px / 28px | Semibold (600) | Section headers, card titles |
| **Heading 3** | `text-base` | 16px / 24px | Medium (500) | Subsection titles, modal headers |
| **Body Regular** | `text-sm` | 14px / 20px | Normal (400) | Card descriptions, form inputs |
| **Telemetry Mono** | `font-mono text-xs` | 12px / 16px | Medium (500) | Status badges, timestamps, stats |
| **Micro Caption** | `text-[11px] uppercase tracking-wider` | 11px / 14px | Semibold (600) | Overline badges, table headers |

---

## 4. Glassmorphism & Elevation System

```css
/* Card Container Elevation */
.glass-card {
  background: rgba(24, 24, 27, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(63, 63, 70, 0.4);
  box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.45);
}

.glass-card-hover:hover {
  border-color: rgba(6, 182, 212, 0.4);
  box-shadow: 0 8px 32px -2px rgba(6, 182, 212, 0.12);
}
```

### Z-Index Layers
1. `z-0`: Dark mesh grid background.
2. `z-10`: Content canvas and dashboard grids.
3. `z-20`: Sticky navigation header and sidebar.
4. `z-30`: Popovers, dropdown menus, and tooltips.
5. `z-40`: Modal backdrop overlay (`bg-black/75 backdrop-blur-sm`).
6. `z-50`: Modal dialogs and critical confirmation alerts.
7. `z-60`: Toast notification stack.

---

## 5. Motion, Physics & Micro-Interactions

* **Physics Engine**: Use **Framer Motion** with spring dynamics rather than linear CSS curves.
  * Standard Spring: `{ type: "spring", stiffness: 450, damping: 32 }`
  * Gentle Enter: `{ type: "spring", stiffness: 300, damping: 28 }`
* **Tactile Click Feel**:
  * All interactive buttons, chips, and links must exhibit scale down on active press:
    `active:scale-[0.97] transition-transform duration-100`.
* **Breathing Pulses**:
  * Live worker threads and active server status badges feature a double-ring pulse:
    Outer ring expands and fades via `animate-ping`, inner circle remains solid emerald.
* **Smooth Page Transitions**:
  * Route switches use subtle opacity fade (`initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }`).

---

## 6. Smooth Scrolling & High Performance

1. **Global Smooth Scrolling**: Set `html { scroll-behavior: smooth; }`.
2. **Custom Industrial Scrollbars**:
   ```css
   ::-webkit-scrollbar {
     width: 6px;
     height: 6px;
   }
   ::-webkit-scrollbar-track {
     background: rgba(24, 24, 27, 0.5);
   }
   ::-webkit-scrollbar-thumb {
     background: rgba(63, 63, 70, 0.6);
     border-radius: 9999px;
   }
   ::-webkit-scrollbar-thumb:hover {
     background: rgba(6, 182, 212, 0.7);
   }
   ```
3. **Zero Cumulative Layout Shift (CLS)**:
   * Every card grid and data table must have a dedicated animated **Skeleton Loader** matching exact dimensions during network fetching.

---

## 7. Accessibility & Ergonomics

* **Contrast Ratios**: Minimum 4.5:1 text-to-background contrast on dark surfaces (WCAG AA).
* **Keyboard Navigation**: Clear, glowing focus indicators:
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950`.
* **Reduced Motion Support**: Respect `@media (prefers-reduced-motion: reduce)` by disabling spring animations and using instant transitions.
