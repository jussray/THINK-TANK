/**
 * Optional server-only Anthropic provider. Nothing invokes this adapter by
 * default; using it transmits founder text to the selected external provider.
 * Never expose ANTHROPIC_API_KEY in a browser or deploy an unauthenticated route.
 */
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export function createAnthropicProvider({
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.THINK_TANK_INTERVIEW_MODEL || 'claude-sonnet-4-20250514',
  fetcher = fetch
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('ANTHROPIC_API_KEY is required for explicitly enabled provider calls');
  }
  if (typeof fetcher !== 'function') throw new TypeError('fetcher is required');
  return async ({ system, messages }) => {
    const response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 220,
        temperature: 0.4,
        system,
        messages
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error('Interview provider request failed: HTTP ' + response.status);
    const body = await response.json();
    const answer = body?.content?.filter((item) => item.type === 'text')
      .map((item) => item.text).join('\n').trim();
    if (!answer) throw new Error('Interview provider returned no text');
    return answer;
  };
}
