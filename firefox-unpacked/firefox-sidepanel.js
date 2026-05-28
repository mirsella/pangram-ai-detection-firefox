(function () {
  const api = globalThis.chrome;

  if (!api?.runtime?.getURL || !api?.sidebarAction?.setPanel || !api?.sidebarAction?.open) {
    console.error("[Pangram] Firefox sidebar APIs are unavailable.");
    return;
  }

  const { runtime, sidebarAction } = api;
  const toPanelUrl = (path) => runtime.getURL(path);

  globalThis.pangramSidePanel = {
    setOptions({ enabled = true, path, tabId } = {}) {
      if (!enabled) {
        return Promise.resolve();
      }

      if (!path) {
        console.warn("[Pangram] Ignoring sidebar update without a panel path.");
        return Promise.resolve();
      }

      const options = { panel: toPanelUrl(path) };

      if (Number.isInteger(tabId)) {
        options.tabId = tabId;
      }

      return Promise.resolve(sidebarAction.setPanel(options));
    },

    open() {
      return Promise.resolve(sidebarAction.open());
    },

    setPanelBehavior() {
      return Promise.resolve();
    },
  };
})();
