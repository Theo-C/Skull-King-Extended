"""Prépare le son « carte posée » : décodage ADPCM → PCM, nettoyage, 3 variantes de hauteur."""
import numpy as np, subprocess, sys
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, resample
src, out = sys.argv[1], sys.argv[2]
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '1', out + '/_pcm.wav'], check=True)
sr, x = wavfile.read(out + '/_pcm.wav'); x = x.astype(np.float64) / 32768
x = x - x.mean()
x = x[:int(sr * .125)]                                   # le son utile s'arrête à ~0,105 s
# un peu de corps (≈ 200 Hz) et moins de grésillement au-dessus de 9 kHz (artefacts ADPCM)
body = sosfilt(butter(2, [140, 320], 'bandpass', fs=sr, output='sos'), x)
hi = sosfilt(butter(2, 9000, 'highpass', fs=sr, output='sos'), x)
y = x + body * 1.0 - hi * .45
n = len(y); fade = np.ones(n); f = int(sr * .02); fade[-f:] = np.linspace(1, 0, f) ** 2
fade[:int(sr * .001)] = np.linspace(0, 1, int(sr * .001))
y *= fade
for name, k in [('a', 1.0), ('b', 0.955), ('c', 1.05)]:  # hauteur ±5 % pour éviter l'effet « mitraillette »
    z = resample(y, int(len(y) / k))
    z = z / np.abs(z).max() * 0.5                          # crête à -6 dBFS : plus discret que les impacts
    wavfile.write(f'{out}/_c{name}.wav', sr, (z * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{out}/_c{name}.wav', '-c:a', 'libopus', '-b:a', '64k', f'{out}/carte-posee-{name}.ogg'], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{out}/_c{name}.wav', '-c:a', 'libmp3lame', '-b:a', '128k', f'{out}/carte-posee-{name}.mp3'], check=True)
