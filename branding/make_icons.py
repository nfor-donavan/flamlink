import subprocess
MARK = '''
<defs>
  <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6FD3FF"/><stop offset="1" stop-color="#1F7AE0"/></linearGradient>
  <linearGradient id="bd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9DAE6"/><stop offset=".45" stop-color="#FFFFFF"/><stop offset="1" stop-color="#B9CCDA"/></linearGradient>
</defs>
<path d="M512 96C566 170 610 214 610 262C610 300 566 330 512 330C458 330 414 300 414 262C414 214 462 180 512 96Z" fill="url(#fl)"/>
<path d="M512 200C536 236 556 254 556 276C556 296 536 310 512 310C488 310 468 296 468 276C468 254 490 236 512 200Z" fill="#E9F8FF"/>
<rect x="462" y="330" width="100" height="22" rx="11" fill="#8FA3B2"/>
<rect x="492" y="346" width="40" height="40" fill="#8FA3B2"/>
<rect x="446" y="378" width="132" height="44" rx="14" fill="#D9A93F"/>
<path d="M352 520C352 452 420 412 512 412C604 412 672 452 672 520L672 826Q672 864 634 864L390 864Q352 864 352 826Z" fill="url(#bd)"/>
<rect x="398" y="612" width="150" height="104" rx="52" fill="none" stroke="#1F7AE0" stroke-width="24"/>
<rect x="476" y="612" width="150" height="104" rx="52" fill="none" stroke="#0E2230" stroke-width="24"/>
'''
BG = '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14384A"/><stop offset="1" stop-color="#091820"/></linearGradient></defs>'
def svg(body, bg=False, rx=0):
    r = f'<rect width="1024" height="1024" rx="{rx}" fill="url(#bg)"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{BG}{r}{body}</svg>'
def scaled(s): return f'<g transform="translate(512 512) scale({s}) translate(-512 -480)">{MARK}</g>'
out = {
 'logo.svg': svg(MARK, True, 230),
 'icon-full.svg': svg(scaled(.92), True, 0),
 'adaptive-foreground.svg': svg(scaled(.66)),
 'splash-icon.svg': svg(scaled(.9)),
 'mark-transparent.svg': svg(MARK),
}
for k,v in out.items(): open(k,'w').write(v)
