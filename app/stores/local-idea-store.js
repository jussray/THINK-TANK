(function (root) {
  'use strict';

  class LocalIdeaStore extends root.ThinkTankStores.IdeaStore {
    constructor({ storage = root.localStorage, storageKey = 'think-tank.idea-record.v0' } = {}) {
      super();
      this.storage = storage;
      this.storageKey = storageKey;
    }

    async saveCurrent(record) {
      const normalized = root.ThinkTankContracts.normalizeIdeaRecordV1(record);
      this.storage.setItem(this.storageKey, JSON.stringify(normalized));
      return normalized;
    }

    async clearCurrent() {
      this.storage.removeItem(this.storageKey);
    }

    async loadCurrent() {
      const raw = this.storage.getItem(this.storageKey);
      if (raw === null) return null;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new root.ThinkTankContracts.ContractValidationError('INVALID_JSON', 'Stored Idea Record is not valid JSON.');
      }
      return root.ThinkTankContracts.normalizeIdeaRecordV1(parsed);
    }
  }

  root.ThinkTankStores = Object.assign(root.ThinkTankStores || {}, { LocalIdeaStore });
})(globalThis);
