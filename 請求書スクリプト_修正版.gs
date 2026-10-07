function createAndOrganizeReceipts() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var timeZone = "Asia/Tokyo";

  // ==========================================
  // 1. 「設定」タブから各種設定と「作成モード」を取得
  // ==========================================
  var configSheet = spreadsheet.getSheetByName("設定");
  if (!configSheet) {
    throw new Error("スプレッドシートの左下に「設定」という名前のタブ（シート）を作成してください。");
  }

  // B8セルから現在のモード（見積書/請求書/領収書）を取得
  var mode = configSheet.getRange("B8").getValue().toString().trim();
  if (!mode) {
    throw new Error("「設定」タブのB8セルで、作成する書類（見積書/請求書/領収書）を選択してください。");
  }

  var templateId = "";
  var folderName = "";

  // モードに応じて、読み込むセルを自動切り替え
  if (mode === "請求書") {
    templateId = configSheet.getRange("B2").getValue().toString().trim();
    folderName = configSheet.getRange("B3").getValue().toString().trim();
  } else if (mode === "見積書") {
    templateId = configSheet.getRange("B4").getValue().toString().trim();
    folderName = configSheet.getRange("B5").getValue().toString().trim();
  } else if (mode === "領収書") {
    templateId = configSheet.getRange("B6").getValue().toString().trim();
    folderName = configSheet.getRange("B7").getValue().toString().trim();
  } else {
    throw new Error("B8セルの値が正しくありません。「見積書」「請求書」「領収書」のいずれかを指定してください。");
  }

  if (!templateId) {
    throw new Error("「設定」タブに、" + mode + "用のひな形ドキュメントIDが入力されていません。");
  }
  if (!folderName) {
    folderName = "今回の" + mode;
  }

  // ==========================================
  // 2. フォルダの特定
  //    【修正】ドライブ全体ではなく、このスプレッドシートと同じフォルダの中だけを探す。
  //    同じ名前のフォルダが別の場所にあっても、出力先が毎回変わらない。
  // ==========================================
  var baseFolder = getBaseFolder_(spreadsheet);
  var targetFolder = getOrCreateChildFolder_(baseFolder, folderName);
  // 【修正】作業用ファイルはマイドライブ直下ではなく、専用フォルダに作る
  var workFolder = getOrCreateChildFolder_(baseFolder, "_作業用（自動で空になります）");

  // ==========================================
  // 3. データ入力シートを開いて集計開始
  // ==========================================
  var sheet = spreadsheet.getSheetByName("シート1");
  if (sheet === null) {
    sheet = spreadsheet.getSheets()[0];
    if (sheet.getName() === "設定" && spreadsheet.getSheets().length > 1) {
      sheet = spreadsheet.getSheets()[1];
    }
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var currencyFormatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });

  function cleanNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    var str = val.toString().replace(/[￥,円個ヶつ\s]/g, '');
    var num = Number(str);
    return isNaN(num) ? 0 : num;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var customers = {};

  for (var i = 0; i < rows.length; i++) {
    var name = rows[i][0].toString().trim();
    if (name === "" || name === "設定項目") continue;

    if (!customers[name]) {
      customers[name] = [];
    }

    customers[name].push({
      rowIndex: i + 2,
      item: rows[i][1],
      price: cleanNumber(rows[i][2]),
      count: cleanNumber(rows[i][3])
    });
  }

  var today = new Date();
  var dateString = Utilities.formatDate(today, timeZone, "yyyy年M月d日");
  var fileDate = Utilities.formatDate(today, timeZone, "yyyyMMdd");

  // 顧客ごとに書類を作成
  for (var customerName in customers) {
    var items = customers[customerName];
    if (items.length === 0) continue;

    var newCopy = null;

    try {
      var templateFile = DriveApp.getFileById(templateId);
      newCopy = templateFile.makeCopy(customerName + "様_" + mode + "_作成中", workFolder);

      var doc = DocumentApp.openById(newCopy.getId());
      var body = doc.getBody();

      var found = body.findText("{{商品名}}");
      var targetTable = null;
      var templateRow = null;
      var templateRowIndex = -1;

      if (found) {
        var element = found.getElement();
        while (element && element.getType() !== DocumentApp.ElementType.TABLE_ROW) {
          element = element.getParent();
        }
        if (element) {
          templateRow = element;
          targetTable = templateRow.getParent();
          templateRowIndex = targetTable.getChildIndex(templateRow);
        }
      }

      if (!targetTable || !templateRow) {
        throw new Error("ひな形ドキュメントの中に『{{商品名}}』の文字が入った表が見つかりません。");
      }

      var subtotal = 0;

      for (var j = 0; j < items.length; j++) {
        var itemData = items[j];
        var amount = itemData.price * itemData.count;
        subtotal += amount;

        sheet.getRange(itemData.rowIndex, 5).setValue(amount);

        var newRow = templateRow.copy();
        newRow.replaceText("{{商品名}}", itemData.item);
        newRow.replaceText("{{単価}}", currencyFormatter.format(itemData.price) + "-");
        newRow.replaceText("{{数量}}", itemData.count + " ヶ");
        newRow.replaceText("{{金額}}", currencyFormatter.format(amount) + "-");

        targetTable.insertTableRow(templateRowIndex + j + 1, newRow);
      }

      targetTable.removeRow(templateRowIndex);

      var tax = Math.round(subtotal * 0.1);
      var total = subtotal + tax;

      var formattedSubtotal = currencyFormatter.format(subtotal) + "-";
      var formattedTax      = currencyFormatter.format(tax) + "-";
      var formattedTotal    = currencyFormatter.format(total) + "-";

      body.replaceText("{{名前}}", customerName);
      body.replaceText("{{税抜}}", formattedSubtotal);
      body.replaceText("{{税抜金額}}", formattedSubtotal);
      body.replaceText("{{消費税}}", formattedTax);
      body.replaceText("{{消費税額}}", formattedTax);
      body.replaceText("{{税込}}", formattedTotal);
      body.replaceText("{{税込金額}}", formattedTotal);
      body.replaceText("{{日付}}", dateString);

      // 【修正】置き換えられずに残った差し込み欄があれば、PDFを作らずにエラーにする
      var leftover = body.findText("\\{\\{[^}]+\\}\\}");
      if (leftover) {
        var el = leftover.getElement().asText().getText();
        var tag = el.substring(leftover.getStartOffset(), leftover.getEndOffsetInclusive() + 1);
        throw new Error("ひな形に置き換えられない差し込み欄があります: " + tag);
      }

      doc.saveAndClose();

      // 【修正】ファイル名に日付を付け、同じ日に作り直したときは古いPDFをゴミ箱へ移して1つにする
      var pdfName = customerName + "様_" + mode + "_" + fileDate + ".pdf";
      var sameName = targetFolder.getFilesByName(pdfName);
      while (sameName.hasNext()) {
        sameName.next().setTrashed(true);
      }

      var pdfBlob = newCopy.getAs('application/pdf');
      targetFolder.createFile(pdfBlob).setName(pdfName);

      // 【修正】PDFができてから「出力成功」を書く
      for (var s = 0; s < items.length; s++) {
        sheet.getRange(items[s].rowIndex, 6).setValue(mode + "出力成功（" + dateString + "）");
      }

    } catch (error) {
      for (var k = 0; k < items.length; k++) {
        sheet.getRange(items[k].rowIndex, 6).setValue("エラー: " + error.message);
      }
    } finally {
      // 【修正】成功しても失敗しても、作業用ファイルは必ずゴミ箱へ移す
      if (newCopy) {
        try {
          newCopy.setTrashed(true);
        } catch (e) {
          // ゴミ箱へ移せなくても処理は続ける（作業用フォルダに残るだけ）
        }
      }
    }
  }
}

// このスプレッドシートが入っているフォルダを返す
function getBaseFolder_(spreadsheet) {
  var parents = DriveApp.getFileById(spreadsheet.getId()).getParents();
  return parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
}

// 指定フォルダの直下にある同名フォルダを返す。なければ作る
function getOrCreateChildFolder_(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}
