# Center and live journey preview

Implement the user's current request, replacing the former KL/Selangor-only rules.

- [x] Support authenticated participant edits (including at capacity) without duplicate entries; retain organizer access for legacy records.
- [x] Remove geographic search limits, compute an average center that handles the date line, and obtain each person's actual driving distance/time to it. Unreachable routes remain explicit.
- [x] Suggest up to ten nearby restaurants using Google popularity plus rating/review-count evidence. Retain separate personal restaurant comparisons.
- [x] Replace the missing-map placeholder and sample movie with a real-data schematic journey animation, in-app video preview, and per-person km/min. Use an abstract layout rather than pretending decorative connections are real streets. Optional Google road map remains available when the browser key exists.
- [x] Verify backend authorization/edits, center arithmetic, restaurant ranking and preview creation; check phone/laptop UI and secret isolation.

Google content remains ephemeral. The private server key never becomes a browser key. The schematic uses indexed layout and journey statistics, not geographic coordinates or a non-Google basemap. It carries Google Maps attribution. Exact street-network flooding cannot be derived from route-only data and is not represented as computed search exploration.

## Verification

- 32 automated tests cover the old flows plus authorized edits at capacity, private edit-token hashing, no participant-hash leakage, dateline handling, center journeys and unreachable routes, restaurant ranking, and preservation of rating/rank metadata on a personal selection.
- Actual Google checks used two public landmarks, held only in memory. Both had driving routes to the computed center (7.2 km and 11.9 km). Ten restaurants were returned, all with ratings and review-count evidence.
- Browser verification added a location to an isolated capacity-one test meetup, reloaded the form, changed the place and saved. The group remained at exactly one participant. The test meetup is removed after checking; existing user meetups are preserved.
- The preview was tested with a fixture group: the browser produced a blob video with readyState 4 and finite duration approximately 7.9 seconds. Playback advanced while paused=false. Selecting another destination produced a different video and updated the people panel.
- The optional Google road map still requires its own browser key. It is no longer a dependency of the video preview.
