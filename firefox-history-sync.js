(function () {
  "use strict";

  const HISTORY_KEY = "history-storage-key";
  const MESSAGE_TYPE = "FIREFOX_SYNC_TEXT_HISTORY";
  const LIMIT = 5;
  const HISTORY_URL = "https://web.pangram.com/api/history-list/";
  const PANGRAM_TABS = ["https://www.pangram.com/*", "https://web.pangram.com/*"];

  const historyUrl = () => {
    const url = new URL(HISTORY_URL);
    url.searchParams.set("limit", String(LIMIT));
    url.searchParams.set("offset", "0");
    url.searchParams.set("order", "-timestamp");
    return url.toString();
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    const text = await response.text();
    let data;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      console.warn("[Pangram] History endpoint returned non-JSON.", { status: response.status, body: text.slice(0, 200) });
      return { ok: false, status: "invalid_json", detail: error.message };
    }

    if (!response.ok) {
      return { ok: false, status: response.status, detail: data && (data.detail || data.message) };
    }

    if (!data || !Array.isArray(data.results)) {
      console.warn("[Pangram] History endpoint returned an unexpected shape.", data);
      return { ok: false, status: "invalid_shape" };
    }

    return { ok: true, items: data.results };
  };

  async function fetchJsonInPage(url) {
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      return { ok: false, status: response.status, detail: data && (data.detail || data.message) };
    }

    if (!data || !Array.isArray(data.results)) {
      return { ok: false, status: "invalid_shape" };
    }

    return { ok: true, items: data.results };
  }

  const fetchFromLoggedInTab = async (url) => {
    const tabs = await chrome.tabs.query({ url: PANGRAM_TABS });
    const tab = tabs.find((candidate) => candidate.id && !candidate.discarded);

    if (!tab) {
      return { ok: false, status: "no_pangram_tab", detail: "Open a logged-in Pangram tab to sync website checks." };
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: fetchJsonInPage,
      args: [url],
    });

    return result && result.result ? result.result : { ok: false, status: "no_result" };
  };

  const predictionLabel = (item) => {
    const raw = item.prediction_short || item.prediction || item.classification;
    if (typeof raw === "string") {
      const value = raw.toLowerCase();
      if (value.includes("mixed") || value.includes("some ai") || value.includes("heavily prompted")) return "Mixed";
      if (value.includes("human")) return "Human";
      if (value.includes("ai")) return "AI";
      return raw;
    }

    if (typeof item.prediction_prob === "number") return item.prediction_prob < 0.5 ? "Human" : "AI";

    console.warn("[Pangram] Skipping history item without a prediction.", item);
    return null;
  };

  const popupEntry = (item) => {
    const id = item.uuid || item.id || item.text_query;
    const text = item.prompt || item.text || item.file_name;
    const timestamp = Date.parse(item.timestamp);
    const predictionShort = predictionLabel(item);

    if (!id || !text || !Number.isFinite(timestamp) || !predictionShort) {
      console.warn("[Pangram] Skipping malformed history item.", item);
      return null;
    }

    return {
      textQuery: String(id),
      predictionShort,
      text: String(text),
      url: item.url || "",
      timestamp,
    };
  };

  const mergedEntries = (remoteEntries, localEntries) => {
    const entries = new Map();
    for (const entry of localEntries) {
      if (entry && entry.textQuery) entries.set(entry.textQuery, entry);
    }
    for (const entry of remoteEntries) entries.set(entry.textQuery, entry);

    return Array.from(entries.values())
      .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0))
      .slice(0, LIMIT);
  };

  const syncHistory = async () => {
    const url = historyUrl();
    let result = await fetchJson(url);

    if (result.status === 401 || result.status === 403) {
      result = await fetchFromLoggedInTab(url);
    }

    if (!result.ok) {
      console.warn("[Pangram] Could not sync website history.", result);
      return result;
    }

    const remoteEntries = result.items.map(popupEntry).filter(Boolean);
    if (remoteEntries.length === 0) {
      console.warn("[Pangram] Website history sync returned no usable checks.");
      return { ok: true, synced: 0 };
    }

    const current = await chrome.storage.local.get(HISTORY_KEY);
    const localEntries = current[HISTORY_KEY]?.entries || [];
    const entries = mergedEntries(remoteEntries, localEntries);

    await chrome.storage.local.set({ [HISTORY_KEY]: { entries } });
    return { ok: true, synced: remoteEntries.length };
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TYPE) return false;

    syncHistory()
      .then(sendResponse)
      .catch((error) => {
        console.error("[Pangram] Website history sync failed.", error);
        sendResponse({ ok: false, status: "exception", detail: error.message || String(error) });
      });

    return true;
  });
})();
