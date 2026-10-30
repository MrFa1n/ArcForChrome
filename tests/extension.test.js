import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../extension/', import.meta.url);
test('manifest entry points exist and request only documented permissions', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['sidePanel','tabs','tabGroups','activeTab','scripting','history','bookmarks','storage']);
  assert.equal(manifest.host_permissions, undefined);
  await Promise.all([manifest.background.service_worker, manifest.side_panel.default_path].map(path => access(new URL(path, root))));
});
test('toolbar action is configured on installation, startup and worker restart', async () => {
  const calls = [];
  const listeners = {};
  const chrome = {
    sidePanel: { setPanelBehavior: async options => calls.push(options) },
    runtime: {
      onInstalled: { addListener: fn => { listeners.install = fn; } },
      onStartup: { addListener: fn => { listeners.start = fn; } }
    }
  };
  vm.runInNewContext(await readFile(new URL('background.js', root), 'utf8'), { chrome, console });
  listeners.install(); listeners.start();
  assert.equal(calls.length, 3);
  assert.ok(calls.every(options => options.openPanelOnActionClick === true));
});
test('worker handles configuration failures without an unhandled rejection', async () => {
  const errors = [];
  const chrome = {
    sidePanel: { setPanelBehavior: async () => { throw new Error('Unavailable'); } },
    runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} } }
  };
  vm.runInNewContext(await readFile(new URL('background.js', root), 'utf8'), { chrome, console: { error: (...args) => errors.push(args) } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors.length, 1);
  assert.equal(errors[0][1].message, 'Unavailable');
});
test('all nine pin commands exist without exceeding Chrome default-binding limits', async () => {
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
  for(let slot=1;slot<=9;slot++) assert.ok(manifest.commands[`pinned-tab-${slot}`]);
  assert.ok(Object.values(manifest.commands).filter(command=>command.suggested_key).length<=4);
});
test('optional remapping is Chrome-scoped and maps to declared pin commands', async () => {
  const profile=JSON.parse(await readFile(new URL('../integrations/karabiner/arc-for-chrome.json',root)));
  assert.equal(profile.rules.length,3);
  const mappings=profile.rules.flatMap(rule=>rule.manipulators);
  assert.equal(mappings.length,11);
  for(const mapping of mappings) {
    assert.equal(mapping.type,'basic');
    assert.deepEqual(mapping.conditions,[{type:'frontmost_application_if',bundle_identifiers:['^com\\.google\\.Chrome$']}]);
    assert.deepEqual(mapping.to[0].modifiers,['left_option','left_shift']);
  }
});
test('macOS defaults use Arc keys for implemented search, pin and sidebar actions', async () => {
  const {commands}=JSON.parse(await readFile(new URL('manifest.json',root)));
  assert.equal(commands['open-search'].suggested_key.mac,'Command+T');
  assert.equal(commands['toggle-pin'].suggested_key.mac,'Command+D');
  assert.equal(commands._execute_action.suggested_key.mac,'Command+S');
  assert.ok(Object.values(commands).filter(command=>command.suggested_key).length<=4);
});
