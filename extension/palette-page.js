import { mountPalette } from './palette.js';
const windowId = Number(new URL(location.href).searchParams.get('window'));
chrome.tabs.query({ windowId }).then(tabs => mountPalette(tabs, true)).catch(error => {
  document.body.textContent = `Search could not open: ${error.message}`;
});
