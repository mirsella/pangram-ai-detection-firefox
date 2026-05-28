(function () {
  "use strict";

  chrome.runtime.sendMessage({ type: "FIREFOX_SYNC_TEXT_HISTORY" }).catch((error) => {
    console.warn("[Pangram] Could not sync website history for the popup.", error);
  });
})();
