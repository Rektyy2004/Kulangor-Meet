# Kulangor Meetup simplification

Implement the user's seven requested changes in place. Preserve the existing organizer session and participants. Remove group creation controls; initialize one 20-person group only when this browser has no existing group. Keep organizer authorization and the private invite boundary.

Use a compact blue/white responsive page with the exact title Kulangor Meetup, Instructions and Invite buttons, KL/Selangor map, member list, departure picker, restaurant search, recommendations and user selections. Searches and submitted places must be in Kuala Lumpur or Selangor. Compare up to five user-selected restaurants against nearby recommendations using the same traffic matrix and departure. Show average, maximum and spread; show individual journeys when a place is selected.

Fix the video experience: embedded MP4 controls for the clearly marked sample, and Google route playback for real calculated routes. Never put the server key into the browser. Real MP4 generation remains the independent OSM CLI; do not mislabel the sample as the group's video.

Implementation sequence:
- [x] Add failing tests for region rejection and selected restaurant comparisons, then backend implementation.
- [x] Replace dashboard and styles with compact blue/white layout; preserve invitation controls and existing session.
- [x] Restrict Google map, add safe route playback and in-page sample video.
- [x] Run tests/typecheck/build and check laptop/phone browser flows; keep secrets ignored.

## Verification · 10 November 2026

27 tests pass; the production build and TypeScript checks pass. Regression coverage includes rejection of a neighboring state inside the rectangular map extent, personal restaurant comparisons with venue deduplication, explicit unreachable selections, authenticated route playback, and correct partial route geometry.

Browser checks at 390px and 1280px found no horizontal overflow. The page has the exact Kulangor Meetup title, no group-creation buttons, Instructions and a private participant invitation capped at 20. Real restaurant autocomplete returned Selangor results and added a selected restaurant chip. Existing stored sessions and participant records are retained.

The embedded MP4 loaded with readyState 4, duration 10 seconds and no media error; native playback advanced to 4.7 seconds with paused=false. This is explicitly a sample video. Live route animation is implemented for Google's route lines, with protected per-venue route loading, but cannot be browser-tested until a separate restricted browser Maps key is configured. The server key is intentionally not exposed to enable that map.

Real Google Nearby Search returned HTTP 200 with restaurant/cafe results in Selangor and Kuala Lumpur. The server key was absent from publishable source files and compiled browser assets; .env.local remains ignored. No GitHub upload was performed.
