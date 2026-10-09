/** Existing pinned TC faces fill SC coverage gaps without substituting characters. */
export function bulletinV7FontFamily(role: string, locale: string): string | undefined {
  if (locale !== 'zh-Hans') return undefined;
  if (role === 'emphasis') return "'HHC Weekly Serif SC', 'HHC Weekly Kai'";
  if (role === 'body' || role === 'reference' || role === 'foreignText') return "'HHC Weekly Serif SC', 'HHC Weekly Serif'";
  return undefined;
}
