import sys,re
D='/tmp/claude-0/-home-user/0ab86908-0949-5e3c-831f-d22b5fd01828/scratchpad/pkg/package/data/'
kc={}
for l in open(D+'ABBREV.txt',encoding='latin-1'):
    f=l.rstrip('\r\n').split('^'); kc[f[0].strip('~')]=f[3]
for l in open(D+'FOOD_DES.txt',encoding='latin-1'):
    f=l.rstrip('\r\n').split('^'); i=f[0].strip('~'); d=f[2].strip('~')
    for pat in sys.argv[1:]:
        if all(re.search(p,d,re.I) for p in pat.split('&&')):
            print(pat[:18].ljust(18),i,kc[i].rjust(4),d[:110]); break
