import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ReaderWatermark} from './ReaderWatermark.js';

describe('visible reader trace overlay', () => {
  it('repeats a faint noninteractive code outside layout, copy and accessibility text', () => {
    const {container} = render(<div style={{position: 'relative'}}><p>Readable sentence.</p><ReaderWatermark traceCode="DEMO-0000-0000-0000"/></div>);
    const overlay = container.querySelector<HTMLElement>('[data-reader-watermark]')!;
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay).toHaveStyle({position: 'absolute', pointerEvents: 'none', userSelect: 'none', opacity: '0.055', backgroundRepeat: 'repeat'});
    expect(overlay.style.backgroundImage).toContain('data:image/svg+xml');
    expect(container.textContent).toBe('Readable sentence.');
    expect(overlay.querySelector('a,button,input,script')).toBeNull();
  });
  it.each(['name@example.org', '<svg onload="alert(1)">', 'https://example.org', 'a'.repeat(100)])('rejects unexpected receipt text %s', traceCode => {
    expect(() => render(<ReaderWatermark traceCode={traceCode}/>)).toThrow('invalid_trace_code');
  });
});
