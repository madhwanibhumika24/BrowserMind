// Google Sign-In for the extension, using Chrome's built-in identity API
// (reads the manifest's oauth2.client_id) plus our own backend session.
import { BASE_URL, AUTH_STORAGE_KEY } from "./api.js";

// Exported so other Google API calls (e.g. utils/googleForms.js) can reuse
// the same token - Chrome's identity API grants one token covering every
// scope declared in manifest.json's oauth2.scopes together, so this isn't
// specific to sign-in.
export function getGoogleAccessToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (accessToken) => {
      if (chrome.runtime.lastError || !accessToken) {
        reject(new Error(chrome.runtime.lastError?.message || "No token returned"));
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
