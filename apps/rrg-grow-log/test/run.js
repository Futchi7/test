// Code.gs のロジックを、Google のサービスを模したオブジェクトで検証する。
// 実行: node test/run.js   （プレビューHTMLを test/preview.html に出力）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const crypto = require('crypto');

const root = path.join(__dirname, '..');

/* ---------------- Fakes ---------------- */
class FakeRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr: nr || 1, nc: nc || 1 }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(this.sheet.get(this.r + i, this.c + j));
      out.push(row);
    }
    return out;
  }
  setValues(v) {
    assert.strictEqual(v.length, this.nr, 'row count mismatch');
    v.forEach((row, i) => { assert.strictEqual(row.length, this.nc, 'col count mismatch'); row.forEach((x, j) => this.sheet.set(this.r + i, this.c + j, x)); });
    return this;
  }
  setValue(x) { this.sheet.set(this.r, this.c, x); return this; }
  setFormula(f) { this.sheet.set(this.r, this.c, f); return this; }
}
class FakeSheet {
  constructor(name) { this.name = name; this.data = []; }
  get(r, c) { return (this.data[r - 1] || [])[c - 1] ?? ''; }
  set(r, c, v) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return Math.max(0, ...this.data.map((r) => r.length)); }
  getRange(r, c, nr, nc) { return new FakeRange(this, r, c, nr, nc); }
  getDataRange() { return new FakeRange(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  appendRow(row) { this.data.push(row.slice()); }
  clear() { this.data = []; }
}
class FakeSS {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new FakeSheet(n)); }
}
const cacheStore = {};
const sandbox = {
  console,
  Utilities: { getUuid: () => crypto.randomUUID(), base64Encode: (b) => Buffer.from(b).toString('base64') },
  LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }), getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cacheStore[k] ?? null, put: (k, v) => { cacheStore[k] = v; } }) },
  DriveApp: { getFileById: (id) => ({ getThumbnail: () => ({ getContentType: () => 'image/png', getBytes: () => [137, 80, 78, 71] }) }) },
};
// 同じ realm で実行する（Date や配列の instanceof を本番と同じ挙動にするため）
Object.assign(globalThis, sandbox);
vm.runInThisContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'));
const G = (name) => vm.runInThisContext(name);

/* ---------------- Tests ---------------- */
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }

const ss = new FakeSS();
G('setupCore_')(ss);
const PLANTS = G('SHEETS').PLANTS;

test('セットアップで5シートとガイド初期値が作られる', () => {
  ['株マスター', '作業ログ', '育て方ガイド', 'テスターの声', '設定'].forEach((n) => assert.ok(ss.getSheetByName(n), n));
  assert.strictEqual(ss.getSheetByName('育て方ガイド').getLastRow(), 4);
});

test('セットアップを2回実行しても重複しない', () => {
  G('setupCore_')(ss);
  assert.strictEqual(ss.getSheetByName('育て方ガイド').getLastRow(), 4);
  assert.strictEqual(ss.getSheetByName('設定').getLastRow(), 3);
});

let codes;
test('まとめて登録で連番と公開IDが付く', () => {
  codes = G('bulkRegisterCore_')(ss, { name: 'ゴールデンポトス', variety: 'ポトス', potSize: '3号', stage: '育成中', count: 3, date: new Date(2026, 7, 1) });
  assert.deepStrictEqual(codes, ['P-001', 'P-002', 'P-003']);
  const more = G('bulkRegisterCore_')(ss, { name: 'ゴールデン水苔', variety: 'ポトス', potSize: '水挿し', stage: '水挿し', count: 2, date: new Date(2026, 8, 1) });
  assert.deepStrictEqual(more, ['P-004', 'P-005']);
  const rows = G('readTable_')(ss.getSheetByName(PLANTS)).rows;
  const tokens = rows.map((r) => r['公開ID']);
  assert.strictEqual(new Set(tokens).size, 5);
  tokens.forEach((t) => assert.ok(G('TOKEN_RE').test(t)));
});

test('株数やステージが不正なら登録しない', () => {
  assert.throws(() => G('bulkRegisterCore_')(ss, { name: 'x', variety: 'ポトス', stage: '育成中', count: 0, date: new Date() }));
  assert.throws(() => G('bulkRegisterCore_')(ss, { name: 'x', variety: 'ポトス', stage: '謎', count: 1, date: new Date() }));
  assert.strictEqual(ss.getSheetByName(PLANTS).getLastRow(), 6);
});

test('数式インジェクションを防ぐ', () => {
  assert.strictEqual(G('safeCell_')('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.strictEqual(G('safeCell_')('+81'), "'+81");
  assert.strictEqual(G('safeCell_')('ふつうの文'), 'ふつうの文');
});

// 作業ログと写真を追加
const logs = ss.getSheetByName('作業ログ');
[[new Date(2026, 8, 20), 'P-001', '水やり', '元気です', true, ''],
 [new Date(2026, 8, 10), 'P-001', '肥料', '', true, ''],
 [new Date(2026, 8, 25), 'P-001', 'その他', '', false, '仕入れ値メモ（非公開）'],
 [new Date(2026, 8, 22), 'P-004', '水換え', '', true, '']].forEach((r) => logs.appendRow(r));
const plantSheet = ss.getSheetByName(PLANTS);
const rows = () => G('readTable_')(plantSheet).rows;
const tokenOf = (code) => rows().find((r) => r['管理番号'] === code)['公開ID'];
plantSheet.set(2, 7, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view');
plantSheet.set(2, 11, '仕入れ先メモ（非公開）');

test('公開ページには許可した項目だけが出る', () => {
  const d = G('getPublicPlant_')(ss, tokenOf('P-001'), new Date(2026, 8, 29));
  assert.strictEqual(d.code, 'P-001');
  assert.strictEqual(d.days, 59);
  assert.strictEqual(d.logs.length, 2, '非公開ログは出ない');
  assert.strictEqual(d.logs[0].type, '水やり', '新しい順');
  const json = JSON.stringify(d);
  assert.ok(!json.includes('非公開'), '非公開メモが漏れていない');
  assert.ok(d.photo.startsWith('data:image/png;base64,'), 'Driveはサムネイル埋め込み');
  assert.ok(!json.includes('1AbCdEfGh'), 'DriveのファイルIDを出さない');
  assert.ok(d.guide && d.guide.water.includes('乾いたら'));
});

test('非公開の株・存在しない公開IDは表示しない', () => {
  plantSheet.set(3, 8, false);
  assert.strictEqual(G('getPublicPlant_')(ss, tokenOf('P-002'), new Date()), null);
  assert.strictEqual(G('getPublicPlant_')(ss, 'x'.repeat(24), new Date()), null);
  plantSheet.set(3, 8, true);
});

test('写真URLの検証', () => {
  assert.strictEqual(G('photoSrc_')('https://example.com/a.jpg'), 'https://example.com/a.jpg');
  assert.strictEqual(G('photoSrc_')('javascript:alert(1)'), '');
  assert.strictEqual(G('photoSrc_')('https://x.com/a.jpg" onerror="alert(1)'), '');
  assert.strictEqual(G('photoSrc_')('http://example.com/a.jpg'), '');
});

test('アンケート: 正常に保存され、入力は検証される', () => {
  const t = tokenOf('P-001');
  const fb = ss.getSheetByName('テスターの声');
  let r = G('submitFeedbackCore_')(ss, t, { rating: '5', pay: '使いたい', wish: '=IMPORTXML("x")', comment: 'a'.repeat(900) }, new Date());
  assert.ok(r.ok);
  const saved = fb.data[fb.data.length - 1];
  assert.strictEqual(saved[1], 'P-001');
  assert.strictEqual(saved[2], 5);
  assert.ok(saved[4].startsWith("'="), '数式として保存しない');
  assert.strictEqual(saved[5].length, 500, '長さ制限');
  r = G('submitFeedbackCore_')(ss, t, { rating: '9' }, new Date());
  assert.ok(!r.ok);
  r = G('submitFeedbackCore_')(ss, 'bad', { rating: '3' }, new Date());
  assert.ok(!r.ok);
  r = G('submitFeedbackCore_')(ss, t, { rating: '3', pay: 'ハッキング' }, new Date());
  assert.ok(r.ok);
  assert.strictEqual(fb.data[fb.data.length - 1][3], '', '選択肢以外は空に');
});

test('アンケート: 1時間あたりの送信回数を制限', () => {
  const t = tokenOf('P-003');
  for (let i = 0; i < 5; i++) assert.ok(G('submitFeedbackCore_')(ss, t, { rating: 4 }, new Date()).ok);
  assert.ok(!G('submitFeedbackCore_')(ss, t, { rating: 4 }, new Date()).ok);
});

test('今日の作業: 間隔を過ぎた作業だけが出る', () => {
  const due = G('computeDue_')(ss, new Date(2026, 8, 29));
  const find = (code, task) => due.find((d) => d.code === code && d.task === task);
  assert.strictEqual(find('P-001', '水やり').overdue, 4, '9/20+5日=9/25 → 4日遅れ');
  assert.ok(!find('P-001', '肥料'), '9/10+60日はまだ');
  assert.ok(find('P-004', '水換え'), '水挿しは水換え 9/22+7=9/29');
  assert.ok(!find('P-004', '水やり'), '水挿しに水やりは出さない');
  assert.strictEqual(find('P-005', '水換え').overdue, 21, '記録なしは登録日から 9/1+7=9/8');
});

test('QRラベル: 公開中の株だけを4列で並べる', () => {
  plantSheet.set(4, 5, '出荷済み');
  const n = G('buildLabelsCore_')(ss, 'https://script.google.com/macros/s/ABC/exec');
  assert.strictEqual(n, 4);
  const sh = ss.getSheetByName('QRラベル');
  assert.ok(String(sh.get(1, 1)).startsWith('=IMAGE("https://api.qrserver.com/'));
  assert.ok(String(sh.get(1, 1)).includes('exec?id=' + tokenOf('P-001')));
  assert.ok(String(sh.get(2, 1)).startsWith('P-001'));
  assert.ok(String(sh.get(1, 4)).includes(tokenOf('P-005')), '出荷済みのP-003を除いた4枚目');
  assert.ok(!JSON.stringify(sh.data).includes(tokenOf('P-003')), '出荷済みは作らない');
  plantSheet.set(4, 5, '育成中');
  G('buildLabelsCore_')(ss, 'https://script.google.com/macros/s/ABC/exec');
  assert.ok(String(sh.get(3, 1)).includes(tokenOf('P-005')), '5枚目は2段目');
});

console.log(`\n${passed} tests passed`);

/* ---------------- Preview (HtmlService template の簡易再現) ---------------- */
function renderTemplate(file, vars) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  let code = 'let __o="";\n';
  const re = /<\?(!?=)?([\s\S]*?)\?>/g;
  let last = 0; let m;
  while ((m = re.exec(src))) {
    code += '__o+=' + JSON.stringify(src.slice(last, m.index)) + ';\n';
    if (m[1] === '=') code += '__o+=__esc(' + m[2] + ');\n';
    else if (m[1] === '!=') code += '__o+=(' + m[2] + ');\n';
    else code += m[2] + '\n';
    last = re.lastIndex;
  }
  code += '__o+=' + JSON.stringify(src.slice(last)) + ';\nreturn __o;';
  return new Function('data', 'app', '__esc', code)(vars.data, vars.app, esc);
}
const sampleData = G('getPublicPlant_')(ss, tokenOf('P-001'), new Date(2026, 8, 29));
sampleData.name = 'ゴールデンポトス <script>x</script>'; // エスケープ確認用
let html = renderTemplate('Care.html', { data: sampleData, app: G('APP') });
assert.ok(!html.includes('<script>x</script>'), 'テンプレートでエスケープされる');
sampleData.name = 'ゴールデンポトス';
sampleData.photo = '';
html = renderTemplate('Care.html', { data: sampleData, app: G('APP') });
html = html.replace('<script>', '<script>window.google={script:{run:{withSuccessHandler(f){this.s=f;return this;},withFailureHandler(){return this;},submitFeedback(){this.s({ok:true,message:"ありがとうございます。アプリの改善に活かします。"});}}}};</script>\n<script>');
fs.writeFileSync(path.join(__dirname, 'preview.html'), html);
fs.writeFileSync(path.join(__dirname, 'preview-notfound.html'), renderTemplate('NotFound.html', { data: null, app: G('APP') }));
console.log('preview written: test/preview.html');
