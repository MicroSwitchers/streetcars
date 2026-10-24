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
timer, day/night and weather clocks, settings and pause state survive the reload.
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

Apple mobile devices (including iPad Safari desktop mode) start on a separate forward renderer with a 400,000-pixel drawing budget, 512-pixel sun shadow map and a 30 fps cap. It keeps the game models, PBR materials, weather sky/rain and night lights, while omitting the desktop MRT/AO, volumetric and screen-space reflection passes. At most four local spot lights and two cabin point lights shade the scene. Large livery and sign textures are reduced to at most 2048 pixels per side before GPU upload. Automatic quality cannot promote these devices back to the heavy renderer.

Context-loss listeners install before renderer creation. A failure pauses rendering, preserves the ride when available and persists the safe renderer for subsequent loads. Context restoration rebuilds reflection probes and leaves the player paused at the same position. A GPU startup failure can still trigger PWA update checking. Normal desktop rendering remains available on devices without a recorded GPU failure.

Checks: `node qa/check_graphics_budget.mjs`; `node qa/check_live.mjs <PWA URL> --ipad --loss`; `node qa/check_live.mjs <PWA URL> --startup-loss`; and `node qa/check_live.mjs <PWA URL> --loss`. These simulate device detection and actual WebGL context loss/restoration in Chrome; they do not substitute for a physical iPad test.
