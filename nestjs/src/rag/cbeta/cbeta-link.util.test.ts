import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCbetaLinehead, buildCbetaOnlineUrl } from './cbeta-link.util';

describe('buildCbetaLinehead', () => {
  it('joins work + ref', () => {
    assert.equal(
      buildCbetaLinehead('T51n2076', 'p0292a01'),
      'T51n2076_p0292a01',
    );
    assert.equal(buildCbetaLinehead('T51n2076', '0292a01'), 'T51n2076_p0292a01');
  });

  it('falls back to work when ref missing', () => {
    assert.equal(buildCbetaLinehead('T51n2076', null), 'T51n2076');
  });
});

describe('buildCbetaOnlineUrl', () => {
  it('uses default DILA template', () => {
    const url = buildCbetaOnlineUrl('T51n2076', 'p0292a01');
    assert.equal(
      url,
      'https://cbetaonline.dila.edu.tw/zh/T51n2076_p0292a01',
    );
  });

  it('respects custom template placeholders', () => {
    const url = buildCbetaOnlineUrl(
      'T51n2076',
      'p0292a01',
      'https://example/{workCode}/{ref}/{linehead}',
    );
    assert.equal(
      url,
      'https://example/T51n2076/0292a01/T51n2076_p0292a01',
    );
  });
});
