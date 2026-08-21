/* ============================================
   Math Arena - App Controller
   Game logic + Calculator UI
   ============================================ */

(function () {
    'use strict';

    /* =========================================================
       VIEW MANAGEMENT
       ========================================================= */
    const $gameView = document.getElementById('gameView');
    const $calcView = document.getElementById('calcView');
    const $navTabs = document.querySelectorAll('.nav-tab');

    function switchView(view) {
        $navTabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));
        if (view === 'game') {
            $gameView.classList.add('active');
            $calcView.classList.remove('active');
        } else {
            $calcView.classList.add('active');
            $gameView.classList.remove('active');
        }
    }

    document.querySelector('.top-nav').addEventListener('click', (e) => {
        const tab = e.target.closest('.nav-tab');
        if (tab) switchView(tab.dataset.view);
    });

    /* =========================================================
       GAME - STATE
       ========================================================= */
    const game = {
        active: false,
        questions: [],
        currentIndex: 0,
        score: 0,
        answers: [],
        startTime: null,
        timerInterval: null,
        elapsed: 0,
        settings: { count: 25, operation: 'mixed', mode: 'quiz', ttTable: 'all', ttOrder: 'sequential', ttCount: 12, fracType: 'simplify', fracCount: 12 },
        locked: false
    };

    // DOM
    const $menuScreen = document.getElementById('menuScreen');
    const $gameScreen = document.getElementById('gameScreen');
    const $resultsScreen = document.getElementById('resultsScreen');
    const $startBtn = document.getElementById('startBtn');
    const $hudScore = document.getElementById('hudScore');
    const $hudProgress = document.getElementById('hudProgress');
    const $hudTime = document.getElementById('hudTime');
    const $progressFill = document.getElementById('progressFill');
    const $questionCard = document.getElementById('questionCard');
    const $questionText = document.getElementById('questionText');
    const $answerInput = document.getElementById('answerInput');
    const $submitBtn = document.getElementById('submitBtn');
    const $feedback = document.getElementById('feedback');
    const $quitBtn = document.getElementById('quitBtn');
    const $scorePct = document.getElementById('scorePct');
    const $statCorrect = document.getElementById('statCorrect');
    const $statWrong = document.getElementById('statWrong');
    const $statTime = document.getElementById('statTime');
    const $statAvg = document.getElementById('statAvg');
    const $reviewList = document.getElementById('reviewList');
    const $playAgainBtn = document.getElementById('playAgainBtn');
    const $changeModeBtn = document.getElementById('changeModeBtn');

    /* =========================================================
       GAME - MENU
       ========================================================= */
    // Option button handlers (works for all groups)
    document.querySelectorAll('.opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.dataset.group;
            document.querySelectorAll(`.opt-btn[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const keyMap = { count: 'count', operation: 'operation', ttOrder: 'ttOrder', ttCount: 'ttCount', fracType: 'fracType', fracCount: 'fracCount' };
            const key = keyMap[group];
            if (key) game.settings[key] = (key === 'count' || key === 'ttCount' || key === 'fracCount') ? parseInt(btn.dataset.val) : btn.dataset.val;
        });
    });

    // Carousel tab switching
    document.querySelectorAll('.carousel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.carousel-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const mode = tab.dataset.mode;
            game.settings.mode = mode; // 'quiz', 'timestables', or 'fractions'
            document.querySelectorAll('.carousel-panel').forEach(p => p.classList.remove('active'));
            document.querySelector(`.carousel-panel[data-panel="${mode}"]`).classList.add('active');
        });
    });

    // Table picker
    document.querySelectorAll('.tp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tp-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            game.settings.ttTable = btn.dataset.table;
        });
    });

    function showScreen(screen) {
        [$menuScreen, $gameScreen, $resultsScreen].forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    $startBtn.addEventListener('click', startGame);
    $quitBtn.addEventListener('click', () => {
        endGame();
        showScreen($menuScreen);
    });
    $playAgainBtn.addEventListener('click', startGame);
    $changeModeBtn.addEventListener('click', () => showScreen($menuScreen));

    /* =========================================================
       GAME - QUESTION GENERATION
       ========================================================= */
    function generateQuestions() {
        const s = game.settings;
        const questions = [];

        if (s.mode === 'timestables') {
            const count = s.ttCount;
            const table = s.ttTable; // 'all' or '1'-'12'
            const order = s.ttOrder; // 'sequential' or 'random'

            // Build the pool of pairs
            let pairs = [];
            if (table === 'all') {
                for (let a = 1; a <= 12; a++) {
                    for (let b = 1; b <= 12; b++) {
                        pairs.push({ a, b });
                    }
                }
            } else {
                const n = parseInt(table);
                for (let b = 1; b <= 12; b++) {
                    pairs.push({ a: n, b });
                }
            }

            if (order === 'sequential') {
                for (let i = 0; i < count; i++) {
                    const pair = pairs[i % pairs.length];
                    questions.push({ text: `${pair.a} \u00D7 ${pair.b}`, answer: pair.a * pair.b, op: '*' });
                }
            } else {
                // Shuffle the pairs, then take count (with wrap-around if needed)
                const shuffled = shuffleArray([...pairs]);
                for (let i = 0; i < count; i++) {
                    const pair = shuffled[i % shuffled.length];
                    questions.push({ text: `${pair.a} \u00D7 ${pair.b}`, answer: pair.a * pair.b, op: '*' });
                }
            }
        } else if (s.mode === 'fractions') {
            for (let i = 0; i < s.fracCount; i++) {
                questions.push(generateFractionQuestion(s.fracType));
            }
        } else {
            // Quiz mode
            for (let i = 0; i < s.count; i++) {
                questions.push(generateRandomQuestion(s.operation));
            }
        }

        return questions;
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /* ---- Fraction Utilities ---- */
    const fracUtils = {
        gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; },
        lcm(a, b) { return Math.abs(a * b) / this.gcd(a, b); },
        hcf(a, b) { return this.gcd(a, b); },
        parseFraction(str) {
            str = str.trim();
            if (str.includes('/')) {
                const parts = str.split('/');
                if (parts.length !== 2) return null;
                const num = parseInt(parts[0].trim());
                const den = parseInt(parts[1].trim());
                if (isNaN(num) || isNaN(den) || den === 0) return null;
                return { num, den };
            }
            const n = parseFloat(str);
            if (isNaN(n)) return null;
            return { num: n, den: 1 };
        },
        fracEqual(a, b) {
            return Math.abs(a.num * b.den - b.num * a.den) < 0.01;
        },
        simplify(num, den) {
            if (den === 0) return { num, den };
            const g = this.gcd(Math.abs(num), Math.abs(den));
            let sn = num / g, sd = den / g;
            if (sd < 0) { sn = -sn; sd = -sd; }
            return { num: sn, den: sd };
        }
    };

    function generateFractionQuestion(type) {
        switch (type) {
            case 'lcm': return genLCM();
            case 'hcf': return genHCF();
            case 'simplify': return genSimplify();
            case 'add': return genFracAdd();
            case 'subtract': return genFracSub();
            case 'multiply': return genFracMul();
            case 'divide': return genFracDiv();
            default: return genSimplify();
        }
    }

    function genLCM() {
        const a = randInt(2, 20), b = randInt(2, 20);
        return { text: `LCM(${a}, ${b})`, answer: fracUtils.lcm(a, b), isFraction: false };
    }
    function genHCF() {
        const a = randInt(2, 50), b = randInt(2, 50);
        return { text: `HCF(${a}, ${b})`, answer: fracUtils.hcf(a, b), isFraction: false };
    }
    function genSimplify() {
        const d = randInt(1, 8), n = randInt(1, d - 1 || 1);
        const g = fracUtils.gcd(n, d);
        const rn = n / g, rd = d / g;
        if (rn === rd || rn === 0) return genSimplify();
        const mult = randInt(2, 5);
        return {
            text: `Simplify ${rn * mult}/${rd * mult}`,
            answer: { num: rn, den: rd },
            isFraction: true
        };
    }
    function genFracAdd() { return genFracArith('+'); }
    function genFracSub() { return genFracArith('-'); }
    function genFracArith(op) {
        const d1 = randInt(2, 8), n1 = randInt(1, d1 * 2 - 1);
        const d2 = randInt(2, 8), n2 = randInt(1, d2 * 2 - 1);
        const cd = fracUtils.lcm(d1, d2);
        let rn, rd;
        if (op === '+') {
            rn = n1 * (cd / d1) + n2 * (cd / d2);
        } else {
            rn = n1 * (cd / d1) - n2 * (cd / d2);
        }
        rd = cd;
        const s = fracUtils.simplify(rn, rd);
        const sym = op === '+' ? '+' : '-';
        return {
            text: `${n1}/${d1} ${sym} ${n2}/${d2}`,
            answer: { num: s.num, den: s.den },
            isFraction: true
        };
    }
    function genFracMul() {
        const d1 = randInt(2, 8), n1 = randInt(1, d1 + 3);
        const d2 = randInt(2, 8), n2 = randInt(1, d2 + 3);
        const s = fracUtils.simplify(n1 * n2, d1 * d2);
        return {
            text: `${n1}/${d1} \u00D7 ${n2}/${d2}`,
            answer: { num: s.num, den: s.den },
            isFraction: true
        };
    }
    function genFracDiv() {
        const d1 = randInt(2, 8), n1 = randInt(1, d1 + 3);
        const d2 = randInt(2, 8), n2 = randInt(1, d2 + 3);
        const s = fracUtils.simplify(n1 * d2, d1 * n2);
        return {
            text: `${n1}/${d1} \u00F7 ${n2}/${d2}`,
            answer: { num: s.num, den: s.den },
            isFraction: true
        };
    }

    function generateRandomQuestion(operation) {
        let op = operation;
        if (op === 'mixed') {
            const ops = ['+', '-', '*', '/'];
            op = ops[randInt(0, 3)];
        }

        let a, b, answer, text;

        switch (op) {
            case '+':
                a = randInt(2, 99);
                b = randInt(2, 99);
                answer = a + b;
                text = `${a} + ${b}`;
                break;
            case '-':
                a = randInt(2, 99);
                b = randInt(2, a); // ensure non-negative result
                answer = a - b;
                text = `${a} - ${b}`;
                break;
            case '*':
                a = randInt(2, 12);
                b = randInt(2, 12);
                answer = a * b;
                text = `${a} \u00D7 ${b}`;
                break;
            case '/':
                b = randInt(2, 12);
                answer = randInt(2, 12);
                a = b * answer; // ensures clean division
                text = `${a} \u00F7 ${b}`;
                break;
        }

        return { text, answer, op };
    }

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /* =========================================================
       GAME - PLAY
       ========================================================= */
    function startGame() {
        game.questions = generateQuestions();
        game.currentIndex = 0;
        game.score = 0;
        game.answers = [];
        game.elapsed = 0;
        game.active = true;
        game.locked = false;

        showScreen($gameScreen);
        showQuestion();
        startTimer();
        $answerInput.value = '';
        $answerInput.className = 'answer-input';
        $feedback.textContent = '';
        $feedback.className = 'feedback';
        $questionCard.className = 'question-card';
        setTimeout(() => $answerInput.focus(), 100);
    }

    function showQuestion() {
        const q = game.questions[game.currentIndex];
        $questionText.innerHTML = renderQuestionHTML(q);
        $hudScore.textContent = game.score;
        $hudProgress.textContent = `${game.currentIndex + 1}/${game.questions.length}`;
        $progressFill.style.width = `${((game.currentIndex) / game.questions.length) * 100}%`;
        $answerInput.value = '';
        $answerInput.className = 'answer-input';
        $answerInput.placeholder = q.isFraction ? 'a/b' : '?';
        $answerInput.inputMode = q.isFraction ? 'text' : 'numeric';
        $feedback.textContent = '';
        $feedback.className = 'feedback';
        $questionCard.className = 'question-card';
    }

    /* Render question text with visual stacked fractions */
    function renderQuestionHTML(q) {
        const suffix = ' = ?';
        if (!q.isFraction) return q.text + suffix;
        return fracToHTML(q.text) + suffix;
    }

    /* Convert a/b patterns in text to stacked fraction HTML */
    function fracToHTML(text) {
        return text.replace(/(\d+)\/(\d+)/g, '<span class="frac-display"><span class="frac-num">$1</span><span class="frac-den">$2</span></span>');
    }

    function submitAnswer() {
        if (!game.active || game.locked) return;

        const val = $answerInput.value.trim();
        if (val === '') return;

        game.locked = true;
        const q = game.questions[game.currentIndex];
        let correct = false;
        let userDisplay = val;
        let answerDisplay = q.answer;

        if (q.isFraction) {
            const parsed = fracUtils.parseFraction(val);
            if (!parsed) { game.locked = false; return; }
            correct = fracUtils.fracEqual(parsed, q.answer);
            answerDisplay = q.answer.den === 1 ? q.answer.num : `${q.answer.num}/${q.answer.den}`;
        } else {
            const userAnswer = parseFloat(val);
            if (isNaN(userAnswer)) { game.locked = false; return; }
            correct = Math.abs(userAnswer - q.answer) < 0.01;
        }

        game.answers.push({
            question: q.text,
            correctAnswer: answerDisplay,
            userAnswer: userDisplay,
            correct: correct
        });

        if (correct) {
            game.score++;
            $hudScore.textContent = game.score;
            $questionCard.classList.add('correct');
            $answerInput.classList.add('correct');
            $feedback.textContent = 'Correct!';
            $feedback.classList.add('correct');
        } else {
            $questionCard.classList.add('wrong');
            $answerInput.classList.add('wrong');
            $feedback.innerHTML = `Wrong &ndash; answer: ${fracToHTML(String(answerDisplay))}`;
            $feedback.classList.add('wrong');
        }

        // Update progress bar to include this question
        $progressFill.style.width = `${((game.currentIndex + 1) / game.questions.length) * 100}%`;

        setTimeout(() => {
            game.currentIndex++;
            game.locked = false;

            if (game.currentIndex >= game.questions.length) {
                endGame();
                showResults();
            } else {
                showQuestion();
                $answerInput.focus();
            }
        }, correct ? 600 : 1200);
    }

    $submitBtn.addEventListener('click', submitAnswer);
    $answerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitAnswer();
        }
    });

    /* =========================================================
       GAME - TIMER
       ========================================================= */
    function startTimer() {
        game.startTime = Date.now();
        game.timerInterval = setInterval(() => {
            game.elapsed = Math.floor((Date.now() - game.startTime) / 1000);
            $hudTime.textContent = formatTime(game.elapsed);
        }, 200);
    }

    function stopTimer() {
        if (game.timerInterval) {
            clearInterval(game.timerInterval);
            game.timerInterval = null;
        }
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    /* =========================================================
       GAME - END & RESULTS
       ========================================================= */
    function endGame() {
        game.active = false;
        stopTimer();
    }

    function showResults() {
        showScreen($resultsScreen);

        const total = game.questions.length;
        const correct = game.score;
        const wrong = total - correct;
        const pct = Math.round((correct / total) * 100);
        const avgTime = total > 0 ? (game.elapsed / total).toFixed(1) : '0.0';

        $scorePct.textContent = `${pct}%`;
        $statCorrect.textContent = correct;
        $statWrong.textContent = wrong;
        $statTime.textContent = formatTime(game.elapsed);
        $statAvg.textContent = `${avgTime}s`;

        // Color the score circle based on performance
        const circle = document.getElementById('scoreCircle');
        if (pct >= 90) {
            circle.style.borderColor = 'var(--green)';
            $scorePct.style.color = 'var(--green)';
        } else if (pct >= 60) {
            circle.style.borderColor = 'var(--gold)';
            $scorePct.style.color = 'var(--gold)';
        } else {
            circle.style.borderColor = 'var(--red)';
            $scorePct.style.color = 'var(--red)';
        }

        // Review list
        let reviewHtml = '';
        game.answers.forEach((a, i) => {
            const cls = a.correct ? 'right' : 'wrong';
            const userFrac = fracToHTML(String(a.userAnswer));
            const correctFrac = fracToHTML(String(a.correctAnswer));
            const questionFrac = fracToHTML(a.question);
            const display = a.correct
                ? userFrac
                : `${userFrac} <span class="ri-was">(was</span> ${correctFrac}<span class="ri-was">)</span>`;
            reviewHtml += `<div class="review-item">
                <span class="ri-q">${i + 1}. ${questionFrac} =</span>
                <span class="ri-a ${cls}">${display}</span>
            </div>`;
        });
        $reviewList.innerHTML = reviewHtml;
    }

    /* =========================================================
       CALCULATOR - ENGINE & UI
       ========================================================= */
    const engine = new CalculatorEngine();

    // Calculator DOM
    const $expr = document.getElementById('expression');
    const $result = document.getElementById('result');
    const $indShift = document.getElementById('ind-shift');
    const $indMode = document.getElementById('ind-mode');
    const $indDrg = document.getElementById('ind-drg');
    const $indMem = document.getElementById('ind-mem');
    const $indHyp = document.getElementById('ind-hyp');
    const $indStore = document.getElementById('ind-store');
    const $helpBtn = document.getElementById('helpBtn');
    const $overlay = document.getElementById('tutorialOverlay');
    const $tutContent = document.getElementById('tutorialContent');
    const $tutClose = document.getElementById('tutorialClose');
    const $statPanel = document.getElementById('statPanel');
    const $statType = document.getElementById('statType');
    const $statCalc = document.getElementById('statCalc');
    const $statClear = document.getElementById('statClear');
    const $statClose = document.getElementById('statClose');
    const $statColumns = document.getElementById('statColumns');

    function updateCalcDisplay() {
        $expr.innerHTML = engine.renderExpression();
        $result.textContent = engine.result;
        $result.classList.toggle('error', engine.result === 'ERROR');
        $indShift.classList.toggle('active', engine.shiftActive);
        $indMode.textContent = engine.calcMode;
        $indDrg.textContent = engine.angleMode;
        $indMem.classList.toggle('active', engine.memoryActive);
        $indHyp.classList.toggle('active', false);
        $indStore.classList.toggle('active', false);
    }

    /* ---- Calculator Button Actions ---- */
    const actionHandlers = {
        'num': (btn) => engine.inputNumber(btn.dataset.val),
        'decimal': () => engine.inputDecimal(),
        'add': () => engine.inputOperator('add'),
        'sub': () => engine.inputOperator('sub'),
        'mul': () => engine.inputOperator('mul'),
        'div': () => engine.inputOperator('div'),
        'equals': () => engine.evaluate(),
        'ac': () => engine.clearAll(),
        'del': () => engine.deleteToken(),
        'backspace': () => engine.backspace(),
        'home': () => engine.home(),
        'sin': () => engine.inputFunction('sin'),
        'cos': () => engine.inputFunction('cos'),
        'tan': () => engine.inputFunction('tan'),
        'sin-inv': () => engine.inputFunction('sin-inv'),
        'cos-inv': () => engine.inputFunction('cos-inv'),
        'tan-inv': () => engine.inputFunction('tan-inv'),
        'log': () => engine.inputFunction('log'),
        'ln': () => engine.inputFunction('ln'),
        'sqrt': () => engine.inputFunction('sqrt'),
        'cbrt': () => engine.inputFunction('cbrt'),
        'square': () => engine.inputFunction('square'),
        'cube': () => engine.inputFunction('cube'),
        'power': () => engine.inputPower(),
        'exp10': () => engine.inputFunction('exp10'),
        'expE': () => engine.inputFunction('expE'),
        'recip': () => engine.inputFunction('recip'),
        'recip-sqrt': () => engine.inputFunction('recip-sqrt'),
        'neg': () => engine.inputFunction('neg'),
        'factorial': () => engine.inputFunction('factorial'),
        'abs': () => engine.inputFunction('abs'),
        'percent': () => engine.inputPercent(),
        'lparen': () => engine.inputLParen(),
        'rparen': () => engine.inputRParen(),
        'fraction': () => engine.inputFraction(),
        'exp': () => engine.inputExp(),
        'pi': () => engine.inputConstant('pi'),
        'euler': () => engine.inputConstant('euler'),
        'ans': () => engine.inputAns(),
        'left': () => engine.moveCursorLeft(),
        'right': () => engine.moveCursorRight(),
        'mem-clear': () => engine.memoryClear(),
        'mem-recall': () => engine.memoryRecall(),
        'mem-store': () => engine.memoryStore(),
        'mem-plus': () => engine.memoryAdd(),
        'mem-minus': () => engine.memorySubtract(),
        'shift': () => { engine.shiftActive = !engine.shiftActive; engine.alphaActive = false; },
        'alpha': () => { engine.alphaActive = !engine.alphaActive; engine.shiftActive = false; },
        'drg': () => engine.cycleAngleMode(),
        'mode': () => {
            const newMode = engine.cycleCalcMode();
            if (newMode === 'STAT') openStatPanel();
            else if (newMode === 'DRILL') startCalcDrill();
            else { closeStatPanel(); closeCalcDrill(); }
        },
        'drill': () => { engine.setCalcMode('DRILL'); startCalcDrill(); }
    };

    document.querySelector('.buttons').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn');
        if (!btn) return;
        const action = btn.dataset.action;
        if (actionHandlers[action]) {
            actionHandlers[action](btn);
            updateCalcDisplay();
            btn.style.transform = 'translateY(3px) scale(0.95)';
            setTimeout(() => { btn.style.transform = ''; }, 100);
        }
    });

    /* ---- Calculator Keyboard ---- */
    document.addEventListener('keydown', (e) => {
        // Only handle keyboard when calculator view is active
        if (!$calcView.classList.contains('active')) return;
        if ($overlay.classList.contains('open')) return;
        if ($statPanel.classList.contains('open') && document.activeElement.tagName === 'INPUT') return;

        const key = e.key;
        if (key >= '0' && key <= '9') { engine.inputNumber(key); updateCalcDisplay(); }
        else if (key === '.') { engine.inputDecimal(); updateCalcDisplay(); }
        else if (key === '+') { engine.inputOperator('add'); updateCalcDisplay(); }
        else if (key === '-') { engine.inputOperator('sub'); updateCalcDisplay(); }
        else if (key === '*') { engine.inputOperator('mul'); updateCalcDisplay(); }
        else if (key === '/') { e.preventDefault(); engine.inputOperator('div'); updateCalcDisplay(); }
        else if (key === 'Enter' || key === '=') { e.preventDefault(); engine.evaluate(); updateCalcDisplay(); }
        else if (key === 'Backspace') { engine.backspace(); updateCalcDisplay(); }
        else if (key === 'Delete') { engine.deleteToken(); updateCalcDisplay(); }
        else if (key === 'Escape') { engine.clearAll(); updateCalcDisplay(); }
        else if (key === 'ArrowLeft') { engine.moveCursorLeft(); updateCalcDisplay(); }
        else if (key === 'ArrowRight') { engine.moveCursorRight(); updateCalcDisplay(); }
        else if (key === '(') { engine.inputLParen(); updateCalcDisplay(); }
        else if (key === ')') { engine.inputRParen(); updateCalcDisplay(); }
        else if (key === '^') { engine.inputPower(); updateCalcDisplay(); }
        else if (key === '!') { engine.inputFunction('factorial'); updateCalcDisplay(); }
        else if (key === '%') { engine.inputPercent(); updateCalcDisplay(); }
        else if (key === 'p') { engine.inputConstant('pi'); updateCalcDisplay(); }
    });

    /* ---- Calculator Tutorial ---- */
    const tutorialSections = {
        'getting-started': `<h3>Sharp EL-W535HT Simulator</h3>
            <p>A fully functional scientific calculator with WriteView display, replicating 422 functions in a web format.</p>
            <h4>Key Features</h4>
            <ul><li>422 functions: trig, log, stats, and more</li>
            <li>WriteView display for textbook-style input</li>
            <li>3 modes: NORMAL, STAT, DRILL</li>
            <li>DRG support: DEG, RAD, GRA</li>
            <li>Memory: MC, MR, MS, M+, M-</li>
            <li>Full keyboard support</li></ul>
            <div class="example"><strong>Try:</strong> Type expressions naturally. The calculator follows standard order of operations.</div>`,
        'basic-math': `<h3>Basic Math</h3>
            <ul><li><span class="key-hint">+</span> <span class="key-hint">-</span> <span class="key-hint">&times;</span> <span class="key-hint">&divide;</span> - Four operations</li>
            <li><span class="key-hint">(</span> <span class="key-hint">)</span> - Parentheses</li>
            <li><span class="key-hint">(-)</span> - Negative numbers</li>
            <li><span class="key-hint">EXP</span> - Scientific notation</li>
            <li><span class="key-hint">x!</span> - Factorial</li>
            <li><span class="key-hint">|x|</span> - Absolute value</li>
            <li><span class="key-hint">Ans</span> - Last answer</li></ul>
            <div class="example"><strong>Example:</strong> (2+3)&times;4 = 20</div>`,
        'scientific': `<h3>Scientific Functions</h3>
            <h4>Trigonometry</h4>
            <ul><li>sin, cos, tan and their inverses</li>
            <li>Use <span class="key-hint">DRG</span> to switch DEG/RAD/GRA</li></ul>
            <h4>Logarithms</h4>
            <ul><li><span class="key-hint">log</span> - Base 10</li>
            <li><span class="key-hint">ln</span> - Natural log</li>
            <li><span class="key-hint">10<sup>x</sup></span> / <span class="key-hint">e<sup>x</sup></span> - Antilogs</li></ul>
            <h4>Powers & Roots</h4>
            <ul><li>x<sup>2</sup>, x<sup>3</sup>, x<sup>y</sup></li>
            <li>Square root, cube root</li>
            <li>1/x reciprocal</li></ul>
            <div class="example"><strong>Example:</strong> 2^10 = 1024</div>`,
        'stat-mode': `<h3>STAT Mode</h3>
            <p>Press <span class="key-hint">MODE</span> to enter STAT mode.</p>
            <ul><li><strong>1-Variable:</strong> mean, median, mode, std dev, variance, min/max</li>
            <li><strong>Linear Regression:</strong> y = a + bx with r, r&sup2;</li>
            <li><strong>Quadratic Regression:</strong> y = a + bx + cx&sup2;</li></ul>`,
        'drill-mode': `<h3>DRILL Mode</h3>
            <p>Random arithmetic problems for practice. Press <span class="key-hint">DRILL</span> to start.</p>
            <ul><li>Addition, subtraction, multiplication</li>
            <li>Type your answer and press =</li>
            <li>Auto-generates next problem</li></ul>`,
        'memory': `<h3>Memory</h3>
            <ul><li><span class="key-hint">MC</span> Clear</li>
            <li><span class="key-hint">MR</span> Recall</li>
            <li><span class="key-hint">MS</span> Store</li>
            <li><span class="key-hint">M+</span> Add to memory</li>
            <li><span class="key-hint">M-</span> Subtract from memory</li></ul>
            <div class="example"><strong>Ans</strong> recalls the last calculation result.</div>`,
        'keyboard': `<h3>Keyboard Shortcuts</h3>
            <ul><li><span class="key-hint">0-9</span> Digits</li>
            <li><span class="key-hint">+ - * /</span> Operators</li>
            <li><span class="key-hint">Enter</span> Evaluate</li>
            <li><span class="key-hint">Backspace</span> Delete</li>
            <li><span class="key-hint">Esc</span> Clear all</li>
            <li><span class="key-hint">^</span> Power</li>
            <li><span class="key-hint">!</span> Factorial</li>
            <li><span class="key-hint">p</span> Pi</li>
            <li><span class="key-hint">( )</span> Parentheses</li></ul>`
    };

    document.querySelectorAll('.tut-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tut-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            $tutContent.innerHTML = tutorialSections[tab.dataset.tab] || '';
        });
    });

    $helpBtn.addEventListener('click', () => {
        $overlay.classList.add('open');
        if (!$tutContent.innerHTML.trim()) $tutContent.innerHTML = tutorialSections['getting-started'];
    });
    $tutClose.addEventListener('click', () => $overlay.classList.remove('open'));
    $overlay.addEventListener('click', (e) => { if (e.target === $overlay) $overlay.classList.remove('open'); });
    $tutContent.innerHTML = tutorialSections['getting-started'];

    /* ---- STAT Panel ---- */
    let statDataPoints = [];
    let filledEntryCount = 0;

    function openStatPanel() {
        $statPanel.classList.add('open');
        statDataPoints = []; filledEntryCount = 0;
        updateStatEntries();
        document.getElementById('statResult').innerHTML = '';
    }
    function closeStatPanel() { $statPanel.classList.remove('open'); }

    function updateStatEntries() {
        const type = $statType.value;
        const needsY = type === 'linear' || type === 'quadratic';
        if (needsY) {
            $statColumns.innerHTML = `
                <div class="stat-col"><div class="stat-col-header">x</div><div class="stat-entries" id="statEntriesX"></div></div>
                <div class="stat-col"><div class="stat-col-header">y</div><div class="stat-entries" id="statEntriesY"></div></div>`;
        } else {
            $statColumns.innerHTML = `<div class="stat-col"><div class="stat-col-header">x</div><div class="stat-entries" id="statEntries"></div></div>`;
        }
        renderStatInputs();
    }

    function renderStatInputs() {
        const type = $statType.value;
        const needsY = type === 'linear' || type === 'quadratic';
        const inputCount = Math.max(statDataPoints.length + 3, 5);
        if (needsY) {
            const xCol = document.getElementById('statEntriesX');
            const yCol = document.getElementById('statEntriesY');
            if (!xCol || !yCol) return;
            xCol.innerHTML = ''; yCol.innerHTML = '';
            for (let i = 0; i < inputCount; i++) {
                const xv = statDataPoints[i] ? statDataPoints[i].x : '';
                const yv = statDataPoints[i] ? statDataPoints[i].y : '';
                xCol.innerHTML += `<div class="stat-entry"><span class="stat-idx">${i+1}</span><input type="text" data-idx="${i}" data-field="x" value="${xv}" placeholder="---"></div>`;
                yCol.innerHTML += `<div class="stat-entry"><span class="stat-idx">${i+1}</span><input type="text" data-idx="${i}" data-field="y" value="${yv}" placeholder="---"></div>`;
            }
        } else {
            const col = document.getElementById('statEntries');
            if (!col) return;
            col.innerHTML = '';
            for (let i = 0; i < inputCount; i++) {
                const xv = statDataPoints[i] ? statDataPoints[i].x : '';
                col.innerHTML += `<div class="stat-entry"><span class="stat-idx">${i+1}</span><input type="text" data-idx="${i}" data-field="x" value="${xv}" placeholder="---"></div>`;
            }
        }
        document.querySelectorAll('.stat-entry input').forEach(input => input.addEventListener('input', handleStatInput));
    }

    function handleStatInput(e) {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        const val = parseFloat(e.target.value);
        if (!statDataPoints[idx]) statDataPoints[idx] = { x: 0, y: 0 };
        if (!isNaN(val)) statDataPoints[idx][field] = val;
        if (e.target.value !== '') filledEntryCount = Math.max(filledEntryCount, idx + 1);
        const totalInputs = document.querySelectorAll('.stat-entry input').length;
        const colCount = needsY() ? 2 : 1;
        const rowCount = totalInputs / colCount;
        if (e.target.value !== '' && idx >= rowCount - 1) {
            statDataPoints.push({ x: 0, y: 0 });
            renderStatInputs();
        }
        function needsY() { const t = $statType.value; return t === 'linear' || t === 'quadratic'; }
    }

    $statType.addEventListener('change', () => { engine.statSetType($statType.value); updateStatEntries(); });

    $statCalc.addEventListener('click', () => {
        const type = $statType.value;
        const needsY = type === 'linear' || type === 'quadratic';
        const xData = [], yData = [];
        statDataPoints.forEach((pt, idx) => {
            if (idx < filledEntryCount) { xData.push(pt.x); if (needsY) yData.push(pt.y); }
        });
        if (xData.length === 0) { document.getElementById('statResult').innerHTML = '<span style="color:#c62828">No data.</span>'; return; }
        engine.statData = { x: xData, y: needsY ? yData : [] };
        engine.statSetType(type);
        const r = engine.statCalculate();
        if (r.error) { document.getElementById('statResult').innerHTML = `<span style="color:#c62828">${r.error}</span>`; return; }
        let html = '';
        if (type === '1var') {
            html = `<div><span class="stat-val">n = ${r.n}</span></div>
                <div><span class="stat-val">Sum = ${engine._formatNumber(r.sum)}</span></div>
                <div><span class="stat-val">Mean = ${engine._formatNumber(r.mean)}</span></div>
                <div><span class="stat-val">Median = ${engine._formatNumber(r.median)}</span></div>
                ${r.mode ? `<div><span class="stat-val">Mode = ${r.mode.join(', ')}</span></div>` : ''}
                <div><span class="stat-val">Std Dev (pop) = ${engine._formatNumber(r.populationStdDev)}</span></div>
                <div><span class="stat-val">Std Dev (sample) = ${engine._formatNumber(r.sampleStdDev)}</span></div>
                <div><span class="stat-val">Min = ${engine._formatNumber(r.min)}</span></div>
                <div><span class="stat-val">Max = ${engine._formatNumber(r.max)}</span></div>
                <div><span class="stat-val">Range = ${engine._formatNumber(r.range)}</span></div>`;
        } else if (type === 'linear') {
            html = `<div><span class="stat-val">n = ${r.n}</span></div>
                <div><span class="stat-val">${r.formula}</span></div>
                <div><span class="stat-val">a = ${engine._formatNumber(r.a)}</span></div>
                <div><span class="stat-val">b = ${engine._formatNumber(r.b)}</span></div>
                <div><span class="stat-val">r = ${engine._formatNumber(r.r)}</span></div>
                <div><span class="stat-val">r&sup2; = ${engine._formatNumber(r.r2)}</span></div>`;
        } else {
            html = `<div><span class="stat-val">n = ${r.n}</span></div>
                <div><span class="stat-val">${r.formula}</span></div>
                <div><span class="stat-val">a = ${engine._formatNumber(r.a)}</span></div>
                <div><span class="stat-val">b = ${engine._formatNumber(r.b)}</span></div>
                <div><span class="stat-val">c = ${engine._formatNumber(r.c)}</span></div>`;
        }
        document.getElementById('statResult').innerHTML = html;
    });

    $statClear.addEventListener('click', () => { statDataPoints = []; filledEntryCount = 0; engine.statClearData(); updateStatEntries(); document.getElementById('statResult').innerHTML = ''; });
    $statClose.addEventListener('click', () => { closeStatPanel(); engine.setCalcMode('NORMAL'); updateCalcDisplay(); });

    /* ---- Calculator Drill Mode ---- */
    let calcDrillProblem = null;
    let calcDrillActive = false;
    let calcDrillTimer = null;

    function startCalcDrill() {
        calcDrillActive = true;
        showNextCalcDrill();
    }
    function showNextCalcDrill() {
        if (calcDrillTimer) { clearTimeout(calcDrillTimer); calcDrillTimer = null; }
        calcDrillProblem = engine.generateDrillProblem();
        engine.tokens = []; engine.cursor = 0; engine.result = '0'; engine.justEvaluated = false;
        $expr.innerHTML = `<span style="color:#5c6bc0;font-weight:600">${calcDrillProblem.question} = ?</span>`;
        $result.textContent = 'Your answer:'; $result.classList.remove('error');
    }
    function checkCalcDrillAnswer() {
        if (!calcDrillActive || !calcDrillProblem) return false;
        let s = '';
        for (const t of engine.tokens) {
            if (t.type === 'number') s += t.value;
            else if (t.type === 'operator' && (t.value === '-' || t.value === '+')) s += t.value;
            else return false;
        }
        const a = parseFloat(s);
        if (isNaN(a)) return false;
        if (Math.abs(a - calcDrillProblem.answer) < 0.001) { engine.result = 'Correct!'; $result.classList.remove('error'); }
        else { engine.result = `Wrong! Answer: ${calcDrillProblem.answer}`; $result.classList.add('error'); }
        updateCalcDisplay();
        calcDrillTimer = setTimeout(showNextCalcDrill, 2000);
        return true;
    }
    function closeCalcDrill() { calcDrillActive = false; calcDrillProblem = null; if (calcDrillTimer) { clearTimeout(calcDrillTimer); calcDrillTimer = null; } }

    /* ---- Init ---- */
    updateCalcDisplay();

})();
