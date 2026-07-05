# -*- coding: utf-8 -*-
"""
update_recall.py｜回收名單看門狗（放進 food-radar-mirror repo，Actions 每日執行）
誠實設計：官方名單以新聞稿/圖檔公告發布、無結構化資料 → 不假裝能全自動解析。
本腳本做三件事：
  1. 驗證 data/recall_list.json 格式正確（壞檔就讓 Actions 轉紅）
  2. 抓食藥署新聞列表，偵測是否出現「新的回收/下架」公告（比對已知關鍵字）
  3. 有新公告 → 寫 data/recall_alert.json ＋讓該步驟輸出提醒（你收到 GitHub 通知後手動更新 JSON）
"""
import io, json, re, sys, urllib.request
from datetime import datetime, timezone

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36',
           'Accept-Language': 'zh-TW,zh;q=0.9'}
NEWS_URL = 'https://www.fda.gov.tw/tc/news.aspx?cid=4'
KEYWORDS = ('回收', '下架', '苯駢芘', '違規', '超標')

def load_json(p):
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)

def main():
    # 0) 前置檢查：缺什麼講清楚，不丟神祕錯誤碼
    import os
    if not os.path.exists('data/recall_list.json'):
        print('❌ 找不到 data/recall_list.json——請到 repo 用「Add file」建立 data/recall_list.json 並貼上名單內容（見部署教學 Phase 1）')
        sys.exit(1)

    # 1) 名單格式驗證
    data = load_json('data/recall_list.json')
    assert 'meta' in data and 'items' in data and len(data['items']) > 0
    for it in data['items']:
        for k in ('tier', 'brand', 'product', 'status', 'refund', 'source'):
            assert k in it, f'items 缺欄位 {k}'
    print(f"✅ recall_list.json 格式 OK（{len(data['items'])} 筆，更新日 {data['meta']['updated']}）")

    # 2) 抓官方新聞列表找新公告
    known = set()
    try:
        known = set(load_json('data/recall_seen.json'))
    except Exception:
        pass
    try:
        req = urllib.request.Request(NEWS_URL, headers=HEADERS)
        html = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'replace')
    except Exception as e:
        print(f'⚠️ 無法抓取食藥署新聞頁（{e}）——本次略過偵測，不影響名單服務')
        return

    titles = re.findall(r'newsContent[^>]*>\s*([^<]{6,80})\s*<', html)
    hits = [t.strip() for t in titles if any(k in t for k in KEYWORDS)]
    new = [t for t in hits if t not in known]

    # 3) 有新公告 → 記錄並提醒
    if new:
        alert = {'detected_at': datetime.now(timezone.utc).isoformat(), 'new_announcements': new,
                 'action': '請人工核對是否需更新 data/recall_list.json（品項/批號/退費）'}
        io.open('data/recall_alert.json', 'w', encoding='utf-8').write(json.dumps(alert, ensure_ascii=False, indent=2))
        print('🚨 偵測到疑似新公告，已寫入 data/recall_alert.json：')
        for t in new:
            print('   ・' + t)
    else:
        print('✅ 官方新聞頁無新的回收/下架公告')
    io.open('data/recall_seen.json', 'w', encoding='utf-8').write(json.dumps(sorted(set(hits) | known), ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
