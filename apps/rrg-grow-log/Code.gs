/**
 * RRG Green Grow Log
 * 植物1株ごとの育成記録（管理はスプレッドシート）と、購入者向けの閲覧専用ページ（Webアプリ）。
 *
 * 安全設計:
 *  - 編集はスプレッドシート（非公開）でのみ行う。公開ページには編集機能がない。
 *  - 公開ページは「公開ID」（推測できないランダム文字列）でしか開けない。
 *  - 公開ページに出すのは、許可した項目（WHITELIST）と「公開」にした作業ログだけ。
 *  - 写真はDriveのサムネイルをサーバー側で埋め込むため、写真の共有設定や位置情報を外に出さない。
 */

const APP = {
  name: 'RRG Green Grow Log',
  company: 'RAGGAE ROOTS GREEN（RRG）',
};

const SHEETS = {
  PLANTS: '株マスター',
  LOGS: '作業ログ',
  GUIDES: '育て方ガイド',
  FEEDBACK: 'テスターの声',
  LABELS: 'QRラベル',
  TODAY: '今日の作業',
  SETTINGS: '設定',
};

const PLANT_HEADERS = ['管理番号', '植物名', '品種', 'ポットサイズ', 'ステージ', '登録日', '写真', '公開', '公開ID', '出荷日', 'メモ（非公開）'];
const LOG_HEADERS = ['日付', '管理番号', '作業', '公開メモ', '公開', 'メモ（非公開）'];
const GUIDE_HEADERS = ['品種', '置き場所', '水やり', '肥料', '冬越し', 'ひとこと', '水やり間隔（日）', '水換え間隔（日）', '肥料間隔（日）'];
const FEEDBACK_HEADERS = ['受信日時', '管理番号', '役に立った（1〜5）', '有料でも使いたいか', 'ほしい機能', '自由記述'];
const SETTINGS_HEADERS = ['項目', '値', '説明'];

const STAGES = ['水挿し', '発根', '鉢上げ', '育成中', '出荷準備', '出荷済み'];
const TASKS = ['水やり', '水換え', '肥料', '植え替え', '剪定', '写真', '出荷', 'その他'];
const PAY_OPTIONS = ['使いたい', 'どちらともいえない', '使わない'];

const TOKEN_RE = /^[A-Za-z0-9]{16,64}$/;
const FEEDBACK_LIMIT_PER_HOUR = 5;
const TEXT_LIMIT = 500;

const SEED_GUIDES = [
  ['ポトス', 'レースカーテン越しの明るい室内。直射日光は葉焼けの原因になります。',
    '春〜秋は土の表面が乾いたらたっぷり。冬は乾いてから2〜3日あけて控えめに。',
    '5〜9月に、置き肥なら2か月に1回、液肥なら月2回が目安。冬は与えません。',
    '10℃以上を保てる室内へ。夜の窓際は冷えるので、部屋の中央に移すと安心です。',
    '伸びたつるは節の下で切って水に挿すと、根が出て増やせます。', 5, 7, 60],
  ['モンステラ', '明るい日陰〜レースカーテン越し。強い直射日光は避けます。',
    '土の表面が乾いたらたっぷり。受け皿の水は捨ててください。',
    '5〜9月に2か月に1回の置き肥が目安。冬は与えません。',
    '10℃以上を保てる室内へ。',
    '茎から出る気根は、邪魔なら切っても大丈夫です。', 7, 7, 60],
  ['サンスベリア', '日当たりのよい室内。乾燥に強く、湿気に弱い植物です。',
    '土が完全に乾いてから。冬はほぼ断水します。',
    '5〜9月に2か月に1回の置き肥が目安。',
    '寒さに弱いので10℃以上の室内へ。冬の水やりは控えます。',
    '水のやりすぎが一番の失敗原因です。迷ったら待ちましょう。', 14, '', 60],
];

/* ------------------------------------------------------------------ */
/* メニュー                                                            */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌿 Grow Log')
    .addItem('① 初期セットアップ', 'setupSheets')
    .addItem('② 公開ページのURLを登録', 'setWebAppUrl')
    .addSeparator()
    .addItem('まとめて登録', 'bulkRegisterDialog')
    .addItem('公開IDを付ける（手入力した株用）', 'ensureTokens')
    .addItem('QRラベルを作成', 'buildLabels')
    .addItem('今日の作業を更新', 'buildToday')
    .addToUi();
}

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  setupCore_(ss);
  SpreadsheetApp.getUi().alert('セットアップが完了しました。\n次に「拡張機能 → Apps Script → デプロイ」でWebアプリを公開し、「② 公開ページのURLを登録」を実行してください。');
}

function setupCore_(ss) {
  const plants = ensureSheet_(ss, SHEETS.PLANTS, PLANT_HEADERS);
  const logs = ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS);
  const guides = ensureSheet_(ss, SHEETS.GUIDES, GUIDE_HEADERS);
  ensureSheet_(ss, SHEETS.FEEDBACK, FEEDBACK_HEADERS);
  const settings = ensureSheet_(ss, SHEETS.SETTINGS, SETTINGS_HEADERS);

  if (guides.getLastRow() < 2) {
    guides.getRange(2, 1, SEED_GUIDES.length, GUIDE_HEADERS.length).setValues(SEED_GUIDES);
  }
  if (settings.getLastRow() < 2) {
    settings.getRange(2, 1, 2, 3).setValues([
      ['公開ページURL', '', 'Webアプリをデプロイしたときに表示される /exec で終わるURL'],
      ['管理番号の頭文字', 'P-', '例: P- → P-001, P-002 …'],
    ]);
  }
  if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.newDataValidation) {
    applyValidations_(plants, logs);
  }
}

function applyValidations_(plants, logs) {
  const max = 2000;
  const col = (headers, name) => headers.indexOf(name) + 1;
  const list = (values) => SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  const check = SpreadsheetApp.newDataValidation().requireCheckbox().build();

  plants.getRange(2, col(PLANT_HEADERS, 'ステージ'), max).setDataValidation(list(STAGES));
  plants.getRange(2, col(PLANT_HEADERS, '公開'), max).setDataValidation(check);
  plants.getRange(2, col(PLANT_HEADERS, '登録日'), max).setNumberFormat('yyyy/mm/dd');
  plants.getRange(2, col(PLANT_HEADERS, '出荷日'), max).setNumberFormat('yyyy/mm/dd');

  const codeRange = plants.getRange('A2:A');
  logs.getRange(2, col(LOG_HEADERS, '管理番号'), max).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(codeRange, true).setAllowInvalid(false).build());
  logs.getRange(2, col(LOG_HEADERS, '作業'), max).setDataValidation(list(TASKS));
  logs.getRange(2, col(LOG_HEADERS, '公開'), max).setDataValidation(check);
  logs.getRange(2, col(LOG_HEADERS, '日付'), max).setNumberFormat('yyyy/mm/dd');
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (sh.setFrozenRows) sh.setFrozenRows(1);
    const head = sh.getRange(1, 1, 1, headers.length);
    if (head.setFontWeight) head.setFontWeight('bold').setBackground('#3F6F55').setFontColor('#FFFFFF');
  }
  return sh;
}

function setWebAppUrl() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('公開ページのURL', 'Webアプリのデプロイ時に表示された URL（/exec で終わるもの）を貼り付けてください。', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const url = res.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
    ui.alert('URLの形式が違うようです。https://script.google.com/…/exec の形のURLを貼ってください。');
    return;
  }
  setSetting_(SpreadsheetApp.getActive(), '公開ページURL', url);
  ui.alert('登録しました。「QRラベルを作成」でラベルを作れます。');
}

/* ------------------------------------------------------------------ */
/* まとめて登録                                                        */
/* ------------------------------------------------------------------ */

function bulkRegisterDialog() {
  const ui = SpreadsheetApp.getUi();
  const ask = (title, msg) => {
    const r = ui.prompt(title, msg, ui.ButtonSet.OK_CANCEL);
    return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null;
  };
  const name = ask('まとめて登録 (1/5)', '植物名（例: ゴールデンポトス）'); if (!name) return;
  const variety = ask('まとめて登録 (2/5)', '品種（「育て方ガイド」の品種名と同じにしてください。例: ポトス）'); if (!variety) return;
  const pot = ask('まとめて登録 (3/5)', 'ポットサイズ（例: 3号）'); if (pot === null) return;
  const stage = ask('まとめて登録 (4/5)', 'ステージ（' + STAGES.join(' / ') + '）'); if (!stage) return;
  const countText = ask('まとめて登録 (5/5)', '株数（1〜200）'); if (!countText) return;

  try {
    const codes = bulkRegisterCore_(SpreadsheetApp.getActive(), {
      name: name, variety: variety, potSize: pot, stage: stage, count: Number(countText), date: new Date(),
    });
    ui.alert(codes.length + '株を登録しました（' + codes[0] + ' 〜 ' + codes[codes.length - 1] + '）。');
  } catch (err) {
    ui.alert('登録できませんでした: ' + err.message);
  }
}

function bulkRegisterCore_(ss, opt) {
  const count = Math.floor(Number(opt.count));
  if (!(count >= 1 && count <= 200)) throw new Error('株数は1〜200で入力してください');
  if (STAGES.indexOf(opt.stage) < 0) throw new Error('ステージは次のどれかにしてください: ' + STAGES.join(' / '));

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sh = ss.getSheetByName(SHEETS.PLANTS);
    const table = readTable_(sh);
    const prefix = getSetting_(ss, '管理番号の頭文字') || 'P-';
    let next = nextCodeNumber_(table.rows.map((r) => r['管理番号']), prefix);
    const codes = [];
    const rows = [];
    for (let i = 0; i < count; i++) {
      const code = formatCode_(prefix, next++);
      codes.push(code);
      const rec = {
        '管理番号': code, '植物名': safeCell_(opt.name), '品種': safeCell_(opt.variety),
        'ポットサイズ': safeCell_(opt.potSize), 'ステージ': opt.stage, '登録日': opt.date,
        '写真': '', '公開': true, '公開ID': newToken_(), '出荷日': '', 'メモ（非公開）': '',
      };
      rows.push(table.headers.map((h) => (h in rec ? rec[h] : '')));
    }
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, table.headers.length).setValues(rows);
    return codes;
  } finally {
    lock.releaseLock();
  }
}

function nextCodeNumber_(codes, prefix) {
  let max = 0;
  const re = new RegExp('^' + escapeRegExp_(prefix) + '(\\d+)$');
  codes.forEach((c) => {
    const m = re.exec(String(c || '').trim());
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max + 1;
}

function formatCode_(prefix, n) {
  return prefix + String(n).padStart(3, '0');
}

function ensureTokens() {
  const n = ensureTokensCore_(SpreadsheetApp.getActive());
  SpreadsheetApp.getUi().alert(n + '株に公開IDを付けました。');
}

function ensureTokensCore_(ss) {
  const sh = ss.getSheetByName(SHEETS.PLANTS);
  const table = readTable_(sh);
  const col = table.headers.indexOf('公開ID');
  if (col < 0) throw new Error('株マスターに「公開ID」列がありません');
  let n = 0;
  table.rows.forEach((r, i) => {
    if (r['管理番号'] && !TOKEN_RE.test(String(r['公開ID'] || ''))) {
      sh.getRange(i + 2, col + 1).setValue(newToken_());
      n++;
    }
  });
  return n;
}

function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 24);
}

/* ------------------------------------------------------------------ */
/* 公開ページ（Webアプリ）                                             */
/* ------------------------------------------------------------------ */

function doGet(e) {
  const id = String((e && e.parameter && e.parameter.id) || '').trim();
  const data = TOKEN_RE.test(id) ? getPublicPlant_(SpreadsheetApp.getActive(), id, new Date()) : null;
  const t = HtmlService.createTemplateFromFile(data ? 'Care' : 'NotFound');
  t.data = data;
  t.app = APP;
  return t.evaluate()
    .setTitle(data ? data.name + '｜' + APP.name : APP.name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 公開してよい情報だけを組み立てて返す。見つからない・非公開なら null。
 */
function getPublicPlant_(ss, token, today) {
  const plants = readTable_(ss.getSheetByName(SHEETS.PLANTS)).rows;
  const p = plants.find((r) => String(r['公開ID']) === token);
  if (!p || p['公開'] !== true) return null;

  const code = String(p['管理番号']);
  const registered = toDate_(p['登録日']);
  const guideRow = readTable_(ss.getSheetByName(SHEETS.GUIDES)).rows
    .find((g) => String(g['品種']).trim() === String(p['品種']).trim());

  const logs = readTable_(ss.getSheetByName(SHEETS.LOGS)).rows
    .filter((l) => String(l['管理番号']) === code && l['公開'] !== false && toDate_(l['日付']))
    .map((l) => ({ date: toDate_(l['日付']), type: String(l['作業'] || ''), memo: String(l['公開メモ'] || '') }))
    .sort((a, b) => b.date - a.date)
    .slice(0, 30)
    .map((l) => ({ date: fmtDate_(l.date), type: l.type, memo: l.memo }));

  return {
    token: token,
    code: code,
    name: String(p['植物名'] || ''),
    variety: String(p['品種'] || ''),
    potSize: String(p['ポットサイズ'] || ''),
    stage: String(p['ステージ'] || ''),
    registered: registered ? fmtDate_(registered) : '',
    days: registered ? Math.max(0, Math.floor((startOfDay_(today) - startOfDay_(registered)) / 86400000)) : null,
    photo: photoSrc_(p['写真']),
    guide: guideRow ? {
      place: String(guideRow['置き場所'] || ''), water: String(guideRow['水やり'] || ''),
      fertilizer: String(guideRow['肥料'] || ''), winter: String(guideRow['冬越し'] || ''),
      tip: String(guideRow['ひとこと'] || ''),
    } : null,
    logs: logs,
    payOptions: PAY_OPTIONS,
  };
}

/** 写真: DriveのファイルID／共有URLならサムネイルを埋め込み、https の画像URLはそのまま使う。 */
function photoSrc_(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const driveId = extractDriveId_(v);
  if (driveId) {
    try {
      const thumb = DriveApp.getFileById(driveId).getThumbnail();
      if (!thumb) return '';
      return 'data:' + thumb.getContentType() + ';base64,' + Utilities.base64Encode(thumb.getBytes());
    } catch (err) {
      return '';
    }
  }
  return /^https:\/\/[^\s"'<>]+$/.test(v) ? v : '';
}

function extractDriveId_(v) {
  let m = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,})/.exec(v);
  if (m) return m[1];
  m = /drive\.google\.com\/.*[?&]id=([A-Za-z0-9_-]{20,})/.exec(v);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{25,}$/.test(v)) return v;
  return '';
}

/**
 * 公開ページのアンケート送信（google.script.run から呼ばれる）。
 * 個人情報は受け取らない。入力は長さ・値を検証し、数式として解釈されないようにして保存する。
 */
function submitFeedback(token, form) {
  return submitFeedbackCore_(SpreadsheetApp.getActive(), token, form, new Date());
}

function submitFeedbackCore_(ss, token, form, now) {
  token = String(token || '');
  if (!TOKEN_RE.test(token)) return { ok: false, message: 'ページが正しくありません。' };
  const plant = readTable_(ss.getSheetByName(SHEETS.PLANTS)).rows
    .find((r) => String(r['公開ID']) === token && r['公開'] === true);
  if (!plant) return { ok: false, message: 'ページが正しくありません。' };

  const f = form || {};
  const rating = Math.floor(Number(f.rating));
  if (!(rating >= 1 && rating <= 5)) return { ok: false, message: '「役に立った」を1〜5で選んでください。' };
  const pay = PAY_OPTIONS.indexOf(f.pay) >= 0 ? f.pay : '';
  const wish = cleanText_(f.wish);
  const comment = cleanText_(f.comment);

  const cache = CacheService.getScriptCache();
  const key = 'fb_' + token;
  const count = Number(cache.get(key) || 0);
  if (count >= FEEDBACK_LIMIT_PER_HOUR) return { ok: false, message: '送信が多すぎます。時間をおいてお試しください。' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ss.getSheetByName(SHEETS.FEEDBACK).appendRow([now, String(plant['管理番号']), rating, pay, safeCell_(wish), safeCell_(comment)]);
  } finally {
    lock.releaseLock();
  }
  cache.put(key, String(count + 1), 3600);
  return { ok: true, message: 'ありがとうございます。アプリの改善に活かします。' };
}

function cleanText_(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, TEXT_LIMIT);
}

/** スプレッドシートの数式インジェクション対策: = + - @ で始まる文字列は文字列として保存する。 */
function safeCell_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/* ------------------------------------------------------------------ */
/* QRラベル                                                            */
/* ------------------------------------------------------------------ */

function buildLabels() {
  const ss = SpreadsheetApp.getActive();
  const url = getSetting_(ss, '公開ページURL');
  if (!url) {
    SpreadsheetApp.getUi().alert('先に「② 公開ページのURLを登録」を実行してください。');
    return;
  }
  ensureTokensCore_(ss);
  const n = buildLabelsCore_(ss, url);
  SpreadsheetApp.getUi().alert(n + '株分のラベルを「' + SHEETS.LABELS + '」シートに作りました。\nファイル → 印刷 で印刷できます（読み取りテストを先に1枚）。');
}

/** 公開中で出荷済みでない株のラベルを、4列 × (QR行 + 文字行) で並べる。 */
function buildLabelsCore_(ss, baseUrl) {
  const plants = readTable_(ss.getSheetByName(SHEETS.PLANTS)).rows
    .filter((p) => p['管理番号'] && p['公開'] === true && p['ステージ'] !== '出荷済み' && TOKEN_RE.test(String(p['公開ID'])));
  let sh = ss.getSheetByName(SHEETS.LABELS);
  if (!sh) sh = ss.insertSheet(SHEETS.LABELS);
  sh.clear();

  const PER_ROW = 4;
  plants.forEach((p, i) => {
    const r = Math.floor(i / PER_ROW) * 2 + 1;
    const c = (i % PER_ROW) + 1;
    const pageUrl = baseUrl + '?id=' + p['公開ID'];
    sh.getRange(r, c).setFormula(qrFormula_(pageUrl));
    sh.getRange(r + 1, c).setValue(p['管理番号'] + '  ' + p['植物名']);
  });
  if (sh.setColumnWidth) {
    for (let c = 1; c <= PER_ROW; c++) sh.setColumnWidth(c, 150);
    for (let r = 1; r <= Math.ceil(plants.length / PER_ROW) * 2; r += 2) {
      sh.setRowHeight(r, 150);
      sh.setRowHeight(r + 1, 24);
    }
  }
  return plants.length;
}

function qrFormula_(url) {
  return '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data="&ENCODEURL("' + url.replace(/"/g, '""') + '"))';
}

/* ------------------------------------------------------------------ */
/* 今日の作業                                                          */
/* ------------------------------------------------------------------ */

function buildToday() {
  const ss = SpreadsheetApp.getActive();
  const items = computeDue_(ss, new Date());
  let sh = ss.getSheetByName(SHEETS.TODAY);
  if (!sh) sh = ss.insertSheet(SHEETS.TODAY);
  sh.clear();
  const rows = [['管理番号', '植物名', '作業', '予定日', '状況']].concat(
    items.map((it) => [it.code, it.name, it.task, it.due, it.overdue > 0 ? it.overdue + '日遅れ' : '今日']));
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  SpreadsheetApp.getUi().alert(items.length ? items.length + '件の作業があります。' : '今日の作業はありません。');
}

/** 出荷済み以外の株について、最後の作業日＋ガイドの間隔日数から、今日までに期限が来た作業を返す。 */
function computeDue_(ss, today) {
  const t0 = startOfDay_(today);
  const guides = {};
  readTable_(ss.getSheetByName(SHEETS.GUIDES)).rows.forEach((g) => { guides[String(g['品種']).trim()] = g; });
  const last = {};
  readTable_(ss.getSheetByName(SHEETS.LOGS)).rows.forEach((l) => {
    const d = toDate_(l['日付']);
    if (!d) return;
    const k = l['管理番号'] + '|' + l['作業'];
    if (!last[k] || d > last[k]) last[k] = d;
  });

  const out = [];
  readTable_(ss.getSheetByName(SHEETS.PLANTS)).rows.forEach((p) => {
    if (!p['管理番号'] || p['ステージ'] === '出荷済み') return;
    const g = guides[String(p['品種']).trim()];
    if (!g) return;
    const start = toDate_(p['登録日']) || t0;
    const tasks = p['ステージ'] === '水挿し'
      ? [['水換え', g['水換え間隔（日）']]]
      : [['水やり', g['水やり間隔（日）']], ['肥料', g['肥料間隔（日）']]];
    tasks.forEach(([task, interval]) => {
      const days = Number(interval);
      if (!(days > 0)) return;
      const base = last[p['管理番号'] + '|' + task] || start;
      const due = new Date(startOfDay_(base).getTime() + days * 86400000);
      const overdue = Math.round((t0 - due) / 86400000);
      if (overdue >= 0) out.push({ code: String(p['管理番号']), name: String(p['植物名']), task: task, due: fmtDate_(due), overdue: overdue });
    });
  });
  return out.sort((a, b) => b.overdue - a.overdue || a.code.localeCompare(b.code));
}

/* ------------------------------------------------------------------ */
/* 共通                                                                */
/* ------------------------------------------------------------------ */

function readTable_(sh) {
  if (!sh) return { headers: [], rows: [] };
  const values = sh.getDataRange().getValues();
  const headers = (values[0] || []).map((h) => String(h).trim());
  const rows = values.slice(1)
    .filter((r) => r.some((v) => v !== '' && v !== null))
    .map((r) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i]; });
      return o;
    });
  return { headers: headers, rows: rows };
}

function getSetting_(ss, key) {
  const row = readTable_(ss.getSheetByName(SHEETS.SETTINGS)).rows.find((r) => r['項目'] === key);
  return row ? String(row['値'] || '').trim() : '';
}

function setSetting_(ss, key, value) {
  const sh = ss.getSheetByName(SHEETS.SETTINGS);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value, '']);
}

function toDate_(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'string' && /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(v.trim())) {
    const [y, m, d] = v.trim().split(/[/-]/).map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtDate_(d) {
  return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}

function escapeRegExp_(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
