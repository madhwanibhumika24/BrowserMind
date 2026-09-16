// Auth for the extension: email/password (signup, login, forgot/reset
// password) plus Google Sign-In via Chrome's built-in identity API (reads
// the manifest's oauth2.client_id). Both end the same way - a session
// token stored in chrome.storage.local - so the rest of the app never
// needs to know which one a person used.
import { BASE_URL, AUTH_STORAGE_KEY, errorMessage } from "./api.js";

export async function signUp({ name, email, password }) {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Sign-up failed"));

  const auth = await res.json(); // { token, email, name }
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
  return auth;
}

export async function logIn({ email, password }) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Log in failed"));

  const auth = await res.json();
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
  return auth;
}

export async function requestPasswordReset(email) {
  const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not send reset code"));
  return res.json(); // { message }
}

export async function resetPassword({ email, code, newPassword }) {
  const res = await fetch(`${BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not reset password"));
  return res.json(); // { message }
}

// Exported so other Google API calls (e.g. utils/googleForms.js) can reuse
// the same token - one token covering every scope declared in manifest.json's
// oauth2.scopes, so this isn't specific to sign-in.
//
// Uses launchWebAuthFlow (a real Google sign-in popup) instead of
// chrome.identity.getAuthToken, specifically so it shows Google's account
// picker every time (`prompt=select_account`) rather than silently reusing
// whichever Google account happens to be signed into Chrome. This means
// manifest.json's oauth2.client_id must be a "Web application" OAuth
// client (not the older "Chrome extension" type getAuthToken needs), with
// this extension's redirect URI - run `chrome.identity.getRedirectURL()`
// in the service worker console, or check chrome://extensions for the
// extension ID and use `https://<extension-id>.chromiumapp.org/` - added
// as an Authorized redirect URI in Google Cloud Console. The backend's
// GOOGLE_OAUTH_CLIENT_ID (.env) must be updated to the same client ID too,
// since it checks the token's `aud` against that value.
export function getGoogleAccessToken(interactive) {
  return new Promise((resolve, reject) => {
    const { client_id: clientId, scopes } = chrome.runtime.getManifest().oauth2;
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${encodeURIComponent(clientId)}` +
      "&response_type=token" +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes.join(" "))}` +
      "&prompt=select_account";

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive }, (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) {
        reject(new Error(chrome.runtime.lastError?.message || "Google sign-in was cancelled"));
        return;
      }
      const params = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
      const accessToken = params.get("access_token");
      if (!accessToken) {
        reject(new Error("Google did not return an access token"));
        return;
      }
      resolve(accessToken);
    });
  });
}

export async function signInWithGoogle() {
  const accessToken = await getGoogleAccessToken(true);

  const res = await fetch(`${BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: ${res.status}`);

  const auth = await res.json(); // { token, email, name }
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
  return auth;
}

export async function getStoredAuth() {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return result[AUTH_STORAGE_KEY] || null;
}

export async function signOut() {
  const auth = await getStoredAuth();
  if (auth?.token) {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
      });
    } catch (err) {
      // Backend might be unreachable - still clear the local session below.
    }
  }
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}
