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
