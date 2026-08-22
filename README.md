# Math Arena

A web-based math practice tool built for tutoring fundamentals to students. Full intended functionality is in place; small updates may still occur.

## Features

### Game View
- **Quiz Mode** -- Timed arithmetic with mixed operations (+, -, x, /), configurable question counts (25/50/100)
- **Times Tables Mode** -- Practice specific tables (1-12 or all), sequential or random order. Question count selector only appears when "All" is chosen
- **Fractions Mode** -- Simplify, add, subtract, multiply, divide fractions, plus LCM and HCF exercises (Grade 8 level difficulty). Visual stacked fraction display

### Learn View
- **Grade 8 Curriculum** -- 23 topics across 5 categories: Number Systems, Arithmetic, Algebra, Geometry, Data & Probability
- Each topic includes theory, worked examples, and interactive practice questions
- Practice sessions integrate with the game engine and report system

### Calculator
- Standard scientific calculator (Windows calculator style layout) with cartoony Sharp EL-W535HT styling
- Trig, inverse trig, log, ln, powers, roots, factorials, memory functions, parentheses, EXP
- Full keyboard support when calculator view is active

### Reports
- After completing any practice session, users enter their name before returning to the menu
- All sessions are stored locally (name, date, mode, topic, score, time, and per-question breakdown)
- Hidden reports page accessible via triple-click at the bottom center of the page
- Filter reports by name and date range
- Download filtered reports as CSV with full answer details

## Tech

Pure HTML, CSS, and JavaScript -- no frameworks, no build tools. Designed to run as a static site on GitHub Pages. All data is stored in the browser via localStorage.
