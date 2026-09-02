# Math Arena

A web-based math practice and assessment tool built for tutoring fundamentals to Grade 8 students (CAPS curriculum, South Africa).

## Features

### Game View
- **Quiz Mode** -- Timed arithmetic with mixed operations (+, -, x, /), configurable question counts (25/50/100)
- **Times Tables Mode** -- Practice specific tables (1-12 or all), sequential or random order
- **Fractions Mode** -- Simplify, add, subtract, multiply, divide fractions, plus LCM and HCF exercises. Visual stacked fraction display
- **Topic Practice** -- Practice specific topics from the Learn curriculum with instant feedback and answer review

### Test View
- **Topic Selection** -- Choose specific topics from the Grade 8 curriculum to include in the test
- **Time Limit** -- Configurable timer (15/30/45/60/90/120 min) with recommended time highlighting
- **Name Entry** -- Student enters their name before starting
- **CAPS-Aligned Marking** -- Dynamic mark allocation (1-4 marks per question) aligned with DBE norms
- **Auto-Marking** -- Tests are automatically marked with instant results
- **Lock-Out** -- Cannot navigate away during an active test; auto-submits on timeout
- **Visual Geometry** -- All geometry questions display SVG diagrams (triangles, circles, angles, Pythagoras, transformations, 3D prisms) with labeled dimensions
- **PDF Download** -- Download marked test as a styled PDF with full breakdown

### Learn View
- **Grade 8 Curriculum** -- 23 topics across 5 categories: Number Systems, Arithmetic, Algebra, Geometry, Data & Probability
- Each topic includes theory, worked examples, and interactive practice questions
- Practice sessions integrate with the game engine and session report system

### Calculator
- Standard scientific calculator (Windows calculator style layout) with cartoony Sharp EL-W535HT styling
- Trig, inverse trig, log, ln, powers, roots, factorials, memory functions, parentheses, EXP
- Full keyboard support when calculator view is active

### Session Reports
- After completing any activity, users enter their name to save the session
- Sessions are tracked in-memory (no localStorage persistence) with a 15-minute inactivity timeout
- Download all session activities as a styled PDF with per-question breakdowns
- Download button appears in the bottom-right corner after the first activity is completed

## Additional Resources

### Baseline Test Documents
- `grade8_baseline_test.tex` -- Baseline test paper for Grade 8 students (20 marks, 20 minutes). Covers Grade 7 recap and Grade 8 content up to August 2026 (CAPS curriculum)
- `grade8_baseline_memo.tex` -- Marking memorandum with detailed solutions and mark allocation

## Tech

Pure HTML, CSS, and JavaScript -- no frameworks, no build tools. Designed to run as a static site on GitHub Pages. PDF generation uses jsPDF. Session data is stored in-memory only (not persisted to localStorage).
