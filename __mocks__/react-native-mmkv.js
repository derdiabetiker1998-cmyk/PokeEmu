const stores = new Map();

class MMKV {
  constructor({ id } = { id: 'default' }) {
    this.id = id;
    if (!stores.has(id)) {
      stores.set(id, new Map());
    }
  }

  getString(key) {
    return stores.get(this.id).get(key);
  }

  set(key, value) {
    stores.get(this.id).set(key, value);
  }
}

module.exports = { MMKV };
