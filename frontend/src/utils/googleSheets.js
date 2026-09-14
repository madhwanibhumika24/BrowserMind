// Exports a Google Form's current responses into a brand new Google Sheet.
// This is a snapshot, not a live two-way link - the Google Forms REST API
// doesn't expose the "linked spreadsheet" feature you get from the Forms
// UI (Responses tab -> "Create Spreadsheet"), so instead we read the
// responses ourselves via the Forms API and write them into a fresh Sheet
// via the Sheets API. Re-run it anytime for an updated snapshot.
import { getGoogleAccessToken } from "./auth.js";

const FORMS_API = "https://forms.googleapis.com/v1/forms";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

function buildAuthHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function describeSheetsError(res) {
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    detail = body?.error?.message || detail;
  } catch (err) {
    // Response wasn't JSON - stick with the status code.
  }
  if (res.status === 403) {
    return `Google Sheets access denied: ${detail}. Make sure the Google Sheets API is enabled for this project and you're added as a test user.`;
  }
  if (res.status === 401) {
    return `Google sign-in for Sheets expired: ${detail}. Try again - you may be asked to re-approve access.`;
  }
  return `Google Sheets export failed: ${detail}`;
}

// Response answers are keyed by Google's internal questionId, not by our
// own question order - so we need the form's actual item structure to map
// each questionId back to its question text and preserve column order.
function extractQuestionOrder(form) {
  return (form.items || [])
    .filter((item) => item.questionItem)
    .map((item) => ({ questionId: item.questionItem.question.questionId, title: item.title }));
}

function answerValue(response, questionId) {
  const answer = response.answers?.[questionId];
  if (!answer) return "";
  const values = answer.textAnswers?.answers?.map((a) => a.value) || [];
  return values.join(", ");
}

async function fetchFormAndResponses(token, formId) {
  const authHeaders = buildAuthHeaders(token);

  const formRes = await fetch(`${FORMS_API}/${formId}`, { headers: authHeaders });
  if (!formRes.ok) throw { status: formRes.status, message: await describeSheetsError(formRes) };
  const form = await formRes.json();

  const responsesRes = await fetch(`${FORMS_API}/${formId}/responses`, { headers: authHeaders });
  if (!responsesRes.ok) throw { status: responsesRes.status, message: await describeSheetsError(responsesRes) };
  const { responses = [] } = await responsesRes.json();

  return { form, responses };
}

// "Submitted at" and "Respondent email" are fixed leading columns, then one
// column per question. Forms only include respondentEmail once email
// collection is turned on (see googleForms.js) - older forms created before
// that won't have it, so the column just comes back blank for those.
function buildRows(form, responses) {
  const questions = extractQuestionOrder(form);
  const header = ["Submitted at", "Respondent email", ...questions.map((q) => q.title)];
  const rows = responses.map((r) => [
    r.lastSubmittedTime ? new Date(r.lastSubmittedTime).toLocaleString() : "",
    r.respondentEmail || "",
    ...questions.map((q) => answerValue(r, q.questionId)),
  ]);
  return [header, ...rows];
}

const HEADER_BG = { red: 0.424, green: 0.361, blue: 0.906 };
const BORDER_COLOR = { red: 0.85, green: 0.85, blue: 0.89 };
const STRIPE_COLOR = { red: 0.96, green: 0.96, blue: 0.99 };

// Bold+colored frozen header, alternating row stripes, thin grid borders,
// wrapped cells so long answers aren't cut off, and fixed readable column
// widths (narrow for the timestamp/email columns, a consistent width for
// question columns) instead of unpredictable auto-sizing - a raw
// values.update alone leaves everything the same plain default width,
// which reads as a wall of truncated, borderless cells.
function formattingRequests(sheetId, columnCount, rowCount) {
  const dataRange = { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount };
  const border = { style: "SOLID", width: 1, color: BORDER_COLOR };

  return [
    {
      addBanding: {
        bandedRange: {
          range: dataRange,
          rowProperties: { firstBandColor: { red: 1, green: 1, blue: 1 }, secondBandColor: STRIPE_COLOR },
        },
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount },
        cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
        fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
      },
    },
    {
      updateBorders: {
        range: dataRange,
        top: border,
        bottom: border,
        left: border,
        right: border,
        innerHorizontal: border,
        innerVertical: border,
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 2 },
        properties: { pixelSize: 160 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: columnCount },
        properties: { pixelSize: 240 },
        fields: "pixelSize",
      },
    },
  ];
}

async function createSheetWithRows(token, title, rows) {
  const authHeaders = buildAuthHeaders(token);

  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ properties: { title } }),
  });
  if (!createRes.ok) throw { status: createRes.status, message: await describeSheetsError(createRes) };
  const sheet = await createRes.json();
  const sheetId = sheet.sheets?.[0]?.properties?.sheetId ?? 0;

  const updateRes = await fetch(
    `${SHEETS_API}/${sheet.spreadsheetId}/values/A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!updateRes.ok) throw { status: updateRes.status, message: await describeSheetsError(updateRes) };

  const formatRes = await fetch(`${SHEETS_API}/${sheet.spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ requests: formattingRequests(sheetId, rows[0].length, rows.length) }),
  });
  // Formatting is cosmetic - the data itself already saved successfully, so
  // a formatting failure shouldn't fail the whole export.
  if (!formatRes.ok) {
    console.warn("Sheets formatting step failed:", await formatRes.text());
  }

  return { spreadsheetUrl: sheet.spreadsheetUrl, responseCount: rows.length - 1 };
}

async function runExport(token, formId, formTitle) {
  const { form, responses } = await fetchFormAndResponses(token, formId);
  const rows = buildRows(form, responses);
  return createSheetWithRows(token, `${formTitle} - Responses`, rows);
}

export async function exportResponsesToSheet(formId, formTitle) {
  const token = await getGoogleAccessToken(true);

  try {
    return await runExport(token, formId, formTitle);
  } catch (err) {
    // Same story as googleForms.js - a cached token that predates the new
    // scopes needs one fresh interactive consent before it'll work.
    if (err?.status === 401 || err?.status === 403) {
      await new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, resolve));
      const freshToken = await getGoogleAccessToken(true);
      return await runExport(freshToken, formId, formTitle);
    }
    throw new Error(err?.message || "Could not export responses to Sheets - try again.");
  }
}
