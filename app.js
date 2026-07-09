/* 中鏢查詢器 app.js｜由 Google Sites 嵌入碼載入執行
 * 資料源：同 repo 的 data/recall_list.json（每日 Actions 看門狗維護）
 * 改介面或名單都在 GitHub 改，Google Sites 不用再動 */
(function () {
  // 資料源改用 GitHub Pages（Fastly CDN）：不限流、push 後約 1 分鐘自動上線、免 purge、無 CDN 節點快取不同步問題
  var RAW = 'https://mortonad.github.io/food-recall-check/';

  // 抓 JSON：先檢查 r.ok（避免把 429 純文字「429: Too Many Requests」硬解析成 JSON 而爆錯）＋失敗自動重試一次
  function loadJSON(url, tries) {
    tries = tries || 2;
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (e) {
      if (tries > 1) {
        return new Promise(function (res) { setTimeout(res, 1200); }).then(function () { return loadJSON(url, tries - 1); });
      }
      throw e;
    });
  }

  // ══════════ v3 CONFIG：填了才啟用，留空自動隱藏該功能 ══════════
  var GA4_ID = 'G-R4L06RN02Q';              // GA4 評估 ID（G-XXXXXXXXXX）→ 啟用流量與查詢詞統計
  var FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScKOdTNi_lGwy99HK8tobL5P1QpVUKsbigXYYhXaeDbGjwt6w/viewform';            // 回報表單網址（https://docs.google.com/forms/d/e/xxxx/viewform）
  var FORM_ENTRY_PRODUCT = 'entry.1850068140';  // 表單「品名」題的 entry ID（例：entry.123456789）→ 查無時自動帶入
  var FORM_ENTRY_TYPE = 'entry.1056333188';     // 表單「你想回報什麼」單選題的 entry ID → 卡片「回報此筆有誤」預填用
  var SITE_URL = 'https://sites.google.com/view/oil2026';  // 正式網址（嵌入沙盒拿不到真網址，必須寫死）
  // ═══════════════════════════════════════════════════════════

  // LINE 分享：line.me/R/msg/text 官方 scheme——文字＋網址一起進聊天室（手機直開 LINE）
  // （註：social-plugins 的 lineit/share 不支援 text 參數，勿用）
  function lineShare(text) {
    return 'https://line.me/R/msg/text/?' + encodeURIComponent(text + '\n' + SITE_URL);
  }
  var LINE_GENERIC = lineShare('⚠️ 食安注意｜家裡那瓶油中鏢了嗎？\n輸入品名 30 秒查回收名單＋退費管道（免費）：');

  // GA4：載入與事件（沒填 GA4_ID 就完全不載入）
  var track = function () {};
  if (GA4_ID) {
    var gs = document.createElement('script');
    gs.async = true; gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(gs);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', GA4_ID);
    track = function (name, params) { try { window.gtag('event', name, params || {}); } catch (e) {} };
  }

  function reportUrl(term, type) {
    if (!FORM_URL) return '';
    return FORM_URL + (FORM_URL.indexOf('?') === -1 ? '?' : '&') + 'usp=pp_url'
      + (FORM_ENTRY_PRODUCT && term ? '&' + FORM_ENTRY_PRODUCT + '=' + encodeURIComponent(term) : '')
      + (FORM_ENTRY_TYPE && type ? '&' + FORM_ENTRY_TYPE + '=' + encodeURIComponent(type) : '');
  }
  var root = document.getElementById('frc-app');
  if (!root) { root = document.createElement('div'); root.id = 'frc-app'; document.body.appendChild(root); }

  var css = ''
    + ':root{--ink:#1a2233;--sub:#5b6675;--line:#e6e9ef;--brand:#2563eb;--brandd:#1e3a8a;--teal:#0ea5a4;--red:#c8493a;--redbg:#fdf1ef;--amber:#9a6b15;--amberbg:#fdf6e8;--gray:#f1f3f6}'
    + '#frc-app{font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;color:var(--ink);line-height:1.65;max-width:760px;margin:0 auto;padding:6px 4px 40px}'
    + '#frc-app .hd{background:linear-gradient(135deg,var(--brandd),var(--brand));color:#fff;border-radius:16px;padding:22px 18px}'
    + '#frc-app .kk{font-size:12px;letter-spacing:.12em;color:#a8e6e0;font-weight:700}'
    + '#frc-app h1{font-size:22px;margin:4px 0 6px}'
    + '#frc-app .sb{font-size:13px;color:#d6e2fb}'
    + '#frc-app .ev{display:inline-block;margin-top:10px;font-size:12px;background:rgba(255,255,255,.14);padding:3px 10px;border-radius:99px}'
    + '#frc-app .sr{display:flex;gap:8px;margin:14px 0 6px}'
    + '#frc-q{flex:1;font-size:16px;padding:12px 14px;border:2px solid var(--brand);border-radius:12px;outline:none}'
    + '#frc-clear{border:none;background:var(--ink);color:#fff;border-radius:12px;padding:0 16px;cursor:pointer}'
    + '#frc-app .hint{font-size:12.5px;color:var(--sub)}'
    + '#frc-app .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}'
    + '#frc-app .chip{font-size:13px;border:1px solid var(--line);background:#fff;border-radius:99px;padding:5px 13px;cursor:pointer;color:var(--brandd)}'
    + '#frc-stats{font-size:13px;color:var(--sub);margin:14px 0 4px}'
    + '#frc-app .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin:10px 0}'
    + '#frc-app .top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}'
    + '#frc-app h3{font-size:16px;margin:0}'
    + '#frc-app .bdg{flex-shrink:0;font-size:12px;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}'
    + '#frc-app .b1{background:var(--redbg);color:var(--red)}'
    + '#frc-app .b2{background:var(--amberbg);color:var(--amber)}'
    + '#frc-app .b3{background:#fff1e0;color:#b45309}'
    + '#frc-app .autonote{font-size:12.5px;color:#b45309;background:#fff8ef;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:7px 9px;margin-top:6px}'
    + '#frc-app .mt{font-size:13px;color:var(--sub);margin-top:5px}'
    + '#frc-app .bt{font-size:13px;background:var(--gray);border-radius:8px;padding:7px 9px;margin-top:7px;word-break:break-all}'
    + '#frc-app .rf{font-size:13px;margin-top:7px;padding:7px 9px;background:#eef6f6;border-left:3px solid var(--teal);border-radius:0 8px 8px 0}'
    + '#frc-app .sc{font-size:12px;margin-top:7px}#frc-app .sc a{color:var(--brand)}'
    + '#frc-app .none{background:var(--gray);border:1px dashed #c6ccd6;border-radius:14px;padding:18px;text-align:center;margin:12px 0}'
    + '#frc-app details{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 13px;margin:8px 0;font-size:14px}'
    + '#frc-app summary{cursor:pointer;font-weight:700}'
    + '#frc-app .dis{font-size:12.5px;color:var(--sub);background:#fff;border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin-top:18px}'
    + '#frc-app .ft{margin-top:22px;text-align:center;font-size:13px;color:var(--sub)}'
    + '#frc-app .cta{display:inline-block;margin-top:8px;background:var(--brand);color:#fff;text-decoration:none;padding:9px 16px;border-radius:99px;font-size:14px}'
    + '#frc-app .up{font-weight:700;color:var(--teal)}'
    + '#frc-app .pipe{font-size:12px;margin:12px 0 0;padding:6px 12px;border-radius:99px;display:inline-block}'
    + '#frc-app .pok{background:#e8f6f5;color:#0b7a78}'
    + '#frc-app .pbad{background:#fdf1ef;color:var(--red);font-weight:700}'
    + '#frc-app .feed{background:#eef3fe;border:1px solid #d5e2fb;border-radius:14px;padding:12px 14px;margin:10px 0}'
    + '#frc-app .feed h4{font-size:14px;color:var(--brandd);margin:0 0 6px}'
    + '#frc-app .feed li{font-size:13px;margin:5px 0 5px 16px}'
    + '#frc-app .feed a{color:var(--brandd)}'
    + '#frc-app .feed .dt{color:var(--sub);font-size:12px;margin-left:6px}'
    + '#frc-app .docsbox{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin:14px 0}'
    + '#frc-app .docsbox h4{font-size:15px;margin:0 0 6px}'
    + '#frc-app .docnote{font-size:12.5px;color:var(--sub);margin:0 0 10px;line-height:1.6}'
    + '#frc-app .docbtn{display:inline-block;margin:4px 6px 4px 0;padding:8px 14px;border:1.5px solid var(--brand);border-radius:99px;color:var(--brandd);text-decoration:none;font-size:13.5px;font-weight:700}'
    + '#frc-app .docbtn:hover{background:#eef3fe}'
    + '#frc-app .linebtn{display:block;text-align:center;margin:12px 0 2px;padding:13px 16px;background:#06C755;color:#fff;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700}'
    + '#frc-app .linemini{color:#06a94b;text-decoration:none}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  root.innerHTML = ''
    + '<div class="hd"><div class="kk">食安雷達 · 民眾查詢頁</div>'
    + '<h1>這瓶，有沒有在下架名單？</h1>'
    + '<div class="sb">輸入品名、品牌或批號，30 秒查證＋退費管道</div>'
    + '<div class="ev" id="frc-ev">載入中…</div></div>'
    + '<div class="sr"><input id="frc-q" type="search" placeholder="例：泰山沙拉油、福壽、C1140426K…" autocomplete="off"><button id="frc-clear">清除</button></div>'
    + '<a class="linebtn" id="frc-line" href="#" target="_blank" rel="noopener">💬 分享到 LINE——提醒家人查一下</a>'
    + '<div class="hint">💡 批號在瓶身或桶身；泰山退費<b>不限批號</b>（2026/4～6 月購買皆可退）。</div>'
    + '<div class="chips" id="frc-chips"></div>'
    + '<div id="frc-pipe"></div>'
    + '<div id="frc-feed"></div>'
    + '<div id="frc-stats"></div><div id="frc-results"></div>'
    + '<div style="margin-top:22px"><b style="font-size:15px">📖 怎麼看我手上這瓶</b><div id="frc-guide"></div>'
    + '<details><summary>☎️ 客服與官方專線</summary><ul id="frc-tel"></ul></details>'
    + '<details><summary>🔗 官方公告原始連結</summary><ul id="frc-src"></ul></details></div>'
    + '<div id="frc-docs"></div>'
    + '<div class="dis" id="frc-dis"></div>'
    + '<div class="ft">資料整理：Morton｜<span id="frc-up"></span><br>'
    + '<a class="cta" href="https://github.com/mortonad/food-recall-check" target="_blank" rel="noopener">🛰️ 想在下次事件自動收到通知？看看食安雷達</a></div>';

  var $ = function (id) { return document.getElementById(id); };
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[\s\-（）()／/｜|]/g, ''); };
  var DATA = null;

  // v5 搜尋核心：欄位「串接」後比對（「泰山沙拉油」可跨品牌＋品名欄命中）
  //             ＋空格分詞 AND（「福壽 香油」兩個詞都要出現才算中）
  function itemHay(i) {
    return norm([i.brand, i.product, i.spec, i.batch, i.maker, i.status].join(''));
  }
  function tokenHit(hay, t) {
    if (hay.indexOf(t) !== -1) return true;
    // 二分容錯：詞被中間字隔開時（福壽香油→福壽＋香油），拆兩段各≥2字都出現就算中
    if (t.length >= 4) {
      for (var k = 2; k <= t.length - 2; k++) {
        if (hay.indexOf(t.slice(0, k)) !== -1 && hay.indexOf(t.slice(k)) !== -1) return true;
      }
    }
    return false;
  }
  function matches(i, rawQ) {
    var toks = String(rawQ || '').trim().split(/\s+/).map(norm).filter(Boolean);
    if (!toks.length) return true;
    var hay = itemHay(i);
    return toks.every(function (t) { return tokenHit(hay, t); });
  }

  // 自動收錄公告的搜尋：比對標題＋品牌 tag（無查詢字時回 false，不灌進結果）
  function feedHay(e) {
    return norm((e.title || '') + (Array.isArray(e.brands) ? e.brands.join('') : ''));
  }
  function matchesFeed(e, rawQ) {
    var toks = String(rawQ || '').trim().split(/\s+/).map(norm).filter(Boolean);
    if (!toks.length) return false;
    var hay = feedHay(e);
    return toks.every(function (t) { return tokenHit(hay, t); });
  }
  // 📄 官方下游名單（official_docs）也接進搜尋：搜「下游」「福壽」「福懋」都能翻出對應 PDF
  function matchesDoc(x, rawQ) {
    var toks = String(rawQ || '').trim().split(/\s+/).map(norm).filter(Boolean);
    if (!toks.length) return false;
    var hay = norm(x.name || '');
    return toks.every(function (t) { return tokenHit(hay, t); });
  }
  function docCard(x) {
    return '<div class="card"><div class="top"><h3>' + x.name + '</h3><span class="bdg b3">📄 官方下游名單</span></div>'
      + '<div class="autonote">此為地方政府公布的「下游進貨業者名單」——名列業者<b>不代表其產品違規</b>，多數已完成下架退回；你要找的賣場／餐廳可點下方 PDF 內搜尋，詳情以官方最新公告為準。</div>'
      + '<div class="sc"><a href="' + x.url + '" target="_blank" rel="noopener">開啟官方 PDF ↗</a></div></div>';
  }
  // 🟠 官方公告·自動收錄卡（明標未經人工核對，批號/退費以官方原文為準）
  function feedCard(e) {
    var t = e.title || '官方公告';
    return '<div class="card"><div class="top"><h3>' + t + '</h3><span class="bdg b3">🟠 官方公告·自動收錄</span></div>'
      + '<div class="autonote">批號／退費請點下方官方原文查證——本筆為系統自動收錄，<b>未經人工核對</b>。</div>'
      + '<div class="sc"><a href="' + e.url + '" target="_blank" rel="noopener">官方原文 ↗</a>'
      + '　·　<a class="linemini" href="' + lineShare('⚠️ 食安注意｜' + t + '\n官方公告，詳情見原文：') + '" target="_blank" rel="noopener">💬 傳給家人</a>'
      + '</div></div>';
  }

  function render() {
    var rawQ = $('frc-q').value;
    var q = norm(rawQ);
    var list = DATA.items.filter(function (i) { return matches(i, rawQ); });
    // 有查詢字時，自動收錄公告＋官方下游名單也一起搜（無查詢字則只走上方時間軸與底部文件區）
    var feedHits = q ? (DATA.auto_feed || []).filter(function (e) { return matchesFeed(e, rawQ); }) : [];
    var docHits = q ? (DATA.official_docs || []).filter(function (x) { return matchesDoc(x, rawQ); }) : [];
    var t1 = list.filter(function (i) { return i.tier === 1; }).length;
    $('frc-stats').innerHTML = q
      ? '找到 <b>' + (list.length + feedHits.length + docHits.length) + '</b> 筆（人工精修 ' + list.length + '・官方公告 ' + feedHits.length + '・下游名單 ' + docHits.length + '）'
      : '目前名單共 <b>' + DATA.items.length + '</b> 筆：官方強制下架 ' + DATA.items.filter(function (i) { return i.tier === 1; }).length + ' 筆・業者自主回收 ' + DATA.items.filter(function (i) { return i.tier === 2; }).length + ' 筆';
    if (q && !list.length && !feedHits.length && !docHits.length) {
      var term = $('frc-q').value.trim();
      var ru = reportUrl(term);
      $('frc-results').innerHTML = '<div class="none"><b>查無「' + term + '」相關項目</b><p style="font-size:13px;color:var(--sub);margin-top:6px">不在已公開名單中——但<b>查無≠保證安全</b>，名單可能持續更新；不確定時請撥品牌客服或食安專線 1919。</p>'
        + (ru ? '<a class="cta" style="margin-top:10px" href="' + ru + '" target="_blank" rel="noopener">🙋 我有這個產品的資訊，回報給整理者</a>' : '')
        + '</div>';
      return;
    }
    var feedHtml = feedHits.length
      ? '<div style="font-size:13px;color:var(--sub);margin:16px 0 2px">📢 相關官方公告（自動收錄 ' + feedHits.length + ' 則，批號/退費請點原文）</div>'
        + feedHits.map(feedCard).join('')
      : '';
    var docHtml = docHits.length
      ? '<div style="font-size:13px;color:var(--sub);margin:16px 0 2px">📄 相關官方下游名單（' + docHits.length + ' 份，賣場／餐廳請點 PDF 內查）</div>'
        + docHits.map(docCard).join('')
      : '';
    $('frc-results').innerHTML = list.map(function (i) {
      var b = i.tier === 1 ? '<span class="bdg b1">🔴 官方下架回收</span>' : '<span class="bdg b2">🟡 業者自主回收</span>';
      return '<div class="card"><div class="top"><h3>' + i.brand + '｜' + i.product + (i.spec ? '（' + i.spec + '）' : '') + '</h3>' + b + '</div>'
        + '<div class="mt">' + i.status + '｜製造/供應：' + i.maker + '</div>'
        + (i.batch ? '<div class="bt">🔍 ' + i.batch + '</div>' : '')
        + (i.refund ? '<div class="rf">💰 退費：' + i.refund + '</div>' : '')
        + '<div class="sc"><a href="' + i.source + '" target="_blank" rel="noopener">來源公告 ↗</a>'
        + (FORM_URL ? '　·　<a href="' + reportUrl(i.brand + '｜' + i.product, '名單資訊有誤') + '" target="_blank" rel="noopener" style="color:var(--sub)">🙋 回報此筆有誤</a>' : '')
        + '　·　<a class="linemini" href="' + lineShare('⚠️ 食安注意｜' + i.brand + '｜' + i.product + (i.spec ? '（' + i.spec + '）' : '') + '\n已列' + (i.tier === 1 ? '官方下架回收' : '業者自主回收') + '名單' + (i.batch ? '\n' + i.batch : '') + '\n退費方式與最新名單：') + '" target="_blank" rel="noopener">💬 傳給家人</a>'
        + '</div></div>';
    }).join('') + feedHtml + docHtml;
  }

  loadJSON(RAW + 'data/recall_list.json').then(function (d) {
    DATA = d; var m = d.meta;
    $('frc-ev').textContent = m.event;
    $('frc-up').innerHTML = '名單更新：<span class="up">' + m.updated + '</span>｜' + m.refund_deadline;
    $('frc-dis').innerHTML = '⚠️ ' + m.disclaimer + (m.penalties ? '<div class="pen" style="margin-top:6px;color:var(--sub);font-size:13px">⚖️ 裁罰：' + m.penalties + '</div>' : '');
    $('frc-guide').innerHTML = m.id_guide.map(function (g) { return '<details><summary>' + g.brand + '</summary><ul><li>' + g.how + '</li></ul></details>'; }).join('');
    $('frc-tel').innerHTML = m.hotlines.map(function (h) { return '<li>' + h.name + '：<a href="tel:' + h.tel.replace(/-/g, '') + '">' + h.tel + '</a></li>'; }).join('');
    $('frc-src').innerHTML = m.sources.map(function (s) { return '<li><a href="' + s.url + '" target="_blank" rel="noopener">' + s.name + '</a></li>'; }).join('');
    var brands = []; DATA.items.forEach(function (i) { if (brands.indexOf(i.brand) === -1) brands.push(i.brand); });
    $('frc-chips').innerHTML = brands.map(function (b) { return '<button class="chip">' + b + '</button>'; }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#frc-app .chip'), function (c) {
      c.onclick = function () { $('frc-q').value = c.textContent; render(); };
    });
    // 搜尋事件：防抖 900ms 才送 GA4（停止輸入才算一次查詢，含結果數；0＝查無）
    var tTimer = null;
    $('frc-q').addEventListener('input', function () {
      render();
      clearTimeout(tTimer);
      tTimer = setTimeout(function () {
        var v = $('frc-q').value.trim();
        if (!v) return;
        var n = DATA.items.filter(function (i) { return matches(i, v); }).length;
        track('search', { search_term: v.slice(0, 60), results: n });
      }, 900);
    });
    $('frc-clear').onclick = function () { $('frc-q').value = ''; render(); };
    $('frc-line').href = LINE_GENERIC;
    $('frc-line').addEventListener('click', function () { track('share_line', { where: 'top' }); });

    // 🩺 管線健康：頁面直接顯示自動更新是否正常（>48h 未跑會亮警告）
    var lr = m.pipeline_last_run || '';
    var stale = true;
    if (lr) {
      var t = new Date(lr.replace(/-/g, '/'));
      stale = isNaN(t) ? true : (Date.now() - t.getTime()) > 48 * 3600 * 1000;
    }
    $('frc-pipe').innerHTML = lr
      ? '<span class="pipe ' + (stale ? 'pbad' : 'pok') + '">' + (stale ? '⚠️ 自動更新已超過 48 小時未執行（' + lr + '）' : '🟢 每日自動更新正常｜最後執行 ' + lr) + '</span>'
      : '<span class="pipe pbad">⚠️ 尚未偵測到自動更新紀錄</span>';

    // 📢 官方公告自動收錄區（全自動，標題級；細節以官方連結為準）
    var feed = d.auto_feed || [];
    if (feed.length) {
      $('frc-feed').innerHTML = '<div class="feed"><h4>📢 最新官方公告（每日自動收錄，點標題看官方原文）</h4><ul>'
        + feed.slice(0, 8).map(function (e) {
            return '<li><a href="' + e.url + '" target="_blank" rel="noopener">' + e.title + '</a>'
              + '<span class="dt">' + (e.date || e.collected_at || '') + '</span></li>';
          }).join('')
        + '</ul></div>';
    }
    // 📄 官方原始文件區（JSON 的 official_docs 有內容才出現；文件性質＝下游進貨名單，文案固定中性）
    var docs = d.official_docs || [];
    if (docs.length) {
      $('frc-docs').innerHTML = '<div class="docsbox"><h4>📄 官方原始文件（地方政府公布之下游名單）</h4>'
        + '<p class="docnote">名單所列為「曾進貨相關油品」之業者，<b>不代表其產品違規</b>；依主管機關說明，多數業者已完成下架退回，實際情形以官方最新公告為準。</p>'
        + docs.map(function (x) {
            return '<a class="docbtn" href="' + x.url + '" target="_blank" rel="noopener">' + x.name + '</a>';
          }).join('')
        + '</div>';
    }

    // 🙋 常駐回報入口（有填 FORM_URL 才出現）：資料指正、新增品項都走這
    if (FORM_URL) {
      var ftEl = document.querySelector('#frc-app .ft');
      if (ftEl) {
        var rl = document.createElement('div');
        rl.innerHTML = '<a href="' + reportUrl('') + '" target="_blank" rel="noopener" style="color:var(--brandd);font-size:13px">🙋 名單有誤或想補充？點此回報給整理者</a>';
        ftEl.insertBefore(rl, ftEl.firstChild);
      }
    }

    render();
  }).catch(function () {
    root.innerHTML = '<div class="none">⚠️ 名單載入失敗，請重新整理。</div>';
  });
})();
