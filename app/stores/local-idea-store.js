(function (root) {
  'use strict';

  class LocalIdeaStore extends root.ThinkTankStores.IdeaStore {
    constructor({
      storage = root.localStorage,
      storageKey = 'think-tank.idea-record.v0',
      collectionKey = 'think-tank.idea-collection.v1'
    } = {}) {
      super();
      this.storage = storage;
      this.storageKey = storageKey;
      this.collectionKey = collectionKey;
    }

    parseRecord(raw) {
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch {
        throw new root.ThinkTankContracts.ContractValidationError('INVALID_JSON', 'Stored Idea Record is not valid JSON.');
      }
      return root.ThinkTankContracts.normalizeIdeaRecordV1(parsed);
    }

    async loadCurrent() {
      const raw = this.storage.getItem(this.storageKey);
      return raw === null ? null : this.parseRecord(raw);
    }

    // V0's active-record key remains compatible. Previous ideas live in a
    // distinct, bounded collection, always normalized as IdeaRecordV1.
    async listRecords() {
      const raw = this.storage.getItem(this.collectionKey);
      let persisted = [];
      if (raw !== null) {
        try { persisted = JSON.parse(raw); }
        catch {
          throw new root.ThinkTankContracts.ContractValidationError('INVALID_JSON', 'Stored idea collection is not valid JSON.');
        }
        if (!Array.isArray(persisted) || persisted.length > 100) {
          throw new root.ThinkTankContracts.ContractValidationError('VALIDATION_ERROR', 'Invalid idea collection.');
        }
      }
      const records = persisted.map((entry) => root.ThinkTankContracts.normalizeIdeaRecordV1(entry));
      if (new Set(records.map((entry) => entry.id)).size !== records.length) {
        throw new root.ThinkTankContracts.ContractValidationError('VALIDATION_ERROR', 'Duplicate Idea Record ids.');
      }
      const current = await this.loadCurrent();
      if (current) {
        const at = records.findIndex((entry) => entry.id === current.id);
        if (at === -1) records.push(current);
        else records[at] = current; // active V0 record wins; no stale mirror
      }
      return records;
    }

    async saveCurrent(record) {
      const normalized = root.ThinkTankContracts.normalizeIdeaRecordV1(record);
      const records = await this.listRecords();
      const index = records.findIndex((entry) => entry.id === normalized.id);
      if (index === -1) records.push(normalized);
      else records[index] = normalized;
      if (records.length > 100) {
        throw new root.ThinkTankContracts.ContractValidationError('VALIDATION_ERROR', 'Idea collection limit reached.');
      }
      // The collection write precedes the compatibility mirror. A quota/write
      // failure is propagated; never claim that state was durably saved.
      this.storage.setItem(this.collectionKey, JSON.stringify(records));
      this.storage.setItem(this.storageKey, JSON.stringify(normalized));
      return normalized;
    }

    async selectCurrent(id) {
      const record = (await this.listRecords()).find((entry) => entry.id === id);
      if (!record) throw new root.ThinkTankContracts.ContractValidationError('NOT_FOUND', 'Idea Record not found.');
      this.storage.setItem(this.storageKey, JSON.stringify(record));
      return record;
    }

    async clearCurrent() {
      // "New idea" clears only the selected record, never deletes other ideas.
      this.storage.removeItem(this.storageKey);
    }
  }

  root.ThinkTankStores = Object.assign(root.ThinkTankStores || {}, { LocalIdeaStore });
})(globalThis);
