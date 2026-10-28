# Window and facade construction

Queen's main street, side streets and exposed end elevations use wall openings,
24 cm stone reveals, inset glazing and thin sash geometry. Existing furnished
storefront recesses, projecting Blender bays, balconies and roof lanterns remain.
Dormers now have inset glazing and projecting hoods. Dundas shops, houses, lofts,
office podiums and civic buildings use the same construction, including returned
windows on end walls.

Glazing is 23.5 cm behind the outer reveal, just in front of the backing wall.
`dist/facade-windows.js` partitions the masonry around aperture unions instead of
covering a solid wall with window stickers. Queen batches the static geometry;
Dundas reuses fixed instance buffers. Seven inexpensive wall-plane batches avoid
rendering the hidden faces of a box for every patch of brickwork. The existing
135,000-triangle base and 380,000-triangle combined Dundas ceilings remain.

Glass and tower curtain walls also use analytic ray/box room mapping. The visible
side walls, ceiling and floor change with viewing angle. Subtle roller blinds,
stable window occupancy and warm/cool night lighting add variation. The tower
rooms are a shader depth effect rather than individual interior meshes. Repeated
painted diagonal highlights were removed. This adds no texture downloads or lights
and keeps the existing iPad pixel, shadow and lighting limits.

`qa/check_facade_windows.mjs` tests aperture unions, wall coverage, face winding
and physical glazing depth. `qa/check_live.mjs --facades --districts` probes actual
rendered openings on both routes and across the Dundas districts, captures day
and night views, and checks all 37 resident sections for stable resources.

Dundas cross streets now continue through six individual buildings on each
occupied arm. Their district determines masonry, height, commercial or residential
fronts, canopies and trees. The nearer buildings have more individual windows;
distant buildings use fewer, broader apertures. All retain physical reveals and
perspective interiors. Native-aspect signs share the existing atlas, and curbside
hydrants, benches and bins reuse the Blender street-prop buffers. Park and valley
openings stay clear. Side-street props remain outside the road and leave a clear
walking line to the doors.

Dundas uses continuous tapered window jambs instead of a separate 25 mm bevel,
halving reveal triangles while retaining the full 24 cm recess. Hidden party-wall
windows are omitted; exposed corner windows and windows above lower neighbours
remain. This funds the side-street detail inside the same triangle ceilings,
without changing iPad resolution, shadows, lights or texture downloads.

Dundas also shares Queen's authored bay windows, iron balconies, selected
pediments, roof equipment, cafe furniture and shop boards. A bay or balcony
replaces its original glazing instead of being layered over it. Flower boxes,
produce in crates and cafe cups use the resident primitive/foliage pools.
Detailed counters have a separate allowance from inexpensive stocked shelving,
so every active furnished recess receives shelf contents. Architectural dressings
receive a reserved share of the shared 380,000-triangle budget alongside the base
and retail batches; no section can silently exceed the limit by adding decoration.

The Blender architecture kit includes projecting soldier-brick headers with
limestone keystones and alternating corner quoins. Its cornice retains the ogee
profile, dentils and corbels at 196 triangles per module (previously 484), allowing
complete cornices on many more Dundas frontages. A round-robin allocation spreads
heads, parapet panels, corner stones and drainage across buildings and street
orientations before adding secondary ornaments. Shopfronts step back by different
amounts; their roofs, apertures, signs and authored details follow the actual wall
plane. Bays and balconies have separate quotas on each side, replace the original
glazing, and keep their supports above the shop fascia.

Selected mid-block sites behind the heritage frontages on both routes now have
stepped office buildings, glazed podiums, floor bands and smaller crowns. Dundas
concentrates taller massing in its downtown, cultural and Regent Park regions.
The towers avoid cross-street corridors and protected park/valley openings, reuse
the existing office material and geometry buffers, and add no real-time lights.

Dundas also has five complete Blender building designs: a pedimented Victorian
shop, a clipped-corner cafe, a converted factory with northlight roofs, a balcony
apartment building and a stepped modern office. These replace selected procedural
buildings at their native widths. Each has its own apertures, side elevations,
entrance, roof and furnished shop recess; no duplicate wall or glazing is left
behind. District placement preserves parks and valleys. The reproducible source
is `asset-source/source/build_dundas_buildings.py`; running it in Blender saves
`../dundas-buildings-game-ready.blend` and exports `dist/dundas-buildings.glb`.
The five source models total 8,086 triangles in a 652 KB download.

Soft contact shading works in the iPad forward renderer. Blender bakes local
ambient visibility into vertices using 20 deterministic rays per vertex. The app
applies this only to indirect light, leaving direct sunlight and window emission
intact. Procedural window returns darken toward the glass, and wall materials add
short, soft gradients at their bases and beneath rooflines. A single fixed
instance batch, using a 32 by 64 pixel gradient, anchors walls to the pavement.
Stone entrance aprons bridge the setback to the sidewalk before this shading is
placed. This adds no full-screen pass, render target or real-time light. The
buildings and contact strips count toward the existing Dundas triangle ceilings;
all section changes reuse resident buffers.

`qa/check_live.mjs --ipad --authored --facades --buildings --intersections`
checks all 37 Dundas sections, the new models' actual window openings, buffer
stability and both triangle ceilings. It captures each design and compares
contact shading on/off in rendered pixels. The ground shading adds at most one
draw call. `qa/check_graphics.mjs architecture offlineArchitecture` also checks
the desktop renderer and both embedded Blender kits in the portable HTML.

The shared road is already a 3D mesh. Its asphalt uses independent 512-pixel
colour, aggregate-height and roughness maps at a 1.8-metre world scale. The three
maps replace the previous three maps and are generated once. Dry aggregate stays
rough; a damp film darkens it without polishing it. Standing water occupies
localized patches and gutters, with smoother normals, rain rings and softened
reflections. Night changes the light, not the surface's physical roughness.
Desktop reflections use stable world-space grain rather than depth derivatives;
iPad keeps its single forward pass and uses the same PBR material. No extra road
geometry, texture downloads, light sources or render targets are required.

`qa/check_live.mjs --pavement` reads the actual rendered roughness across more
than 2,000 road samples across every weather preset, including after-storm drizzle,
heavy rain, storm fronts, city rain and damp mist. It checks actual accumulated
wetness, a gentler contrast between the surrounding sheen and puddles, localized
standing water, and matching day/night material roughness. The shared material
and reflection response follow surface wetness throughout weather transitions;
recently soaked streets can remain wet even after rain weakens.
