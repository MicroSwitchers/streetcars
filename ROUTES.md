# Route data and scope

The route button selects the complete **standard daytime 501 Queen (Humber Loop–Neville Park)** or **505 Dundas (Dundas West Station–Broadview Station)** eastbound itinerary. Queen's late-evening Long Branch extension is a different service pattern and is not included. Oncoming boards show the opposite destination. Route choice persists offline and across updates; switching routes starts a new daytime ride.

Names and regular stop order were checked on 24 October 2026 against:

- [TTC / City of Toronto merged GTFS](https://open.toronto.ca/dataset/merged-gtfs-ttc-routes-and-schedules/), feed S1000542, 30 September–31 October 2026; regular eastbound patterns `shp-501-16` and `shp-505-09`.
- [TTC 501 Queen](https://www.ttc.ca/routes-and-schedules/501/0/2142) and [TTC 505 Dundas](https://www.ttc.ca/routes-and-schedules/505/0/2190), including the regular daytime termini and current stop-name corrections.
- [TTC Family of Services](https://www.ttc.ca/wheel-trans/family-of-services/Family-of-Services-Stops-and-Routes), confirming Queen/Yonge and Humber connections.
- [Northeastern University Toronto campus guide](https://bpb-us-e1.wpmucdn.com/sites.northeastern.edu/dist/c/788/files/2025/01/New-Campus-Guide-QSW-Discover-NU-Toronto.pdf), standard Queen stop order and IDs at University, York and Bay.
- [TTC TMU Station](https://www.ttc.ca/subway-stations/tmu-station) for the current station name; [Toronto by-law 1258-2024](https://www.toronto.ca/legdocs/bylaws/2024/law1258.pdf) for Coxwell Avenue / Emdaabiimok Avenue.

Queen's temporary York–Adelaide–Church diversion is replaced with its standard Queen Street stops: York, Bay, Yonge/Queen Station and Church. Feed typos and stale names are corrected (Queen **West** at Sudbury, TMU Station, Hennick Bridgepoint Hospital). The displayed Coxwell / Emdaabiimok intersection preserves the different street names north and south of Queen. Conditional short-turn and station-access stop patterns are excluded.

The shipped snapshot contains 62 Queen and 39 Dundas stops, with their TTC IDs. There is no live transit dependency. These are accurate **ordered stop itineraries**, not a survey or recreation of every minor cross street: street geometry remains procedural and straightened, with compressed distances. Dundas scenery draws on real regional character and representative landmark silhouettes; buildings are not exact reproductions. Real street bends and station loops are not reproduced.

Three overlapping stop locations share the existing neighbourhood. After departure from a section's last stop, a soft fade moves to the next section while driving and sound continue. Served stops and the every-two-stops option use the complete itinerary's indices, so section boundaries do not add or omit stops. Only the actual final stop offers Again; Full auto repeats the complete itinerary. Resident geometry, sign textures and traffic pools remain bounded on iPad.

Contains information licensed under the Open Government Licence – Toronto.

Verification: `node qa/check_routes.mjs` covers both complete trips at both stop intervals. `node qa/check_live.mjs <PWA URL> --ipad --routes` covers route-button changes, boards, moving section fades, complete Full auto itineraries, persistent selection and offline restart.

## Dundas scenery references

Research checked on 24 October 2026 informs the following west-to-east visual progression. These are practical scenery regions, rather than official neighbourhood boundaries. The world remains peopleless: buildings, vehicles, objects and greenery provide the detail. Reference photographs inform original procedural geometry and materials; no source photographs or textures are copied into the app.

Dundas reuses Queen's Blender-built shop merchandise, street furniture and heritage architecture kit. Nearby display bays have 2.3-metre furnished recesses with thin glazing, varied interior light colours and pavement illumination. Selective cornices, straight lintels and sills, industrial steel windows, occasional fire escapes, varied storefront frames and canopies, and branched leaf crowns add depth. Shop lettering is drawn at the physical plaque aspect ratio; generic arch overlays are excluded. Shop names and modelled merchandise use the same retail profile. Brick, stone, plaster, timber and roof finishes use mipmapped surface detail. Each section updates fixed instance buffers with capped authored-asset counts; the iPad pixel, shadow, light and frame-rate settings remain unchanged.

| Route section | Visual character and placement |
| --- | --- |
| Dundas West Station to Sterling Road | Brick commercial rows, converted houses, small apartments and varied rooflines around Roncesvalles. |
| Lansdowne Avenue to Shaw Street | Little Portugal's narrow low-rise storefronts, independent cafes, bakeries and mural panels. |
| Shaw Street to Bathurst Street | Trinity Bellwoods' tree-filled park edge south of Dundas near Shaw and Crawford; older retail toward Toronto Western Hospital. |
| Denison Avenue to Beverley Street | Chinatown's close retail frontages, awnings and produce displays. |
| McCaul Street to University Avenue | A representative timber-ribbed glass AGO frontage south of Dundas, followed by larger institutional buildings. |
| Chestnut Street to Church Street | Taller downtown retail and office buildings, with screens and the open Sankofa Square southeast of Yonge and Dundas. |
| Jarvis Street to Parliament Street | Garden District and Cabbagetown-edge brick houses adapted into storefronts, heritage rooflines and newer infill. |
| Parliament Street to River Street | Regent Park's modern podiums, towers and planted public space; the big park north of Dundas and Daniels Spectrum south at Regent Park Boulevard. |
| River Street to Broadview Avenue | An open Don Valley crossing with railings and lower greenery. |
| Mountstephen Street to Gerrard Street | Broadview and East Chinatown's small brick shops, with a redbrick and pale-stone library silhouette at the northwest Gerrard corner. |
| Langley Avenue to Millbrook Crescent | Riverdale Park's grassy slope and distant downtown skyline west of Broadview; residential frontage on the east. |
| Wolfrey Avenue to Broadview Station | Tree-lined residential frontage transitioning to the station entrance on the east side of Broadview. |

Primary references:

- [City of Toronto: Dundas and Roncesvalles heritage assessment](https://www.toronto.ca/legdocs/mmis/2020/te/bgrd/backgroundfile-158596.pdf), for commercial main-street buildings, adapted houses and apartments.
- [Little Portugal Toronto BIA](https://lptbia.com/about), for the Lansdowne-to-Shaw corridor, independent shops and murals.
- [City of Toronto: Trinity Bellwoods Park](https://www.toronto.ca/city-government/planning-development/construction-new-facilities/park-facility-projects/trinity-bellwoods-park-access-circulation-study/) and [Chinatown BIA listing](https://www.toronto.ca/business-economy/business-operation-growth/business-improvement-areas/bia-list/bia-list-a-e/), for their street boundaries.
- [Art Gallery of Ontario: Galleria Italia](https://ago.ca/agoinsider/view-torontos-living-room), for the curving glass and warm timber structure visible from streetcars.
- [Sankofa Square Board of Management](https://www.sankofasquare.ca/about-us), for the public plaza and digital screens.
- [City of Toronto: Garden District heritage plan](https://www.toronto.ca/wp-content/uploads/2021/11/96fb-CityPlanning-Garden-District-HCD-Revised-Plan.pdf) and [Cabbagetown Southwest district](https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/cabbagetown-southwest-heritage-conservation-district-plan/overview-cabbagetown-southwest-hcd-plan/), for older residential and adapted commercial frontages along Dundas East.
- [Daniels Spectrum](https://www.danielsspectrum.ca/contact), for its southwest-corner location at Dundas and Regent Park Boulevard.
- [City of Toronto: Riverdale Park East](https://www.toronto.ca/city-government/planning-development/construction-new-facilities/park-facility-projects/riverdale-park-east-top-of-bank-improvements/), for the Broadview hill and skyline outlook; [Toronto Public Library: Riverdale Library](https://tpl.ca/about-the-library/library-history/carnegie-riverdale/), for redbrick and white sandstone details.
- [TTC: Broadview Station](https://www.ttc.ca/en/subway-stations/broadview-station), for the entrance on the east side of Broadview north of Danforth.
