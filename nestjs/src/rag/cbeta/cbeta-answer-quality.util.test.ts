import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertCbetaAnswerLang,
  cbetaAnswerPrefill,
  isMetaPlanningOpener,
  shouldBufferCbetaHead,
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

  it('rejects English lead-in buried before late Vietnamese', () => {
    const text =
      "PHẦN 1\n\nThiền (禪), theo ngữ cảnh CBETA dưới đây, I also want to weave ideas forever without a period or Vietnamese early";
    const r = assertCbetaAnswerLang(text, 'vi');
    assert.equal(r.ok, false);
  });

  it('rejects English body after VI prefill even with Giáo môn parentheses', () => {
    const text =
      'PHẦN 1\n\nThiền (禪), theo ngữ cảnh CBETA dưới đây, the doctrinal (Giáo môn) view with its four dhyanas versus Patriarchal Chan (Tổ Sư Thiền).';
    const r = assertCbetaAnswerLang(text, 'vi');
    assert.equal(r.ok, false);
    assert.ok(
      r.reason === 'en_lead_in_vi' || r.reason === 'missing_vi_marks',
      r.reason,
    );
  });

  it('accepts English content after PART 1 prefill', () => {
    const text =
      'PART 1\n\nChan (禪), according to the CBETA passages below, means dhyāna as stillness and deliberation.';
    const r = assertCbetaAnswerLang(text, 'en');
    assert.equal(r.ok, true, r.reason);
  });

  it('accepts VI content after stripping meta scaffolding', () => {
    const text =
      'PHẦN 1\n\nThiền (禪), theo ngữ cảnh CBETA dưới đây, Tôi cần trả lời bằng tiếng Việt: định nghĩa Thiền Na là tĩnh lự theo kinh luận.';
    const r = assertCbetaAnswerLang(text, 'vi');
    assert.equal(r.ok, true, r.reason);
  });
});

describe('shouldBufferCbetaHead', () => {
  it('buffers short or English-meta heads for VI', () => {
    assert.equal(shouldBufferCbetaHead('short', 'vi'), true);
    assert.equal(
      shouldBufferCbetaHead(
        "I also want to weave in Thần Hội without finishing the English clause yet and still no Vietnamese diacritics here at all",
        'vi',
      ),
      true,
    );
  });

  it('stops buffering once Vietnamese content is ready', () => {
    assert.equal(
      shouldBufferCbetaHead(
        'định nghĩa Giáo môn về Thiền Na (靜慮) là tĩnh lự gồm tư duy và diệt trừ theo kinh luận CBETA trong ngữ cảnh đã chọn.',
        'vi',
      ),
      false,
    );
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

  it('drops I\'ll-structure planning for EN answers', () => {
    const cleaned = stripLeadingMetaPlanning(
      "I'll structure my answer in two parts: first covering the doctrinal school perspective on Chan as 靜慮.",
      'en',
    );
    assert.match(cleaned, /^first covering/i);
    const gate = assertCbetaAnswerLang(
      'PART 1\n\nChan (禪), according to the CBETA passages below, ' + cleaned,
      'en',
    );
    assert.equal(gate.ok, true, gate.reason);
  });

  it('does not strip content that merely starts with lowercase first', () => {
    const cleaned = stripLeadingMetaPlanning(
      'first covering the doctrinal school perspective on Chan as stillness.',
      'en',
    );
    assert.match(cleaned, /^first covering/i);
  });

  it('drops EN structure scaffolding and Vietnamese labels', () => {
    const cleaned = stripLeadingMetaPlanning(
      'a synthesis section, then an "AI interpretation" section distinguishing doctrinal (Giáo môn) perspectives from Zen lineage (Tổ Sư Thiền). Chan means dhyāna as stillness and deliberation.',
      'en',
    );
    assert.match(cleaned, /^Chan means/i);
    assert.doesNotMatch(cleaned, /Giáo môn|Tổ Sư/);
    const gate = assertCbetaAnswerLang(
      'PART 1\n\nChan (禪), according to the CBETA passages below, ' + cleaned,
      'en',
    );
    assert.equal(gate.ok, true, gate.reason);
  });

  it('drops I-should-also-note CoT before Chan content', () => {
    const cleaned = stripLeadingMetaPlanning(
      "I should also note that Bodhidharma's four-phrase formula is sometimes mistakenly tied to the fifth paramita when it's actually about prajna (per Yang Renshan). Chan means meditative absorption as stillness and deliberation.",
      'en',
    );
    assert.match(cleaned, /^Chan means/i);
    assert.equal(isMetaPlanningOpener(cleaned), false);
    const gate = assertCbetaAnswerLang(
      'PART 1\n\nChan (禪), according to the CBETA passages below, ' + cleaned,
      'en',
    );
    assert.equal(gate.ok, true, gate.reason);
  });

  it('drops first-a-synthesis and English-pulling openers', () => {
    const cleaned = stripLeadingMetaPlanning(
      'first a synthesis distinguishing the doctrinal school versus patriarch Chan perspectives without citations. Chan means dhyāna as quiet contemplation.',
      'en',
    );
    assert.match(cleaned, /^Chan means/i);
    const cleaned2 = stripLeadingMetaPlanning(
      'English, pulling together the etymology of Chan as dhyāna. Chan is also called correct concentration.',
      'en',
    );
    assert.match(cleaned2, /^Chan is|^Chan means/i);
  });
});
