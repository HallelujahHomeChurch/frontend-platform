# Controlled typography diagnostics

Generated locally from the user-supplied 1739/1740 PDFs. These are privacy-safe
renderer inputs, not a second PDF parser fixture set. Original words, image
pixels, embedded font programs and identifying metadata are absent. Text uses
only `測`, `a`, `i`, `W`, `0`, `.`, and spaces. Page dimensions, text baselines,
font-size classes, role changes and source tracking remain represented.

The generator uses the already-installed bundled pdfplumber locally. CI reads
the generated JSON; it does not need the original PDFs or pdfplumber. Only the
two reviewed back-page regions below 464pt are omitted. This is **not** a
production exclusion rule. `Undefined` is a visually confirmed emphasis font
for these two diagnostic sources only, not a generic font classifier.

Semantic component grouping, original raster title/subtitle reconstruction,
and definitive paragraph/page allocation await the Task 6 production parser.
Do not describe this diagnostic corpus as a final visual or publication gate.
The current runner correctly reports unresolved substitution/allocation
overflow; it does not shrink or truncate those lines.
