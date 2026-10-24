"""Build both entry points and package the current static PWA for deployment."""
from pathlib import Path
import json,runpy,zipfile
ROOT=Path(__file__).resolve().parent
for script in ['build_offline.py','build_web.py']:runpy.run_path(str(ROOT/script),run_name='__main__')
pwa=ROOT/'pwa'
revision=json.loads((pwa/'version.json').read_text())['release']
with zipfile.ZipFile(ROOT/'Queen-Street-PWA.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(pwa.rglob('*')):
        if not file.is_file():continue
        relative=file.relative_to(pwa)
        if relative.parts[0]=='releases' and relative.parts[1]!=revision:continue
        archive.write(file,str(relative))
print('Ready to deploy:',ROOT/'Queen-Street-PWA.zip')
