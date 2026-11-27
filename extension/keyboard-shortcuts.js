export const KEYBOARD_SHORTCUTS_SETTING = "spotlight-keyboard-shortcuts";

export function shortcutChord({ key, shift, alt }) {
  return [alt ? "Alt" : "", shift ? "⇧" : "", key.toUpperCase()]
    .filter(Boolean)
    .join(" ");
}

export function shortcutText(binding) {
  return `⌘/Ctrl ${shortcutChord(binding)}`;
}

export function validShortcut(binding) {
  return (
    typeof binding?.key === "string" &&
    /^[a-z0-9]$/.test(binding.key) &&
    typeof binding.shift === "boolean" &&
    typeof binding.alt === "boolean"
  );
}
