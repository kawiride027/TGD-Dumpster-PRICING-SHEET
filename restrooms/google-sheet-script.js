// =============================================================
// TGD RESTROOM QUOTES — GOOGLE APPS SCRIPT
// =============================================================
// Logs portable-restroom and temp-power-pole estimates.
// Do not paste this into the dumpster quote spreadsheet.
// The dumpster web app writes to that spreadsheet's active tab
// and does not accept a sheet or tab parameter.
//
// SETUP
// 1. Create a new Google Sheet for restroom estimates.
// 2. Extensions > Apps Script. Delete the sample and paste this file.
// 3. Deploy > New deployment > Web app.
//    Execute as: Me. Who has access: Anyone.
// 4. Paste the web app /exec URL into GOOGLE_SHEET_URL in restrooms/index.html.
// 5. Paste the Google Sheet URL (the link CSRs open) into RESTROOM_ESTIMATES_URL.
//
// The script creates a tab named "Restroom Estimates" if it is missing.
// It does not write to any other tab.
//
// Columns:
// A Estimate #
// B Date/Time
// C CSR
// D CSR Email
// E Customer Name
// F Phone
// G Email
// H Job Address
// I Use Case
// J Details
// K Total Quote
// L Recurring 28-day
// =============================================================

var RESTROOM_TAB = "Restroom Estimates";
var RESTROOM_HEADERS = [
  "Estimate #",
  "Date/Time",
  "CSR",
  "CSR Email",
  "Customer Name",
  "Phone",
  "Email",
  "Job Address",
  "Use Case",
  "Details",
  "Total Quote",
  "Recurring 28-day"
];

function restroomSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(RESTROOM_TAB);
  if (!sheet) sheet = ss.insertSheet(RESTROOM_TAB);
  if (sheet.getLastRow() === 0) sheet.appendRow(RESTROOM_HEADERS);
  return sheet;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = restroomSheet();
    var timestamp = data.timestamp || new Date().toISOString();
    var formattedDate = Utilities.formatDate(new Date(timestamp), Session.getScriptTimeZone(), "MM/dd/yyyy hh:mm a");
    sheet.appendRow([
      data.estimate_number || "",
      formattedDate,
      data.csr_name || "",
      data.csr_email || "",
      data.customer_name || "",
      data.customer_phone || "",
      data.customer_email || "",
      data.job_address || "",
      data.use_case || "",
      data.details || "",
      data.total_quote ? "$" + data.total_quote : "",
      data.recurring_28_day_total ? "$" + data.recurring_28_day_total : ""
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput("TGD Restroom Quote Logger is active.")
    .setMimeType(ContentService.MimeType.TEXT);
}
