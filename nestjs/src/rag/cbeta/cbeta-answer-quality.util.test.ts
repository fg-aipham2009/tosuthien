import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertCbetaAnswerLang,
  cbetaAnswerPrefill,
  isMetaPlanningOpener,
  stripCbetaAnswerPrefill,
  stripLeadingMetaPlanning,
} from './cbeta-answer-quality.util';

describe('isMetaPlanningOpener', () => {
  it('flags English CoT openers', () => {
    assert.equal(isMetaPlanningOpener("I'm noting that the entity list is noisy"), true);
    assert.equal(isMetaPlanningOpener('I need to produce a two-part answer'), true);
    assert.equal(isMetaPlanningOpener('The context block is unrelated'), true);
  });

  it('flags Vietnamese scaffolding openers', () => {
    assert.equal(
      isMetaPlanningOpener('Tôi cần trả lời bằng tiếng Việt với hai phần'),
      true,
    );
    assert.equal(isMetaPlanningOpener('Để trả lời câu hỏi này'), true);
    assert.equal(
      isMetaPlanningOpener('Tôi đang tổng hợp từ các nguồn: định nghĩa Thiền'),
      true,
    );
  });

  it('allows real content openers', () => {
    assert.equal(
      isMetaPlanningOpener('Thiền (禪那) trong ngữ cảnh CBETA chỉ sự tĩnh lự'),
      false,
    );
    assert.equal(
      isMetaPlanningOpener(
        'Các tên xuất hiện trong phạm vi đã quét (T51n2076), xếp theo tần suất',
      ),
      false,
    );
    assert.equal(
      isMetaPlanningOpener(
        'the doctrinal/etymological meaning of 禪那 as 靜慮 covering the four dhyānas',
      ),
      false,
    );
  });
});

describe('assertCbetaAnswerLang', () => {
  it('accepts Vietnamese content after stripping PHẦN 1 prefill', () => {
    const text =
      'PHẦN 1\n\nThiền (禪), theo ngữ cảnh CBETA dưới đây, là pháp chỉ quán gắn với 靜慮.';
    const r = assertCbetaAnswerLang(text, 'vi');
    assert.equal(r.ok, true, r.reason);
  });

  it('rejects Vietnamese meta scaffolding', () => {
    const text =
      'PHẦN 1\n\nTôi cần trả lời bằng tiếng Việt với hai phần, dựa trên các khái niệm';
    const r = assertCbetaAnswerLang(text, 'vi');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'meta_planning');
  });

  it('rejects English CoT for vi answers', () => {
    const text =
      "PHẦN 1\n\nDưới đây là các vị tổ trong phạm vi đã quét:\n\nI'm checking which patriarchs";
    const r = assertCbetaAnswerLang(text, 'vi');
    assert.equal(r.ok, false);
  });

  it('accepts English content after PART 1 prefill', () => {
    const text =
      'PART 1\n\nChan (禪), according to the CBETA passages below, means dhyāna as stillness and deliberation.';
    const r = assertCbetaAnswerLang(text, 'en');
    assert.equal(r.ok, true, r.reason);
  });
});

describe('cbetaAnswerPrefill', () => {
  it('opens ordinary VI answers with content, not bare heading only', () => {
    const p = cbetaAnswerPrefill('vi', false);
    assert.match(p, /Thiền \(禪\)/);
    assert.ok(p.length > 'PHẦN 1\n\n'.length);
  });

  it('opens ordinary EN answers with Chan content cue', () => {
    const p = cbetaAnswerPrefill('en', false);
    assert.match(p, /Chan \(禪\)/);
  });

  it('keeps coverage prefills list-oriented', () => {
    assert.match(cbetaAnswerPrefill('vi', true), /các vị tổ/);
    assert.match(cbetaAnswerPrefill('zh', true), /祖師/);
  });
});

describe('stripCbetaAnswerPrefill', () => {
  it('removes PHẦN 1 and content cue prefix', () => {
    const body = stripCbetaAnswerPrefill(
      'PHẦN 1\n\nThiền (禪), theo ngữ cảnh CBETA dưới đây, là tĩnh lự.',
    );
    assert.equal(body, 'là tĩnh lự.');
  });
});

describe('stripLeadingMetaPlanning', () => {
  it('removes Vietnamese scaffolding before real content', () => {
    const cleaned = stripLeadingMetaPlanning(
      'Tôi cần trả lời bằng tiếng Việt, gồm hai phần: cách hiểu về Thiền theo Giáo môn là tĩnh lự.',
    );
    assert.match(cleaned, /^cách hiểu về Thiền/);
    assert.equal(isMetaPlanningOpener(cleaned), false);
    const cleaned2 = stripLeadingMetaPlanning(
      'Tôi đang tổng hợp từ các nguồn: định nghĩa Thiền-na theo Tam Tạng là tĩnh lự.',
    );
    assert.match(cleaned2, /^định nghĩa Thiền/);
  });

  it('removes English I-need scaffolding', () => {
    const cleaned = stripLeadingMetaPlanning(
      'I need to write this in English with two parts: Chan means dhyāna as stillness.',
    );
    assert.match(cleaned, /^Chan means/);
    const cleaned2 = stripLeadingMetaPlanning(
      "I need to put together an English answer with two parts, drawing on the term's origins—Chan as dhyāna.",
    );
    assert.match(cleaned2, /^Chan as/);
  });

  it('drops English CoT when answer lang is Vietnamese', () => {
    const cleaned = stripLeadingMetaPlanning(
      "I also want to weave in Thần Hội's idea of non-thought. Định nghĩa Giáo môn về Thiền Na là tĩnh lự.",
      'vi',
    );
    assert.match(cleaned, /^Định nghĩa Giáo môn/);
    const gate = assertCbetaAnswerLang(
      'PHẦN 1\n\nThiền (禪), theo ngữ cảnh CBETA dưới đây, ' + cleaned,
      'vi',
    );
    assert.equal(gate.ok, true, gate.reason);
  });

  it('drops I\'m-starting planning for EN answers', () => {
    const cleaned = stripLeadingMetaPlanning(
      "I'm starting with the etymology of Chan as dhyāna, meaning quiet contemplation.\n\nNext I'm outlining the doctrinal sense. Chan means meditative absorption.",
      'en',
    );
    assert.match(cleaned, /^Chan means/);
    const gate = assertCbetaAnswerLang(
      'PART 1\n\nChan (禪), according to the CBETA passages below, ' + cleaned,
      'en',
    );
    assert.equal(gate.ok, true, gate.reason);
  });
});
