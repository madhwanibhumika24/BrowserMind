// Creates a REAL Google Form (in the signed-in user's own Google Drive) via
// the Google Forms REST API, called directly from the extension using the
// user's own OAuth token - our backend never sees this token or talks to
// Google Forms itself. Requires the forms.body scope declared in
// manifest.json's oauth2.scopes, and the Google Forms API enabled on the
// Cloud project behind that OAuth client (see README).
import { getGoogleAccessToken } from "./auth.js";

const FORMS_API = "https://forms.googleapis.com/v1/forms";

function buildAuthHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function describeFormsError(res) {
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    detail = body?.error?.message || detail;
  } catch (err) {
    // Response wasn't JSON - stick with the status code.
  }
  if (res.status === 403) {
    return `Google Forms API access denied: ${detail}. Make sure the Forms API is enabled for this project and you're added as a test user in the OAuth consent screen.`;
  }
  if (res.status === 401) {
    return `Google sign-in for Forms expired: ${detail}. Try again - you may be asked to re-approve access.`;
  }
  return `Google Forms request failed: ${detail}`;
}

function questionToCreateItemRequest(q, index, isQuiz) {
  const question = {
    required: false,
    choiceQuestion: {
      type: "RADIO",
      options: (q.options || []).map((value) => ({ value })),
      shuffle: false,
    },
  };

  if (isQuiz && q.answer) {
    question.grading = {
      pointValue: 1,
      correctAnswers: { answers: [{ value: q.answer }] },
    };
  }

  return {
    createItem: {
      item: { title: q.question, questionItem: { question } },
      location: { index },
    },
  };
}

async function buildForm(token, { title, description, kind, questions }) {
  const authHeaders = buildAuthHeaders(token);

  // Forms API only accepts info.title at creation time - description,
  // quiz mode, and every question have to go in a follow-up batchUpdate.
  const createRes = await fetch(FORMS_API, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ info: { title } }),
  });
  if (!createRes.ok) throw { status: createRes.status, message: await describeFormsError(createRes) };
  const { formId } = await createRes.json();

  const requests = [
    { updateFormInfo: { info: { description }, updateMask: "description" } },
    // Without this, responses come back with no way to tell who submitted
    // them - RESPONDER_INPUT asks for an email up front (typed, not
    // verified via Google sign-in) so it works for any respondent.
    {
      updateSettings: {
        settings: { emailCollectionType: "RESPONDER_INPUT" },
        updateMask: "emailCollectionType",
      },
    },
  ];

  const isQuiz = kind === "quiz";
  if (isQuiz) {
    requests.push({
      updateSettings: {
        settings: { quizSettings: { isQuiz: true } },
        updateMask: "quizSettings.isQuiz",
      },
    });
  }

  questions.forEach((q, i) => requests.push(questionToCreateItemRequest(q, i, isQuiz)));

  const updateRes = await fetch(`${FORMS_API}/${formId}:batchUpdate`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ requests }),
  });
  if (!updateRes.ok) throw { status: updateRes.status, message: await describeFormsError(updateRes) };

  const getRes = await fetch(`${FORMS_API}/${formId}`, { headers: authHeaders });
  if (!getRes.ok) throw { status: getRes.status, message: await describeFormsError(getRes) };
  const form = await getRes.json();

  return {
    formId,
    responderUri: form.responderUri,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
  };
}

export async function createGoogleForm(formData) {
  const token = await getGoogleAccessToken(true);

  try {
    return await buildForm(token, formData);
  } catch (err) {
    // 401/403 here usually means the cached token predates the forms.body
    // scope being added (e.g. this extension update just landed) - clear
    // it and force one fresh interactive consent, then retry once.
    if (err?.status === 401 || err?.status === 403) {
      await new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, resolve));
      const freshToken = await getGoogleAccessToken(true);
      return await buildForm(freshToken, formData);
    }
    throw new Error(err?.message || "Could not create the Google Form - try again.");
  }
}
