import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { routeCbetaQuery } from './cbeta-router';
import { isCbetaCoverageIntent } from './cbeta-intent.util';
import {
  detectCbetaSchoolLineage,
  enrichSchoolLineageSearch,
  isCbetaSchoolLineageQuestion,
  schoolLineageChunkBoost,
} from './cbeta-school-lineage.util';

describe('Ngũ gia school lineage routing', () => {
  const cases: Array<{ q: string; school: string; coverage: boolean }> = [
    {
      q: 'Liệt kê các vị Tổ theo dòng truyền thừa của tông Tào Động',
      school: '曹洞',
      coverage: false,
    },
    {
      q: 'liệt kê pháp hệ tông Lâm Tế',
      school: '臨濟',
      coverage: false,
    },
    {
      q: 'Dòng truyền thừa Vân Môn tông theo CBETA',
      school: '雲門',
      coverage: false,
    },
    {
      q: 'Pháp hệ Quy Ngưỡng (溈仰) gồm những ai?',
      school: '溈仰',
      coverage: false,
    },
    {
      q: 'Liệt kê truyền thừa Pháp Nhãn tông',
      school: '法眼',
      coverage: false,
    },
    {
      q: 'Liệt kê các vị tổ trong truyền đăng lục',
      school: '',
      coverage: true,
    },
  ];

  for (const c of cases) {
    it(`routes: ${c.q.slice(0, 40)}…`, () => {
      const spec = detectCbetaSchoolLineage(c.q);
      if (c.school) {
        assert.ok(spec, 'expected school match');
        assert.equal(spec!.nameZh, c.school);
        assert.equal(isCbetaSchoolLineageQuestion(c.q), true);
        assert.equal(isCbetaCoverageIntent(c.q), false);
        const d = routeCbetaQuery({ question: c.q });
        assert.equal(d.schoolLineageMode, true);
        assert.equal(d.coverageMode, false);
        assert.ok(d.reasons.some((r) => r.includes('schoolLineage')));
      } else {
        assert.equal(spec, null);
        assert.equal(isCbetaCoverageIntent(c.q), c.coverage);
        const d = routeCbetaQuery({ question: c.q });
        assert.equal(d.schoolLineageMode, false);
        assert.equal(d.coverageMode, c.coverage);
      }
    });
  }
});

describe('enrichSchoolLineageSearch', () => {
  it('adds 曹洞 + succession needles without inventing a master list answer', () => {
    const out = enrichSchoolLineageSearch(
      'Liệt kê các vị Tổ theo dòng truyền thừa của tông Tào Động',
      '曹洞',
      [],
    );
    assert.ok(out);
    assert.match(out!.searchZh, /曹洞/);
    assert.match(out!.searchZh, /法嗣|宗派圖|正傳/);
    // Must not hardcode a full generation answer tree as the only content.
    assert.ok(!/洞山良价.{0,5}曹山本寂.{0,5}雲居道膺/.test(out!.searchZh));
  });
});

describe('schoolLineageChunkBoost', () => {
  it('boosts 嗣 / 宗派圖 evidence for the named school', () => {
    const weak = schoolLineageChunkBoost('一般敘述', '雜錄', '曹洞');
    const strong = schoolLineageChunkBoost(
      '曹洞宗正傳宗派圖…洞山价法嗣曹山本寂…又雲居道膺',
      '禪燈世譜',
      '曹洞',
    );
    assert.ok(strong > weak);
    assert.ok(strong >= 50);
  });
});
