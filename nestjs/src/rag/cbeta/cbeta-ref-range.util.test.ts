import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cbetaRefCovers,
  normalizeCbetaRef,
} from './cbeta-ref-range.util';

describe('cbetaRefCovers', () => {
  it('matches locator inside chunk span 0316b20–0317b12', () => {
    assert.equal(
      cbetaRefCovers('0316b20', '0317b12', 'p0317a22'),
      true,
    );
    assert.equal(normalizeCbetaRef('p0317a22'), '0317a22');
  });

  it('rejects locators outside the span', () => {
    assert.equal(
      cbetaRefCovers('0316b20', '0317b12', '0318a01'),
      false,
    );
  });
});
