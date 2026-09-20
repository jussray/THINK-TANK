(function (root) {
  'use strict';

  class IdeaStore {
    async saveCurrent(_record) {
      throw new Error('IdeaStore.saveCurrent must be implemented.');
    }

    async clearCurrent() {
      throw new Error('IdeaStore.clearCurrent must be implemented.');
    }
  }

  class IdeaReadModel {
    async loadCurrent() {
      throw new Error('IdeaReadModel.loadCurrent must be implemented.');
    }
  }

  root.ThinkTankStores = Object.assign(root.ThinkTankStores || {}, {
    IdeaStore,
    IdeaReadModel
  });
})(globalThis);
