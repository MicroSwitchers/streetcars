Intersection infill uses a closed, 636-triangle Blender corner shop with a deep
stocked display, inset door, recessed upper windows, profiled window hoods,
returned roof coping and a terracotta medallion. New paneled shutters and separate
medallions also dress existing buildings. `source/corner_block_models.py` builds
these three additions. Swept balcony scrolls replace capped cylinder segments,
reducing the full kit from 10,584 to 10,348 triangles and from 383,804 to 380,664
bytes, without new image textures or decoders. Rebuild a dedicated preview with
`source/build_architecture.py -- --corner-review`.

`dist/intersection-blocks.js` subtracts existing frontage, protected park/landmark
plots and crossing clearances before closing unintended gaps. The same planner
serves both routes. Queen reserves complete side-street corner footprints first;
Dundas allocates structural shells before optional facade ornaments, retaining
its 380,000-triangle combined resident ceiling. Side streets continue to another
junction and an occupied block; skyline towers no longer stand in Queen's
side-street corridors. Fixed sign matrices grew by 80 entries (about 6 KB), while
new plaques reuse the existing atlas and existing sign proportions.

The architectural kit now contains 20 Blender prototypes, including seven low-cost
masonry reliefs: straight window hoods, terracotta spandrels, recessed parapet
friezes, louvred vents, collared downpipes, fluted piers and profiled stone belts.
These additions total 472 source triangles and about 30 KB in the decoder-free
GLB. The complete kit remains below its original 11,000-triangle source budget.
`source/facade_detail_models.py` builds the new parts; rebuild the full kit with
`source/build_architecture.py`. The editable file is
`../building-architecture-game-ready.blend` relative to the repository root.

`dist/facade-details.js` plans reliefs around actual window apertures, with four
masonry styles and a separate modern podium treatment. Queen and Dundas reuse
the same prototypes on their main frontages, exposed upper party walls, corner
returns and side streets. Dundas reserves at most 29,000 of its existing facade
triangles for these reliefs; the overall 380,000-triangle resident budget remains
unchanged. No lights, shadow maps or texture atlases were added. Side-street
offices also continue their glazed upper floors above the masonry podium.

# Photo-refined TTC CLRV game asset

The shared street-furniture kit now has 33 original prototypes. New planting
assets include a slatted cedar trough, cast-stone planter, wall flower box,
climbing trellis and wall lantern. The `parkedbike` prototype contains its bicycle,
ring-and-post stand and U-lock together; freestanding `bicycle` is shop merchandise
only. These six additions total 5,644 source triangles, reuse the existing PBR
materials, and add no image textures or decoders. The editable lineup is saved as
`../street-furniture-game-ready.blend` relative to the repository root. Rebuild with
Blender 4.5 and `source/build_street_props.py -- --skip-render`.

Trees on both routes, their side streets and parks use the shared deterministic
`treeShape()` in `dist/surfaces.js`: tapered, forked branches and three crown
proportions. Each foliage card carries 56 fine leaflets, with cutout coverage
preserved in the 256-pixel texture's mipmaps. This replaces large leaf shapes
without increasing canopy triangles; uncapped branch segments reduce trunk cost.
Planters, trellises and window boxes reuse this foliage and shared cedar grain.

The street furniture kit also includes five original Blender models: a louvered
utility cabinet, newspaper dispenser, cast ring-and-post bicycle stand, tree
grate and slotted curb drain. Their combined source budget is 3,747 triangles.
They reuse the existing kit materials and add 132,444 bytes to `street-props.glb`,
with no image textures, decoders, animation or extra light sources.

The editable kit is `../../street-furniture-game-ready.blend`. Rebuild it with
Blender 4.5 in background/factory-startup mode using
`source/build_street_props.py -- --skip-render`; `source/street_detail_models.py`
contains the five new designs. `source/render_street_details.py` renders their
review lineup from the saved native file. Queen uses spatial instance batches;
Dundas reuses fixed instance buffers and its existing 190,000-triangle retail
ceiling. Flat grates and drains skip shadow casting. Placements leave boarding
areas, crossings and the curb camera corridor open.

The current editable asset is `../../ttc-clrv-game-ready.blend`.
The game export is `ttc-clrv-refined.glb`, installed as `../dist/ttc-clrv.glb`.
All images are packed into Blender and embedded in the GLB.

The supplied `ttc-clrv-improved.blend` and `ttc-clrv-improved.blend1` are unchanged.
Inspection found the same mesh geometry in those two files; the `.blend` file had
been saved later. `blend-comparison.json` records the comparison. The previous game
export is preserved as `ttc-clrv-pre-refinement.glb`.

## Improvements

- A continuously curved nose, raked wraparound windshield, rounded destination mask
  integrated into the roof, one central driving headlamp, small corner lamp
  clusters, fleet numerals above the rollsign, recessed service hatch, and layered
  end anti-climbers. The existing 4039 identity and 501 Long Branch sign remain.
- Passenger windows have real rounded apertures, rubber surrounds, thin aluminium
  sash details, and opening-window dividers. Door leaves have capsule-shaped glazing,
  compression seals, hinge fittings and STOP markings. Waist trim ends at the door
  jambs; it does not cross either open entrance.
- The high floor is inset inside the exterior body shell. Entrance steps reach
  the raised saloon without passing through the side livery.
- The rear now has the same continuously rounded plan as the front, with upright
  wraparound glazing, two perforated ventilation grilles, three lamps on each
  side, a trolley retriever housing and cord, and a curved rear route-number mask.
- Forty-two passenger seats use curved cushion/back shells and rolled stainless
  surrounds. The rear nook contains three forward-facing seats across the
  back and two inward-facing seats on each side. All seven seats use the same
  height as the other passenger seats, with a continuous saloon floor underneath.
  Wood liners, grab rails and an interior fleet-number headboard finish the nook.
- The roof has one trolley equipment tray, porcelain insulators, coiled return
  springs, guards, a rear anti-slip walkway, shoulder intakes, shallow seams and
  an access hatch. The three repeated large vent boxes have been removed.
- The cabin has cream ceiling panels with seams and screws, recessed ventilation
  channels, individual fluorescent fittings, original transit cards, swept steel
  stanchions, wood entrance partitions, a red driver cabinet and a farebox.
- Separate, compact albedo, normal and roughness maps for floor rubber, wood and upholstery.
  Existing paint and brushed-steel detail remains. Small fitting geometry is reduced
  and meshes remain batched by material and functional parent.

## Game budget and compatibility

The validated export has **153,608 triangles**, **106 material primitives** and a
**7.41 MB** GLB with 15 embedded images and no decoder dependency. The previous
rounded-front revision had 135,632 triangles, 106 primitives and a 7.56 MB GLB.
All 19 controller pivots and all four animation clips are
preserved. Wheel radius, rigid trolley reach, folding-door controls and lamp
materials remain compatible. The runtime headlight now aligns with the central lamp.

`validation-refined.json` records the export checks. `native-validation.json` verifies
the saved Blender rest pose and open doorway clearance. Browser ray checks verify
continuous curvature across both ends, the level rear floor and seats, interior PBR maps
and clear entrances at both trim heights. Browser checks cover doors, wheel
rotation, trolley contact, lights, the inset floor, bumper stability, phone layouts,
night rendering, and the embedded offline build. This is a photo-based reconstruction,
not a surveyed replica; original pivot locations remain to preserve game behaviour.

## Reference and previews

The user's supplied front, rear and interior photos guided the shape and cabin.
Dimension/vehicle context was cross-checked against the
[Seashore Trolley Museum's CLRV 4068 collection entry](https://collections.trolleymuseum.org/items/326)
and the [Illinois Railway Museum's CLRV 4034 entry](https://www.irm.org/player/ttc4034/).
Their length/height conventions differ, so the asset's established game scale was
retained while visible proportions and fittings were refined.

- `refined-front.png`: front/door-side exterior.
- `refined-nose.png`: close view of the curved cab and trim.
- `refined-rear.png`: rear/non-door-side exterior.
- `refined-interior.png`: saloon interior.
- `refined-lounge.png`: close view of the seven-seat rear nook at normal saloon level.
- `refined-logo.png`: close view of the corrected TTC crest.
- `refined-roof.png`: overhead roof layout.
- `refined-rear-close.png`: curved rear, ventilation and lamp details.
- `source/build_refined_streetcar.py`: editable procedural model source.

The TTC crest uses the winged keystone and interlocking monogram from the
[published vector artwork](https://commons.wikimedia.org/wiki/File:Logo_of_the_Toronto_Transit_Commission.svg),
converted to white ink with transparency to match the supplied reference.
The original SVG and the embedded atlas version are retained in `source/`.
No photographic textures or stock-image watermarks are included; all textures
are embedded, so the game makes no external image requests.

## Rebuild

Use Blender 4.5 LTS and Python with Pillow. From the workspace root:

```powershell
python .\Queen-Street\asset-source\source\make_refined_markings.py
python .\Queen-Street\asset-source\source\make_refined_materials.py
python .\Queen-Street\asset-source\source\make_cabin_details.py
& 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe' --background --factory-startup --disable-autoexec --python .\Queen-Street\asset-source\source\build_refined_streetcar.py -- --skip-render
python .\Queen-Street\asset-source\validate_refined.py
Copy-Item .\Queen-Street\asset-source\ttc-clrv-refined.glb .\Queen-Street\dist\ttc-clrv.glb
python .\Queen-Street\build_offline.py
```

The builder captures and restores the canonical rest transforms around glTF export,
so NLA evaluation does not leave nested door pivots in an evaluated pose in the
editable file. To review the saved file:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe' --background --factory-startup --disable-autoexec --python .\Queen-Street\asset-source\source\render_refined.py -- front rear interior lounge roof
```

The previous model and export are also preserved as `ttc-clrv-before-rounded.blend`
and `ttc-clrv-before-rounded.glb`. The earlier procedural source, export and preview
images are retained for reference. The shared cab profile is in `source/rounded_cab.py`.
The `finalize_refined.py`, `repair_refined_doors.py` and `finish_refined.py` scripts
record the one-time refinement/repair steps used during visual review; normal
rebuilds use `build_refined_streetcar.py` directly.

The rear, roof and saloon geometry is in `source/rear_roof_interior.py`.
The immediately preceding model, export and builder are backed up in
`before-rear-roof/`. The seat-support and shell-optimization scripts record final
review adjustments; those changes are already included in the main builder.
