"""Build a self-contained, versioned static PWA. Run before every server release."""
from pathlib import Path
import gzip,hashlib,json,re,shutil

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'dist'
PWA=ROOT/'pwa-source'
OUTPUT=ROOT/'pwa'
def sha(data):return hashlib.sha256(data).hexdigest()
files={str(p.relative_to(SOURCE)).replace('\\','/'):p.read_bytes() for p in SOURCE.rglob('*') if p.is_file() and p.suffix in {'.js','.css','.glb','.wav'}}
files['pwa-client.js']=(PWA/'pwa-client.js').read_bytes()
shared={str(p.relative_to(PWA)).replace('\\','/'):p.read_bytes() for p in (PWA/'icons').glob('*') if p.is_file()}
shared['manifest.webmanifest']=(PWA/'manifest.webmanifest').read_bytes()
shared['THIRD_PARTY_LICENSES.txt']=(ROOT/'THIRD_PARTY_LICENSES.txt').read_bytes()
source_html=(SOURCE/'index.html').read_text(encoding='utf8')
template=(PWA/'sw.template.js').read_text(encoding='utf8')
revision=sha(source_html.encode()+template.encode()+(ROOT/'build_web.py').read_bytes()+b''.join(name.encode()+data for name,data in sorted({**files,**shared}.items())))[:16]
release=OUTPUT/'releases'/revision
release.mkdir(parents=True,exist_ok=True)
assets=[]
def emit(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 if path.suffix in {'.js','.css','.html','.json','.webmanifest','.glb','.wav','.svg'}:
  compressed=gzip.compress(data,compresslevel=9,mtime=0)
  if len(compressed)<len(data)*.95:Path(str(path)+'.gz').write_bytes(compressed)
for name,data in sorted(files.items()):
 emit(release/name,data);assets.append({'url':f'releases/{revision}/{name}','sha256':sha(data)})
for name,data in sorted(shared.items()):
 emit(OUTPUT/name,data);assets.append({'url':name,'sha256':sha(data)})
prefix='./releases/'+revision+'/'
html=source_html.replace('href="style.css"',f'href="{prefix}style.css"').replace('src="main.js"',f'src="{prefix}main.js"').replace('src="./audio/',f'src="{prefix}audio/')
def importmap(match):
 data=json.loads(match.group(1));data['imports']={key:prefix+value.removeprefix('./') for key,value in data['imports'].items()};return '<script type="importmap">'+json.dumps(data)+'</script>'
html=re.sub(r'<script type="importmap">(.*?)</script>',importmap,html,flags=re.S)
head=f'''<meta name="queen-street-release" content="{revision}">
<meta name="theme-color" content="#20323a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Queen Street">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="./icons/icon-192.png">
<link rel="modulepreload" href="{prefix}vendor/three.module.js">
<link rel="modulepreload" href="{prefix}loading.js">
<script type="module" src="{prefix}pwa-client.js"></script>
'''
html=html.replace('</head>',head+'</head>')
emit(OUTPUT/'index.html',html.encode())
worker=template.replace('__RELEASE__',json.dumps(revision)).replace('__ASSETS__',json.dumps(assets,separators=(',',':'))).replace('__SHELL_SHA__',json.dumps(sha(html.encode())))
emit(OUTPUT/'sw.js',worker.encode())
version={'release':revision,'assets':len(assets),'bytes':sum(len(data) for data in files.values())+sum(len(data) for data in shared.values())}
emit(OUTPUT/'version.json',(json.dumps(version,indent=2)+'\n').encode())
(OUTPUT/'_headers').write_text('''# Apply equivalent headers on hosts that do not support this file.
/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
/index.html
  Cache-Control: no-cache, must-revalidate
/
  Cache-Control: no-cache, must-revalidate
/version.json
  Cache-Control: no-store
/manifest.webmanifest
  Cache-Control: no-cache
/icons/*
  Cache-Control: no-cache
/releases/*
  Cache-Control: public, max-age=31536000, immutable
''',encoding='utf8')
print(json.dumps(version))
print('Deploy pwa/ over HTTPS. Upload release files first; publish index.html and sw.js last.')
