import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  needsVnDialogueBackshift,
  needsVnPassageStartBackshift,
} from './cbeta-expand.util';

describe('needsVnPassageStartBackshift', () => {
  it('flags mid-clause continuation openers', () => {
    assert.equal(
      needsVnPassageStartBackshift('nên canh ba vào thất. Tổ dùng ca sa che lại…'),
      true,
    );
    assert.equal(
      needsVnPassageStartBackshift('thì Huệ Năng ngay đó Đại Ngộ.'),
      true,
    );
  });

  it('flags Đáp without Hỏi', () => {
    assert.equal(needsVnDialogueBackshift('Đáp: Tham thiền là khán thoại đầu.'), true);
    assert.equal(
      needsVnPassageStartBackshift('Đáp: Tham thiền là khán thoại đầu.'),
      true,
    );
  });

  it('allows clean scene / HỎI openers', () => {
    assert.equal(
      needsVnPassageStartBackshift('HỎI: Thế nào là thoại đầu?\nĐáp: …'),
      false,
    );
    assert.equal(
      needsVnPassageStartBackshift('Một hôm Tổ thượng đường…'),
      false,
    );
    assert.equal(
      needsVnPassageStartBackshift('[Trang 15]\nLục Tổ bảo Huệ Năng…'),
      false,
    );
  });
});
