(function (root) {
  'use strict';

  class MemoryIdeaStore extends root.ThinkTankStores.IdeaStore {
    constructor(initialRecord = null) {
      super();
      this.currentRecord = initialRecord == null
        ? null
        : root.ThinkTankContracts.normalizeIdeaRecordV1(initialRecord);
    }

    async saveCurrent(record) {
      this.currentRecord = root.ThinkTankContracts.normalizeIdeaRecordV1(record);
      return structuredClone(this.currentRecord);
    }

    async clearCurrent() {
      this.currentRecord = null;
    }

    async loadCurrent() {
      if (this.currentRecord == null) return null;
      return structuredClone(root.ThinkTankContracts.validateIdeaRecordV1(this.currentRecord));
    }
  }

  root.ThinkTankStores = Object.assign(root.ThinkTankStores || {}, { MemoryIdeaStore });
})(globalThis);
