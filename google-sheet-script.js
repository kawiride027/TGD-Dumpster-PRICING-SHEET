// =============================================================
// TGD DUMPSTER PRICING — GOOGLE APPS SCRIPT
// =============================================================
// This script receives quote data from the TGD Pricing Lookup
// app and logs it to a Google Sheet.
//
// SETUP INSTRUCTIONS:
// 1. Create a new Google Sheet (or use an existing one)
// 2. Add these headers to Row 1:
//    A1: Estimate #
//    B1: Date/Time
//    C1: CSR
//    D1: Customer Name
//    E1: Phone
//    F1: Email
//    G1: Zip Code
//    H1: Zone
//    I1: Customer Type
//    J1: Bin Details
//    K1: Total Quote
//    L1: Total Discounts
//
// 3. Go to Extensions > Apps Script
// 4. Delete any existing code and paste this entire file
// 5. Click Deploy > New Deployment
// 6. Select type: "Web app"
//    - Execute as: "Me"
//    - Who has access: "Anyone"
// 7. Click "Deploy" and authorize when prompted
// 8. Copy the Web App URL
// 9. Paste the URL into the GOOGLE_SHEET_URL constant in
//    your TGD Pricing Lookup index.html file
// =============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // If headers don't exist yet, add them
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Estimate #",
        "Date/Time",
        "CSR",
        "Customer Name",
        "Phone",
        "Email",
        "Zip Code",
        "Zone",
        "Customer Type",
        "Bin Details",
        "Total Quote",
        "Total Discounts"
      ]);
    }

    // Format the timestamp for readability
    var timestamp = data.timestamp || new Date().toISOString();
    var date = new Date(timestamp);
    var formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), "MM/dd/yyyy hh:mm a");

    // Append the quote row
    sheet.appendRow([
      data.estimate_number || "",
      formattedDate,
      data.csr_name || "",
      data.customer_name || "",
      data.customer_phone || "",
      data.customer_email || "",
      data.zip_code || "",
      data.zone_name || "",
      data.customer_type || "",
      data.bin_details || "",
      data.total_quote ? "$" + data.total_quote : "",
      data.total_discounts ? "$" + data.total_discounts : "$0.00"
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

// Required for GET requests (used to test the deployment)
function doGet(e) {
  return ContentService
    .createTextOutput("TGD Quote Logger is active.")
    .setMimeType(ContentService.MimeType.TEXT);
}
