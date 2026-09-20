(function (root) {
  'use strict';

  const ENGINE_VERSION = 'v0.1.0';
  const RUBRIC_VERSION = 'v0';

  function scoreIdea(record) {
    const answers = record.answers.map((entry) => entry.answer.trim());
    const specificity = answers.filter((answer) => answer.length >= 35).length;
    const market = Math.min(10, 3 + specificity * 2);
    const differentiation = Math.min(
      10,
      2 + (answers[2]?.length >= 45 ? 3 : 1) + (answers[3]?.length >= 45 ? 3 : 1)
    );
    const timing = Math.min(
      10,
      3 + (answers[0]?.length >= 45 ? 2 : 0) + (answers[2]?.length >= 35 ? 2 : 0)
    );

    return {
      market,
      differentiation,
      timing,
      total: Math.round((market + differentiation + timing) / 3)
    };
  }

  function critiqueIdea(record) {
    const shortest = [...record.answers].sort((a, b) => a.answer.length - b.answer.length)[0];
    return shortest && shortest.answer.length < 35
      ? 'Your weakest evidence is still too general. Name a concrete behavior, buyer, or switching trigger before treating this as validated.'
      : 'The claims are specific enough for a first pass, but none are external evidence yet. The next risk is confusing a coherent story with market proof.';
  }

  function synthesizeIdea(record) {
    const answers = record.answers;
    return {
      customer: answers[0]?.answer || '',
      alternative: answers[1]?.answer || '',
      wedge: answers[2]?.answer || '',
      moat: answers[3]?.answer || ''
    };
  }

  function matchPattern(record) {
    const text = record.idea.toLowerCase();
    if (text.includes('subscription')) {
      return 'Retention-first business: test repeat value before acquisition scale.';
    }
    if (text.includes('marketplace')) {
      return 'Two-sided cold start: prove one constrained side first.';
    }
    return 'Founder-led wedge: test the narrowest painful use case before broadening.';
  }

  function assessIdea(record) {
    return {
      engineVersion: ENGINE_VERSION,
      rubricVersion: RUBRIC_VERSION,
      scorecard: scoreIdea(record),
      critique: critiqueIdea(record),
      modules: synthesizeIdea(record),
      pattern: matchPattern(record)
    };
  }

  root.ThinkTankDomain = Object.assign(root.ThinkTankDomain || {}, {
    ENGINE_VERSION,
    RUBRIC_VERSION,
    scoreIdea,
    critiqueIdea,
    synthesizeIdea,
    matchPattern,
    assessIdea
  });
})(globalThis);
