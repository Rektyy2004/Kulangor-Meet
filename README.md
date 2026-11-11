# Kulangor Meetup

A simple blue-and-white meeting planner for up to 20 people. Locations can be anywhere supported by Google Places and driving routes; there is no KL/Selangor restriction.

## Run

Requires Node.js 20.19 or newer.

```powershell
npm install
npm run dev
```

Open **http://localhost:3000**. The app reopens this browser’s meetup, or creates one if needed. Share **Invite people**: the link opens the same workspace for everyone. Anyone holding it can view and edit every starting point; share only with your group.

## Set up the key

See [docs/API_KEYS.md](docs/API_KEYS.md). Put the private key in `.env.local`:

```dotenv
GOOGLE_MAPS_API_KEY=YOUR_PRIVATE_SERVER_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_WEBSITE_RESTRICTED_BROWSER_KEY
```

Enable **Places API (New)** and **Routes API** for the private server key. Enable **Maps JavaScript API** for a separate website-restricted browser key. The browser key displays the real map, surrounding streets and route playback. The private server key never goes into browser code. For production, create a JavaScript map ID and set `NEXT_PUBLIC_GOOGLE_MAP_ID`; local testing defaults to Google’s `DEMO_MAP_ID`.

Restart development after changing environment settings. For production, rebuild before starting:

```powershell
npm run build
npm start
```

## Use

1. Select **Add my starting point**, or invite people with the group link.
2. Choose a mapped street, landmark or specific neighborhood, e.g. Bandar Baru Sri Petaling. Avoid a whole town such as Subang or Klang when a more precise point is available. The complete selected address is shown.
3. Use **Edit my starting point**, **Change my starting point**, or the **Edit** link beside a person to change a saved entry. An edit preserves the person and does not consume another place, even in a full group.
4. Choose a departure time. The picker explicitly uses Malaysia time (UTC+8), including when a starting point is in another country.
5. Select **Calculate center**. See the geographic average, each person's driving km and minutes to it, and nearby restaurant suggestions.
6. Optionally select up to five personal restaurants and calculate again. Selecting any restaurant changes the people list and video to that destination.

Every link holder can edit any entry, including older entries. Changes refresh on other open workspaces within about 15 seconds, or on window focus. Unchanged refresh checks do not call Google. Concurrent edits to the same person use the last saved value. Each visitor can calculate and compare destinations locally.

## Center and restaurant calculation

The center averages latitude and unwraps longitude around the first location to handle crossings of the date line. It is an approximate geographic average, not a guarantee of the minimum total driving time. It can fall off-road or in water. Google driving routes may end at a nearby accessible point; missing routes are reported explicitly.

The server requests up to 20 popular restaurants within 5 km of the center and ranks the pool using rating, review count and an adjusted rating score. It returns up to ten, excluding closed venues. Fewer may exist in the search area. Ratings and review counts are displayed as evidence; no claim of universal restaurant quality is made.

The driving matrix uses one future departure and `TRAFFIC_AWARE_OPTIMAL`, with each request capped at 100 elements. Restaurant comparison cards show average km, average driving minutes and the longest drive. A personal selection unreachable by any member is identified instead of receiving fabricated distances.

## Google Map route preview

The main preview is a real Google road map showing surrounding streets and places. Each member has a labeled person icon in their assigned color. Actual Google Routes polylines connect the origins to the selected center or restaurant. Play, pause, replay and the progress slider move the icons and reveal their lines along those road paths. Small origin dots remain in place. Full route bounds are fitted, including road bends.

Playback is an illustrative 12-second animation, not real-time navigation or a downloadable MP4. It does not record or export Google map imagery. There is no example movie or schematic fallback. If the browser key is missing or rejected, an explicit setup message replaces the map and playback is disabled. Missing driving routes are reported rather than drawn as straight lines.

The separate [OSMnx/Manim renderer](renderer/README.md) is still available for independent geographic inputs; it does not consume Google-derived locations or routes.

## Storage and publishing

Without Supabase, group records are in ignored `.data/sessions/`, for one local Node process. The store retains user-provided names, place IDs and access-token hashes. Google details and traffic results are fetched when needed. The random 96-bit meetup ID is a shared access capability: anyone holding it can read the roster, change entries and request calculations. Token hashes are never returned. No individual accounts are required. Do not post this link publicly.

For shared hosting, configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and run [database/schema.sql](database/schema.sql) in the Supabase SQL editor. Existing deployments must also run the new `update_meeting_participant` function included there. Keep the service key server-side and add a distributed rate limiter for multiple web instances.

Deploy to a Node-capable HTTPS host so phone/laptop participants can use the same invitation. Invitations use the browser’s current website address. Localhost links work only on the device opening them.

`.env.local`, generated builds and local participant records are ignored by Git. Commit only the blank `.env.example` template. Before GitHub upload, check staged files and history for credentials; configure production secrets in the host's environment settings. No GitHub upload has been performed. Adapt the privacy/terms templates to the operator's real identity and retention policy before public operation.

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

Tests cover shared-link access, private hash exclusion, revision polling, edits at capacity, center calculations, matrix indexing/batching, missing routes and restaurant ranking. Provider-boundary tests use controlled responses. Live checks are described in [docs/CENTER_AND_PREVIEW_PLAN.md](docs/CENTER_AND_PREVIEW_PLAN.md).

Official references: [Google Routes policies](https://developers.google.com/maps/documentation/routes/policies), [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search), [Google key security](https://developers.google.com/maps/api-security-best-practices).
