# 11 — Content Pipeline

> How questions get authored, imported, reviewed, and shipped.
> Cross-refs: [08-admin-panel.md](08-admin-panel.md) · [02-database-schema.md](02-database-schema.md)

---

## What we mean by "content"

A question, in our system, has these parts:
- **Stem** — the actual question text
- **Passage** (optional) — context students read before the stem
- **Four options** — A, B, C, D
- **Correct answer** — single letter
- **Explanation** — why the correct answer is right, why the others are wrong, and the key rule/takeaway
- **Metadata** — subject, category, difficulty, tags

This doc covers the journey from "Bahromjon has a question in his head" to "question is live in the platform."

---

## Subjects and categories (fixed taxonomy)

### Reading & Writing (English)
1. **Information & Ideas** — `information-and-ideas`
2. **Craft & Structure** — `craft-and-structure`
3. **Expression of Ideas** — `expression-of-ideas`
4. **Standard English Conventions** — `standard-english-conventions`

### Math
1. **Algebra** — `algebra`
2. **Advanced Math** — `advanced-math`
3. **Problem-Solving & Data Analysis** — `problem-solving-data-analysis`
4. **Geometry & Trigonometry** — `geometry-trigonometry`

**Total: 8 categories.** These mirror the College Board's official Digital SAT structure. We don't deviate.

If the SAT structure changes, we add new categories (don't repurpose old ones).

---

## Quality bar for a question

Every question, before it goes `published`, must meet these criteria:

### Stem
- [ ] Clear and unambiguous
- [ ] No typos or grammar issues
- [ ] Appropriate length (not artificially long)
- [ ] If a passage is provided, it's necessary (don't add fluff)

### Options
- [ ] Exactly four
- [ ] All four are plausible (not obviously wrong by elimination)
- [ ] Wrong options reflect realistic student errors (not random words)
- [ ] Similar lengths (long correct answer + short wrong ones is a tell)
- [ ] Mutually exclusive (only one correct)

### Correct answer
- [ ] Verifiable from the passage/stem
- [ ] Not "correct by ambiguity" — would survive a College Board review

### Explanation
- [ ] At least 30 characters (we enforce this in validation)
- [ ] Explains the **reasoning**, not just restates the answer
- [ ] Explicitly addresses why each wrong choice is wrong (this is what students need)
- [ ] Includes a **key rule** — the takeaway that generalizes beyond this specific question

### Difficulty
- [ ] Honest assessment (don't mark hard for marketing)
- Calibration over time using the per-question accuracy data we collect

---

## Authoring workflow

### Option 1: Admin form (low volume)
Bahromjon goes to `/admin/questions` → "Add question" → fills the form → "Save and publish."

Use when:
- Adding a single new question.
- Editing an existing one.
- Writing a question that needs careful formatting (passages with HTML, etc.).

### Option 2: CSV bulk import (high volume)
Use when:
- Initial load of 200+ existing questions.
- Adding a batch (e.g., "60 new Math questions from the June test").

CSV is faster but error-prone. Always import to `status = 'draft'` and review before publishing.

---

## CSV format specification

### File requirements
- UTF-8 encoded (with or without BOM).
- First row is header.
- Standard CSV: comma-separated, double-quoted strings, `""` to escape a double quote inside a string.
- Newlines inside fields: must be inside quoted strings.

### Columns

| Column | Required | Type | Validation | Notes |
|---|---|---|---|---|
| `subject` | yes | text | "English" or "Math" (case-insensitive) | |
| `category` | yes | text | Must match one of the 8 category names exactly | |
| `passage` | no | text | If provided, min 50 chars | Can include HTML: `<em>`, `<sup>`, `<sub>` |
| `question_text` | yes | text | Min 10 chars | Same HTML allowed |
| `option_a` | yes | text | Non-empty | |
| `option_b` | yes | text | Non-empty | |
| `option_c` | yes | text | Non-empty | |
| `option_d` | yes | text | Non-empty | |
| `correct_answer` | yes | char(1) | "A", "B", "C", or "D" | |
| `explanation` | yes | text | Min 30 chars | Same HTML allowed |
| `difficulty` | yes | text | "easy", "medium", or "hard" | |
| `tags` | no | text | Semicolon-separated | e.g., `quadratic;factoring` |

### Example row

```csv
subject,category,passage,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,tags
"English","Craft & Structure","The scientist <em>proposed</em> that the unusual sedimentary patterns indicated a sudden climatic shift.","As used in the text, what does the word ""proposed"" most nearly mean?","Demanded","Suggested","Refused","Confirmed","B","'Proposed' here means to put forward an idea tentatively. ""Suggested"" matches this meaning. ""Demanded"" implies force; ""Confirmed"" implies certainty — neither fits the tentative tone of the scientist's claim. **Key rule:** Substitute each option into the original sentence and pick the one that preserves meaning.","medium","words-in-context"
```

### Common errors

| Error | Why | Fix |
|---|---|---|
| Unclosed double quote | One stray `"` somewhere | Use a CSV editor (Excel, Google Sheets), export to CSV |
| Subject doesn't match | "english" lowercase OK, but "Eng" not | Use `English` or `Math` (or any case of those) |
| Category doesn't match | Typo or wrong category name | Open template, copy exact category name |
| Correct answer not A/B/C/D | "b" lowercase usually fine, but "1" or "B." not | Use single uppercase letter, no punctuation |
| Multi-line passages broken | Newlines outside quotes | Wrap entire field in quotes; preserve `\n` inside |
| Trailing whitespace | Hidden trailing spaces fail tag matching | Trim all string fields in pre-import normalization |

### Template
A template CSV with one example row + a "DELETE THIS ROW" instruction lives at `docs/templates/question-import-template.csv` (to be created).

---

## Pre-import normalization

When admin uploads a CSV, the server:

1. Reads the file, validates UTF-8.
2. Parses header row, matches against expected columns. Missing required columns → fail entire import with error.
3. For each row:
   - Trims all string fields.
   - Normalizes case for `subject`, `correct_answer`, `difficulty`.
   - Validates against schema (Zod).
   - Looks up subject + category UUIDs.
   - Parses tags (split on `;`, trim each).
   - Checks for duplicates: same `question_text + correct_answer` → skip with reason "duplicate".
   - On valid: insert into `questions` with `status='draft'`, `created_by=admin.id`.
   - On invalid: collect error with row number + reason, don't insert.
4. Return summary: `{ imported: 187, skipped: 13, errors: [...] }`.

---

## Reviewing imported drafts

After import, the question bank has 187 new `draft` questions. Workflow:

1. Admin filters by `status=draft` in the list view.
2. Goes through each (or in batches of 10-20):
   - Click "Preview" to see as student would
   - Click "Edit" to fix any issues
   - Click "Publish" when satisfied
3. Bulk-publish for batches: select 20 questions → "Bulk publish".

### Bulk publish safeguards
- Pre-flight check: ensures every selected question passes validation (explanation present, all options non-empty).
- Confirmation modal lists how many will be published.

---

## Versioning questions

We **don't version** individual questions — edits replace the existing row. Past attempts (the `attempts` table) keep their answer logically correct because:
- The `selected_answer` and `is_correct` are stored at attempt time.
- The student's record doesn't change if we later edit the question text.

If we materially change a question (e.g., change the correct answer because the original was wrong):
- All past `attempts` for that question are now misleading.
- We **archive the question** (new status) and **author a corrected version** as a new row.
- Optional: invalidate AI insight caches that referenced the old question.

This means historical record is preserved; we never silently rewrite history.

---

## Tags

Tags are flexible labels for sub-topic granularity within a category.

### Examples
- Math/Advanced Math: `quadratic`, `exponential`, `factoring`, `parabola`, `discriminant`
- Math/Algebra: `linear`, `system`, `inequality`, `slope`, `intercept`
- English/Craft & Structure: `words-in-context`, `rhetorical-function`, `text-structure`, `dual-text`
- English/Standard English: `comma-splice`, `colon`, `dangling-modifier`, `subject-verb-agreement`

### Tag rules
- Always lowercase, hyphen-separated for multi-word.
- Don't duplicate categories as tags ("algebra" tag inside Algebra category = noise).
- Three or fewer tags per question typically.
- Tags drive the AI weakness analysis — they're how Claude knows "this user struggles specifically with quadratics, not all of advanced math."

### Maintaining the tag vocabulary
- No fixed list at launch — admin types freely.
- After 100+ questions, audit the tag list and merge duplicates/near-duplicates (e.g., "factoring" vs "factor").
- Eventually: drop-down with autocomplete from existing tags in the admin form.

---

## Difficulty calibration

### Initial assignment
Bahromjon assigns difficulty based on his judgment + College Board difficulty signals.

### Continuous calibration
After ~50 attempts per question, we have data:
- Question with > 80% accuracy across students → likely Easy
- 50-79% accuracy → Medium
- < 50% accuracy → Hard

Quarterly: admin runs a "Difficulty audit" — sees questions whose assigned difficulty doesn't match observed accuracy, reviews + updates.

Auto-recalibration may come in Phase 10 — for now, manual review preserves quality.

---

## Image / diagram questions

Math questions often include diagrams (circles, triangles). At launch, we handle this in two ways:

### Option A: Inline SVG in passage
For simple diagrams (lines, polygons, axes), embed SVG directly in the `passage` field. Example:
```html
<svg viewBox="0 0 100 100" width="120">
  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>
```

Pros: zero hosting, scales perfectly, theme-aware (currentColor).
Cons: not authorable without HTML knowledge.

### Option B (later): Image upload
For complex diagrams, upload image to Supabase Storage, embed via `<img>` tag.

Phase 4 launch: support both. Admin form has an "Insert SVG" template button that drops in a starter.

---

## Source attribution

Most questions are original or in the style of public SAT practice questions. If we use a question that closely follows a College Board released question (legal under fair use for practice purposes), we add a tag like `source:cb-may2024` for internal tracking. Never displayed to students.

---

## Initial 200-question load checklist

For the first big import:
- [ ] Bahromjon prepares 200 questions in a spreadsheet
- [ ] Validate the spreadsheet matches CSV format (use template)
- [ ] Export as UTF-8 CSV
- [ ] Local dev import to verify format
- [ ] Fix errors in source spreadsheet, re-export
- [ ] Import to production as drafts
- [ ] Bulk preview a sample of 20 random questions
- [ ] Bulk publish in batches of 50 with review between batches
- [ ] Verify each category has roughly even distribution (no one category has 100 questions and another has 5)
- [ ] First QOD scheduled for tomorrow

---

## Ongoing content schedule

Target cadence post-launch:
- **+10 new questions per week** (mix of categories)
- **1 QOD per day** (scheduled at least 1 week in advance)
- **Difficulty audit quarterly**
- **Tag audit quarterly**

Bahromjon's primary content responsibility. We may invite a second author later (would need their own admin account + content guidelines doc).

---

## Editorial style guide

### Tone
- **Direct, not chatty.** SAT prep is serious; respect the student's time.
- **Encouraging in explanations.** "It's a common trap" beats "You probably picked B because…"
- **No filler.** Don't pad explanations to look thorough.

### Formatting
- **Italicize:** technical terms on first use, foreign words, book/movie titles → use `<em>`.
- **Bold:** key rules, takeaways → use `<strong>` (in explanations only — never in question stems).
- **Lists:** use `<ul>` or `<ol>` when explanation has 3+ steps.
- **No emojis** in question content.

### Math notation
- Until we add MathJax/KaTeX (Phase 10), use plain text:
  - Exponents: `x²` or `x^2`
  - Square root: `√(x+1)` or `sqrt(x+1)`
  - Fractions: `(x+1)/(x-1)` or `1/2`
  - Inequalities: `≤`, `≥`, `≠`, `→`
- Use Unicode where possible (`²`, `³`, `√`, `π`) — better than ASCII for rendering.

---

## Reviewing community feedback

Future feature: students flag bad questions ("explanation is wrong" / "two correct answers").

For now: admin notes in user profiles can include flags. Bahromjon reviews flagged questions monthly.

---

## What we don't do (yet)

- ❌ AI-generated questions
- ❌ User-submitted questions
- ❌ Question translations
- ❌ Question variations (e.g., same question with different numbers)
- ❌ Free-response (grid-in) questions — only multiple choice at launch

---

**See next:** [12-testing-strategy.md](12-testing-strategy.md) for how we make sure the platform actually works.
