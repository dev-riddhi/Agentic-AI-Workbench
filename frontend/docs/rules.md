# Frontend Engineering Rules & Quality Standards — Sovereign Agentic AI Workbench

This document sets the mandatory coding rules, architectural guidelines, performance benchmarks, and multi-verification procedures that must be strictly adhered to across the entire frontend codebase.

---

## 1. Core Architecture & Philosophy

### 1.1 Strict Air-Gapped Compliance (0.0 KB External Egress)
* **Zero Remote Scripts / CDNs**: Never load external scripts, stylesheets, analytics, or trackers (e.g. Google Analytics, CDN fonts, Unpkg, CDNJS).
* **Self-Hosted Assets**: All fonts (`next/font`), icons (`lucide-react`), and styles must be bundled locally into the build.
* **Loopback Enforcement**: Default API endpoints must bind strictly to internal loopback (`http://localhost:8000/api/v1` or `http://127.0.0.1:8000/api/v1`).

### 1.2 TypeScript Strictness
* **No Implicit or Explicit `any`**: All data structures, API payloads, component props, and event handlers must be strictly typed using interfaces defined in [lib/api/types.ts](file:///e:/Agentic-AI-Workbench/frontend/lib/api/types.ts).
* **Null & Undefined Safety**: Explicitly type optional fields (`description?: string | null`). Use optional chaining (`agent?.ai_model?.name`) and nullish coalescing (`?? 'Default'`).
* **Enum & Constant Union Types**: Use union string literals for deterministic status values:
  ```typescript
  export type AgentTrigger = 'manual' | 'schedule' | 'onetime';
  export type ModelStatus = 'ready' | 'downloading' | 'error';
  export type DocStatus = 'indexed' | 'pending' | 'failed';
  ```

### 1.3 React 19 & Next.js 16 (App Router) Standards
* **`"use client"` Placement**: Only declare `"use client"` in components that manage local state, use React hooks (`useState`, `useEffect`, `useContext`), or attach DOM event listeners. Keep layouts and wrapper shells as Server Components where practical.
* **Hydration-Safe Browser State**: When accessing `window`, `localStorage`, or media queries, always use `useSyncExternalStore` or an `isMounted` guard to eliminate SSR hydration mismatches.
* **Clean Component Decomposition**:
  * Limit individual component files to under 250 lines of code.
  * Extract complex logic into custom reusable hooks (`hooks/use-agent-runner.ts`, `hooks/use-model-status.ts`).
  * Separate presentational primitives from business logic containers.

---

## 2. The Multi-Verification System (MVS)

Before marking any task, component, or refactoring complete, every developer and agent must pass the **5-Layer Multi-Verification System**:

```text
┌─────────────────────────────────────────────────────────────┐
│               MULTI-VERIFICATION SYSTEM (MVS)               │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Static Type Check       ──► tsc --noEmit (0 err)   │
│  Layer 2: Linter & Syntax         ──► npm run lint (0 warn)  │
│  Layer 3: Production Build Test   ──► npm run build (Pass)   │
│  Layer 4: Zero Console Errors     ──► Browser audit (0 err)  │
│  Layer 5: Zero Layout Shift (CLS) ──► Skeleton matching      │
└─────────────────────────────────────────────────────────────┘
```

1. **Layer 1 (Type Verification)**: Run TypeScript compiler without emitting JS to ensure 100% type soundness:
   ```powershell
   npx tsc --noEmit
   ```
2. **Layer 2 (Code Style & Linting)**: Run ESLint to prevent unused imports, bad hooks dependencies, or syntax quirks:
   ```powershell
   npm run lint
   ```
3. **Layer 3 (Production Compilation)**: Execute Next.js Turbopack production build to verify route tree integrity, static prerendering, and bundling:
   ```powershell
   npm run build
   ```
4. **Layer 4 (Runtime Console Check)**: Check that no browser console warnings, React rendering errors, or unhandled promise rejections occur during user interaction.
5. **Layer 5 (Visual & CLS Audit)**: Ensure that loading states render dimension-matched skeleton placeholders so the UI never jumps or shifts when data arrives.

---

## 3. UI/UX Design Standards: Cyber Neo-Brutalism & Glassmorphism

### 3.1 Design Paradigms
* **Dark Neo-Brutalism**:
  * 1px high-contrast structural borders (`border-zinc-800`, `border-zinc-700` on hover).
  * Crisp, bold visual hierarchy — no ambiguous flat surfaces.
  * Monospaced telemetry chips with uppercase letter-spaced captions (`text-[11px] font-mono tracking-wider`).
* **Cyber Glassmorphism**:
  * Translucent frosted glass containers using `bg-zinc-900/60` and `backdrop-blur-md`.
  * Subtle specular gradients on card headers (`from-zinc-800/40 via-transparent to-transparent`).
  * Ambient colored glow on active elements (Cyan glow for AI reasoning, Emerald glow for running workers).

### 3.2 Color Grading Rules
* **Avoid Generic Colors**: Never use uncurated browser defaults (raw red, blue, green). Always use calibrated Tailwind Zinc + Semantic Neon tokens.
* **Canvas Background**: Deepest Obsidian `bg-zinc-950` (`#09090b`).
* **Cards & Panels**: `bg-zinc-900/65` with `border border-zinc-800/80`.
* **State Signatures**:
  * `Ready / Idle`: Muted slate (`zinc-400` text, `zinc-800` badge).
  * `Running / Online`: Emerald (`emerald-400` text, `emerald-950/40` background, `emerald-500/30` border).
  * `Scheduled / Busy`: Amber (`amber-400` text, `amber-950/40` background, `amber-500/30` border).
  * `Alert / Offline / Danger`: Rose (`rose-400` text, `rose-950/40` background, `rose-500/30` border).
  * `Interactive / Active Selection`: Cyan (`cyan-400` text, `cyan-950/40` background, `cyan-500/40` border).

### 3.3 Typography Rules
* **Sans Font**: Primary interface font for labels, paragraphs, buttons, and titles.
* **Monospace Font**: Mandatory for model filenames, quantization tags (`Q4_K_M`), tool names, token usage counts, cron expressions, UUIDs, and terminal streams. Always include `tabular-nums` so numbers don't jitter during live streaming.

---

## 4. Motion, Physics & Smooth Scrolling

### 4.1 Animation Guidelines
* **GPU-Accelerated Properties Only**: Only animate `transform` (`scale`, `translate3d`, `rotate`) and `opacity`. Never animate `width`, `height`, `margin`, `padding`, or `top/left` (causes CPU reflows).
* **Physics Springs (Framer Motion)**:
  * Standard UI Transition: `{ type: "spring", stiffness: 450, damping: 32 }`
  * Dialog / Modal Enter: `{ type: "spring", stiffness: 350, damping: 28 }`
* **Tactile Press Feedback**:
  * Every interactive button, chip, and link must scale down slightly on press:
    `active:scale-[0.97] transition-transform duration-100 ease-out`.
* **Breathing Engine Pulses**:
  * Running agent worker threads must display a dual-ring heartbeat:
    ```tsx
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
    ```

### 4.2 Smooth Scrolling
* Set `html { scroll-behavior: smooth; }` in `globals.css`.
* Apply the slim custom industrial scrollbar styles (6px width, zinc thumb, cyan highlight on hover).
* In terminal stdout logs and reasoning chat, implement auto-scroll down on new streaming tokens with an operator "Pause Auto-scroll" toggle.

---

## 5. High Performance & Faster Loading

1. **Zero Cumulative Layout Shift (CLS)**:
   * Skeletons are mandatory. Never show an empty white space while data is loading.
   * Skeleton elements must match the exact dimensions, border radius, and aspect ratio of the rendered component.
2. **Code Splitting & Lazy Loading**:
   * Use `next/dynamic` to dynamically import heavy components not needed immediately on first paint (e.g. Code syntax highlighters, terminal log viewers, complex modal dialogs).
3. **Memoization & Polling Hygiene**:
   * When polling real-time endpoints (e.g. `/api/v1/agents/running` every 3s), use `useCallback` for fetchers and `useMemo` for derived filtered lists to avoid redundant component re-renders.
   * Clean up all `setInterval` and `setTimeout` timers in hook return cleanup functions.
4. **Optimistic UI Updates**:
   * For non-reversible actions (deleting an agent, stopping a worker), update the UI state immediately and revert if the API request fails, providing a snappy, instant-feedback interface.

---

## 6. Error Handling & API Resilience

1. **User-Friendly Error Extraction**:
   * Never show raw `[object Object]` or cryptic network stack traces to operators.
   * Extract backend error descriptions cleanly:
     ```typescript
     const errorMessage = err?.response?.data?.detail 
       || err?.message 
       || 'An unexpected operational failure occurred.';
     toast.error(errorMessage, 'Operation Failed');
     ```
2. **Token Rotation Resilience**:
   * All API calls must route through the configured Axios client ([lib/api/client.ts](file:///e:/Agentic-AI-Workbench/frontend/lib/api/client.ts)) to benefit from transparent JWT token refresh on 401.
3. **Empty States with Direct Call-to-Action**:
   * Every view (No Agents, No Documents, No Downloaded Models, No Search Results) must provide a beautifully styled empty container explaining why it's empty and offering a primary button to take action immediately.
