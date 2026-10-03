# Renders the Flamlink mark to PNG with Pillow (no SVG renderer needed).
from PIL import Image, ImageDraw
SS = 3
def bez(p0,p1,p2,p3,n=40):
    return [tuple((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t**2*c+t**3*d for a,b,c,d in zip(p0,p1,p2,p3)) for t in [i/n for i in range(n+1)]]
def qbez(p0,p1,p2,n=20):
    return [tuple((1-t)**2*a+2*(1-t)*t*b+t**2*c for a,b,c in zip(p0,p1,p2)) for t in [i/n for i in range(n+1)]]
FLAME = (bez((512,96),(566,170),(610,214),(610,262))+bez((610,262),(610,300),(566,330),(512,330))+
         bez((512,330),(458,330),(414,300),(414,262))+bez((414,262),(414,214),(462,180),(512,96)))
INNER = (bez((512,200),(536,236),(556,254),(556,276))+bez((556,276),(556,296),(536,310),(512,310))+
         bez((512,310),(488,310),(468,296),(468,276))+bez((468,276),(468,254),(490,236),(512,200)))
BODY = (bez((352,520),(352,452),(420,412),(512,412))+bez((512,412),(604,412),(672,452),(672,520))+
        [(672,826)]+qbez((672,826),(672,864),(634,864))+[(390,864)]+qbez((390,864),(352,864),(352,826)))
def grad(size, c0, c1, horizontal=False, mid=None):
    g = Image.new('RGBA', size)
    px = g.load(); W,H = size
    for y in range(H):
        for x in range(W):
            t = (x/(W-1)) if horizontal else (y/(H-1))
            if mid:
                col = tuple(int(a+(b-a)*(t/.45)) for a,b in zip(c0,mid)) if t<.45 else tuple(int(a+(b-a)*((t-.45)/.55)) for a,b in zip(mid,c1))
            else:
                col = tuple(int(a+(b-a)*t) for a,b in zip(c0,c1))
            px[x,y] = col+(255,)
    return g
def render(s=1.0, bg=False, rx=0, out=1024, final=None):
    N = 1024*SS
    T = lambda p: ((512+s*(p[0]-512))*SS, (512+s*(p[1]-480))*SS)
    def poly_mask(pts):
        m = Image.new('L',(N,N),0); ImageDraw.Draw(m).polygon([T(p) for p in pts], fill=255); return m
    img = Image.new('RGBA',(N,N),(0,0,0,0))
    if bg:
        m = Image.new('L',(N,N),0); ImageDraw.Draw(m).rounded_rectangle((0,0,N-1,N-1), radius=rx*SS, fill=255)
        img.paste(grad((N,N),(0x14,0x38,0x4A),(0x09,0x18,0x20)), (0,0), m)
    def paste_grad(mask, g):
        img.paste(g,(0,0),mask)
    # flame
    paste_grad(poly_mask(FLAME), grad((N,N),(0x6F,0xD3,0xFF),(0x1F,0x7A,0xE0)))
    d = ImageDraw.Draw(img)
    d.polygon([T(p) for p in INNER], fill=(0xE9,0xF8,0xFF,255))
    def rrect(x,y,w,h,r,fill):
        x0,y0=T((x,y)); x1,y1=T((x+w,y+h)); d.rounded_rectangle((x0,y0,x1,y1), radius=r*s*SS, fill=fill)
    rrect(462,330,100,22,11,(0x8F,0xA3,0xB2,255))
    rrect(492,346,40,40,0,(0x8F,0xA3,0xB2,255))
    rrect(446,378,132,44,14,(0xD9,0xA9,0x3F,255))
    paste_grad(poly_mask(BODY), grad((N,N),(0xC9,0xDA,0xE6),(0xB9,0xCC,0xDA),True,(255,255,255)))
    d = ImageDraw.Draw(img)
    def ring(x,y,w,h,r,sw,col):
        x0,y0=T((x-sw/2,y-sw/2)); x1,y1=T((x+w+sw/2,y+h+sw/2))
        d.rounded_rectangle((x0,y0,x1,y1), radius=(r+sw/2)*s*SS, outline=col, width=int(sw*s*SS))
    ring(398,612,150,104,52,24,(0x1F,0x7A,0xE0,255))
    ring(476,612,150,104,52,24,(0x0E,0x22,0x30,255))
    return img.resize((out,out), Image.LANCZOS)
if __name__=='__main__':
    m='../mobile/assets/'
    render(.92,True,0).save(m+'icon.png')
    render(.66,False).save(m+'adaptive-icon.png')
    render(.9,False).save(m+'splash-icon.png')
    render(.92,True,0,out=64).save(m+'favicon.png')
    render(1,True,230,out=512).save('../web/public/icon-512.png')
    render(1,True,230,out=192).save('../web/public/icon-192.png')
    render(1,True,230,out=1024).save('logo-1024.png')
    print('ok')
