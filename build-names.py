import gzip,json,sys,re
src,meta_p,out=sys.argv[1:4]
M=json.load(open(meta_p))
def hira(s): return ''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヶ' else c for c in s)
V=dict(zip('かきくけこさしすせそたちつてとはひふへほ','がぎぐげござじずぜぞだぢづでどばびぶべぼ'))
V2=dict(zip('はひふへほ','ぱぴぷぺぽ'))
R={}
for c,m in M.items():
  s=set()
  for r in m['on_readings']: s.add(hira(r.replace('-','')))
  for r in m['kun_readings']+m.get('name_readings',[]):
    r=r.replace('-',''); s.add(r.replace('.','')); s.add(r.split('.')[0])
  more=set()
  for r in s:
    if not r: continue
    if r[0] in V: more.add(V[r[0]]+r[1:])
    if r[0] in V2: more.add(V2[r[0]]+r[1:])
    if len(r)>1 and r[-1] in 'つちくき': more.add(r[:-1]+'っ')
  R[c]=s|more
def regular(w,k):
  if '々' in w: w=''.join(w[i-1] if ch=='々' and i else ch for i,ch in enumerate(w))
  from functools import lru_cache
  @lru_cache(None)
  def f(i,j):
    if i==len(w): return j==len(k)
    return any(k.startswith(r,j) and f(i+1,j+len(r)) for r in R.get(w[i],()) if r)
  return f(0,0)
def rk(c):
  m=M.get(c)
  if not m: return 30000
  r=m['freq_mainichi_shinbun'] or 4000
  if m['grade'] is None: r+=20000
  elif m['grade']>=9: r+=1500
  return r
TOP='佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 林 斎藤 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本 斉藤 福田 太田 西村 藤井 金子 岡本 藤原 中野 三浦 原田 中川 松田 竹内 小野 田村 中山 和田 石田 森田 上田 原 柴田 酒井 工藤 横山 宮崎 宮本 内田 高木 安藤 島田 谷口 大野 高田 丸山 今井 河野 藤本 村田 武田 上野 杉山 増田 小山 大塚 平野 菅原 久保 松井 千葉 岩崎 桜井 木下 野口 松尾 菊地 野村 新井 渡部 佐野 杉本 古川 菊池 市川 小松 吉川 山内 西田 中田 熊谷 大西 浜田 小島 中西 堀 北村 永井 土屋 高野 片山 本田 秋山 星野 吉村 荒木 大久保 森本 樋口 吉岡 松浦 久保田 服部 中尾 早川 川口 宮田 小池 大橋 内藤 長田 須藤 菅野 松下'.split()
TOP+='博 弘 浩 宏 寛 洋 清 茂 実 勇 進 誠 修 明 隆 豊 稔 勝 正 守 学 昭 武 健 剛 晃 薫 恵 愛 翔 蓮 陽 聡 衛 久 栄 昇 功 保 貢 弘之 博之 浩之 太郎 次郎 三郎 四郎 一郎 健一 誠一 和夫 一男 正夫 義男 良夫 幸男 秀夫 敏夫 昭夫 茂雄 和雄 健太 大輔 拓也 直樹 達也 和也 哲也 浩二 健二 雄一 真一 光男 正男 春男 秋男 信夫 正雄 義雄 幸雄 英雄 武雄 俊夫 久夫 三男 美智子 道子 和子 幸子 節子 洋子 恵子 京子 順子 久美子 由美子 智子 裕子 明美 陽子 悦子 文子 弘子 久子 千代子 花子 静子 清子 信子 敏子 典子 直美 真由美 由美 恵美 美香 美穂 愛子 優子 正子 春子 秋子 冬子 夏子 良子 芳子 雅子 昌子 君子 光子 美子 喜代子 富子 照子 貞子 澄子 和美 結衣 陽菜 美咲 葵 翔太 大翔 悠真 湊 拓海 健 誠 光 大樹 陽太 美紀 真理子 由紀子 早苗 恵理子 史郎 五郎 正一 正二 正三 健三 昭二 孝 隆 進一 清 忠 實 一 茂 博 正樹 秀樹 和彦 正彦 信行 雅之 隆之 和之 英樹 康夫'.split()
TOPR={}
for i,w in enumerate(TOP): TOPR.setdefault(w,i)
import math,collections
CG=collections.Counter(); CS=collections.Counter(); RC=collections.Counter()
for line in gzip.open(src,'rt',encoding='utf-8'):
  p=line.rstrip('\n').split('|')
  if len(p)<5: continue
  C=CS if p[4]=='surname' else CG if p[4] in('given','male','female') else None
  if C is None: continue
  for ch in set(p[2]): C[ch]+=1
  RC[p[2]]+=1
N={}
for line in gzip.open(src,'rt',encoding='utf-8'):
  p=line.rstrip('\n').split('|')
  if len(p)<5: continue
  kanji,kana,typ=p[2],p[3],p[4]
  if not re.fullmatch(r'[ぁ-ゖー]+',kana) or not kanji or not re.search(r'[一-鿿々]',kanji): continue
  if any(0xF900<=ord(c)<=0xFAFF for c in kanji): continue
  t={'surname':'s','given':'g','male':'g','female':'g'}.get(typ,'')
  N.setdefault(kana,{}).setdefault(kanji,set()).add(t)
res={}
for kana,d in N.items():
  def key(x):
    w=x[0]
    t=x[1]; C=CS if 's' in t and 'g' not in t else CG
    pop=sum(-math.log(C[c]+1) for c in w)/len(w)
    fr=sum(math.log(rk(c)) for c in w)/len(w)
    return (TOPR.get(w,9999) if (len(w)==1 or regular(w,kana)) else 9999, round(-1.2*math.log(RC[w]+1)+0.5*len(w)+pop+fr*0.7+(0 if regular(w,kana) else 0.7),3))
  items=sorted(d.items(),key=key)[:150]
  res[kana]=[[w,('s' if 's' in t else '')+('g' if 'g' in t else '')] for w,t in items]
json.dump(res,open(out,'w'),ensure_ascii=False,separators=(',',':'))
print(len(res))
