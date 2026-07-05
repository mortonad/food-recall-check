/* 中鏢查詢器 app.js｜由 Google Sites 嵌入碼載入執行
 * 資料源：同 repo 的 data/recall_list.json（每日 Actions 看門狗維護）
 * 改介面或名單都在 GitHub 改，Google Sites 不用再動 */
(function () {
  var RAW = 'https://raw.githubusercontent.com/mortonad/food-recall-check/main/';
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
    + '#frc-app .feed .dt{color:var(--sub);font-size:12px;margin-left:6px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  root.innerHTML = ''
    + '<div class="hd"><div class="kk">食安雷達 · 民眾查詢頁</div>'
    + '<h1>這瓶，有沒有在下架名單？</h1>'
    + '<div class="sb">輸入品名、品牌或批號，30 秒查證＋退費管道</div>'
    + '<div class="ev" id="frc-ev">載入中…</div></div>'
    + '<div class="sr"><input id="frc-q" type="search" placeholder="例：泰山沙拉油、福壽、C1140426K…" autocomplete="off"><button id="frc-clear">清除</button></div>'
    + '<div class="hint">💡 批號在瓶身或桶身；泰山退費<b>不限批號</b>（2026/4～6 月購買皆可退）。</div>'
    + '<div class="chips" id="frc-chips"></div>'
    + '<div id="frc-pipe"></div>'
    + '<div id="frc-feed"></div>'
    + '<div id="frc-stats"></div><div id="frc-results"></div>'
    + '<div style="margin-top:22px"><b style="font-size:15px">📖 怎麼看我手上這瓶</b><div id="frc-guide"></div>'
    + '<details><summary>☎️ 客服與官方專線</summary><ul id="frc-tel"></ul></details>'
    + '<details><summary>🔗 官方公告原始連結</summary><ul id="frc-src"></ul></details></div>'
    + '<div class="dis" id="frc-dis"></div>'
    + '<div class="ft">資料整理：Morton｜<span id="frc-up"></span><br>'
    + '<a class="cta" href="https://github.com/mortonad/food-recall-check" target="_blank" rel="noopener">🛰️ 想在下次事件自動收到通知？看看食安雷達</a></div>';

  var $ = function (id) { return document.getElementById(id); };
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[\s\-（）()／/｜|]/g, ''); };
  var DATA = null;

  function render() {
    var q = norm($('frc-q').value);
    var list = DATA.items.filter(function (i) {
      if (!q) return true;
      return [i.brand, i.product, i.spec, i.batch, i.maker, i.status].some(function (f) { return norm(f).indexOf(q) !== -1; });
    });
    var t1 = list.filter(function (i) { return i.tier === 1; }).length;
    $('frc-stats').innerHTML = q
      ? '找到 <b>' + list.length + '</b> 筆（官方下架 ' + t1 + '・業者自主 ' + (list.length - t1) + '）'
      : '目前名單共 <b>' + DATA.items.length + '</b> 筆：官方強制下架 ' + DATA.items.filter(function (i) { return i.tier === 1; }).length + ' 筆・業者自主回收 ' + DATA.items.filter(function (i) { return i.tier === 2; }).length + ' 筆';
    if (q && !list.length) {
      $('frc-results').innerHTML = '<div class="none"><b>查無「' + $('frc-q').value.trim() + '」相關項目</b><p style="font-size:13px;color:var(--sub);margin-top:6px">不在已公開名單中——但<b>查無≠保證安全</b>，名單可能持續更新；不確定時請撥品牌客服或食安專線 1919。</p></div>';
      return;
    }
    $('frc-results').innerHTML = list.map(function (i) {
      var b = i.tier === 1 ? '<span class="bdg b1">🔴 官方下架回收</span>' : '<span class="bdg b2">🟡 業者自主回收</span>';
      return '<div class="card"><div class="top"><h3>' + i.brand + '｜' + i.product + (i.spec ? '（' + i.spec + '）' : '') + '</h3>' + b + '</div>'
        + '<div class="mt">' + i.status + '｜製造/供應：' + i.maker + '</div>'
        + (i.batch ? '<div class="bt">🔍 ' + i.batch + '</div>' : '')
        + (i.refund ? '<div class="rf">💰 退費：' + i.refund + '</div>' : '')
        + '<div class="sc"><a href="' + i.source + '" target="_blank" rel="noopener">來源公告 ↗</a></div></div>';
    }).join('');
  }

  fetch(RAW + 'data/recall_list.json').then(function (r) { return r.json(); }).then(function (d) {
    DATA = d; var m = d.meta;
    $('frc-ev').textContent = m.event;
    $('frc-up').innerHTML = '名單更新：<span class="up">' + m.updated + '</span>｜' + m.refund_deadline;
    $('frc-dis').textContent = '⚠️ ' + m.disclaimer;
    $('frc-guide').innerHTML = m.id_guide.map(function (g) { return '<details><summary>' + g.brand + '</summary><ul><li>' + g.how + '</li></ul></details>'; }).join('');
    $('frc-tel').innerHTML = m.hotlines.map(function (h) { return '<li>' + h.name + '：<a href="tel:' + h.tel.replace(/-/g, '') + '">' + h.tel + '</a></li>'; }).join('');
    $('frc-src').innerHTML = m.sources.map(function (s) { return '<li><a href="' + s.url + '" target="_blank" rel="noopener">' + s.name + '</a></li>'; }).join('');
    var brands = []; DATA.items.forEach(function (i) { if (brands.indexOf(i.brand) === -1) brands.push(i.brand); });
    $('frc-chips').innerHTML = brands.map(function (b) { return '<button class="chip">' + b + '</button>'; }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#frc-app .chip'), function (c) {
      c.onclick = function () { $('frc-q').value = c.textContent; render(); };
    });
    $('frc-q').addEventListener('input', render);
    $('frc-clear').onclick = function () { $('frc-q').value = ''; render(); };

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
    render();
  }).catch(function () {
    root.innerHTML = '<div class="none">⚠️ 名單載入失敗，請重新整理。</div>';
  });
})();
