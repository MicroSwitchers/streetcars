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
