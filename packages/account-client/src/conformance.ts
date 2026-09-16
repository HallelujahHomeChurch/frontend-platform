export const accountAuthConformanceCases = [
  'expiry',
  'issuance-single-flight',
  'stale-token-fencing',
  'one-refresh-one-retry',
  '403-no-refresh',
  '429-cooldown',
  'sign-out-invalidation',
  'event-redaction'
] as const;

export type AccountAuthConformanceCase = typeof accountAuthConformanceCases[number];

export async function runAccountAuthConformance(
  run: (testCase: AccountAuthConformanceCase) => Promise<void>
): Promise<void> {
  for (const testCase of accountAuthConformanceCases) await run(testCase);
}
