// ============================================================
// DEALISH GOOGLE SHEETS INTEGRATION
// ============================================================
// Setup instructions:
// 1. In your Google Sheet, go to Extensions → Apps Script
// 2. Paste this entire file, replacing any existing code
// 3. Fill in your credentials in the CONFIG section below
// 4. Click Save, then Run → setupTriggers (approve permissions)
// 5. Deploy → New Deployment → Web App → Execute as: Me → Access: Anyone
// 6. Copy the Web App URL and paste it into Dealish admin → Integrations → Webhook URL
// 7. Click "Detect Schema" in Dealish admin — we'll figure out your columns automatically
// ============================================================

// ---- CONFIG (fill these in) ----
const CONFIG = {
  API_KEY: 'YOUR_DEALISH_API_KEY',         // From Dealish admin → Integrations → Generate Key
  RESTAURANT_ID: 'YOUR_RESTAURANT_ID',     // From Dealish admin → Integrations
  INTEGRATION_ID: 'YOUR_INTEGRATION_ID',  // From Dealish admin → Integrations (after setup)
  SHEET_TAB: 'Sheet1',                     // Name of the tab with your deals/inventory
  DEALISH_API_URL: 'https://hpsoqjpzebkkxdqapegl.supabase.co/functions/v1',
  HEADER_ROW: 1,                           // Which row has your column headers (usually 1)
  DATA_START_ROW: 2,                       // Which row your data starts (usually 2)
};
// ---- END CONFIG ----


// ============================================================
// INBOUND: Sheet → Dealish
// Runs when you edit the sheet; sends changed rows to Dealish
// ============================================================

function onEditTrigger(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_TAB) return;

  const row = e.range.getRow();
  if (row < CONFIG.DATA_START_ROW) return; // ignore header edits

  // Debounce: use CacheService to avoid rapid-fire syncs
  const cache = CacheService.getScriptCache();
  const cacheKey = `pending_sync_${row}`;
  cache.put(cacheKey, 'true', 5); // 5 second debounce

  // Schedule a sync via time trigger (fires ~1 min later)
  // For immediate sync, call syncRow(row) directly (slower on large sheets)
  syncRow(row);
}

function syncRow(rowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_TAB);
  if (!sheet) return;

  const headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Build named object from headers + row data
  const rowObj = {};
  headers.forEach((h, i) => {
    if (h) rowObj[h] = rowData[i];
  });

  // Skip completely empty rows
  if (Object.values(rowObj).every(v => v === '' || v === null || v === undefined)) return;

  const payload = {
    integration_id: CONFIG.INTEGRATION_ID,
    rows: [{ row_index: rowIndex, data: rowObj }],
  };

  try {
    const resp = UrlFetchApp.fetch(`${CONFIG.DEALISH_API_URL}/sheets-sync/sync`, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': CONFIG.API_KEY },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const result = JSON.parse(resp.getContentText());
    if (resp.getResponseCode() !== 200) {
      console.error(`Dealish sync error for row ${rowIndex}:`, result);
    }
  } catch (err) {
    console.error(`Failed to sync row ${rowIndex}:`, err);
  }
}

// Full sync: syncs all rows (run manually or on a time trigger)
function syncAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_TAB);
  if (!sheet) { console.error(`Tab "${CONFIG.SHEET_TAB}" not found`); return; }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) { console.log('No data rows to sync'); return; }

  const headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dataRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, sheet.getLastColumn());
  const allRows = dataRange.getValues();

  const rows = allRows.map((rowData, i) => {
    const rowObj = {};
    headers.forEach((h, j) => { if (h) rowObj[h] = rowData[j]; });
    return { row_index: CONFIG.DATA_START_ROW + i, data: rowObj };
  }).filter(r => Object.values(r.data).some(v => v !== '' && v !== null));

  if (!rows.length) { console.log('No non-empty rows to sync'); return; }

  // Batch in groups of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const payload = { integration_id: CONFIG.INTEGRATION_ID, rows: batch };

    try {
      const resp = UrlFetchApp.fetch(`${CONFIG.DEALISH_API_URL}/sheets-sync/sync`, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-api-key': CONFIG.API_KEY },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      const result = JSON.parse(resp.getContentText());
      console.log(`Synced rows ${i + CONFIG.DATA_START_ROW}–${i + batch.length + CONFIG.DATA_START_ROW - 1}:`, result.results?.length, 'processed');
    } catch (err) {
      console.error(`Batch sync error:`, err);
    }
  }

  console.log('Full sync complete');
}

// Initial setup: send headers + sample to Dealish for LLM schema detection
function detectSchema() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_TAB);
  if (!sheet) { console.error(`Tab "${CONFIG.SHEET_TAB}" not found`); return; }

  const headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0].filter(h => h !== '');
  const lastRow = Math.min(sheet.getLastRow(), CONFIG.DATA_START_ROW + 4);
  const sampleRows = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, headers.length).getValues();

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const payload = {
    sheet_id: spreadsheet.getId(),
    sheet_tab: CONFIG.SHEET_TAB,
    headers,
    sample_rows: sampleRows,
    webhook_url: getWebAppUrl(), // auto-detect deployed URL if possible
  };

  const resp = UrlFetchApp.fetch(`${CONFIG.DEALISH_API_URL}/sheets-sync/detect`, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': CONFIG.API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(resp.getContentText());
  if (resp.getResponseCode() === 200) {
    console.log('✅ Schema detected! Integration ID:', result.integration_id);
    console.log('Column mapping:', JSON.stringify(result.mapping, null, 2));
    console.log('→ Update INTEGRATION_ID in CONFIG with:', result.integration_id);
    SpreadsheetApp.getUi().alert(`✅ Schema detected!\n\nIntegration ID: ${result.integration_id}\n\nUpdate INTEGRATION_ID in CONFIG then run syncAllRows.`);
  } else {
    console.error('Schema detection failed:', result);
    SpreadsheetApp.getUi().alert(`❌ Schema detection failed: ${result.error || 'Unknown error'}`);
  }
}

function getWebAppUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (_) {
    return null;
  }
}


// ============================================================
// OUTBOUND: Dealish → Sheet
// Called by Dealish when a deal is created/updated in the app
// ============================================================

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { event, deal, row_index } = payload;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_TAB);
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ error: 'Sheet not found' })).setMimeType(ContentService.MimeType.JSON);

    const headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lastCol = sheet.getLastColumn();

    if (event === 'delete') {
      if (row_index) {
        // Mark as inactive rather than deleting the row
        const activeCol = headers.findIndex(h => String(h).toLowerCase().includes('active'));
        if (activeCol >= 0) {
          sheet.getRange(row_index, activeCol + 1).setValue('No');
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // Build row values aligned to headers
    const rowValues = headers.map(header => {
      const h = String(header).toLowerCase().trim();
      if (h.includes('title') || h.includes('name') || h.includes('item')) return deal.title || '';
      if (h.includes('description') || h.includes('detail') || h.includes('note')) return deal.description || '';
      if (h.includes('deal price') || h.includes('sale price') || h.includes('promo price')) return deal.deal_price || '';
      if (h.includes('original') || h.includes('regular') || h.includes('full price')) return deal.original_price || '';
      if (h.includes('discount') || h.includes('percent') || h.includes('%')) return deal.discount_percent || '';
      if (h.includes('active') || h.includes('enabled') || h.includes('on special')) return deal.is_active ? 'Yes' : 'No';
      if (h.includes('valid from') || h.includes('start')) return deal.valid_from ? new Date(deal.valid_from).toLocaleDateString() : '';
      if (h.includes('valid until') || h.includes('expir') || h.includes('end')) return deal.valid_until ? new Date(deal.valid_until).toLocaleDateString() : '';
      if (h.includes('category') || h.includes('type')) return deal.category || '';
      return ''; // unknown column — leave blank
    });

    if (row_index) {
      // Update existing row
      sheet.getRange(row_index, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      // Append new row
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1, 1, rowValues.length).setValues([rowValues]);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('doPost error:', err);
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
// SETUP (run once after pasting this script)
// ============================================================

function setupTriggers() {
  // Remove any existing onEdit triggers for this script
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'onEditTrigger') ScriptApp.deleteTrigger(t);
  });

  // Install onEdit trigger
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  console.log('✅ Triggers installed. Now run detectSchema() to connect to Dealish.');
  SpreadsheetApp.getUi().alert('✅ Triggers installed!\n\nNext step: Run detectSchema() to connect your sheet to Dealish.');
}

function addMenu() {
  SpreadsheetApp.getUi()
    .createMenu('🍽️ Dealish')
    .addItem('1. Setup Triggers', 'setupTriggers')
    .addItem('2. Detect Schema', 'detectSchema')
    .addItem('3. Sync All Rows Now', 'syncAllRows')
    .addToUi();
}

// Auto-run when sheet opens
function onOpen() {
  addMenu();
}
