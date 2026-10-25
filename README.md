# Queen Street — A streetcar ride

The default sensory view uses a single Go press. Go becomes bright green with a steady glow when available and dims while travelling or waiting; the glow can be turned off in Settings. The play view has no instruction bubble or destination subtitle. Optional street names sit on a narrow vertical route line at the left.

Hold the Settings control continuously for **3 seconds** with touch, mouse, pen, Space or Enter. A filling bar and countdown show progress; releasing early, dragging away, losing focus or hiding the page cancels the hold. The menu pauses the ride and restores its prior pause state on close.

The weather control cycles through slow cycling, Random, all eight fixed types and Off. Random follows a saved shuffled sequence with the same four-minute phases and gentle 90-second blends. Day/night works separately. Signal stopping defaults to off and remains optional; new installations default to Single press, with older saved play modes reset to Single press once for this update; later explicit mode choices persist. Validated preferences?including the ready cue, street names, mode, weather, sound, camera, stop options and night-light switch?persist in local storage across reloads and PWA updates.

Play online: **https://microswitchers.github.io/streetcars/**

GitHub repository: https://github.com/MicroSwitchers/streetcars

Every push to `main` runs the ride/audio checks, builds the versioned PWA from `dist/`, and deploys it to GitHub Pages. Installed copies download complete verified updates and apply them when the ride is paused. Edit the source in `dist/` and `pwa-source/`; generated releases, local renders and native Blender backups stay out of Git history.

A browser game built around the animated CLRV, with three levels of control and an optional Just watch mode. The original Queen Street West–inspired environment remains the backdrop; route distances and intersections are compressed rather than surveyed. The vehicle keeps its historic 501 Long Branch rollsign.

The game now uses the photo-refined CLRV asset, with a continuously rounded nose and wraparound windshield, a central driving headlamp,
rounded passenger windows and capsule door glazing, improved end fittings,
a raised floor, and a red-seat interior with stainless rails. The rear is also
continuously rounded, with separate ventilation grilles and stacked tail lamps.
The rebuilt roof has one trolley equipment tray and a rear anti-slip walkway.
The cabin has 42 formed seats, including a seven-seat rear nook at the same floor
and seating height as the rest of the cabin, a correctly proportioned TTC crest, detailed
ceiling panels and lights, wood entrance partitions, and driver equipment.
The editable model is `../ttc-clrv-game-ready.blend`. The previous `.blend` and
`.blend1` files are preserved. Rebuild instructions and exterior/interior previews
are in [asset-source](asset-source/README.md).

## Ride settings and mobile play

Settings now includes **Doors stay open** (no minimum, 5, 10, 15, 20 or 30 seconds)
and **Stop frequency** (every stop or every two stops). The door timer starts
when the doors finish opening and pauses with the game. Just watch departs when
the timer expires; other modes still wait for your command. Every two stops
serves Bathurst and Spadina on this route; the final stop is always included.

**Auto / Low / Balanced / High** graphics adapts resolution, shadows and effect
budgets. Touch devices start with a smaller budget. Models load in parallel,
audio loading is deferred, scenery uses local culling cells, and paused scenes
reuse their rendered frame. Startup prepares the HDR shaders asynchronously
without generating a redundant sky/reflection map.

An installable, offline-capable PWA is available in **pwa/**. It checks for
updates automatically and preserves the ride while applying complete updates
at a pause or the end of the route. Incomplete or corrupt updates retain the
working offline version. Run `python build_release.py` to rebuild both versions
and create **Queen-Street-PWA.zip** for a static HTTPS host.
See [installation, automatic updates and deployment](DEPLOYMENT.md) and
[performance validation](asset-source/performance/README.md).

## Weather and atmosphere

The starting look is subdued overcast, with slow weather and day/night cycles.
Settings > Weather offers **Slow cycle**, **Random**, **One weather type**, and **Off**.
The fixed type is saved separately, so switching modes retains your choice.
Weather phases last four minutes, with a gradual 90-second blend. Daylight lasts
four minutes, dusk and dawn each take 30 seconds, and full night lasts 12 seconds.

The sun stays behind a cloud veil. Sunny looks use gentle rays, restrained warm
light and softer wet-pavement highlights, without daytime bloom or an exposure
boost. Cached HDR skies still light glass, metal and paint. Night lamps illuminate
haze, rain and wet paving. Off removes animated weather, rain, fog, rays, wet-road
effects and bloom, with static diffused lighting; the separate day/night control
still works. Weather pauses with the ride and is included in the portable game.
See [weather implementation and validation](asset-source/weather/README.md).

## Building architecture

The street now includes an original ten-model Blender architecture kit across
111 buildings: carved cornices and window hoods, canted copper-roofed bays,
French-door iron balconies, stone pediments, grated fire escapes, roof lanterns,
chimney pots and louvred cupolas. The new bays replace the former overlapping
window boxes. Geometry is shared through spatial instance batches, with varied
stone/sash tints and the existing nighttime window lighting. The world remains
people-free.

The editable kit is `../building-architecture-game-ready.blend`. See
[architecture assets and validation](asset-source/architecture/README.md) for
the Blender source, preview, geometry budget and browser checks. The portable
`Queen-Street-Drive.html` embeds the complete kit.

## Play modes

| Mode | Player controls | Automatic help |
| --- | --- | --- |
| One button (default) | A large green Go button | Drives to each stop, brakes, opens both door sets, and waits indefinitely. Go closes the doors and starts the next leg. Again begins a fresh ride after the last stop. |
| Go + doors | Go plus door controls | Drives and brakes. Open and close the doors before departing. Choose one Open/Close toggle or separate Open and Close buttons. |
| Full driving | Power/brake slider plus door controls | Signals apply a safety brake; doors cannot open while moving, and traction is blocked while doors are open. |
| Full auto | Optional sounds; no Go or Pause control | Drives, opens the doors, spends 5 seconds at each stop, then continues. After the last stop it automatically repeats the ride under a soft camera dissolve. |

Bell and horn buttons are optional in every mode and can be hidden separately. They are extra play actions, never required to continue a one-button ride. There are no departure timers in the two Go-controlled modes; Just watch alone continues automatically. Ride speed can be set to 12, 20 or 30 km/h for those modes.

The **Always green traffic lights** setting is enabled by default and keeps the displayed signals, streetcar driving logic and background traffic in agreement. It works in every driving mode and can be changed while paused. Turning it off restores the timed green/amber/red cycle. **Stop at red lights** can be switched off separately; when enabled, a bottom-right indicator shows the current signal. Scheduled stops and door controls still work normally. Both choices are remembered in this browser.

Enable **Day/night cycle** in settings for 240 seconds of daylight, a 30-second dusk, 12 seconds of full night, and a 60-second dawn. The short night adds warm shop-window glow and cooler outdoor lighting. The Day/Night button then appears in the top bar and switches directly between the two parts of the cycle. Turning the cycle off restores daylight.

## Settings and input

Holding Settings for three seconds opens a modal supporter menu and pauses the ride. Preferences are stored in the current browser, with a fallback if local storage is unavailable. Choose large, extra-large or jumbo picture buttons, wider button spacing, high contrast controls, camera behaviour, small swipe adjustments, a calmer camera option, sound volume and sound-button visibility. The operating system's reduced-motion preference supplies the initial calmer-camera setting.

Use Space or Enter for Go when the street is focused, or activate a focused button using Space or Enter. Tab navigates controls. A held key cannot automatically depart the next stop. A switch that sends one of those keys or a click can use the same controls. Closing settings with Back to the streetcar returns focus to Go in assisted modes. Escape closes the menu and restores the prior pause state.

B rings the bell, H sounds the horn, and C changes camera. Full driving also accepts W / Up for power, S / Down for brake, Space for emergency brake, and D for doors. The slider supports pointer, touch and keyboard input. Phone layouts retain the large primary controls and keep the vehicle framed above them.

The player streetcar uses the right-hand track, with its doors and stop shelters on the curb side. The sidewalk camera watches from that same passenger side. Livery remains readable after correcting the vehicle handedness. The front door marker is mounted on the fixed body panel behind the door opening.

The camera menu and C key offer five views:

- **Calm - slow movement** is a wider, stable view of the whole streetcar with a small, slow drift over a 100-second cycle. Its height and horizon remain level.
- **Following from behind** travels behind the streetcar at a fixed angle, showing it move along the street.
- **Following from the front** travels ahead of the streetcar, looking back at its front.
- **Sidewalk - watching it pass** stays at a standing eye height of 1.65 m in one spot while the streetcar approaches, passes and goes away. A level pan centres the full streetcar silhouette and adjusts the field of view to keep the body above the controls. A 2.8-second dissolve moves to the next stationary spot; portrait views switch before the car comes too close for their narrow frame. Viewpoints cover stops and the complete route through its end. The camera never flies down the street between passes.
- **Explore - free camera** keeps the existing user-controlled orbit.

Calmer camera removes the calm view's automatic drift and lengthens view dissolves to four seconds. Sidewalk subject tracking remains active so the car stays visible. Dissolves render both views from the current simulation on every frame, so the streetcar, wheels and traffic keep moving. The outgoing sidewalk camera keeps panning from its fixed position; outgoing travelling views continue following the car. Both views retain ambient occlusion and antialiasing, blend in linear HDR colour and are tone-mapped once. Their shadow map is reused within the frame. Pausing freezes automatic movement and dissolves. Small swipe adjustments remain optional. View switches and automatic repeat rides also use the soft dissolve. Short landscape screens put the one-button or Just watch control at the right.

The Go, Open doors, Close doors, Bell and Horn buttons use original AAC-style silhouette pictures with word labels. Opening and closing have different pictures and inward/outward arrows; the toggle updates its picture and accessible name together. These are custom pictograms, not a licensed AAC symbol vocabulary. Jumbo controls reach 180 px tall on desktop and 176 px on portrait phones, with up to 30 px between buttons when wider spacing is enabled. Settings remember size and spacing separately.

**Explore - free camera** adds a user-controlled 360-degree exterior orbit. Drag left/right to turn and up/down to change height, use a mouse wheel or two-finger pinch to zoom, or use J/L, I/K and +/- on a keyboard. Re-centre restores its starting pose. It follows the moving streetcar and holds the selected angle at stops, with no automatic rotation. Camera height changes only through the user controls; the orbit stays within the street rather than climbing over buildings. Choosing Explore enables camera movement; the supporter can disable it with the swipe setting. Calm, Following, Front and Sidewalk views remain available.

## Sound

The bell uses ?R04-39-Trolley Bell.wav? by craigsmith ([Freesound 479980](https://freesound.org/s/479980/), Creative Commons 0). It rings once on the first actual forward movement after a stop, including the initial departure, station departures, signal stops and manual driving. Closing doors, waiting at a signal, pausing and resuming an already moving streetcar do not ring it. The Bell button and B key play the same recording on demand. The horn uses ?Industrial Air Horn? by mcpable ([Freesound 131930](https://freesound.org/s/131930/), Creative Commons 0).

The moving streetcar uses TRP's binaural Toronto streetcar pass recording ([Freesound 616611](https://freesound.org/s/616611/), CC0); it begins on movement, fades at stops, and resumes smoothly without looping. iamaviolin's ?Train Door Opening? ([Freesound 439499](https://freesound.org/s/439499/), CC0) plays when doors begin opening or closing. Go, Resume, driving input or a sound control enables audio, which follows the saved volume setting. Camera, Settings and unrelated clicks do not enable playback. Bell and door buffers prepare silently after audio is enabled. Pending requests cancel on pause/restart, stale one-shot requests expire, and naturally finished pass audio stays silent until the next travel leg. Recordings are included locally in the modular, portable and PWA builds. Sound credits appear in Ride settings and `THIRD_PARTY_LICENSES.txt`.

Run `python make_sounds.py` to reproduce the game bell and horn from the supplied WAVs in the parent directory. It removes leading silence and source metadata, normalizes peak levels and writes 16-bit PCM at the original sample rate and channel count, preserving the full recorded decay. Original files are untouched. Preparation details and hashes are in `asset-source/audio/recordings.json`.

## Files and development

Daylight combines a warm sun, cool sky fill and pavement bounce with a locally generated HDR sky/street reflection map. The optional day/night cycle smoothly adjusts the sun, sky fill, environment reflections, fog and shop-window glow. Twilight warms the haze, while warm street lamps illuminate nearby pavement and fade up with the night; only nearby lamp lights are active around the streetcar. The paint's existing clear coat and brushed metal respond to those outdoor reflections. A tighter, texel-stabilized shadow map follows the streetcar, and a soft contact shadow grounds the wheels and underbody. Headlights, cabin lights and marker lamps are automatically unlit during daylight, and the Night lights control enables them after dusk. Rear brake lenses brighten during deceleration and remain lit while the vehicle is held at a stop, in both daylight and darkness; the night-light switch does not disable braking. Background cars use a per-instance brake strength, so only the stopping cars brighten their rear lenses. Parked cars remain unlit. Nighttime red pavement spill also strengthens under streetcar braking. At night, all six amber side markers glow steadily and the red rear lenses brighten. Six short-range amber spotlights and two red rear spotlights illuminate the textured pavement with soft falloff. They are attached to the streetcar, fade up through dusk, and respond immediately to the Lights control even while paused. Their limited reach and disabled shadow casting keep the effect compact. Lighting requires no external assets or per-frame reflection capture.

The graphics pass adds a clouded procedural sky, detailed brick relief, world-scaled asphalt and concrete, reflective shop windows and individual leaf cutouts. The street extends well beyond both ends of the playable route, so the opening camera sees a continuous neighbourhood instead of the edge of the map. Paint, glass and brushed metal retain the original streetcar textures with adjusted outdoor reflections. A multisampled render target records colour and an 8-bit geometry-normal attachment in the same geometry draw, feeding half-resolution ambient occlusion, a depth-aware filter and the final edge-smoothing/vignette pass. AO uses the actual surface normals rather than differentiating adjacent depth pixels; this prevents depth precision steps from becoming stripes on flat panels and paving. Transparent overlays preserve the opaque normal behind them. Sky and overhead-wire shaders explicitly support the second attachment. Twelve fixed AO samples add contact depth around walls, curbs and vehicles; filtering respects depth boundaries, and distant shading fades out. Asphalt, concrete, roofing and brick have separate roughness maps, fine relief and subtle world-space weathering. Lower daytime fill and a slightly lower sun give facades stronger shape without washing out the pavement; cool nighttime fill keeps the street readable. The renderer caps display density at 2; HDR colour and multisampling follow the device's WebGL capabilities. Everything is generated locally and works offline.

The embedded rails, grooves, lane markings and stop lines are integrated into a single road surface. Zebra crossings use one set of depth-biased markings; the road shader does not draw a second stripe bank. Pixel-footprint filtering keeps thin lines stable in the distance. Side streets meet the main road without overlapping surfaces; small remaining surface decals use a depth bias. Flat road details do not cast tiny crawling shadows, and the camera uses a 0.5 m near plane for better depth precision. The streetcar's transparent safety decals also use a depth bias.

The interface uses a transit-inspired charcoal, cream and red palette, with a three-stop route strip that follows the ride. The original picture controls, button size choices, high contrast mode, keyboard input and camera comfort settings remain available. Desktop, portrait phone, short landscape and jumbo door-control layouts are included.

`dist/` is the complete static web build. Serve it with any static server. Run `python build_offline.py` to build `Queen-Street-Drive.html`, which embeds the model, modules and WAVs and opens offline by double-clicking.

`ride.js` owns mode transitions and motion; `cameras.js` handles framing and gestures; `sounds.js` handles audio; `app.js` owns settings, input and interface. `main.js` creates the renderer, `lighting.js` supplies daylight, reflections and shadows, `surfaces.js` generates materials and foliage, and `rendering.js` supplies ambient occlusion and the finishing passes. `shadow-bias.js` compensates shadow comparisons for the receiver's slope and the PCF filter footprint, preventing striped self-shadows on angled flat surfaces without changing the material textures or adding another render pass. `environment.js`, `neighbourhood.js` and `street-life.js` retain the street and background actors. `day-night.js` supplies the short-night timing, `streetcar-asset.js` prepares the curb-side doors and lettering, and `streetcar-traffic.js` controls periodic oncoming streetcars. `streetcar-controller.js` supplies wheel, folding-door, lighting and rigid trolley-wire controls for the GLB. Three.js and its licence are included.

For browser verification, serve this folder with `python -m http.server 8124 --bind 127.0.0.1`, then run `node qa/check_graphics.mjs`. It uses installed Chrome in an isolated headless profile and needs no npm packages. Checks cover desktop, phone, landscape, large separate door controls, settings and the embedded offline build; the ride checks exercise all stops and the door interlock. Each run saves screenshots and JSON results in a new `qa/renders-*` folder.

The environment includes a mural park, bicycles, side streets, shops, trees and signal-controlled background cars. Cross streets extend farther into the neighbourhood, with continuous rows of close-set storefronts, striped awnings, longer sidewalks that stop at the Queen Street sidewalk edge, returned corner façades, and clearly marked zebra crossings with tactile curb ramps. Crosswalk bars follow each street's direction, with separate banks set apart at the intersection corners. Exposed side elevations have layered masonry courses, quoins, window surrounds, and occasional metal fire escapes to avoid blank building ends. Varied striped canvas awnings bring colour and depth to most shopfronts without adding external assets. Upper-storey windows have contrasting lintels, sills and mullions, with continuous floor bands, corner pilasters, and varied capped parapets to break up the repeated rooflines. At street level, display scenes sit behind separately rendered, thin transparent glass panes and inset frames; entrances have glazed doors, divided transoms, metal handles, address plaques and individual stone steps. Sloped, braced awnings and projecting signboards use a shared illustrated sign atlas, with individually styled shop identities, border detail and subtle night illumination. Pedestrians have been removed. Traffic now uses Blender-built sedan, hatchback and wagon models with continuous curved bodywork, open wheel arches, curved glazing, visible interiors, detailed lights, mirrors, registration lettering and rolling alloy wheels. The native file is `../traffic-cars-game-ready.blend`; [car source and previews](asset-source/cars/README.md) include rebuild instructions. The three models and both distance levels share a roughly 1.3 MB GLB. Nearby cars use about 22,000 triangles each and distant cars about 5,300. Instanced batches share geometry and paint variants; parked transforms update when their distance level changes, while moving traffic and wheels update each frame. Headlamp and tail-lens emission follows the day/night cycle. The game uses standard HTML, JavaScript, WebGL and glTF, with no paid API or decoder dependency. The source is arranged so future simulation code could be supplied through Rust/WebAssembly without rebuilding the asset.

Camera behaviour and automatic watch rides can also be checked with `node qa/check_cameras.mjs`. This covers slow drift, fixed sidewalk positions, dissolves, pause, reduced motion, two complete automatic rides, and the original one-button waiting behaviour. More than 530,000 body-corner projections verify full-route sidewalk framing on desktop, portrait and short landscape screens at 10, 20 and 30 km/h, including reduced motion.

Check the AO output with `node qa/check_graphics.mjs ambientOcclusion ambientOcclusionPhone`: a controlled box-and-floor scene verifies contact shading, clean open surfaces, stationary-frame stability and odd-sized render targets.

Check surface banding with `node qa/check_graphics.mjs shadowSurfaces shadowSurfacesPhone surfaceArtifacts linesClose linesHiDPI linesRetina`. The zero-bias shadow stress fixture compares a moving shadow projection before and after slope correction, and verifies that a separate box still casts a real shadow. Isolated wall/floor scenes separately check that AO does not introduce bands. The regular sunlight bias and texel-stabilized projection remain in place.

Check depth-precision banding with `node qa/check_graphics.mjs depthNormals`: the previous depth-derived normal is compared with geometry normals on isolated walls and paving at 16, 18 and 20 bits, three near-plane distances, and a HUD-offset eye-level view. Contact shading is separately verified by `ambientOcclusion`. Browser checks also collect GPU warnings and check for WebGL errors.

Check continuous transition motion with `node qa/check_graphics.mjs liveTransitions liveTransitionsPhone liveTransitionsCalmer offlineLiveTransitions`. Pixel-centroid checks verify movement even at zero fade progress, when only the outgoing view is visible, and at several intermediate weights. An actual sidewalk pass checks forward travel, synchronized world position and rotating wheels through both ordinary and four-second calmer dissolves. `node qa/check_cameras.mjs` also checks outgoing tracking, retained camera modes and explicit pause behaviour.

Check the exterior night lamps with `node qa/check_graphics.mjs nightMarkers nightMarkerPhone nightRear offlineNightMarkers`. The checks compare the rendered asphalt with the new lights on and off, verify amber spill on both sides and red spill behind the car, and exercise dusk, travel and the paused Lights control. `StreetcarController.setNight(amount)` accepts a 0-to-1 night level; `lighting.js` supplies it from the day/night cycle. Exterior emitters are available separately from the central headlamp and cabin lights in `rig.exteriorEmitters`.

An oncoming CLRV periodically passes on the other track. One pooled vehicle shares the player model geometry and embedded textures, rolls its wheels, follows the opposite overhead wire, stops at red signals and pauses with the ride. After clearing the player it waits 22-30 seconds before approaching again. Its headlamp remains in the lighting setup between arrivals to avoid shader recompilation.

Check traffic direction, repeat arrivals, signal stops, door-side marker clearance and the short night cycle with `node qa/check_graphics.mjs oncoming oncomingPhone offlineOncoming`. These checks also verify that passing vehicles clear each other, that lettering geometry and textures are shared, and that the approaching car receives the same nighttime lens glow.

The Blender car models can be checked with `node qa/check_graphics.mjs carAssets carAssetsPhone carAssetsNight offlineCarAssets`. The checks verify scale and roof clearance, linked wheel meshes, lower distance budgets, switching with hysteresis and only one active distance level, nighttime lens glow, mirror clearance, signal stops, rolling wheels and offline embedding.

Check departure timing with `node qa/check_departure_bell.mjs` and the real recordings in Chrome with `node qa/check_graphics.mjs departureBell offlineDepartureBell`. Check delayed audio with `node qa/check_sounds.mjs` and `node qa/check_graphics.mjs audioActivation offlineAudioActivation`. The timing checks cover loads finishing after cancellation, expired button requests, pause/resume races, repeated stop updates and natural recording completion. Check the daylight/brake policy with `node qa/check_graphics.mjs daytimeBrakes daytimeBrakesPhone offlineDaytimeBrakes`; this includes a rendered-pixel check for actual red car-brake emission and tests normal stops, manual braking, coasting, night controls and the oncoming streetcar.

Full auto has no Go, Pause or Resume control. It starts and repeats the ride automatically. The P shortcut is disabled. Full auto also keeps running behind Settings. Hidden tabs and graphics recovery may suspend rendering internally; returning to a running tab resumes automatically. Play-mode preferences from before `playModeVersion: 1` migrate to Single press once, preserving all other settings. Future explicit mode choices remain persistent.

Every page load begins in morning daylight, including offline launches, update/recovery reloads and browsers with a saved night selection. Morning holds until the first departure, unless Night is explicitly selected. Always green traffic lights defaults on and doors stay open for five seconds; existing installations receive these defaults once (other custom door durations are retained). Later choices remain saved. Dawn fades over one minute, and manual Day/Night changes ease over eight seconds. iPad reflections now blend continuously with the sky; Balanced uses 1.1 million drawing pixels and a 1536-pixel shadow map, with Low available as before.
