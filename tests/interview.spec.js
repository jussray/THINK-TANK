const { test, expect } = require('@playwright/test');

test('founder can complete an interview and persist an Idea Record', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('idea-input').fill('A subscription service that helps solo founders pressure-test startup ideas before building.');
  await page.getByTestId('start-interview').click();

  const answers = [
    'Solo founders paying from their own budget because they need sharper decisions before spending scarce build money.',
    'They currently use notes, friends, generic chatbots, founder communities, or simply start building without a structured challenge.',
    'They would switch this month if one guided interview turns a vague idea into a clear go, revise, or stop decision in under an hour.',
    'The defensibility starts with a durable history of interviews, evidence, pivots, and scoring patterns that compounds around the founder.'
  ];

  for (const answer of answers) {
    await page.getByTestId('answer-input').fill(answer);
    await page.getByTestId('submit-answer').click();
  }

  await expect(page.getByText('CRITIC', { exact: true })).toBeVisible();
  await expect(page.getByText('SCORECARD', { exact: true })).toBeVisible();
  await expect(page.getByText('SYNTHESIZER', { exact: true })).toBeVisible();
  await expect(page.getByText('MATCHMAKER', { exact: true })).toBeVisible();
  await expect(page.getByTestId('scorecard')).toContainText('Overall');
  await expect(page.getByTestId('versions')).toContainText('v1');

  await page.reload();
  await expect(page.getByTestId('idea-record')).toContainText('subscription service');
  await expect(page.getByTestId('versions')).toContainText('v1');
});
