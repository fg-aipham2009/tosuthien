import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CbetaEntitiesService } from './cbeta-entities.service';

describe('formatEntityListBlock budget', () => {
  it('caps list by maxChars and keeps highest-count names first', () => {
    const svc = Object.create(CbetaEntitiesService.prototype) as CbetaEntitiesService;
    const entities = Array.from({ length: 200 }, (_, i) => ({
      nameZh: `名${String(i).padStart(3, '0')}`,
      count: 200 - i,
      works: ['T51n2076'],
    }));
    const block = svc.formatEntityListBlock(entities, ['T51n2076'], 800);
    assert.ok(block.includes('[CBETA_ENTITY_LIST]'));
    assert.ok(block.includes('名000'));
    assert.ok(block.includes('còn'));
    assert.ok(block.length <= 900);
    assert.ok(!block.includes('名199'));
  });
});
