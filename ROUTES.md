# Route data and scope

The route button selects the complete **standard daytime 501 Queen (Humber Loop–Neville Park)** or **505 Dundas (Dundas West Station–Broadview Station)** eastbound itinerary. Queen's late-evening Long Branch extension is a different service pattern and is not included. Oncoming boards show the opposite destination. Route choice persists offline and across updates; switching routes starts a new daytime ride.

Names and regular stop order were checked on 24 October 2026 against:

- [TTC / City of Toronto merged GTFS](https://open.toronto.ca/dataset/merged-gtfs-ttc-routes-and-schedules/), feed S1000542, 30 September–31 October 2026; regular eastbound patterns `shp-501-16` and `shp-505-09`.
- [TTC 501 Queen](https://www.ttc.ca/routes-and-schedules/501/0/2142) and [TTC 505 Dundas](https://www.ttc.ca/routes-and-schedules/505/0/2190), including the regular daytime termini and current stop-name corrections.
- [TTC Family of Services](https://www.ttc.ca/wheel-trans/family-of-services/Family-of-Services-Stops-and-Routes), confirming Queen/Yonge and Humber connections.
- [Northeastern University Toronto campus guide](https://bpb-us-e1.wpmucdn.com/sites.northeastern.edu/dist/c/788/files/2025/01/New-Campus-Guide-QSW-Discover-NU-Toronto.pdf), standard Queen stop order and IDs at University, York and Bay.
- [TTC TMU Station](https://www.ttc.ca/subway-stations/tmu-station) for the current station name; [Toronto by-law 1258-2024](https://www.toronto.ca/legdocs/bylaws/2024/law1258.pdf) for Coxwell Avenue / Emdaabiimok Avenue.

Queen's temporary York–Adelaide–Church diversion is replaced with its standard Queen Street stops: York, Bay, Yonge/Queen Station and Church. Feed typos and stale names are corrected (Queen **West** at Sudbury, TMU Station, Hennick Bridgepoint Hospital). The displayed Coxwell / Emdaabiimok intersection preserves the different street names north and south of Queen. Conditional short-turn and station-access stop patterns are excluded.

The shipped snapshot contains 62 Queen and 39 Dundas stops, with their TTC IDs. There is no live transit dependency. These are accurate **ordered stop itineraries**, not a survey or recreation of every minor cross street: the game retains a procedural, straightened streetscape, compressed distances and generic buildings. It does not reproduce real street bends, station loops or individual landmarks.

Three overlapping stop locations share the existing neighbourhood. After departure from a section's last stop, a soft fade moves to the next section while driving and sound continue. Served stops and the every-two-stops option use the complete itinerary's indices, so section boundaries do not add or omit stops. Only the actual final stop offers Again; Full auto repeats the complete itinerary. Resident geometry, sign textures and traffic pools remain bounded on iPad.

Contains information licensed under the Open Government Licence – Toronto.

Verification: `node qa/check_routes.mjs` covers both complete trips at both stop intervals. `node qa/check_live.mjs <PWA URL> --ipad --routes` covers route-button changes, boards, moving section fades, complete Full auto itineraries, persistent selection and offline restart.
