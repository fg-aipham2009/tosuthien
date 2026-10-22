import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  cbetaMultiWorkRetrievalEnabled,
  cbetaQuoteLevelCitationsEnabled,
  cbetaQuoteVerifyV2Enabled,
} from './cbeta-feature-flags.util';

describe('cbeta feature flags default off', () => {
  const keys = [
    'CBETA_MULTI_WORK_RETRIEVAL',
    'CBETA_QUOTE_LEVEL_CITATIONS',
    'CBETA_QUOTE_VERIFY_V2',
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('all experimental flags are off when unset', () => {
    assert.equal(cbetaMultiWorkRetrievalEnabled(), false);
    assert.equal(cbetaQuoteLevelCitationsEnabled(), false);
    assert.equal(cbetaQuoteVerifyV2Enabled(), false);
  });

  it('flags turn on with 1/true', () => {
    process.env.CBETA_MULTI_WORK_RETRIEVAL = '1';
    process.env.CBETA_QUOTE_LEVEL_CITATIONS = 'true';
    process.env.CBETA_QUOTE_VERIFY_V2 = 'on';
    assert.equal(cbetaMultiWorkRetrievalEnabled(), true);
    assert.equal(cbetaQuoteLevelCitationsEnabled(), true);
    assert.equal(cbetaQuoteVerifyV2Enabled(), true);
  });
});
