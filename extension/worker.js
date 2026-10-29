import './background.js';
import { executeCommand } from './shortcuts.js';
chrome.commands.onCommand.addListener(command => {
  executeCommand(chrome, command).catch(error => console.error('Keyboard command failed:', error));
});
