import json,glob,sys,re
src=sys.argv[1]; out=sys.argv[2]
meta=json.load(open(src+'/data/kanji-meta.json'))
def hira(s): return ''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヶ' else c for c in s)
W={}
for f in glob.glob(src+'/data/words/*.json'):
  for k,ws in json.load(open(f)).items():
    for w in ws:
      for v in w['variants']:
        if not v['written'] or not v['pronounced']: continue
        W.setdefault((v['written'],hira(v['pronounced'])),set()).update(v.get('priorities') or [])
def score(p):
  s=0
  for x in p:
    if x in('news1','ichi1','spec1','gai1'): s+=10
    elif x in('news2','ichi2','spec2','gai2'): s+=3
    elif x.startswith('nf'): s+=max(0,50-int(x[2:]))/10
  return s
kanji_re=re.compile(r'[㐀-鿿豈-﫿々]')
# words index: reading -> list of [written, common]
words={}
for (wr,rd),p in W.items():
  if not kanji_re.search(wr) or re.search(r'[ァ-ヺＡ-Ｚａ-ｚA-Za-z]',wr): continue
  if not re.fullmatch(r'[ぁ-ゖー]+',rd): continue
  words.setdefault(rd,[]).append((score(p),len(wr),wr))
wout={}
for rd,l in words.items():
  l.sort(key=lambda x:(-x[0],x[1]))
  seen=[];
  for s,_,wr in l:
    if wr not in [x[0] for x in seen]: seen.append([wr,1 if s>=3 else 0])
  wout[rd]=seen
# examples per kanji
ex={}
for (wr,rd),p in W.items():
  s=score(p)
  if s<3 or len(wr)<2 or not re.fullmatch(r'[ぁ-ゖー]+',rd): continue
  if re.search(r'[ァ-ヺ]',wr): continue
  for c in set(wr):
    if c in meta: ex.setdefault(c,[]).append((s,len(wr),wr,rd))
K={}
for c,m in meta.items():
  on=m['on_readings']; kun=m['kun_readings']+m.get('name_readings',[])[:0]
  if not on and not kun: continue
  if 0xF900<=ord(c)<=0xFAFF or 0x2F800<=ord(c)<=0x2FA1F: continue
  e=sorted(ex.get(c,[]),key=lambda x:(-x[0],x[1]))
  el=[];seenw=set()
  for _,_,wr,rd in e:
    if wr in seenw: continue
    seenw.add(wr); el.append([wr,rd])
    if len(el)>=8: break
  K[c]={'on':on,'kun':m['kun_readings'],'st':m['stroke_count'],'g':m['grade'],'f':m['freq_mainichi_shinbun'],'ex':el}
json.dump(K,open(out+'/kanji.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(wout,open(out+'/words.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(K),len(wout))
