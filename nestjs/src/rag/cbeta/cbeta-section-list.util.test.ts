import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractSectionHeadingNeedle,
  formatCbetaSectionListAnswer,
  parseOrderedMastersFromSection,
} from './cbeta-section-list.util';
import { isCbetaSectionListIntent } from './cbeta-intent.util';

/** Excerpt shaped like T51n2076 chunk 0256c07 (dense register). */
const SAMPLE =
  '第二世下五十六人（馬祖法嗣）汾州無業禪師澧州大同廣澄禪師池州南泉普願禪師五臺鄧隱峯禪師溫州佛嶴和尚烏臼和尚潭州石霜山大善和尚石臼和尚本谿和尚石林和尚洪州西山亮坐主黑眼和尚米嶺和尚齊峯和尚大陽和尚紅螺山和尚泉州龜洋無了禪師利山和尚韶州乳源和尚松山和尚則川和尚南嶽西園曇藏禪師百靈和尚鎮州金牛和尚洞安和尚忻州打地和尚潭州秀谿和尚磁州馬頭峯神藏禪師潭州華林善覺禪師汀州水塘和尚古寺和尚江西椑樹和尚京兆草堂和尚袁州陽岐山甄叔禪師濛谿和尚洛京黑㵎和尚京兆興平和尚逍遙和尚福谿和尚洪州水老和尚浮杯和尚潭州龍山和尚襄州居士龐蘊（已上四十三人見錄）天目山明覺禪師王屋山行明禪師京兆智藏禪師大陽山希頂禪師蘇州崑山定覺禪師隨州洪山大師連州元堤禪師泉州無了禪師泉州慧忠禪師安豐山懷空禪師羅浮山道行禪師廬山法藏禪師呂后山寧賁禪師（已上一十三人無機緣語句不錄）懷讓禪師第二世法嗣';

describe('isCbetaSectionListIntent', () => {
  it('detects 馬祖法嗣 / 五十六人 / tìm mục', () => {
    assert.equal(
      isCbetaSectionListIntent(
        'Trong 景德傳燈錄 (T51n2076), tìm mục: 懷讓禪師第二世下五十六人（馬祖法嗣）',
      ),
      true,
    );
    assert.equal(
      isCbetaSectionListIntent(
        'liệt kê đủ 56 tên 馬祖法嗣 theo thứ tự; phân biệt 見錄 và 不錄',
      ),
      true,
    );
  });

  it('does not steal ordinary patriarch list questions', () => {
    assert.equal(
      isCbetaSectionListIntent('Liệt kê các vị tổ trong truyền đăng lục'),
      false,
    );
  });
});

describe('parseOrderedMastersFromSection', () => {
  it('extracts 43+13 names in order from dense register text', () => {
    const p = parseOrderedMastersFromSection(SAMPLE, '馬祖法嗣');
    assert.equal(p.recorded.length, 43);
    assert.equal(p.norecorded.length, 13);
    assert.equal(p.allNames.length, 56);
    assert.equal(p.recorded[0], '汾州無業禪師');
    assert.equal(p.recorded[2], '池州南泉普願禪師');
    assert.ok(p.recorded.includes('襄州居士龐蘊'));
    assert.ok(p.recorded.includes('五臺鄧隱峯禪師'));
    assert.ok(p.norecorded.includes('天目山明覺禪師'));
    assert.equal(p.norecorded.at(-1), '呂后山寧賁禪師');
  });
});

describe('formatCbetaSectionListAnswer', () => {
  it('includes work title, ref, and ordered names', () => {
    const parsed = parseOrderedMastersFromSection(SAMPLE);
    const text = formatCbetaSectionListAnswer({
      question: 'Liệt kê 56 tên 馬祖法嗣 trong T51n2076',
      titleZh: '景德傳燈錄',
      workCode: 'T51n2076',
      juanNo: 8,
      cbetaRefStart: '0256c07',
      parsed,
    });
    assert.match(text, /景德傳燈錄/);
    assert.match(text, /T51n2076/);
    assert.match(text, /0256c07/);
    assert.match(text, /汾州無業禪師/);
    assert.match(text, /見錄/);
    assert.match(text, /不錄/);
    assert.equal((text.match(/汾州無業禪師/g) || []).length >= 1, true);
  });

  it('states 不錄 membership for 天目山明覺禪師', () => {
    const parsed = parseOrderedMastersFromSection(SAMPLE);
    const text = formatCbetaSectionListAnswer({
      question: '天目山明覺禪師 thuộc 見錄 hay 不錄 trong mục 56 pháp tự Mã Tổ?',
      titleZh: '景德傳燈錄',
      workCode: 'T51n2076',
      juanNo: 8,
      cbetaRefStart: '0256c07',
      parsed,
    });
    assert.match(text, /天目山明覺禪師/);
    assert.match(text, /不錄/);
    assert.match(text, /Kết luận/);
  });
});

describe('extractSectionHeadingNeedle', () => {
  it('prefers 馬祖法嗣 heading span', () => {
    const n = extractSectionHeadingNeedle(
      'tìm mục 懷讓禪師第二世下五十六人（馬祖法嗣） trong T51n2076',
    );
    assert.ok(n && n.includes('五十六人'));
  });
});
