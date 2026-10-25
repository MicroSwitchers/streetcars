# Queen Street on phones and tablets

The installable version is in `pwa/`. Serve the **contents** of that folder at a
stable HTTPS address, either at the site root or in a subfolder. The portable
`Queen-Street-Drive.html` remains useful for opening the game as a local file;
installation and server updates use the hosted PWA instead.

On iPad/iPhone, open the hosted address in Safari and choose **Share > Add to
Home Screen**. On Android, use **Install Queen Street** in the game's settings
when offered, or the browser's **Install app / Add to Home Screen** menu. Wait
until Settings > Play as an app says **Ready for offline play** before relying
on an offline launch. Install prompts are controlled by the browser.

The game supports touch, portrait and landscape layouts, and modern browsers
with WebGL 2. Auto graphics starts with a smaller rendering budget on touch or
low-memory devices. Low, Balanced and High can also be selected manually.
Physical iPad and Android hardware testing is still recommended; the included
touch/tablet tests run in Chrome on a desktop GPU.

## Build and publish an update

From this project folder, run:

```text
python build_release.py
```

This rebuilds the portable HTML, the hosted PWA and `Queen-Street-PWA.zip`.
Upload the PWA files to the same address used for the previous release.

1. Upload the new `releases/<revision>/` directory first. It contains the exact
   JavaScript, CSS, models and audio for that revision.
2. Upload icons and the web app manifest, then publish `index.html`,
   `version.json` and `sw.js` last. An atomic static-host deployment is suitable.
3. Keep older immutable release directories when practical, especially during
   a rollout. The builder retains them locally; the ZIP contains the current
   release and the root files.

The release identifier is a deterministic hash of the source, assets, PWA
templates and builder. Running the build without changes does not create an
unnecessary app update. Changing a model, script, sound, style or PWA template
automatically changes the service worker and its cache version. Include this
build command in the server's deployment pipeline before publishing.

## Automatic updates

The app checks on launch, returning to the foreground, reconnecting, and every
five minutes while visible and online. New versions download without stopping
the current ride. All required assets are checked against SHA-256 hashes before
the new worker is allowed to install.

An installed update applies automatically when the ride is paused, waiting to
start, or dwelling at the last stop. Position, selected stops, door state, dwell
timer, weather clock, settings and pause state survive the reload. Every page load resets the lighting clock to morning daylight.
An active ride continues until a safe point. Other open tabs retain their older
cached assets until they can update too. Old caches are removed only after all
remaining clients report the current release.

If a required file is missing, corrupt or unavailable, installation fails and
the verified working version remains available offline. Audio supports cached
byte ranges, including the short range probes used by mobile media elements.
No update button, push-notification permission or app-store release is needed.
Browsers control execution while an app is closed; updates are checked when the
app next opens or resumes, rather than relying on a closed-app background timer.

## Hosting headers and compression

`pwa/_headers` supplies cache rules for hosts that support that format. Configure
equivalent rules elsewhere, adjusting the paths if the app is in a subfolder:

| Files | Cache-Control |
| --- | --- |
| `sw.js` | `no-cache, no-store, must-revalidate` |
| `index.html`, app root, manifest, icons | `no-cache` |
| `version.json` | `no-store` |
| `releases/*` | `public, max-age=31536000, immutable` |

Serve JavaScript as `text/javascript` and the manifest as
`application/manifest+json`. The build includes `.gz` variants of compressible
files. Enable static gzip or the host's automatic compression; a `.gz` file
must be sent with `Content-Encoding: gzip`, rather than changing URLs in the
HTML. For example, Nginx can use `gzip_static on;` with its normal MIME types.
Keep deployed file bytes unchanged: disable host-side minification or HTML
injection. Gzip/Brotli transport compression preserves the verified content.
The current runtime assets are about 18.9 MB raw and 9.9 MB with the supplied
gzip variants. Initial audio is deferred; the full offline cache downloads after
the first playable frame and reuses the browser's already fetched release files.

Local testing can use `python -m http.server 8125 --directory pwa`, then open
`http://localhost:8125`. Localhost is a development secure-context exception;
an iPad or Android device connecting over a LAN IP needs HTTPS.

## Validation

```text
node qa/check_ride_settings.mjs
node qa/check_graphics.mjs rideSettings rideSettingsPhone rideSettingsTablet offlineRideSettings
node qa/check_pwa.mjs
```

The PWA test stages complete and incomplete updates on a private local server,
disables the network, reloads the installed app, checks audio ranges, verifies
moving rides are not reloaded, and checks snapshot restoration and cache cleanup.
`asset-source/performance/validation.json` records the final results.

Implementation references: [MDN installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable),
[service worker lifecycle](https://web.dev/articles/service-worker-lifecycle),
and [WebKit Home Screen web apps](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/#every-site-can-be-a-web-app-on-ios-and-ipados).

## GitHub Pages deployment

The public game is at https://microswitchers.github.io/streetcars/ and the repository is https://github.com/MicroSwitchers/streetcars.

The `.github/workflows/pages.yml` workflow checks ride/audio behavior, builds the PWA and publishes it on every push to `main`. Runtime source and prepared game assets are tracked; generated builds, QA screenshots and native Blender backups are excluded from Git history. The build uses the committed PCM recordings, so original WAV masters are not required on the CI server.

Run `node qa/check_live.mjs` on Windows with Chrome installed to verify the public game becomes playable, finishes its offline cache and reloads with the network disabled. Local verification passed for release `a56a2e86639066b5`, including 46 cached assets, working sound credits and no runtime exceptions.

## iPad graphics and context recovery

Apple mobile devices (including iPad Safari desktop mode) use a separate forward renderer with a 30 fps cap. iPads normally use the 1,400,000-pixel / 2048-shadow Balanced profile; Low and recovery use 400,000 pixels and a 512-pixel shadow map. It keeps the game models, PBR materials, weather sky/rain and night lights, while omitting the desktop MRT/AO, volumetric and screen-space reflection passes. Balanced allows eight local spot lights and four cabin point lights; Low allows four and two. Large livery and sign textures are reduced to at most 2048 pixels per side before GPU upload. Automatic quality stays within the forward renderer and its Low/Balanced budgets.

Context-loss listeners install before renderer creation. A failure pauses rendering, preserves the ride when available and persists the safe renderer for subsequent loads. Context restoration rebuilds reflection probes and leaves the player paused at the same position. A GPU startup failure can still trigger PWA update checking. Normal desktop rendering remains available on devices without a recorded GPU failure.

Checks: `node qa/check_graphics_budget.mjs`; `node qa/check_live.mjs <PWA URL> --ipad --loss`; `node qa/check_live.mjs <PWA URL> --startup-loss`; and `node qa/check_live.mjs <PWA URL> --loss`. These simulate device detection and actual WebGL context loss/restoration in Chrome; they do not substitute for a physical iPad test.

## Sensory controls validation

`node qa/check_sensory_logic.mjs` checks the complete weather-button loop, stable shuffled weather and smooth boundaries. `node qa/check_live.mjs <PWA URL> --sensory --phone` and `--sensory --ipad` check defaults, bright/dim readiness, the compact route, early hold cancellation, full touch and keyboard holds, Random progression and all preferences after a complete offline reload. The iPad case also retains its bounded graphics profile.

## Sharper iPad profile

Auto now starts iPads in the forward Balanced profile: 1,400,000 drawing pixels, a 2048-pixel sun shadow map, eight nearby spot lights, four cabin point lights and 128-pixel reflection probes. It retains the 30 fps cap, bounded probe cache and 2048-pixel texture limit. It still avoids desktop MRT, volumetric and screen-space reflection passes. Settings enables Auto, Low and Balanced on these devices; High is capped at Balanced. Low and a recorded graphics-failure startup retain the previous 400,000-pixel / 512-shadow profile. Auto adapts using thresholds appropriate to a 30 fps target rather than treating the intentional frame cap as a performance problem.

## Morning starts and smooth dawn

New launches and fresh rides start at the morning/daylight beginning of the clock, even if a night choice was saved. Other preferences persist. Application-update and graphics-recovery reloads also reset the lighting clock and any manual fade to morning, while retaining the ride position and other settings. The morning clock waits for the first departure; an explicit Night selection still works before departure. In-place graphics restoration retains lighting continuity.

Dawn now takes 60 seconds; full night remains short at 12 seconds. The Day/Night control fades over eight seconds and supports reversing midway. On the iPad renderer, cached day/night/weather reflection atlases are mixed in a small GPU pass rather than swapping maps at 50% night. The scene uses one stable blended environment texture, keeping the main material shaders lightweight. Balanced increases to 1.4 million drawing pixels and 2048-pixel sun shadows; Low and the recovery fallback remain unchanged.

`node qa/check_live.mjs <PWA URL> --ipad --morning --dawn` verifies saved-night overrides, the higher budget, rendered dawn continuity, eight-second manual fades and morning startup offline. Reflection-map identity stays stable across dawn. The morning check also seeds a nighttime update/recovery checkpoint and verifies that the offline reload restores the ride in daylight. Always green defaults on and door dwell defaults to five seconds, with a one-time migration of the older defaults; subsequent choices persist.

Weather selections now crossfade over eight seconds, including interrupted changes and Weather Off. The sky, rain, fog, lighting and cached reflections share the transition; selecting weather never changes day/night. Paused Settings previews still finish their fades while the automatic clocks stay still. Rain wets the pavement promptly, and the film dries over a longer period after the rain stops. Dawn and dusk tint the clouds gently without an exposed sun disc or increased glare. The Day/Night button follows the actual scene, and selecting Night retains its full short night after the fade. The streetcar travel recording is 12.5% louder, with bell, horn, master volume and anti-pop fades unchanged.

`node qa/check_live.mjs <PWA URL> --ipad --morning --atmosphere --dawn --loss` checks rendered weather continuity, rapid selections without reflection leaks, gradual drying, static Weather Off, paused previews, three-minute phases, daytime startup, the richer tablet budget and graphics recovery.

## Complete Queen and Dundas itineraries

`dist/routes-data.js` holds the offline TTC stop snapshot; `routes.js` selects overlapping three-stop street sections without rebuilding the neighbourhood. The route badge switches the complete itinerary with a soft fade; `route-signs.js` updates the existing livery UV regions at 2048?1024. Roadside atlas cells are isolated by role and slot so reused signs cannot overwrite other streets. Route choice and itinerary progress are captured separately from ride physics. Every page load still starts in daylight. Legacy checkpoints without itinerary identity start a fresh ride, avoiding restoration of the former Bathurst/Portland sample onto the new stop list.

Run `node qa/check_routes.mjs` and `node qa/check_live.mjs <PWA URL> --ipad --routes`. Both full routes and both stop intervals are covered by the logic check; the browser check covers every stop, complete Full auto loops, uninterrupted driving during fades, constant scene object count, distinct sign atlas cells, destination textures and offline selection persistence. `ROUTES.md` is included in the verified offline cache with source and licence information.
