# Kulangor Meet

Build the user's supplied three-stage architecture: verified location collection for up to 20 people, traffic-based minimum-population-standard-deviation venue selection, then a separate road-flood video renderer.

Implementation choice: Next.js App Router with TypeScript; server-side Places API (New) and Routes API; Supabase REST storage, with atomic local JSON persistence for a runnable no-key demonstration. No existing project files or credentials were present. Work in the supplied empty project on codex/kulangor-meet.

UI: light editorial dashboard with warm white, forest green, orange highlights, large map, member list, venue comparisons, departure picker, group invitation, and animated independent demo schematic. New real sessions are empty. A seeded 20-person demo is always clearly labelled and never described as live traffic.

Live participant links can submit their own verified place but cannot retrieve all member locations. Organizer credentials are separate capability tokens stored hashed server-side. They are never in the invitation link. The browser uses Google Maps for live geographic data, with separately restricted browser key. Raw typed addresses never become submissions.

Calculation: 5 km centroid search for up to 15 places; future organizer-selected departure; optimal-traffic matrix in batches <=100 elements; reject candidates with any missing/unreachable origin; population deviation ascending, then mean, maximum, place ID. Results are ephemeral. Persist Google place IDs and user-provided names, refreshing Google details before calculation; cached coordinates expire after 30 days.

Video: OSMnx directed drive graph, weighted Dijkstra, Manim 60 FPS MP4, colored flood and final independently computed paths with OSM lengths. Google-derived routes, places, and coordinate exports are excluded from the OSM renderer under Google's mapping restrictions. Supply an independent OSM-coordinate input schema and runnable synthetic demo plus sample MP4. This source separation is an explicit necessary adjustment to the requested architecture.

Deployment: deliver the complete runnable local project and deployment instructions. Python renders run as CLI/background work on a machine with Manim, rather than inside web request handlers. Supabase and Google live verification require the user's credentials; do not invent successful provider calls. Separate Geocoding API is unnecessary. Google pricing uses SKU-specific allowances rather than the old $200 monthly credit.
