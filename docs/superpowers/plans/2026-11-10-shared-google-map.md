# Shared Google Map Implementation Plan

**Goal:** Everyone holding the meetup link can view and edit its starting points, and play road-following member journeys on a real Google Map.

**Architecture:** The existing random 96-bit session identifier is the shared access capability. Keep token hashes private. Poll a lightweight revision endpoint; fetch Google place details only after changes. Replace the schematic with Google Maps JavaScript, real Routes polylines, colored person markers, and playback controls. A separate website-restricted browser key is required; never reuse the private server key in the browser.

**Tech stack:** Next.js 16, React, Google Places/Routes/Maps JavaScript, existing local or Supabase persistence.

- [x] Add failing shared read/edit/calculate/routes tests, including capacity and private hash checks.
- [x] Enable link-based access, add revision polling, and point invitations to the workspace.
- [x] Replace schematic preview with real Google Map and moving person markers along actual road geometry. Keep origins visible and fit the complete route bounds.
- [x] Explain precise location selection and display the complete selected address.
- [x] Update privacy, instructions, and browser key setup documentation.
- [x] Run tests/build; verify shared workspace and responsive UI. Verify live map if a browser key becomes available; otherwise document that setup blocker accurately.

## Verification evidence

- Shared-link tests initially failed with 403, then passed after replacing organizer-only access with the user-requested shared capability model.
- Revision checks detect changes without a Google request; edits at capacity preserve the participant count and hide token hashes.
- Live HTTP route check: Subang Jaya → Bandar Baru Sri Petaling returned 15.8 km / 18 min / 159 road points for the selected future departure. The second test origin returned 14.0 km / 16 min / 153 points. Estimates vary with departure/traffic.
- Browser: token-free shared workspace loaded two participants; an edit at capacity saved; a subsequent edit from a separate HTTP client appeared automatically without reload. Temporary test group removed.
- Phone viewport: no horizontal overflow; controls stack into a single column.
- Private server key scan: zero matches in source/docs/tests/scripts/public/browser build assets. Local environment and participant data remain ignored; repository has no commits.
- Browser key is absent. Live Google basemap/marker playback cannot be visually verified until a separate website-restricted Maps JavaScript key is configured. The app displays setup instructions and disables playback rather than fabricating a map.
- Ruling: provide interactive Google map playback without recording Google imagery into an MP4. This matches the real-map preview request and is explicitly disclosed in UI/docs.

- Final review fixes: retain one Map instance to avoid repeat map loads when switching restaurants; wrap longitude during playback so date-line routes do not travel around the world. Date-line regression verified red→green.
- Final checks: 36 tests passed across 8 files; production build passed. Browser-key guard prevents reusing the private server key as a public key.
- Remaining external setup: configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; then rebuild/restart and visually verify Google basemap/marker playback.
