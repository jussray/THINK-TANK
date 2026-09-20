(function (root) {
  'use strict';

  class MemoryIdeaStore extends root.ThinkTankStores.IdeaStore {
    constructor(initialRecord = null) {
      super();
      this.currentRecord = initialRecord == null ? null : structuredClone(initialRecord);
    }

    async saveCurrent(record) {
      this.currentRecord = structuredClone(record);
      return structuredClone(this.currentRecord);
    }

    async clearCurrent() {
      this.currentRecord = null;
    }

    async loadCurrent() {
      return this.currentRecord == null ? null : structuredClone(this.currentRecord);
    }
  }

  root.ThinkTankStores = Object.assign(root.ThinkTankStores || {}, { MemoryIdeaStore });
})(globalThis);
