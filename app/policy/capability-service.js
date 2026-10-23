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

  const KNOWN_CAPABILITIES = new Set(Object.values(CAPABILITY));

  function can(capabilities, capability) {
    // Fail closed three ways:
    //  - only capability names this build actually defines are answerable, so a
    //    future CAPABILITY entry with no policy row is denied, not allowed;
    //  - own properties only, so an inherited/prototype-supplied flag cannot
    //    grant a capability the policy never wrote;
    //  - strict true, so truthy-but-not-true values do not grant.
    if (!KNOWN_CAPABILITIES.has(capability)) return false;
    if (capabilities === null || typeof capabilities !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(capabilities, capability)) return false;
    return capabilities[capability] === true;
  }

  root.ThinkTankPolicy = Object.assign(root.ThinkTankPolicy || {}, {
    CAPABILITY,
    CapabilityService,
    can
  });
})(globalThis);
