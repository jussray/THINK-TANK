# THINK-TANK

Think Tank interviews a founder's idea, challenges the answers, scores a fixed rubric, synthesizes a durable Idea Record, and preserves versions for later pivots.

## V0 scope

This branch proves one end-to-end loop only:

1. Enter an idea.
2. Answer four interviewer questions.
3. Persist answers into one Idea Record.
4. Run deterministic Critic, Scorecard, Synthesizer, and Matchmaker passes over that shared record.
5. Save a version receipt.
6. Reload and recover the record from local storage.

The deterministic role logic is intentionally not presented as production AI. Provider-backed agents, Supabase persistence, auth, billing, Team, and API access remain outside this slice.

## Run

```bash
npm install
npm run serve
```

Open `http://127.0.0.1:4173`.

## Verify

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright test completes the founder interview, checks all five role outputs, checks the score/version receipt, reloads the page, and proves the Idea Record survives reload.
