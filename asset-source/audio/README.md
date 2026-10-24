# Streetcar recordings

- R04-39-Trolley Bell.wav by craigsmith -- https://freesound.org/s/479980/ -- License: Creative Commons 0
- Industrial Air Horn by mcpable -- https://freesound.org/s/131930/ -- License: Creative Commons 0

`python make_sounds.py` prepares the two supplied WAVs in the parent directory without changing those originals. The game keeps the complete recording after trimming leading silence, with its original sample rate, channel count and pitch. Peaks are normalized to 0.8; 2 ms / 40 ms boundary fades prevent clicks. The exported 16-bit PCM strips bulky source metadata. See `recordings.json` for source/output hashes, exact durations and trim amounts.

The bell rings on the first actual positive travel from rest, in all four control modes, including signal and traffic stops. It does not ring just for Go, door closure, arrival or resuming an already moving ride. Bell button / B and Horn button / H use these same buffers. Audio remains subject to the master volume and browser activation policy. Audio is prepared silently after a deliberate Go, Resume, driving or sound control; preparation cannot queue later playback. Existing cancellation, cooldowns and 800 ms stale-request limits apply to one-shots.

The audio, credits and departure logic are included in both `Queen-Street-Drive.html` and the versioned PWA. Run `python build_release.py` after changes.

Validation:

```text
node qa/check_departure_bell.mjs
node qa/check_sounds.mjs
node qa/check_graphics.mjs departureBell offlineDepartureBell audioActivation offlineAudioActivation doorAudio offlineDoorAudio streetcarAudio offlineStreetcarAudio
node qa/check_pwa.mjs
```

Chrome recording checks use a trusted Bell click with the normal autoplay policy, decode the actual PCM buffers, verify their onsets and durations, play both controls and check automatic departure timing. The engine checks cover station, manual, signal and traffic departures at multiple frame rates, plus door interlocks, pause/resume and snapshot restoration.
