"""Prepare the supplied CC0 recordings, leaving originals untouched.

Trim leading silence, normalize peaks, retain the full recorded decay, and
export 16-bit PCM without source metadata. No resampling or pitch changes.
"""
from pathlib import Path
import hashlib
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'dist' / 'audio'
OUTPUT.mkdir(exist_ok=True)
RECORDINGS = {
    'bell': ('479980__craigsmith__r04-39-trolley-bell.wav',
             'R04-39-Trolley Bell.wav by craigsmith -- https://freesound.org/s/479980/ -- License: Creative Commons 0'),
    'horn': ('131930__mcpable__industrial-air-horn.wav',
             'Industrial Air Horn by mcpable -- https://freesound.org/s/131930/ -- License: Creative Commons 0'),
}

def decode_pcm(data, width):
    if width == 2:
        return np.frombuffer(data, '<i2').astype(np.float64) / 32768
    if width == 3:
        b = np.frombuffer(data, np.uint8).reshape(-1, 3).astype(np.int32)
        values = b[:, 0] | b[:, 1] << 8 | b[:, 2] << 16
        return ((values ^ 8388608) - 8388608).astype(np.float64) / 8388608
    if width == 4:
        return np.frombuffer(data, '<i4').astype(np.float64) / 2147483648
    raise ValueError(f'Unsupported PCM sample width: {width}')

report = {}
for name, (filename, credit) in RECORDINGS.items():
    source = ROOT.parent / filename
    with wave.open(str(source), 'rb') as audio:
        rate, channels = audio.getframerate(), audio.getnchannels()
        samples = decode_pcm(audio.readframes(audio.getnframes()), audio.getsampwidth()).reshape(-1, channels)
    peak = float(np.max(np.abs(samples)))
    onset = np.flatnonzero(np.max(np.abs(samples), axis=1) > peak * .02)
    if not len(onset):
        raise ValueError(f'Empty recording: {source}')
    start = max(0, int(onset[0]) - round(rate * .004))
    samples = samples[start:] * (.80 / peak)
    fade_in, fade_out = round(rate * .002), round(rate * .040)
    samples[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    samples[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    target = OUTPUT / f'streetcar-{name}.wav'
    with wave.open(str(target), 'wb') as audio:
        audio.setnchannels(channels)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(np.rint(samples * 32767).astype('<i2').tobytes())
    report[name] = {'source': filename, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                    'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'credit': credit,
                    'leadingSilenceRemovedSeconds': start / rate, 'durationSeconds': len(samples) / rate,
                    'sampleRate': rate, 'channels': channels, 'bits': 16, 'bytes': target.stat().st_size}
    print(f'{name}: {len(samples) / rate:.3f}s, {target.stat().st_size:,} bytes')
metadata = ROOT / 'asset-source' / 'audio'
metadata.mkdir(exist_ok=True)
(metadata / 'recordings.json').write_text(json.dumps(report, indent=2) + chr(10), encoding='utf8')
