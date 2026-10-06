/** Visible issuance trace only; not fingerprinting or copy/screenshot prevention. */
export function ReaderWatermark({traceCode, tone = 'light'}: {traceCode: string; tone?: 'light' | 'dark'}) {
  if (!/^[A-Z0-9-]{8,40}$/.test(traceCode)) throw new Error('invalid_trace_code');
  const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><text x="240" y="120" text-anchor="middle" font-family="monospace" font-size="18" letter-spacing="2" fill="${tone === 'dark' ? '#e8d9c9' : '#665c53'}" transform="rotate(-24 240 120)">${traceCode}</text></svg>`;
  return <div data-reader-watermark aria-hidden="true" style={{position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none', opacity: .055, backgroundRepeat: 'repeat', backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(tile)}")`}}/>;
}
