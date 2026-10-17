# Council / Court dependency provenance

Canonical source: [jussray/ULTRATHINK-COUNCIL](https://github.com/jussray/ULTRATHINK-COUNCIL) at commit `643c0bb9ab5e1152a49814d6351c2ac1b68b81b2`.

These are source-pinned copies of `src/council.mjs` and `src/busHandoff.mjs`, packaged because the source repo has no published npm package contract. It remains the authority; Think Tank may not change its semantics or claim local hashes authenticate a provider.

Council assembles evidence-bound deliberation. Court reviews and holds unsupported claims. Council Bus remains the independent transport tracked in [Linear ENG-7](https://linear.app/juss/issue/ENG-7/council-bus-reconcile-transport-and-return-findings-to-originating-ai). `prepareCouncilBusHandoff` does NOT send a message, authenticate callbacks, grant authority, or establish return-to-origin delivery. Its result MUST remain `PREPARED_NOT_SENT` in this implementation.

No provider key, private transcript, unverified chat identity, or live routing permission is installed here. Update this pin only after upstream contract review, exact-source comparison and tests.
