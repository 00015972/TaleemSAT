# 15. HTML Import Schema

The admin import pipeline (`docs/11-content-pipeline.md`) accepts two source formats for a question bank: a College Board PDF (transcribed by a vision model — costs a small amount of AI spend per question) and a hand-converted **HTML** file (parsed deterministically — `lib/import/html-questions.ts` — no AI at all).

The HTML path only works because the file is fully tagged. This document is the contract: convert a PDF into HTML that follows this shape exactly, and the parser needs zero guessing. Deviate from it and the affected question gets flagged for manual review instead of silently mis-imported — but staying close to this shape means most of a bank imports clean on the first try.

If you're using an AI chat tool to do the conversion, paste this document alongside the source PDF and ask it to produce HTML matching it.

## Per-question structure

Each question is one `<article class="question">`:

```html
<article class="question" id="q-<source-id>">
  <div class="question-header">
    <h2>Question <N></h2>
    <span class="qid">ID: <source-id></span>
  </div>
  <div class="badges">
    <span class="badge">SAT</span>
    <span class="badge"><Subject></span>
    <span class="badge"><Domain></span>
    <span class="badge"><Skill></span>
    <span class="badge"><Difficulty></span>
  </div>

  <h3>Question</h3>
  <div class="question-body">
    <!-- paragraphs, an optional table, optional figures -->
  </div>

  <h3>Answer Choices</h3>
  <ul class="options">
    <li class="option"><span class="option-letter">A</span><span class="option-text">...</span></li>
    <li class="option correct"><span class="option-letter">B</span><span class="option-text">...</span> <span class="correct-tag">Correct answer</span></li>
    <li class="option"><span class="option-letter">C</span><span class="option-text">...</span></li>
    <li class="option"><span class="option-letter">D</span><span class="option-text">...</span></li>
  </ul>

  <h3>Rationale</h3>
  <div class="rationale">
    <p>...</p>
  </div>
</article>
```

**Required, exact class names:** `article.question`, `.qid`, `.badges .badge`, `.question-body`, `ul.options` / `li.option`, `.option-letter`, `.option-text`, `.correct` (on the right `<li>`), `.rationale`. The parser looks for these literally — renaming or nesting them differently means that field comes back empty and the question is flagged.

**One bad question never blocks the rest of the file** — every `<article>` is parsed independently, and a malformed one just gets marked `verification_failed` for a human to fix or reject.

## Badges — exactly 5, in this order

1. **Assessment** — always `SAT`
2. **Subject** — `Reading and Writing` or `Math`
3. **Domain** — one of the 8 names below, spelled exactly
4. **Skill** — one of the 29 names below, spelled exactly (this is what maps the question to a topic — see `lib/import/taxonomy.ts`)
5. **Difficulty** — `Easy`, `Medium`, or `Hard`

Matching on Domain/Skill ignores case and punctuation, but **not** synonyms — copy these verbatim rather than paraphrasing.

**Domains (Reading & Writing):** Information and Ideas · Craft and Structure · Expression of Ideas · Standard English Conventions

**Domains (Math):** Algebra · Advanced Math · Problem-Solving and Data Analysis · Geometry and Trigonometry

**Skills (Reading & Writing, 10):**
Central Ideas and Details · Inferences · Command of Evidence · Words in Context · Text Structure and Purpose · Cross-Text Connections · Rhetorical Synthesis · Transitions · Boundaries · Form, Structure, and Sense

**Skills (Math, 19):**
Linear equations in one variable · Linear functions · Linear equations in two variables · Systems of two linear equations in two variables · Linear inequalities in one or two variables · Equivalent expressions · Nonlinear equations in one variable and systems of equations in two variables · Nonlinear functions · Ratios, rates, proportional relationships, and units · Percentages · One-variable data: Distributions and measures of center and spread · Two-variable data: Models and scatterplots · Probability and conditional probability · Inference from sample statistics and margin of error · Evaluating statistical claims: Observational studies and experiments · Area and volume · Lines, angles, and triangles · Right triangles and trigonometry · Circles

## Math — write it as LaTeX text, not images

Whenever a formula appears, write it as literal LaTeX in the surrounding text — `$x^2 + 3x - 4 = 0$` inline, `$$...$$` for a standalone/display equation. Never render math as an image, `<sup>`/`<sub>` fragments, or MathML — the parser only extracts plain text, so anything that isn't literal text is lost.

This is the one convention that makes Math-domain banks import as cheaply as Reading & Writing ones: if the math survives as text, the HTML path needs no AI for Math either. If a question can't be transcribed this way (a genuine diagram, not a formula), see **Figures** below instead.

## Passage (optional)

For Reading & Writing questions with a separate stimulus, wrap it before the question:

```html
<div class="passage">
  <p>...</p>
</div>

<h3>Question</h3>
<div class="question-body">
  <p>Which choice completes the text with the most logical...</p>
</div>
```

If omitted, the whole `question-body` is imported as one combined block — which is fine, just less structured.

## Tables

Plain `<table>` with `<thead>`/`<tbody>`, no merged cells:

```html
<table>
  <thead><tr><th>Column A</th><th>Column B</th></tr></thead>
  <tbody>
    <tr><td>...</td><td>...</td></tr>
  </tbody>
</table>
```

This parses into a plain-text row-by-row form (`Row 1: Column A: ...; Column B: ...`) — legible on its own since the practice UI doesn't preserve line breaks. Merged cells (`colspan`/`rowspan`), a nested table, or a row whose cell count doesn't match its headers all still parse, but flag the question for manual review.

## Figures

Embed as a data URI directly in `question-body`:

```html
<figure class="chart">
  <img src="data:image/png;base64,...">
</figure>
```

PNG, JPEG, and WEBP are supported and get automatically uploaded and attached to the question. Any embedded figure always routes the question to manual review — an admin needs to confirm it's the right image before it reaches students — but it no longer has to be attached by hand.

## Grid-in questions

Digital SAT grid-ins have no lettered options — the student types an answer. Replace `<ul class="options">` with:

```html
<h3>Answer Choices</h3>
<div class="grid-in-answer">
  <p class="correct-value">3/2</p>
  <p class="accepted-forms">3/2, 1.5</p>
</div>
```

`accepted-forms` is comma-separated and should list every equivalent written form the official answer key accepts.

## Worked example (real, from a converted bank)

```html
<article class="question" id="q-0147b080">
  <div class="question-header">
    <h2>Question 1</h2>
    <span class="qid">ID: 0147b080</span>
  </div>
  <div class="badges">
    <span class="badge">SAT</span>
    <span class="badge">Reading and Writing</span>
    <span class="badge">Information and Ideas</span>
    <span class="badge">Command of Evidence</span>
    <span class="badge">Easy</span>
  </div>

  <h3>Question</h3>
  <div class="question-body">
    <p>Pyramids in Egypt and the Americas</p>
    <table>
      <thead><tr><th>Pyramid</th><th>Country</th><th>Height (meters)</th></tr></thead>
      <tbody>
        <tr><td>The Great Pyramid</td><td>Mexico</td><td>33</td></tr>
        <tr><td>El Castillo</td><td>Belize</td><td>40</td></tr>
      </tbody>
    </table>
    <p>Consulting the table, el Castillo is ______</p>
  </div>

  <h3>Answer Choices</h3>
  <ul class="options">
    <li class="option"><span class="option-letter">A</span><span class="option-text">33 meters tall.</span></li>
    <li class="option correct"><span class="option-letter">C</span><span class="option-text">40 meters tall.</span> <span class="correct-tag">Correct answer</span></li>
    <li class="option"><span class="option-letter">B</span><span class="option-text">47 meters tall.</span></li>
    <li class="option"><span class="option-letter">D</span><span class="option-text">60 meters tall.</span></li>
  </ul>

  <h3>Rationale</h3>
  <div class="rationale">
    <p>Choice C is the best answer because the table shows el Castillo is 40 meters tall.</p>
  </div>
</article>
```

## What happens after upload

Parsed questions land in the same staging table and review screen the PDF path uses (`import_job_items` → the admin Import review UI). A question with every field intact goes straight to "pending review"; anything ambiguous — missing correct-answer marker, wrong option count, unmapped skill, an embedded figure, an irregular table — is flagged `verification_failed` with a specific reason, the same way the PDF pipeline flags a vision-model disagreement. Approving a reviewed item promotes it into `questions` as a draft; nothing reaches students until it's published from there, same as every other import path.
