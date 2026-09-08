import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeQuestionTextBlocks, sanitizeRichText } from './richtext-sanitize';

test('preserves mixed and nested emphasis in imported question content', () => {
  const source =
    'Choice B is correct. Angle <i>ACE</i> measures 62°. ' +
    'Therefore, <b>62 + 58 + <i>x</i> = 180</b>, which gives <strong><em>x</em> = 60</strong>.';

  assert.equal(sanitizeRichText(source), source);
});

test('preserves emphasis across question text blocks', () => {
  const source = 'A regular sentence with <i>one italic term</i>.\n\nOnly <b>this equation</b> is bold.';

  assert.equal(sanitizeQuestionTextBlocks(source), source);
});

test('keeps safe emphasis while removing executable markup', () => {
  const source = '<b>Keep this</b><script>alert(1)</script><i onclick="alert(2)">and this</i>';

  assert.equal(sanitizeRichText(source), '<b>Keep this</b><i>and this</i>');
});
