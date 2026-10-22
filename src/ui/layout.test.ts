import { describe, expect, it } from 'vitest';
import { escapeHtml, fillSlots, footerHtml, headerHtml, librariesTableHtml } from './layout.ts';
import { NAV_PAGES, SITE_BASE } from './site.ts';

describe('fillSlots', () => {
  it('inserts content literally, so "$$" in the theory notes survives', () => {
    const html = fillSlots('<p><!--slot:a--></p>', { a: () => 'costs $$5 and $& more' });
    expect(html).toBe('<p>costs $$5 and $& more</p>');
  });

  it('only runs the content functions of slots that appear', () => {
    let called = false;
    fillSlots('<p>no slots</p>', {
      unused: () => {
        called = true;
        return '';
      },
    });
    expect(called).toBe(false);
  });

  it('fails loudly on a misspelled slot instead of leaving it empty', () => {
    expect(() => fillSlots('<!--slot:heder-->', { header: () => '' })).toThrow('heder');
  });
});

describe('headerHtml', () => {
  it('links every navigation page under the site base path', () => {
    const html = headerHtml('');
    for (const page of NAV_PAGES) expect(html).toContain(`href="${SITE_BASE}${page.path}"`);
  });

  it('marks exactly the current page with aria-current', () => {
    const html = headerHtml('theory/');
    expect(html.split('aria-current="page"')).toHaveLength(2);
    expect(html).toContain(`href="${SITE_BASE}theory/" aria-current="page"`);
  });

  it('marks the home link on the home page', () => {
    expect(headerHtml('')).toContain(`href="${SITE_BASE}" aria-current="page"`);
  });
});

describe('footerHtml', () => {
  it('links the credits page', () => {
    expect(footerHtml('')).toContain(`href="${SITE_BASE}credits/"`);
  });
});

describe('escapeHtml and librariesTableHtml', () => {
  it('escapes characters that would start HTML', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
  });

  it('lists each library with version and license', () => {
    const html = librariesTableHtml([{ name: 'katex', version: '1.2.3', license: 'MIT', url: 'https://katex.org' }]);
    expect(html).toContain('<a href="https://katex.org">katex</a>');
    expect(html).toContain('<td>1.2.3</td><td>MIT</td>');
  });
});
