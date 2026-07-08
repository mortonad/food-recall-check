# -*- coding: utf-8 -*-
"""
update_recall.py v2｜回收公告「全自動」收錄器（Actions 每日執行，零人工維運）

每天自動做：
  1. 驗證 data/recall_list.json（壞了直接用中文講原因）
  2. 掃食藥署新聞頁 → 只擷取「本次油案相關」公告的（標題＋日期＋連結＋品牌 tag）
     └ 雙閘門過濾 is_case_related()：本案關鍵字 ＋（回收動作 或 污染物）才收
     └ 下游名單 PDF 改由 JSON 的 official_docs 人工維護（連結穩定、可搜尋），不自動抓
       （台中頁自動抓曾造成：同文件重複收錄＋跨網域拼錯網址的死連結）
  3. 機器直接寫進 JSON 的 auto_feed 區（去重、標品牌）→ Actions commit → 網頁自動更新
  4. 更新 meta.pipeline_last_run → 網頁上直接顯示管線健康（超時會亮 ⚠️）
  5. 有新公告順便開 GitHub Issue 通知（想補批號細節再去補 items 區；不補網站也是新的）

分層誠實原則（網頁前端據此分色呈現）：
  auto_feed＝標題級（全自動、可被搜尋；卡片明標「🟠 官方公告·批號見原文、未經人工核對」）
  items    ＝批號級（人工精修、高精度紅卡；只有大事件值得補）
"""
import io, json, re, sys, html, urllib.request
from datetime import datetime, timezone, timedelta

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36',
           'Accept-Language': 'zh-TW,zh;q=0.9'}
NEWS_URL = 'https://www.fda.gov.tw/tc/news.aspx?cid=4'
BASE = 'https://www.fda.gov.tw/tc/'
# 「只收本次油案相關」雙閘門：標題要同時命中 CASE_KW（本案油品/品牌/污染物）
# 與 ACTION_KW（回收動作）或 CONTAM（污染物），才收——避免收進無關的食安回收。
CASE_KW = ('中聯', '泰山', '福壽', '福懋', '味王', '聯華', '老協珍', '益康',
           '苯駢芘', '苯并芘', '沙拉油', '大豆油', '黃豆油', '豆油', '食用油',
           '調合油', '烹調油', '香油', '蔬菜油', '花生', '油脂', '原料油', '分裝')
# ACTION 含下游/通路語彙（受影響/波及/流向/停用），讓「XX通路受影響下架」這類公告也收得到；
# 但一律要先命中 CASE_KW（油品/品牌/污染物）才算，確保只收本次油案、不亂收無關回收。
ACTION_KW = ('回收', '下架', '超標', '違規', '停售', '停用', '預防性',
             '退貨', '退費', '退運', '受影響', '波及', '流向', '下游', '通路')
CONTAM = ('苯駢芘', '苯并芘')
# 事件強訊號：只要命中一個就收（不需再湊 ACTION）。用來接住那些「不寫品牌也不寫回收、
# 但明顯是本案」的核心公告——如「擴大受影響產品下架」「公布 360 家受影響業者明細」。
STRONG_KW = ('中聯', '苯駢芘', '苯并芘', '問題油', '油品事件',
             '受影響業者', '受影響產品', '影響業者')
# 品牌白名單：命中就幫該筆標 brands tag，讓網頁搜「泰山」「福壽」也能查到自動收錄公告。
BRANDS = ('中聯', '泰山', '福壽', '福懋', '味王', '聯華', '老協珍')
TPE = timezone(timedelta(hours=8))
DATA_PATH = 'data/recall_list.json'


def now_tpe():
    return datetime.now(TPE).strftime('%Y-%m-%d %H:%M')


def is_case_related(title):
    """只收本次油案相關。兩條路任一成立即收：
       ①事件強訊號（中聯/苯駢芘/受影響業者…）直接命中；或
       ②本案品牌/油品 ＋（回收動作 或 污染物）——接住「泰山金酥耐炸油下架」這種品牌級公告。"""
    if any(s in title for s in STRONG_KW):
        return True
    case_hit = any(c in title for c in CASE_KW)
    action_hit = any(k in title for k in ACTION_KW) or any(c in title for c in CONTAM)
    return case_hit and action_hit


def brands_in(text):
    """標題/檔名裡出現的本案品牌 → 讓網頁搜品牌時也能命中自動收錄的公告。"""
    return [b for b in BRANDS if b in (text or '')]


def load_data():
    """讀名單；錯誤用人話講清楚。"""
    import os
    if not os.path.exists(DATA_PATH):
        print('❌ 找不到 data/recall_list.json——請照部署教學 Phase 1 建立並貼上名單內容')
        sys.exit(1)
    raw = io.open(DATA_PATH, encoding='utf-8').read()
    if raw.strip() == '':
        print('❌ data/recall_list.json 是「空檔案」——檔名建了但內容沒貼上。')
        print('   修法：GitHub 打開該檔 → 鉛筆✏️編輯 → 貼上完整名單 JSON → Commit 到 main。')
        sys.exit(1)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f'❌ data/recall_list.json 不是合法 JSON（第 {e.lineno} 行附近：{e.msg}）——請整份重新貼上。')
        sys.exit(1)
    if 'meta' not in data or 'items' not in data:
        print('❌ JSON 缺 meta 或 items 區塊——請用原始範本整份重貼。')
        sys.exit(1)
    data.setdefault('auto_feed', [])          # v2 新增區：沒有就自動補，舊 JSON 免改
    # v3 自癒：清掉舊版自動抓的台中 PDF 重複項（下游名單改由 official_docs 維護，免重複與死連結）
    before = len(data['auto_feed'])
    data['auto_feed'] = [e for e in data['auto_feed']
                         if not str(e.get('title', '')).startswith('📄 台中市府文件')]
    purged = before - len(data['auto_feed'])
    if purged:
        print(f'🧹 已清除 {purged} 筆舊版台中 PDF 重複項（下游名單改由 official_docs 呈現）')
    print(f"✅ recall_list.json 格式 OK（人工精修 {len(data['items'])} 筆／自動收錄 {len(data['auto_feed'])} 筆）")
    return data


def fetch_announcements():
    """抓食藥署新聞列表 → [(title, url, date)]；抓不到回 None（不中斷服務）。
    重點：列表頁的中文標題放在 <a ... title="..."> 屬性、且是 HTML 實體編碼（&#39135;=食…），
    必須 html.unescape 解碼後才是可讀標題；早期版本用「標籤間文字」解析，命中恆為 0。"""
    try:
        req = urllib.request.Request(NEWS_URL, headers=HEADERS)
        page = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'replace')
    except Exception as e:
        print(f'⚠️ 無法抓取食藥署新聞頁（{e}）——本次略過收錄，明天會再試')
        return None
    out = []
    for m in re.finditer(r'href="([^"]*newsContent[^"]*)"[^>]*\btitle="([^"]*)"', page, re.I):
        url = html.unescape(m.group(1))
        title = re.sub(r'\s+', ' ', html.unescape(m.group(2))).strip()
        if not title or not is_case_related(title):     # 只收本次油案相關公告
            continue
        if url.startswith('/'):
            url = 'https://www.fda.gov.tw' + url
        elif not url.startswith('http'):
            url = BASE + url
        # 就近找日期（列表頁常見 yyyy-mm-dd 或民國 yyy/mm/dd）
        tail = page[m.end():m.end() + 300]
        dm = re.search(r'(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(\d{3}[-/.]\d{1,2}[-/.]\d{1,2})', tail)
        date = dm.group(0).replace('.', '/').replace('-', '/') if dm else ''
        out.append((title, url, date))
    return out


def merge_auto_feed(data, announcements):
    """把新公告合入 auto_feed（以 url 去重）；回傳新增清單。純函式、可測試。"""
    seen = {e.get('url') for e in data['auto_feed']}
    added = []
    for title, url, date in announcements:
        if url in seen:
            continue
        entry = {'title': title, 'url': url, 'date': date,
                 'collected_at': now_tpe(), 'brands': brands_in(title)}
        data['auto_feed'].insert(0, entry)      # 新的在前
        seen.add(url)
        added.append(entry)
    data['auto_feed'] = data['auto_feed'][:100]  # 保留最近 100 則
    return added


def save_data(data):
    data['meta']['pipeline_last_run'] = now_tpe()
    io.open(DATA_PATH, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=1))


def open_issue(added):
    """新公告開 Issue → GitHub 自動寄信（人工「選擇性」補批號細節用；不動作網站也已更新）。"""
    import os
    token = os.environ.get('GITHUB_TOKEN', '')
    repo = os.environ.get('GITHUB_REPOSITORY', '')
    if not token or not repo:
        print('（非 Actions 環境，略過開 Issue）')
        return
    body = ('已「自動收錄」以下公告到網頁（標題級）：\n\n'
            + '\n'.join(f"- [{e['title']}]({e['url']})" for e in added)
            + '\n\n👉 若屬重大事件、想補「批號/退費」細節，再編輯 data/recall_list.json 的 items 區；'
              '不編輯，網站也已顯示公告與官方連結。')
    payload = json.dumps({'title': f'📢 已自動收錄 {len(added)} 則新公告（可選擇性補批號細節）',
                          'body': body, 'labels': ['recall-watchdog']}).encode('utf-8')
    req = urllib.request.Request(
        f'https://api.github.com/repos/{repo}/issues', data=payload, method='POST',
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                 'User-Agent': 'recall-watchdog'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"📬 已開 Issue #{json.loads(r.read().decode())['number']}（GitHub 會寄信通知）")
    except Exception as e:
        print(f'⚠️ 開 Issue 失敗（{e}）——不影響自動收錄')


def main():
    data = load_data()
    ann = fetch_announcements()
    if ann is None:                              # 抓不到：仍寫 last_run 讓頁面知道管線活著
        save_data(data)
        return
    added = merge_auto_feed(data, ann)
    save_data(data)
    if added:
        print(f'📢 自動收錄 {len(added)} 則新公告：')
        for e in added:
            print('   ・' + e['title'])
        open_issue(added)
    else:
        print('✅ 無新公告（auto_feed 維持 ' + str(len(data['auto_feed'])) + ' 則）')


if __name__ == '__main__':
    main()
