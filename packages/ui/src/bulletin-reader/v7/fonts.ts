/** Existing pinned TC faces fill SC coverage gaps without substituting characters. */
export function bulletinV7FontFamily(role: string, locale: string): string | undefined {
  if (locale !== 'zh-Hans') return role === 'emphasis' ? "'HHC Weekly Serif'" : undefined;
  if (role === 'emphasis') return "'HHC Weekly Serif SC', 'HHC Weekly Serif'";
  if (role === 'body' || role === 'reference' || role === 'foreignText') return "'HHC Weekly Serif SC', 'HHC Weekly Serif'";
  return undefined;
}
