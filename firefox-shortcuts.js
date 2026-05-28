(function () {
  const CHECK_MENU_ID = "check-for-ai-content";
  const CHECK_COMMAND_ID = "check-selected-text";

  const isMac = /Mac/.test(navigator.platform || navigator.userAgent || "");
  const shortcutLabel = isMac ? "Ctrl+Shift+C" : "Alt+Shift+C";

  function selectedTextFromPage() {
    const active = document.activeElement;

    if (
      active &&
      typeof active.value === "string" &&
      typeof active.selectionStart === "number" &&
      typeof active.selectionEnd === "number" &&
      active.selectionEnd > active.selectionStart
    ) {
      return active.value.slice(active.selectionStart, active.selectionEnd).trim();
    }

    const selection = window.getSelection();
    return selection ? selection.toString().trim() : "";
  }

  function updateContextMenuTitle() {
    const title = `Check for AI content (${shortcutLabel})`;

    chrome.contextMenus.update(CHECK_MENU_ID, { title }, () => {
      if (!chrome.runtime.lastError) {
        return;
      }

      console.warn("[Pangram] Updating context menu title failed; creating it instead.", chrome.runtime.lastError.message);
      chrome.contextMenus.create({ id: CHECK_MENU_ID, title, contexts: ["selection"] }, () => {
        if (chrome.runtime.lastError) {
          console.warn("[Pangram] Creating context menu shortcut failed.", chrome.runtime.lastError.message);
        }
      });
    });
  }

  async function checkSelectedText(tab) {
    if (!tab?.id) {
      console.warn("[Pangram] Cannot check selected text without an active tab.");
      return;
    }

    if (tab.url && !tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
      console.warn("[Pangram] Cannot check selected text on a protected browser page.");
      return;
    }

    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: selectedTextFromPage,
      });

      const text = result?.result || "";
      if (!text) {
        console.warn("[Pangram] Check selected text shortcut was used without a selection.");
        return;
      }

      await chrome.runtime.sendMessage({
        type: "DETECT",
        text,
        mode: null,
        source: null,
        interaction: "keyboard-shortcut",
      });
    } catch (error) {
      console.error("[Pangram] Check selected text shortcut failed.", error);
    }
  }

  chrome.runtime.onInstalled.addListener(updateContextMenuTitle);
  chrome.runtime.onStartup.addListener(updateContextMenuTitle);

  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== CHECK_COMMAND_ID) {
      return;
    }

    checkSelectedText(tab);
  });
})();
