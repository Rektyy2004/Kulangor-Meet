# Verification · 9 November 2026

The completed project was verified locally on Windows with Node.js 20.19.5 and Python 3.12 in `.venv`.

## Automated checks

- `npm test`: 20 passing tests across five files. Covers population deviation and tie breaks, 100-element batching, unordered provider indices, omitted zero-distance values, unreachable candidates, protected organizer access, capacity under concurrent submissions, ID-only persistence, live handler workflows with controlled Google responses, and empty HTTP 201 Supabase inserts.
- `npm run typecheck`: passed.
- `npm run build`: passed, including the dashboard, dynamic participant invitation, all API handlers, and privacy/terms pages.
- `npm run test:smoke`: passed against the production server. Checks the 20-person demo matrix, future departures, empty live sessions, organizer authorization, private public metadata, rejection of raw addresses, demo autocomplete, missing live credentials, and local persistence.
- `.venv\Scripts\python.exe -m unittest discover -s tests -p test_renderer.py`: 14 passing tests. Includes directed weighted routes, parallel-edge identity, reciprocal street flooding, distinct parallel geometry, invalid coordinates, disconnected graphs, cached graph mismatch and rejected Google provenance.
- `npm audit --audit-level=moderate`: zero reported vulnerabilities at verification time.

## Browser checks

Checked the production app at desktop width and 390 px phone width. No horizontal overflow was observed; phone inputs use 16 px type. Created a group through the interface, opened its participant invitation, confirmed the missing-Google setup state, and returned to the example group. Changed the MYT departure, confirmed the stale-result notice, recalculated for the new departure, played the animation, selected another venue, and filtered the member list. No browser error or warning logs were captured during these checks.

The live invitation does not show the private roster. End-to-end verified-location submissions are covered with controlled provider responses; a real Google lookup was not performed.

## Video checks

The delivered `public/demo-preview.mp4` was rendered with Manim: H.264, yuv420p, 1280 × 720, 60 FPS, 10 seconds, 20 synthetic origins. Flood and final-route frames were visually inspected. The video is illustrative and independent of the dashboard's separate synthetic estimates.

Actual Manim rendering was also checked with a short synthetic job. OSMnx successfully downloaded a small central Kuala Lumpur drive graph from Overpass: 469 nodes and 773 directed edges. An independent two-origin OSM job rendered to a 3-second, 60 FPS MP4, retaining curved road geometry. These integration-check files are in ignored `.data/`; the main downloadable sample is in `public/`.

## Remaining configuration

No Google or Supabase credentials were supplied. Real Google traffic, the browser Google map, and hosted Supabase persistence therefore remain unverified against those external accounts. The Supabase schema is supplied for setup. The project runs locally and has not been published to a shared HTTPS hostname.

Google geographic results stay in the Google Maps web flow. The independent OSM renderer takes separately sourced coordinates via its documented CLI, rather than exporting Google content onto another map. Live video jobs require this separate input and execution step.
