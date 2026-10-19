"""Bereitet die CC0-Aufnahmen für das Spiel auf (frontend/public/klang). Quellen und Lizenz: docs/assets.md.

Aufruf: python3 scripts/klang_aufnahmen.py <Downloadordner> frontend/public/klang
Im Downloadordner erwartet (nicht im Repo):
  g_682128.mp3, g_521587.mp3    Freesound-Vorschau (HQ) der Grasschritte HenKonen und Fission9
  h_691616.mp3                  Freesound-Vorschau (HQ) „Babbling Brook“ von KEPPLER1332
  ../fanto/Fantozzi-footsteps/  entpacktes Fantozzi-footsteps.7z (OpenGameArt)
  calm4.ogg, calm6.ogg          Junkala „Sand Castles“, „Innocence“ (OpenGameArt)
  x_<name>.mp3                  die Aufnahmen aus docs/mockups/klang/daten.js (Base64 dekodiert)
Braucht ffmpeg und numpy.
"""
import subprocess, sys, shutil, numpy as np
FS = sys.argv[1]; OUT = sys.argv[2]; SR = 32000
def load(f):
    return np.frombuffer(subprocess.run(['ffmpeg','-v','quiet','-i',f,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout,np.float32).copy()
def save(x, name, br='48k'):
    p = subprocess.run(['ffmpeg','-v','quiet','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a',br,f'{OUT}/{name}.mp3'],input=x.astype(np.float32).tobytes(),check=True)
def env(x, hop=160): return np.sqrt(np.convolve(x**2, np.ones(hop)/hop, 'same'))
def segments(x, rel=.06, gap=.07, minlen=.06):
    e = env(x); on = e > e.max()*rel; segs=[]; i=0; g=int(gap*SR)
    while i < len(x):
        if on[i]:
            j=i
            while j < len(x) and on[j:j+g].any(): j += 80
            if (j-i)/SR >= minlen: segs.append((max(0,i-int(.005*SR)), min(len(x), j)))
            i=j
        else: i+=80
    return segs
def fade(x, a=.004, d=.05):
    x=x.copy(); na=int(a*SR); nd=min(len(x)//2,int(d*SR)); x[:na]*=np.linspace(0,1,na); x[-nd:]*=np.linspace(1,0,nd)**2; return x
def rms_norm(x, target=.12): return x*(target/np.sqrt((x**2).mean()+1e-12))
def lowpass(x, f):
    X=np.fft.rfft(x); fq=np.fft.rfftfreq(len(x),1/SR); X*=1/np.sqrt(1+(fq/f)**4); return np.fft.irfft(X,len(x)).astype(np.float32)
def highpass(x, f):
    X=np.fft.rfft(x); fq=np.fft.rfftfreq(len(x),1/SR); X*=1/np.sqrt(1+(f/np.maximum(fq,1))**4); return np.fft.irfft(X,len(x)).astype(np.float32)

# Gras: Rascheln (HenKonen) mit leichtem Auftreten (Fission9) darunter
rustle = load(f'{FS}/g_682128.mp3'); thud = load(f'{FS}/g_521587.mp3')
rs = sorted(segments(rustle), key=lambda s: -np.abs(rustle[s[0]:s[1]]).max())[:4]
ts = segments(thud, rel=.04)
for k,(a,b) in enumerate(sorted(rs)):
    r = highpass(rustle[a:min(b, a+int(.42*SR))], 250)
    ta,tb = ts[k % len(ts)]; t = lowpass(thud[ta:tb], 300)[:len(r)]
    t = np.pad(t, (0, len(r)-len(t)))
    y = rms_norm(r, .1) + .45*rms_norm(t, .1)
    save(fade(rms_norm(y)), f'schritt_gras_{k+1}')
# Weg (Erde, Sand): Fantozzi Sand
for k, n in enumerate(['SandL1','SandR1','SandL2']):
    x = load(f'{FS}/../fanto/Fantozzi-footsteps/flac/Fantozzi-{n}.flac'); a,b = segments(x, rel=.04)[0]
    save(fade(rms_norm(x[a:b])), f'schritt_weg_{k+1}')
# Bach: KEPPLER1332 „Babbling Brook“, 20 s nahtlos (Überblendung am Ende)
x = load(f'{FS}/h_691616.mp3'); L, X = 20*SR, int(2.5*SR); s = 4*SR
body = x[s:s+L].copy(); tail = x[s+L:s+L+X]; w = np.sin(np.linspace(0, np.pi/2, X))
body[:X] = body[:X]*w + tail*np.cos(np.linspace(0, np.pi/2, X))
save(highpass(body, 90)*.9/np.abs(body).max(), 'bach', '40k')
# Aus dem Mockup übernommen (Kenney, Ylmir, Spring Spring, Junkala)
for src, dst in [('step_wood_000','schritt_holz_1'),('step_wood_003','schritt_holz_2'),('step_concrete_000','schritt_stein_1'),('step_concrete_003','schritt_stein_2'),
                 ('rpg_doorOpen_1','tuer_auf'),('rpg_doorClose_2','tuer_zu'),('rpg_metalPot1','topf'),('rpg_handleCoins','muenzen'),('rpg_chop','hacken'),
                 ('rpg_bookFlip2','buch'),('rpg_cloth2','tuch'),('rpg_metalLatch','schloss'),('amb_regen','regen'),('amb_voegel_wind','voegel'),
                 ('music_morgen','musik_morgen'),('music_mittag','musik_mittag'),('music_abend','musik_abend')]:
    shutil.copy(f'{FS}/x_{src}.mp3', f'{OUT}/{dst}.mp3')
# Neue Stücke aus demselben Paket: Nacht (Innocence), drinnen (Sand Castles)
for src, dst in [('calm6','musik_nacht'),('calm4','musik_drinnen')]:
    subprocess.run(['ffmpeg','-v','quiet','-y','-i',f'{FS}/{src}.ogg','-ar',str(SR),'-c:a','libmp3lame','-b:a','56k',f'{OUT}/{dst}.mp3'],check=True)
