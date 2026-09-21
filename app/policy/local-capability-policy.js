(function (root) {
  'use strict';

  class LocalCapabilityPolicy extends root.ThinkTankPolicy.CapabilityService {
    async capabilitiesFor() {
      const C = root.ThinkTankPolicy.CAPABILITY;
      return Object.freeze({
        [C.IDEA_READ]: true,
        [C.IDEA_EDIT]: true,
        [C.ANALYSIS_RUN]: true,
        [C.RECORD_EXPORT]: true,
        [C.RECORD_IMPORT]: true,
        [C.RESEARCH_RUN]: false,
        [C.AGENT_RUN]: false,
        [C.MEMBER_INVITE]: false,
        [C.BILLING_MANAGE]: false,
        [C.DECISION_APPROVE]: false
      });
    }
  }

  root.ThinkTankPolicy = Object.assign(root.ThinkTankPolicy || {}, { LocalCapabilityPolicy });
})(globalThis);
