import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import assets from './template-assets.json';

describe('scripture font asset contract', () => {
  it('uses the self-hosted TW-Kai face without replacing body or emphasis', () => {
    const scripture = assets.find(asset => asset.roles?.includes('scripture'))!;
    expect(scripture.family).toBe('HHC Weekly Scripture');
    expect(scripture.sourceUrl).toBe('https://www.cns11643.gov.tw/opendata/Fonts_Kai.zip');
    expect(scripture.roles).toEqual(['scripture']);
    expect(assets.find(asset => asset.roles?.includes('body'))?.family).toBe('HHC Weekly Serif');
    expect(assets.find(asset => asset.roles?.includes('emphasis'))?.family).toBe('HHC Weekly Kai');
    const css = readFileSync('src/bulletin-reader/paper.css', 'utf8');
    expect(css).toContain(`src: url('${scripture.url}')`);
    expect(css).toContain("[data-font-role='scripture'] { font-family: 'HHC Weekly Scripture', serif; font-weight: 400; }");
    expect(css).not.toMatch(/https?:\/\//);
  });
});
