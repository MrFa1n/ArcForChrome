import { togglePageNavigation } from "./page-navigation.js";
import { openPalette, paletteAction } from "./palette-service.js";

export function registerSearch(api, mount) {
  const open = (mode = "search") =>
    openPalette(api, mount, mode).catch((error) =>
      console.error("Could not open search:", error),
    );
  if (api.sidePanel?.setPanelBehavior) {
    api.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false })
      .catch((error) =>
        console.warn("Could not keep the toolbar action on Search:", error),
      );
  }
  api.tabs.onRemoved?.addListener((tabId) => {
    api.storage?.session?.remove(`preview:${tabId}`).catch(() => {});
  });
  api.action.onClicked.addListener(() => open());
  api.commands.onCommand.addListener((command) => {
    if (command === "toggle-page-navigation")
      return api.tabs
        .query({ active: true, currentWindow: true })
        .then(
          ([tab]) =>
            Number.isInteger(tab?.id) && togglePageNavigation(api, tab.id),
        )
        .catch((error) => console.warn(error.message));
    if (command === "open-search") return open();
    if (command === "previous-tab") {
      return api.tabs
        .query({ active: true, currentWindow: true })
        .then(
          ([tab]) =>
            tab &&
            paletteAction(
              api,
              { type: "palette:command", command: "previous-tab" },
              { id: api.runtime.id, tab },
            ),
        )
        .catch((error) =>
          console.error("Could not switch to previous tab:", error),
        );
    }
    if (command === "open-commands") return open("commands");
    if (command === "edit-address") return open("edit");
  });
  api.runtime.onConnect?.addListener((port) => {
    if (port.name !== "palette-search") return;
    let connected = true;
    port.onDisconnect.addListener(() => {
      connected = false;
    });
    const send = (message) => {
      if (connected) port.postMessage(message);
    };
    const search = ({ query, scope }) => {
      port.onMessage.removeListener(search);
      paletteAction(
        api,
        { type: "palette:suggest", query, scope },
        port.sender,
        (result) => send({ ...result, ok: true, partial: true }),
      ).then(
        (result) => send({ ...result, ok: true }),
        (error) => send({ ok: false, error: error.message }),
      );
    };
    port.onMessage.addListener(search);
  });
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      !message ||
      ![
        "palette:activate",
        "palette:navigate",
        "palette:suggest",
        "palette:site",
        "palette:command",
        "palette:restore",
        "palette:remember-site",
        "palette:move",
        "palette:undo",
        "palette:settings",
        "palette:finish-tour",
        "palette:recover",
        "palette:group",
        "palette:bookmark",
        "palette:quicklink",
        "palette:tab-action",
        "palette:icons",
        "palette:note",
        "palette:extra",
      ].includes(message.type)
    )
      return;
    paletteAction(api, message, sender).then(
      (result) => sendResponse({ ok: true, ...result }),
      (error) => sendResponse({ ok: false, error: error.message }),
    );
    return true;
  });
}
