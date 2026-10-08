"""Baut index.html aus src/. Aufruf im Repo-Root: python3 build.py"""
import os
R=os.path.dirname(os.path.abspath(__file__))
langs=["de","en","it","hr","pl","tr"]
i18n="var I18N={};\n"+"\n".join(open(f"{R}/src/i18n/{l}.js",encoding="utf8").read() for l in langs)
app=open(f"{R}/src/app.js",encoding="utf8").read()
head=open(f"{R}/src/app_head.html",encoding="utf8").read()
cut=head.index("</style>")+len("</style>")
pwa=('<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<link rel="icon" type="image/png" href="icon-192.png">\n'
     '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="FastTrack">\n')
swreg='<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}</script>\n'
html=('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
     +pwa+head[:cut]+"\n</head>\n<body>\n"+head[cut:]+'\n<script src="config.js"></script>\n<script>\n'+i18n+"\n"+app+"\n</script>\n"+swreg+"</body>\n</html>\n")
open(f"{R}/index.html","w",encoding="utf8").write(html)
print("index.html gebaut:",len(html),"Bytes")
