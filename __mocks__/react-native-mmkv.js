const stores = new Map();

function createMMKV({ id } = { id: 'default' }) {
  if (!stores.has(id)) {
    stores.set(id, new Map());
  }
  const store = stores.get(id);
  return {
    id,
    getString: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
  };
}

module.exports = { createMMKV };
