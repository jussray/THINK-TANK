(function (root) {
  'use strict';

  class LocalIdeaStore extends root.ThinkTankStores.IdeaStore {
    constructor({ storage = root.localStorage, storageKey = 'think-tank.idea-record.v0', libraryKey = 'think-tank.idea-library.v1' } = {}) {
      super();
      this.storage = storage;
      this.storageKey = storageKey;
      this.libraryKey = libraryKey;
    }

    async loadAll() {
      const raw = this.storage.getItem(this.libraryKey);
      let candidates = [];
      if (raw !== null) {
        try { candidates = JSON.parse(raw); }
        catch { throw new root.ThinkTankContracts.ContractValidationError('INVALID_JSON', 'Saved idea library is not valid JSON.'); }
        if (!Array.isArray(candidates)) throw new root.ThinkTankContracts.ContractValidationError('VALIDATION_ERROR', 'Saved idea library must be an array.');
      }
      const records = new Map();
      for (const candidate of candidates) {
        const valid = root.ThinkTankContracts.normalizeIdeaRecordV1(candidate);
        if (records.has(valid.id)) throw new root.ThinkTankContracts.ContractValidationError('VALIDATION_ERROR', 'Saved idea library contains duplicate IDs.');
        records.set(valid.id, valid);
      }
      // Upgrade earlier V0 work into the library without changing the legacy active key.
      const current = await this.loadCurrent();
      if (current) records.set(current.id, current);
      return [...records.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }

    async saveCurrent(record) {
      const normalized = root.ThinkTankContracts.normalizeIdeaRecordV1(record);
      const existing = await this.loadAll();
      const records = existing.filter(entry => entry.id !== normalized.id);
      records.push(normalized);
      // Archive first: a failed archive write must not silently lose a previously active idea.
      this.storage.setItem(this.libraryKey, JSON.stringify(records));
      this.storage.setItem(this.storageKey, JSON.stringify(normalized));
      return normalized;
    }

    async selectCurrent(id) {
      const records = await this.loadAll();
      const selected = records.find(record => record.id === id);
      if (!selected) throw new root.ThinkTankContracts.ContractValidationError('NOT_FOUND', 'Saved idea not found.');
      this.storage.setItem(this.storageKey, JSON.stringify(selected));
      return selected;
    }

    async clearCurrent() {
      // Starting fresh never deletes Idea Records from the library.
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
