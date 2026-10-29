function configurePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(error => console.error('Could not configure the side panel:', error));
}
chrome.runtime.onInstalled.addListener(configurePanel);
chrome.runtime.onStartup.addListener(configurePanel);
configurePanel();
