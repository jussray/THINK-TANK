(function (root) {
  'use strict';

  class LocalIdeaStore extends root.ThinkTankStores.IdeaStore {
    constructor({ storage = root.localStorage, storageKey = 'think-tank.idea-record.v0' } = {}) {
      super();
      this.storage = storage;
      this.storageKey = storageKey;
    }

    async saveCurrent(record) {
      this.storage.setItem(this.storageKey, JSON.stringify(record));
      return record;
    }

    async clearCurrent() {
      this.storage.removeItem(this.storageKey);
    }

    async loadCurrent() {
      try {
        return JSON.parse(this.storage.getItem(this.storageKey) || 'null');
      } catch {
        return null;
      }
    }
  }

  root.ThinkTankStores = Object.assign(root.ThinkTankStores || {}, { LocalIdeaStore });
})(globalThis);
