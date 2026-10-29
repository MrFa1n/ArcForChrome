const CYCLE_INTERVAL = 1200;

function recentOrder(tabs, saved = []) {
  const live = new Set(tabs.map(tab => tab.id));
  const known = Array.isArray(saved) ? saved.filter(id => Number.isInteger(id) && live.has(id)) : [];
  const seeded = [...tabs].sort((a,b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)).map(tab => tab.id);
  return [...new Set([...known,...seeded])];
}

export function createRecentTabs(api, {now = Date.now} = {}) {
  // One worker writer serializes events and commands, including session writes.
  let queue = Promise.resolve();
  function run(action) {
    const pending = queue.then(action);
    queue = pending.catch(() => {});
    return pending;
  }
  async function read() {
    const {recentTabs} = await api.storage.session.get('recentTabs');
    return recentTabs && typeof recentTabs === 'object' && !Array.isArray(recentTabs) ? recentTabs : {};
  }
  async function save(state) { await api.storage.session.set({recentTabs:state}); }

  function activated({windowId,tabId}) {
    return run(async () => {
      const state = await read();
      const tabs = await api.tabs.query({windowId});
      if (!tabs.some(tab => tab.id === tabId)) return;
      const previous = state[windowId];
      const order = recentOrder(tabs,previous?.order);
      const cycle = previous?.cycle?.expected === tabId ? {...previous.cycle,expected:null} : null;
      state[windowId] = {order:[tabId,...order.filter(id => id !== tabId)],cycle};
      await save(state);
    });
  }

  function cycle() {
    return run(async () => {
      const tabs = await api.tabs.query({currentWindow:true});
      const active = tabs.find(tab => tab.active);
      if (!active || tabs.length < 2) return;
      const state = await read();
      const previous = state[active.windowId];
      const order = recentOrder(tabs,previous?.order);
      const oldCycle = previous?.cycle;
      const continuing = oldCycle && oldCycle.until > now() && oldCycle.lastTabId === active.id && Array.isArray(oldCycle.order);
      const snapshot = continuing ? recentOrder(tabs,oldCycle.order) : [active.id,...order.filter(id => id !== active.id)];
      const index = (snapshot.indexOf(active.id) + 1) % snapshot.length;
      const target = snapshot[index];
      // If update fails, leave stored recency unchanged. Activation events queue after this operation.
      await api.tabs.update(target,{active:true});
      state[active.windowId] = {
        order:[target,...order.filter(id => id !== target)],
        cycle:{order:snapshot,lastTabId:target,expected:target,until:now()+CYCLE_INTERVAL}
      };
      await save(state);
    });
  }

  function removed(windowId,tabId) {
    return run(async () => {
      const state = await read();
      if (!state[windowId]) return;
      if (tabId === undefined) delete state[windowId];
      else {
        state[windowId].order = (state[windowId].order || []).filter(id => id !== tabId);
        state[windowId].cycle = null;
      }
      await save(state);
    });
  }
  return {activated,cycle,removed};
}
