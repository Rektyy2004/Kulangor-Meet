# Kulangor Meet Implementation Plan

**Goal:** Deliver a working 20-person meeting planner and independent 60 FPS road-animation pipeline from the supplied specification.

**Architecture:** Next.js frontend and route handlers with explicit demo/live modes. Supabase shared persistence or local development persistence. Python OSMnx/Manim renders use independently sourced geographic input.

**Spec:** docs/DESIGN.md; src/lib/types.ts defines shared contracts.

## Global constraints
- Never call demo estimates live traffic.
- Never accept raw address text as a mapped location.
- Use one future departure for all matrix batches, at most 100 elements each.
- Exclude incomplete destinations and use population standard deviation, then mean/max ties.
- Separate organizer authorization from public join links.
- Keep all secret keys server-side; no Google content in OSM exports.

## Tasks
- [x] Backend: test fairness, matrix indexing/chunking, missing routes, capacity, and session isolation; implement providers, session store, HTTP API, schema.
- [x] Frontend: responsive dashboard, accessible verified search, live/demo sessions, invitation, departure time, calculation, candidate comparison, animation controls and sample export.
- [x] Renderer: independent input validation, directed weighted road flood, Manim scene, CLI, synthetic demo video, Python tests and setup guide.
- [x] Integration: production build, full tests, type checking, browser interaction checks, inspect sample video, document setup and exact live-verification limits.

## Review focus
Origin/destination index order; incomplete and failed provider responses; stale/invalid/past departure times; leaked organizer tokens or participant coordinates on public endpoints; retained Google data and accidental demo/live crossover.
