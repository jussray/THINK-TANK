(function (root) {
  'use strict';

  const CAPABILITY = Object.freeze({
    IDEA_READ: 'idea.read',
    IDEA_EDIT: 'idea.edit',
    ANALYSIS_RUN: 'analysis.run',
    RECORD_EXPORT: 'record.export',
    RECORD_IMPORT: 'record.import',
    RESEARCH_RUN: 'research.run',
    AGENT_RUN: 'agent.run',
    MEMBER_INVITE: 'member.invite',
    BILLING_MANAGE: 'billing.manage',
    DECISION_APPROVE: 'decision.approve'
  });

  class CapabilityService {
    async capabilitiesFor() {
      throw new Error('CapabilityService.capabilitiesFor must be implemented.');
    }
  }

  function can(capabilities, capability) {
    return capabilities?.[capability] === true;
  }

  root.ThinkTankPolicy = Object.assign(root.ThinkTankPolicy || {}, {
    CAPABILITY,
    CapabilityService,
    can
  });
})(globalThis);
