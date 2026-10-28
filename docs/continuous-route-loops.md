# One continuous practice loop

Each selected route is one ordered drive, not one route for each shaping anchor.
The shared route screen now shows one complete loop instead of presenting the
anchor count as the main route metric. The actual anchor count remains available;
no paid content, route point, route identity or historical session is removed.

Mapbox retains the complete provider road geometry. Direction arrows follow that
geometry's stored order. A shared Start / Finish marker replaces overlapping
endpoint markers only when both anchors and actual road geometry close. Shaping
markers are optional, with the selected anchor still visible for inspection.
The initial compass direction uses the actual road geometry, not a straight line
to a distant shaping point. It is not a provider turn instruction.

Saved controls must start/end within one metre. The server also rejects provider
geometry with endpoints more than 25 metres apart (a bounded snapping tolerance).
It never appends a straight closing line or moves an existing route's coordinates
to make it look closed. Open routes require actual content review/revalidation.
Existing self-crossing, repeated-road, U-turn and 23–27-minute checks remain.

The primary presentation is the full Mapbox drive, covering 0–100% of the route.
That coverage label is not a GPS completion percentage. Google Maps hand-offs
remain available under a collapsed optional disclosure; selecting one does not
alter the Mapbox route or unlock another route. Every ordered point is retained.
[Google's URL documentation](https://developers.google.com/maps/documentation/urls/get-started)
limits intermediate waypoints to three on mobile browsers and up to nine
elsewhere. A single identical 25-anchor Google Maps mobile URL is not promised.

No database migration, route rewrite, generation/provider requests, purchase,
plan change, GitHub push or production deployment is part of this local change.
Verification includes synthetic closed/open route checks, mocked Mapbox marker
and direction-layer tests, Google hand-off coverage tests, and production builds.
Mocked rendering tests are not real-device navigation/GPS testing.

## Optional Waze approach navigation

The shared navigation panel now includes **Open in Waze · To start point** for
an accessible route with validated coordinates. It uses the full route's first
anchor, not the selected Google Maps section's start. Empty/locked navigation
data and invalid/missing coordinates produce no Waze destination link.

The HTTPS deep link contains only destination `ll` (latitude,longitude),
`navigate=yes` and the public `utm_source=drivecoach` identifier. No account,
access token, browser GPS position, waypoint list or session is sent. No new GPS
permission or provider request occurs when rendering the button. Opening the
external app is a deliberate user action; configure navigation while parked.

Waze calculates the approach from the driver's current position to that start.
It does **not** receive or reproduce the full practice loop. The full checked
round remains in Mapbox, and browser tracking may pause outside the browser.
The HTTPS link allows the normal app/web fallback documented by
[Waze Deep Links](https://developers.google.com/waze/deeplinks); no forced custom
scheme, app-install detection, paid API or API key is added.

Synthetic URL/rendering tests cover coordinate order, invalid input, fixed start
across Google section selections, absent/locked data and English/Dutch copy.
Real-device Waze hand-off/navigation has not been exercised by these tests.
