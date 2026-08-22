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
    const $learnView = document.getElementById('learnView');
    const $calcView = document.getElementById('calcView');
    const $navTabs = document.querySelectorAll('.nav-tab');

    function switchView(view) {
        $navTabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));
        $gameView.classList.toggle('active', view === 'game');
        $learnView.classList.toggle('active', view === 'learn');
        $calcView.classList.toggle('active', view === 'calculator');
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
        settings: { count: 25, operation: 'mixed', mode: 'quiz', ttTable: 'all', ttOrder: 'sequential', ttCount: 12, fracType: 'simplify', fracCount: 12, practiceTopic: null },
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
    const $ttCountGroup = document.getElementById('ttCountGroup');
    document.querySelectorAll('.tp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tp-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            game.settings.ttTable = btn.dataset.table;
            // Only show question count when "All" is selected
            if ($ttCountGroup) $ttCountGroup.style.display = btn.dataset.table === 'all' ? '' : 'none';
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
    $playAgainBtn.addEventListener('click', () => {
        pendingAction = () => startGame();
        showNameModal();
    });
    $changeModeBtn.addEventListener('click', () => {
        pendingAction = () => {
            game.settings.mode = 'quiz';
            game.settings.practiceTopic = null;
            showScreen($menuScreen);
        };
        showNameModal();
    });

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
        } else if (s.mode === 'topic-practice') {
            const gen = practiceGenerators[s.practiceTopic];
            if (gen) {
                for (let i = 0; i < s.count; i++) {
                    const q = gen();
                    if (!q.isFraction && !q.isCoord) q.isFraction = false;
                    questions.push(q);
                }
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
        const a = randInt(2, 12), b = randInt(2, 12);
        return { text: `LCM(${a}, ${b})`, answer: fracUtils.lcm(a, b), isFraction: false };
    }
    function genHCF() {
        const a = randInt(2, 30), b = randInt(2, 30);
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

    function updateCalcDisplay() {
        $expr.innerHTML = engine.renderExpression();
        $result.textContent = engine.result;
        $result.classList.toggle('error', engine.result === 'ERROR');
        $indShift.classList.toggle('active', engine.shiftActive);
        $indMode.textContent = engine.calcMode;
        $indDrg.textContent = engine.angleMode;
        $indMem.classList.toggle('active', engine.memoryActive);
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
        'mem-clear': () => engine.memoryClear(),
        'mem-recall': () => engine.memoryRecall(),
        'mem-store': () => engine.memoryStore(),
        'mem-plus': () => engine.memoryAdd(),
        'mem-minus': () => engine.memorySubtract(),
        'shift': () => { engine.shiftActive = !engine.shiftActive; engine.alphaActive = false; },
        'drg': () => engine.cycleAngleMode()
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

    /* =========================================================
       LEARN VIEW - Grade 8 Curriculum
       ========================================================= */
    const $learnSidebar = document.getElementById('learnSidebar');
    const $learnContent = document.getElementById('learnContent');
    let currentTopic = null;
    let currentLessonTab = 'theory';

    const mb = (t) => `<div class="math-block">${t}</div>`;
    const note = (t) => `<div class="math-note">${t}</div>`;
    const ex = (title, body) => `<div class="example-box"><div class="ex-title">${title}</div>${body}</div>`;

    const learnCategories = [
        {
            id: 'number', name: 'Number Systems',
            desc: 'Whole numbers, integers, decimals',
            topics: [
                {
                    id: 'whole-nums', name: 'Whole Numbers',
                    theory: `<h3>Properties of Whole Numbers</h3>
<h4>Commutative Property</h4><p>Order does not matter for addition and multiplication:</p>${mb('a + b = b + a &nbsp;&nbsp; a &times; b = b &times; a')}
<h4>Associative Property</h4><p>Grouping does not matter:</p>${mb('(a + b) + c = a + (b + c)')}
<h4>Distributive Property</h4><p>Multiplication distributes over addition:</p>${mb('a &times; (b + c) = a&times;b + a&times;c')}
<h4>Identity Elements</h4><ul><li><strong>Additive identity:</strong> a + 0 = a (0 is the identity for addition)</li><li><strong>Multiplicative identity:</strong> a &times; 1 = a (1 is the identity for multiplication)</li></ul>
<h4>Division by Zero</h4>${note('Any number divided by 0 is <strong>undefined</strong>. You cannot divide by zero.')}
<h4>Multiples and Factors</h4><ul><li><strong>Factors</strong> of 12: 1, 2, 3, 4, 6, 12</li><li><strong>Multiples</strong> of 5: 5, 10, 15, 20, 25, ...</li><li><strong>Prime numbers</strong> have exactly 2 factors: 2, 3, 5, 7, 11, 13, ...</li><li><strong>Prime factorisation</strong>: breaking a number into prime factors<br>e.g. 60 = 2 &times; 2 &times; 3 &times; 5 = 2&sup2; &times; 3 &times; 5</li></ul>
<h4>LCM and HCF</h4><ul><li><strong>HCF</strong> (Highest Common Factor) = largest factor shared by both numbers</li><li><strong>LCM</strong> (Lowest Common Multiple) = smallest multiple shared by both numbers</li></ul>${note('Use prime factorisation to find LCM and HCF of large numbers.')}`,
                    examples: ex('Example 1: Commutative Property', '3 + 5 = 5 + 3 = 8<br>4 &times; 7 = 7 &times; 4 = 28') + ex('Example 2: Distributive Property', '3 &times; (10 + 4) = 3&times;10 + 3&times;4 = 30 + 12 = 42') + ex('Example 3: Prime Factorisation of 84', '84 = 2 &times; 42 = 2 &times; 2 &times; 21 = 2 &times; 2 &times; 3 &times; 7 = 2&sup2; &times; 3 &times; 7') + ex('Example 4: HCF and LCM of 12 and 18', '12 = 2&sup2; &times; 3 &nbsp;&nbsp; 18 = 2 &times; 3&sup2;<br>HCF = 2 &times; 3 = <strong>6</strong><br>LCM = 2&sup2; &times; 3&sup2; = <strong>36</strong>')
                },
                {
                    id: 'integers', name: 'Integers',
                    theory: `<h3>Understanding Integers</h3><p>Integers include negative numbers, zero, and positive numbers: {..., -3, -2, -1, 0, 1, 2, 3, ...}</p>
<h4>Ordering Integers</h4><p>On a number line, numbers increase from left to right. So -5 < -2 < 0 < 3.</p>
<h4>Adding and Subtracting Integers</h4><ul><li>Same signs: add and keep the sign. &nbsp; -3 + (-5) = -8</li><li>Different signs: subtract and keep the sign of the larger absolute value. &nbsp; -7 + 4 = -3</li><li>Subtracting: add the opposite. &nbsp; 5 - (-3) = 5 + 3 = 8</li></ul>
<h4>Multiplying and Dividing Integers</h4><ul><li>Same signs &rarr; positive result &nbsp; (-4)&times;(-3) = 12</li><li>Different signs &rarr; negative result &nbsp; (-6)&times;3 = -18</li></ul>
<h4>Squares, Cubes, and Roots</h4><ul><li>(-3)&sup2; = 9 &nbsp;(negative &times; negative = positive)</li><li>(-2)&sup3; = -8 &nbsp;(odd power keeps the sign)</li><li>&radic;9 = 3 &nbsp;&nbsp; &sup3;&radic;-8 = -2</li></ul>${note('A negative number has no real square root, but does have a real cube root.')}`,
                    examples: ex('Example 1: Adding Integers', '-6 + 10 = 4 (different signs: 10 - 6 = 4, positive wins)') + ex('Example 2: Subtracting Integers', '3 - (-7) = 3 + 7 = 10') + ex('Example 3: Multiplying Integers', '(-5) &times; (-4) &times; 2 = 20 &times; 2 = 40<br>(Two negatives make a positive, then times positive stays positive)') + ex('Example 4: Mixed Operations', '(-2)&sup2; + &radic;25 = 4 + 5 = 9')
                },
                {
                    id: 'decimals', name: 'Decimal Fractions',
                    theory: `<h3>Decimal Fractions</h3>
<h4>Place Value</h4><p>In 3.275: the 2 is tenths, 7 is hundredths, 5 is thousandths.</p>
<h4>Ordering Decimals</h4><p>Compare digit by digit from left to right. Pad with zeros if needed:<br>3.4 vs 3.37 &rarr; 3.40 vs 3.37 &rarr; 3.40 > 3.37</p>
<h4>Rounding</h4><p>To round to 2 decimal places, look at the 3rd decimal digit:<br>If it is 5 or more, round up. Otherwise, round down.</p>
<h4>Calculations</h4><ul><li><strong>Add/Subtract:</strong> Line up decimal points vertically</li><li><strong>Multiply:</strong> Multiply as whole numbers, then count total decimal places</li><li><strong>Divide:</strong> Move the decimal point to make the divisor a whole number</li></ul>
<h4>Squares and Roots</h4><p>(&radic;0.25 = 0.5) &nbsp;&nbsp; (0.3)&sup2; = 0.09 &nbsp;&nbsp; &sup3;&radic;0.125 = 0.5</p>`,
                    examples: ex('Example 1: Ordering', 'Write in order: 0.45, 0.5, 0.405, 0.54<br>Answer: 0.405, 0.45, 0.5, 0.54') + ex('Example 2: Multiplying Decimals', '2.4 &times; 0.3 = ?<br>24 &times; 3 = 72, then 2 decimal places total &rarr; <strong>0.72</strong>') + ex('Example 3: Dividing Decimals', '4.8 &divide; 0.6 = 48 &divide; 6 = <strong>8</strong>')
                }
            ]
        },
        {
            id: 'arithmetic', name: 'Arithmetic',
            desc: 'Fractions, percentages, ratio, finance',
            topics: [
                {
                    id: 'fractions', name: 'Common Fractions',
                    theory: `<h3>Working with Fractions</h3>
<h4>Simplifying</h4><p>Divide numerator and denominator by their HCF:</p>${mb('6/8 = 3/4 &nbsp;(divided both by 2)')}
<h4>Adding and Subtracting</h4><p>Find a common denominator (LCM of denominators), then add/subtract numerators:</p>${mb('1/3 + 1/4 = 4/12 + 3/12 = 7/12')}
<h4>Multiplying</h4><p>Multiply numerators and denominators directly:</p>${mb('2/3 &times; 4/5 = 8/15')}
<h4>Dividing</h4><p>Multiply by the reciprocal of the divisor:</p>${mb('2/3 &divide; 4/5 = 2/3 &times; 5/4 = 10/12 = 5/6')}
<h4>Mixed Numbers</h4><p>Convert to improper fractions before calculating:</p>${mb('2&frac13; = 7/3')}
<h4>Fractions of Whole Numbers</h4>${mb('3/4 of 20 = 3/4 &times; 20 = 60/4 = 15')}
<h4>Squares and Roots of Fractions</h4>${mb('(&sup2;/sub3;)&sup2; = 4/9 &nbsp;&nbsp; &radic;(16/25) = 4/5')}`,
                    examples: ex('Example 1: Adding Fractions', '2/5 + 1/3 = 6/15 + 5/15 = <strong>11/15</strong>') + ex('Example 2: Mixed Number Calculation', '1&frac12; + 2&frac13; = 3/2 + 7/3 = 9/6 + 14/6 = 23/6 = <strong>3&sup5;/sub6;</strong>') + ex('Example 3: Dividing Fractions', '3/4 &divide; 2/5 = 3/4 &times; 5/2 = 15/8 = <strong>1&frac78;</strong>')
                },
                {
                    id: 'percentages', name: 'Percentages',
                    theory: `<h3>Percentages</h3>
<h4>Finding Percentages</h4>${mb('25% of 80 = 25/100 &times; 80 = 20')}
<h4>Percentage of Part of Whole</h4>${mb('15 out of 60 = 15/60 &times; 100% = 25%')}
<h4>Percentage Increase</h4>${mb('Increase 50 by 20%: 50 + (20/100 &times; 50) = 50 + 10 = 60')}
<h4>Percentage Decrease</h4>${mb('Decrease 80 by 15%: 80 - (15/100 &times; 80) = 80 - 12 = 68')}
<h4>Converting Between Forms</h4><ul><li>Fraction to %: multiply by 100 &nbsp; 3/5 = 60%</li><li>Decimal to %: multiply by 100 &nbsp; 0.75 = 75%</li><li>% to Fraction: divide by 100 &nbsp; 40% = 40/100 = 2/5</li></ul>`,
                    examples: ex('Example 1: Percentage Increase', 'Price increases from R200 by 15%.<br>New price = 200 + (15/100 &times; 200) = 200 + 30 = <strong>R230</strong>') + ex('Example 2: Finding the Original', 'After a 20% discount, an item costs R160. Original price?<br>80% of original = 160 &rarr; Original = 160/0.8 = <strong>R200</strong>')
                },
                {
                    id: 'ratio', name: 'Ratio and Rate',
                    theory: `<h3>Ratio and Rate</h3>
<h4>Ratio</h4><p>A ratio compares quantities of the <strong>same kind</strong>:</p>${mb('3:5 means for every 3 of one thing, there are 5 of another')}
<h4>Rate</h4><p>A rate compares quantities of <strong>different kinds</strong>:</p>${mb('60 km/h &nbsp;&nbsp; R5/kg')}
<h4>Sharing in a Ratio</h4><p>Share 40 in ratio 3:5:</p><ul><li>Total parts = 3 + 5 = 8</li><li>One part = 40 &divide; 8 = 5</li><li>Shares: 3&times;5 = 15 and 5&times;5 = 25</li></ul>
<h4>Increasing/Decreasing in a Ratio</h4><p>Increase 24 in ratio 5:3:</p>${mb('24 &times; 5/3 = 40')}
<h4>Equivalent Ratios</h4><p>2:3 = 4:6 = 6:9 (multiply or divide both parts by the same number)</p>`,
                    examples: ex('Example 1: Sharing in a Ratio', 'Share R600 in ratio 2:3:5.<br>Total parts = 10. One part = R60.<br>Shares: R120, R180, <strong>R300</strong>') + ex('Example 2: Rate Problem', 'A car travels 180 km in 3 hours. Speed = 180/3 = <strong>60 km/h</strong>')
                },
                {
                    id: 'financial', name: 'Financial Maths',
                    theory: `<h3>Financial Applications</h3>
<h4>Profit and Loss</h4><ul><li>Profit = Selling Price - Cost Price</li><li>Loss = Cost Price - Selling Price</li><li>% Profit = (Profit / Cost Price) &times; 100</li></ul>
<h4>Simple Interest</h4>${mb('I = P &times; r &times; t<br>A = P + I = P(1 + rt)')}
<p>Where P = principal, r = interest rate (as decimal), t = time in years</p>
<h4>VAT</h4><p>VAT = 15% of the price. Inclusive price = 115% of exclusive price.</p>
<h4>Exchange Rates</h4><p>If 1 USD = R18.50, then R370 = 370/18.50 = $20</p>
<h4>Hire Purchase</h4><p>Total paid = deposit + (monthly instalment &times; number of months). Interest is charged on the balance.</p>`,
                    examples: ex('Example 1: Simple Interest', 'Invest R5000 at 8% p.a. simple interest for 3 years.<br>I = 5000 &times; 0.08 &times; 3 = R1200<br>Amount = 5000 + 1200 = <strong>R6200</strong>') + ex('Example 2: Profit Percentage', 'Bought for R80, sold for R100.<br>Profit = R20. % Profit = 20/80 &times; 100 = <strong>25%</strong>')
                }
            ]
        },
        {
            id: 'algebra', name: 'Algebra',
            desc: 'Exponents, expressions, equations, functions',
            topics: [
                {
                    id: 'exponents', name: 'Exponents',
                    theory: `<h3>Exponents</h3>
<h4>Exponential Form</h4>${mb('a<sup>n</sup> = a &times; a &times; a &times; ... (n times)')}
<p>e.g. 2<sup>5</sup> = 2&times;2&times;2&times;2&times;2 = 32</p>
<h4>Laws of Exponents</h4><ul><li>a<sup>m</sup> &times; a<sup>n</sup> = a<sup>m+n</sup></li><li>a<sup>m</sup> &divide; a<sup>n</sup> = a<sup>m-n</sup></li><li>(a<sup>m</sup>)<sup>n</sup> = a<sup>m&times;n</sup></li><li>a<sup>0</sup> = 1</li><li>(ab)<sup>n</sup> = a<sup>n</sup>b<sup>n</sup></li></ul>
<h4>Scientific Notation</h4>${mb('N = a &times; 10<sup>n</sup> where 1 &le; a < 10')}
<p>e.g. 3500 = 3.5 &times; 10&sup3;</p>
<h4>Negative and Zero Exponents</h4><p>a<sup>-n</sup> = 1/a<sup>n</sup> &nbsp;&nbsp; a<sup>0</sup> = 1</p>`,
                    examples: ex('Example 1: Laws of Exponents', '2&sup3; &times; 2&sup4; = 2<sup>3+4</sup> = 2<sup>7</sup> = 128') + ex('Example 2: Scientific Notation', '45 000 = 4.5 &times; 10<sup>4</sup>') + ex('Example 3: Zero Exponent', '5<sup>0</sup> = 1 &nbsp;&nbsp; (anything to the power 0 is 1)')
                },
                {
                    id: 'alg-expressions', name: 'Algebraic Expressions',
                    theory: `<h3>Algebraic Expressions</h3>
<h4>Key Terms</h4><ul><li><strong>Variable:</strong> a letter representing an unknown value (x, y)</li><li><strong>Constant:</strong> a fixed number (5, -3)</li><li><strong>Coefficient:</strong> number multiplied by a variable (in 4x, coefficient is 4)</li><li><strong>Term:</strong> a single item (3x, -5y&sup2;, 7)</li><li><strong>Like terms:</strong> same variable(s) and exponent(s) (3x and 5x are like; 3x and 5y are unlike)</li></ul>
<h4>Simplifying</h4><p>Combine like terms by adding/subtracting coefficients:</p>${mb('3x + 5x - 2y = 8x - 2y')}
<h4>Multiplying</h4><ul><li>Monomial &times; Monomial: multiply coefficients, add exponents of like bases<br>3x &times; 4x = 12x&sup2;</li><li>Monomial &times; Binomial: distribute<br>2x(3x + 5) = 6x&sup2; + 10x</li></ul>
<h4>Dividing</h4>${mb('6x&sup2; &divide; 2x = 3x &nbsp;&nbsp; (subtract exponents)')}
<h4>Substitution</h4><p>Replace variables with given values:</p>${mb('If x = 3: 2x&sup2; + 1 = 2(9) + 1 = 19')}`,
                    examples: ex('Example 1: Simplify', '5a + 3b - 2a + 7b = (5-2)a + (3+7)b = <strong>3a + 10b</strong>') + ex('Example 2: Expand', '3x(2x - 4) = 6x&sup2; - 12x') + ex('Example 3: Substitute', 'Evaluate 3x&sup2; - 2x + 1 when x = -2:<br>3(4) - 2(-2) + 1 = 12 + 4 + 1 = <strong>17</strong>')
                },
                {
                    id: 'equations', name: 'Algebraic Equations',
                    theory: `<h3>Solving Equations</h3>
<h4>What is an Equation?</h4><p>An equation states that two expressions are equal. Solving means finding the value of the variable.</p>
<h4>Solving by Inspection</h4><p>Think: "What value makes this true?"</p>${mb('x + 5 = 12 &rarr; x = 7')}
<h4>Using Inverses</h4><ul><li>Additive inverse: undo addition with subtraction</li><li>Multiplicative inverse: undo multiplication with division</li></ul>${mb('3x - 7 = 11<br>3x = 18 &nbsp;(add 7 to both sides)<br>x = 6 &nbsp;(divide both sides by 3)')}
<h4>Substitution</h4><p>Replace variables with values to check or generate tables:</p><p>If y = 2x + 1, when x = 3: y = 2(3) + 1 = 7</p>
<h4>Setting Up Equations</h4><p>Translate word problems into algebraic equations:</p><p>"A number doubled, plus 5, equals 21" &rarr; 2x + 5 = 21</p>`,
                    examples: ex('Example 1: Solve', '5x + 3 = 28<br>5x = 25<br>x = <strong>5</strong>') + ex('Example 2: Word Problem', 'Three times a number minus 4 equals 11.<br>3x - 4 = 11 &rarr; 3x = 15 &rarr; x = <strong>5</strong>')
                },
                {
                    id: 'functions', name: 'Functions and Relationships',
                    theory: `<h3>Functions and Relationships</h3>
<h4>Input and Output</h4><p>A function takes an input, applies a rule, and produces an output.</p>
<h4>Flow Diagrams</h4><p>x &rarr; [&times;3 + 2] &rarr; output<br>If x = 4: output = 3(4) + 2 = 14</p>
<h4>Tables</h4><table style="margin:8px 0;border-collapse:collapse;color:#fff"><tr style="border-bottom:2px solid rgba(255,255,255,0.3)"><th style="padding:4px 12px">x</th><td style="padding:4px 12px">1</td><td style="padding:4px 12px">2</td><td style="padding:4px 12px">3</td><td style="padding:4px 12px">4</td></tr><tr><th style="padding:4px 12px">y</th><td style="padding:4px 12px">5</td><td style="padding:4px 12px">8</td><td style="padding:4px 12px">11</td><td style="padding:4px 12px">14</td></tr></table><p>Rule: y = 3x + 2</p>
<h4>Finding the Rule</h4><p>Look at the pattern: constant difference = 3, so rule involves 3x. When x=1, y=5, so y = 3x + 2.</p>
<h4>Equivalent Descriptions</h4><p>The same relationship can be shown verbally, in a table, as a flow diagram, or as an equation.</p>`,
                    examples: ex('Example 1: Complete the Table', 'Rule: y = 4x - 1<br>x=1: y=3 &nbsp; x=2: y=7 &nbsp; x=5: y=<strong>19</strong>') + ex('Example 2: Find the Rule', 'x: 1, 2, 3, 4 &nbsp; y: 2, 5, 8, 11<br>Difference = 3, so y = 3x + c. When x=1, y=2, so c=-1.<br>Rule: <strong>y = 3x - 1</strong>')
                },
                {
                    id: 'patterns', name: 'Numeric Patterns',
                    theory: `<h3>Numeric and Geometric Patterns</h3>
<h4>Arithmetic Sequences</h4><p>Constant difference between terms: 2, 5, 8, 11, 14, ... (d = 3)</p>${mb('T<sub>n</sub> = a + (n-1)d<br>where a = first term, d = common difference')}
<h4>Geometric Sequences</h4><p>Constant ratio between terms: 3, 6, 12, 24, ... (r = 2)</p>${mb('T<sub>n</sub> = a &times; r<sup>n-1</sup>')}
<h4>Finding the Rule</h4><ul><li>Look at the differences between consecutive terms</li><li>If constant difference &rarr; arithmetic (linear)</li><li>If constant ratio &rarr; geometric (exponential)</li><li>Describe the rule in words and algebraic language</li></ul>
<h4>Extending Patterns</h4><p>Once you know the rule, you can find any term without listing all previous terms.</p>`,
                    examples: ex('Example 1: Find the 20th Term', 'Sequence: 5, 9, 13, 17, ...<br>a = 5, d = 4<br>T<sub>20</sub> = 5 + (19)(4) = 5 + 76 = <strong>81</strong>') + ex('Example 2: Geometric Pattern', 'Sequence: 2, 6, 18, 54, ...<br>r = 3<br>T<sub>5</sub> = 2 &times; 3<sup>4</sup> = 2 &times; 81 = <strong>162</strong>')
                }
            ]
        },
        {
            id: 'geometry', name: 'Geometry',
            desc: 'Angles, shapes, Pythagoras, transformations',
            topics: [
                {
                    id: 'angles', name: 'Angle Relationships',
                    theory: `<h3>Angles and Lines</h3>
<h4>Basic Angle Facts</h4><ul><li>Angles on a straight line add up to <strong>180&deg;</strong></li><li>Angles around a point add up to <strong>360&deg;</strong></li><li>Vertically opposite angles are <strong>equal</strong></li><li>Complementary angles add up to <strong>90&deg;</strong></li></ul>
<h4>Parallel Lines Cut by a Transversal</h4><ul><li><strong>Corresponding angles</strong> (F-angles) are equal</li><li><strong>Alternate angles</strong> (Z-angles) are equal</li><li><strong>Co-interior angles</strong> (U-angles) add up to 180&deg;</li></ul>
<h4>Perpendicular Lines</h4><p>Lines that meet at 90&deg; are perpendicular. We write AB &perp; CD.</p>`,
                    examples: ex('Example 1: Angles on a Line', 'Three angles on a straight line: 50&deg;, x&deg;, 70&deg;.<br>50 + x + 70 = 180 &rarr; x = <strong>60&deg;</strong>') + ex('Example 2: Parallel Lines', 'A transversal cuts parallel lines. If one corresponding angle is 65&deg;, the other is also <strong>65&deg;</strong>.')
                },
                {
                    id: 'triangles', name: 'Triangles',
                    theory: `<h3>Properties of Triangles</h3>
<h4>Types by Sides</h4><ul><li><strong>Equilateral:</strong> 3 equal sides, 3 equal angles (each 60&deg;)</li><li><strong>Isosceles:</strong> 2 equal sides, 2 equal base angles</li><li><strong>Scalene:</strong> no equal sides</li></ul>
<h4>Types by Angles</h4><ul><li><strong>Acute:</strong> all angles less than 90&deg;</li><li><strong>Right-angled:</strong> one angle is exactly 90&deg;</li><li><strong>Obtuse:</strong> one angle greater than 90&deg;</li></ul>
<h4>Key Properties</h4><ul><li>Sum of interior angles = <strong>180&deg;</strong></li><li>Exterior angle = sum of two non-adjacent interior angles</li><li>In an isosceles triangle, base angles are equal</li></ul>`,
                    examples: ex('Example 1: Find Missing Angle', 'Angles of a triangle: 55&deg;, 65&deg;, x.<br>x = 180 - 55 - 65 = <strong>60&deg;</strong>') + ex('Example 2: Isosceles Triangle', 'Base angle = 50&deg;. Third angle = 180 - 50 - 50 = <strong>80&deg;</strong>')
                },
                {
                    id: 'quadrilaterals', name: 'Quadrilaterals',
                    theory: `<h3>Properties of Quadrilaterals</h3>
<h4>Types</h4><ul><li><strong>Parallelogram:</strong> 2 pairs of parallel sides, opposite sides equal, opposite angles equal</li><li><strong>Rectangle:</strong> parallelogram with 4 right angles</li><li><strong>Square:</strong> rectangle with 4 equal sides</li><li><strong>Rhombus:</strong> parallelogram with 4 equal sides</li><li><strong>Trapezium:</strong> exactly 1 pair of parallel sides</li><li><strong>Kite:</strong> 2 pairs of adjacent equal sides</li></ul>
<h4>Key Properties</h4><ul><li>Sum of interior angles = <strong>360&deg;</strong></li><li>In a parallelogram: opposite sides are equal, opposite angles are equal, diagonals bisect each other</li></ul>`,
                    examples: ex('Example 1: Find Missing Angle', 'Angles of quadrilateral: 90&deg;, 110&deg;, 70&deg;, x.<br>x = 360 - 90 - 110 - 70 = <strong>90&deg;</strong>') + ex('Example 2: Parallelogram', 'One angle is 60&deg;. Opposite angle = 60&deg;. The other two angles = 180 - 60 = <strong>120&deg;</strong> each.')
                },
                {
                    id: 'similarity', name: 'Similar and Congruent',
                    theory: `<h3>Similar and Congruent Shapes</h3>
<h4>Congruent Shapes</h4><ul><li>Same shape AND same size</li><li>All corresponding sides and angles are equal</li><li>Symbol: &cong;</li></ul>
<h4>Similar Shapes</h4><ul><li>Same shape but different size</li><li>Corresponding angles are equal</li><li>Corresponding sides are in the same ratio</li><li>Symbol: ~</li></ul>
<h4>Scale Factor</h4><p>If two shapes are similar with scale factor k:</p><ul><li>Sides of larger = k &times; sides of smaller</li><li>Perimeter of larger = k &times; perimeter of smaller</li><li>Area of larger = k&sup2; &times; area of smaller</li></ul>`,
                    examples: ex('Example 1: Similar Triangles', 'Triangle sides 3, 4, 5 is similar to triangle with sides 6, 8, 10 (scale factor 2).') + ex('Example 2: Area Ratio', 'Scale factor = 3. Area ratio = 3&sup2; = 9.<br>If small area = 5 cm&sup2;, large area = 5 &times; 9 = <strong>45 cm&sup2;</strong>')
                },
                {
                    id: 'pythagoras', name: 'Pythagoras',
                    theory: `<h3>Theorem of Pythagoras</h3>
<p>In a right-angled triangle:</p>${mb('a&sup2; + b&sup2; = c&sup2;<br>where c is the hypotenuse (longest side)')}
<h4>Finding the Hypotenuse</h4>${mb('c = &radic;(a&sup2; + b&sup2;)')}
<h4>Finding a Short Side</h4>${mb('a = &radic;(c&sup2; - b&sup2;)')}
<h4>Testing for Right Angle</h4><p>If a&sup2; + b&sup2; = c&sup2;, the triangle is right-angled.</p>${note('Only works for right-angled triangles. The hypotenuse is always opposite the 90&deg; angle.')}`,
                    examples: ex('Example 1: Find Hypotenuse', 'Sides 3 and 4.<br>c = &radic;(9 + 16) = &radic;25 = <strong>5</strong>') + ex('Example 2: Find Short Side', 'Hypotenuse = 13, one side = 5.<br>Other side = &radic;(169 - 25) = &radic;144 = <strong>12</strong>') + ex('Example 3: Is it Right-Angled?', 'Sides 5, 7, 9. Check: 5&sup2; + 7&sup2; = 25 + 49 = 74. 9&sup2; = 81. 74 &ne; 81, so <strong>not</strong> right-angled.')
                },
                {
                    id: 'transformations', name: 'Transformations',
                    theory: `<h3>Transformations on the Coordinate Plane</h3>
<h4>Reflection</h4><ul><li>Reflect in x-axis: (x, y) &rarr; (x, -y)</li><li>Reflect in y-axis: (x, y) &rarr; (-x, y)</li><li>Reflect in y = x: (x, y) &rarr; (y, x)</li></ul>
<h4>Translation</h4><p>Shift every point by the same amount: (x, y) &rarr; (x + a, y + b)</p>
<h4>Rotation</h4><p>Turn around a centre point (usually origin):</p><ul><li>90&deg; clockwise: (x, y) &rarr; (y, -x)</li><li>180&deg;: (x, y) &rarr; (-x, -y)</li><li>90&deg; anticlockwise: (x, y) &rarr; (-y, x)</li></ul>
<h4>Enlargement</h4><p>Multiply coordinates by scale factor k from centre of enlargement.</p><ul><li>k > 1: shape gets bigger</li><li>0 < k < 1: shape gets smaller</li><li>Perimeter scales by k, area scales by k&sup2;</li></ul>`,
                    examples: ex('Example 1: Reflection', 'Reflect (3, 5) in the x-axis: <strong>(3, -5)</strong>') + ex('Example 2: Translation', 'Translate (2, 4) by (3, -1): <strong>(5, 3)</strong>') + ex('Example 3: Rotation', 'Rotate (4, 1) by 90&deg; anticlockwise about origin: <strong>(-1, 4)</strong>')
                },
                {
                    id: 'perimeter-area', name: 'Perimeter and Area',
                    theory: `<h3>Perimeter and Area of 2D Shapes</h3>
<h4>Formulae</h4><ul><li><strong>Square:</strong> P = 4s, A = s&sup2;</li><li><strong>Rectangle:</strong> P = 2(l + w), A = l &times; w</li><li><strong>Triangle:</strong> A = &frac12; &times; b &times; h</li><li><strong>Circle:</strong> C = 2&pi;r, A = &pi;r&sup2;</li><li><strong>Parallelogram:</strong> A = b &times; h</li><li><strong>Trapezium:</strong> A = &frac12;(a + b) &times; h</li></ul>
<h4>Composite Shapes</h4><p>Break complex polygons into rectangles and triangles, calculate each area, then add.</p>
<h4>Circle Relationships</h4><ul><li>Diameter = 2 &times; radius</li><li>Circumference = &pi; &times; diameter = 2&pi;r</li></ul>${note('&pi; &approx; 3.14159... Use &pi; button on calculator for accuracy.')}`,
                    examples: ex('Example 1: Triangle Area', 'Base = 8 cm, height = 5 cm.<br>A = &frac12; &times; 8 &times; 5 = <strong>20 cm&sup2;</strong>') + ex('Example 2: Circle', 'Radius = 7 cm.<br>C = 2&pi;(7) = <strong>43.98 cm</strong><br>A = &pi;(7&sup2;) = <strong>153.94 cm&sup2;</strong>')
                },
                {
                    id: 'surface-volume', name: 'Surface Area and Volume',
                    theory: `<h3>3D Objects: Surface Area and Volume</h3>
<h4>Formulae</h4><ul><li><strong>Cube:</strong> SA = 6s&sup2;, V = s&sup3;</li><li><strong>Rectangular prism:</strong> SA = 2(lw + lh + wh), V = l &times; w &times; h</li><li><strong>Triangular prism:</strong> V = Area of triangle &times; length<br>= &frac12;bh &times; l</li></ul>
<h4>Capacity</h4><ul><li>1 cm&sup3; = 1 ml</li><li>1 m&sup3; = 1 kl = 1000 l</li></ul>
<h4>Unit Conversions</h4><ul><li>1 cm&sup2; = 100 mm&sup2;</li><li>1 m&sup2; = 10 000 cm&sup2;</li><li>1 km&sup2; = 1 000 000 m&sup2;</li><li>1 cm&sup3; = 1000 mm&sup3;</li><li>1 m&sup3; = 1 000 000 cm&sup3;</li></ul>`,
                    examples: ex('Example 1: Rectangular Prism', 'l=5cm, w=3cm, h=4cm.<br>V = 5&times;3&times;4 = <strong>60 cm&sup3;</strong><br>SA = 2(15+20+12) = <strong>94 cm&sup2;</strong>') + ex('Example 2: Unit Conversion', '2.5 m&sup3; = 2.5 &times; 1 000 000 = <strong>2 500 000 cm&sup3;</strong><br>2 500 000 cm&sup3; = <strong>2500 l</strong> = <strong>2.5 kl</strong>')
                }
            ]
        },
        {
            id: 'data', name: 'Data and Probability',
            desc: 'Statistics, data handling, probability',
            topics: [
                {
                    id: 'statistics', name: 'Data Handling',
                    theory: `<h3>Data Handling and Statistics</h3>
<h4>Collecting Data</h4><ul><li>Define a clear question</li><li>Choose a data source (peers, surveys, newspapers)</li><li>Population = entire group; Sample = part of the population</li></ul>
<h4>Organising Data</h4><ul><li>Tally marks and frequency tables</li><li>Stem-and-leaf displays (show all individual values)</li><li>Group data into intervals for large datasets</li></ul>
<h4>Measures of Central Tendency</h4><ul><li><strong>Mean:</strong> sum of values &divide; number of values</li><li><strong>Median:</strong> middle value when sorted (or average of 2 middle values)</li><li><strong>Mode:</strong> most frequently occurring value</li></ul>
<h4>Measures of Dispersion</h4><ul><li><strong>Range:</strong> highest value - lowest value</li></ul>
<h4>Choosing the Right Average</h4><ul><li>Mean: best for numerical data with no extreme values</li><li>Median: best when there are outliers</li><li>Mode: best for categorical data</li></ul>`,
                    examples: ex('Example 1: Mean, Median, Mode', 'Data: 3, 5, 7, 7, 8, 10, 12<br>Mean = 52/7 = <strong>7.43</strong><br>Median = <strong>7</strong> (4th value)<br>Mode = <strong>7</strong><br>Range = 12 - 3 = <strong>9</strong>')
                },
                {
                    id: 'probability', name: 'Probability',
                    theory: `<h3>Probability</h3>
<h4>Definition</h4>${mb('P(event) = number of favourable outcomes / total possible outcomes')}
<p>Probability is always between 0 and 1.</p>
<h4>Equally Likely Outcomes</h4><p>When rolling a fair die, each outcome has probability 1/6.</p>
<h4>Sample Space</h4><p>List all possible outcomes:</p><ul><li>Coin toss: {H, T} &rarr; P(H) = 1/2</li><li>Die roll: {1, 2, 3, 4, 5, 6} &rarr; P(even) = 3/6 = 1/2</li></ul>
<h4>Relative Frequency</h4><p>Relative frequency = (times event occurred) / (total trials)</p>${note('As the number of trials increases, relative frequency approaches the theoretical probability.')}`,
                    examples: ex('Example 1: Basic Probability', 'A bag has 3 red, 5 blue, 2 green balls.<br>P(red) = 3/10 = <strong>0.3</strong><br>P(not green) = 8/10 = <strong>0.8</strong>') + ex('Example 2: Relative Frequency', 'In 50 coin tosses, heads appeared 27 times.<br>Relative frequency = 27/50 = 0.54<br>Theoretical probability = 0.5<br>(They are close but not identical)')
                }
            ]
        }
    ];

    /* ---- Question Generators for Practice ---- */
    const practiceGenerators = {
        'whole-nums': genWholeNumQ,
        'integers': genIntegerQ,
        'decimals': genDecimalQ,
        'fractions': genFracPracticeQ,
        'percentages': genPercentQ,
        'ratio': genRatioQ,
        'financial': genFinancialQ,
        'exponents': genExponentQ,
        'alg-expressions': genAlgExprQ,
        'equations': genEquationQ,
        'functions': genFunctionQ,
        'patterns': genPatternQ,
        'angles': genAngleQ,
        'triangles': genTriangleQ,
        'quadrilaterals': genQuadQ,
        'similarity': genSimilarityQ,
        'pythagoras': genPythagorasQ,
        'transformations': genTransformQ,
        'perimeter-area': genAreaQ,
        'surface-volume': genVolumeQ,
        'statistics': genStatsQ,
        'probability': genProbabilityQ
    };

    function genWholeNumQ() {
        const type = randInt(0, 2);
        if (type === 0) { // HCF
            const a = randInt(4, 30), b = randInt(4, 30);
            return { text: `HCF(${a}, ${b})`, answer: fracUtils.hcf(a, b) };
        } else if (type === 1) { // LCM
            const a = randInt(2, 12), b = randInt(2, 12);
            return { text: `LCM(${a}, ${b})`, answer: fracUtils.lcm(a, b) };
        } else { // Distributive property verification
            const a = randInt(2, 12), b = randInt(2, 12), c = randInt(2, 12);
            return { text: `${a} &times; (${b} + ${c})`, answer: a * (b + c) };
        }
    }

    function genIntegerQ() {
        const type = randInt(0, 3);
        let a, b, answer, text;
        if (type === 0) { // addition
            a = randInt(-30, 30); b = randInt(-30, 30);
            answer = a + b; text = `(${a}) + (${b})`;
        } else if (type === 1) { // subtraction
            a = randInt(-20, 20); b = randInt(-20, 20);
            answer = a - b; text = `(${a}) - (${b})`;
        } else if (type === 2) { // multiplication
            a = randInt(-12, 12); b = randInt(-12, 12);
            if (a === 0) a = 1; if (b === 0) b = -1;
            answer = a * b; text = `(${a}) &times; (${b})`;
        } else { // division
            b = randInt(2, 12) * (Math.random() < 0.5 ? 1 : -1);
            answer = randInt(-10, 10);
            if (answer === 0) answer = 1;
            a = b * answer; text = `(${a}) &divide; (${b})`;
        }
        return { text, answer };
    }

    function genDecimalQ() {
        const type = randInt(0, 2);
        let a, b, answer, text;
        if (type === 0) { // add
            a = +(Math.random() * 20).toFixed(2); b = +(Math.random() * 20).toFixed(2);
            answer = +(a + b).toFixed(2); text = `${a} + ${b}`;
        } else if (type === 1) { // multiply
            a = +(Math.random() * 9 + 1).toFixed(1); b = +(Math.random() * 9 + 1).toFixed(1);
            answer = +(a * b).toFixed(2); text = `${a} &times; ${b}`;
        } else { // round
            a = +(Math.random() * 100).toFixed(3);
            answer = +a.toFixed(2); text = `Round ${a} to 2 d.p.`;
        }
        return { text, answer };
    }

    function genFracPracticeQ() {
        return generateFractionQuestion(game.settings.fracType || 'simplify');
    }

    function genPercentQ() {
        const type = randInt(0, 2);
        if (type === 0) { // find percentage
            const pct = [10, 15, 20, 25, 30, 40, 50, 75][randInt(0, 7)];
            const num = randInt(2, 20) * 10;
            return { text: `${pct}% of ${num}`, answer: pct / 100 * num };
        } else if (type === 1) { // percentage increase
            const num = randInt(10, 200);
            const pct = [5, 10, 15, 20, 25][randInt(0, 4)];
            return { text: `Increase ${num} by ${pct}%`, answer: num + num * pct / 100 };
        } else { // percentage decrease
            const num = randInt(10, 200);
            const pct = [5, 10, 15, 20, 25][randInt(0, 4)];
            return { text: `Decrease ${num} by ${pct}%`, answer: num - num * pct / 100 };
        }
    }

    function genRatioQ() {
        const type = randInt(0, 1);
        if (type === 0) { // share in ratio
            const r1 = randInt(2, 5), r2 = randInt(2, 5);
            const total = (r1 + r2) * randInt(2, 10);
            const part1 = total / (r1 + r2) * r1;
            return { text: `Share ${total} in ratio ${r1}:${r2} - first part`, answer: part1 };
        } else { // find value given ratio
            const r1 = randInt(2, 5), r2 = randInt(2, 5);
            const part1 = randInt(2, 10) * r1;
            const part2 = part1 / r1 * r2;
            return { text: `Ratio ${r1}:${r2}. If first = ${part1}, find second`, answer: part2 };
        }
    }

    function genFinancialQ() {
        const type = randInt(0, 1);
        if (type === 0) { // simple interest
            const P = randInt(5, 50) * 100;
            const r = randInt(3, 12);
            const t = randInt(1, 5);
            const I = P * r / 100 * t;
            return { text: `Simple interest on R${P} at ${r}% for ${t} year(s)`, answer: I };
        } else { // profit/loss
            const cost = randInt(10, 100) * 5;
            const sell = cost + randInt(1, 10) * 5;
            return { text: `Cost R${cost}, sold R${sell}. Profit?`, answer: sell - cost };
        }
    }

    function genExponentQ() {
        const type = randInt(0, 2);
        if (type === 0) { // evaluate
            const base = randInt(2, 5), exp = randInt(2, 5);
            return { text: `${base}<sup>${exp}</sup>`, answer: Math.pow(base, exp) };
        } else if (type === 1) { // multiply (laws)
            const base = randInt(2, 5), e1 = randInt(1, 4), e2 = randInt(1, 4);
            return { text: `${base}<sup>${e1}</sup> &times; ${base}<sup>${e2}</sup>`, answer: Math.pow(base, e1 + e2) };
        } else { // scientific notation: convert to standard
            const a = +(Math.random() * 9 + 1).toFixed(1);
            const n = randInt(2, 6);
            return { text: `Write ${a} &times; 10<sup>${n}</sup> as a number`, answer: a * Math.pow(10, n) };
        }
    }

    function genAlgExprQ() {
        // Evaluate expression by substitution
        const x = randInt(-5, 5);
        const a = randInt(1, 5), b = randInt(-5, 5);
        const answer = a * x + b;
        const bStr = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`;
        return { text: `Evaluate ${a}x ${bStr} when x = ${x}`, answer };
    }

    function genEquationQ() {
        // ax + b = c, solve for x
        const x = randInt(-10, 10);
        const a = randInt(2, 8);
        const b = randInt(-15, 15);
        const c = a * x + b;
        const bStr = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`;
        return { text: `Solve: ${a}x ${bStr} = ${c}`, answer: x };
    }

    function genFunctionQ() {
        // Given y = mx + c, find y for given x
        const m = randInt(2, 6), c = randInt(-5, 5);
        const x = randInt(1, 10);
        const y = m * x + c;
        const cStr = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
        return { text: `y = ${m}x ${cStr}. Find y when x = ${x}`, answer: y };
    }

    function genPatternQ() {
        // Arithmetic sequence: find nth term
        const a = randInt(1, 10), d = randInt(2, 6);
        const n = randInt(5, 15);
        const answer = a + (n - 1) * d;
        // Show first few terms
        const terms = [a, a + d, a + 2 * d, a + 3 * d].join(', ');
        return { text: `Pattern: ${terms}, ... Find term ${n}`, answer };
    }

    function genAngleQ() {
        const type = randInt(0, 1);
        if (type === 0) { // angles on a line
            const a1 = randInt(20, 80), a2 = randInt(20, 80);
            return { text: `Angles on a line: ${a1}&deg;, ${a2}&deg;, x. Find x`, answer: 180 - a1 - a2 };
        } else { // angles around a point
            const a1 = randInt(40, 100), a2 = randInt(40, 100), a3 = randInt(40, 100);
            return { text: `Angles at a point: ${a1}&deg;, ${a2}&deg;, ${a3}&deg;, x. Find x`, answer: 360 - a1 - a2 - a3 };
        }
    }

    function genTriangleQ() {
        const a1 = randInt(30, 80), a2 = randInt(30, 140 - a1);
        const a3 = 180 - a1 - a2;
        return { text: `Triangle angles: ${a1}&deg;, ${a2}&deg;, x. Find x`, answer: a3 };
    }

    function genQuadQ() {
        const a1 = randInt(60, 120), a2 = randInt(60, 120), a3 = randInt(60, 120);
        const a4 = 360 - a1 - a2 - a3;
        if (a4 <= 0) return genQuadQ();
        return { text: `Quadrilateral angles: ${a1}&deg;, ${a2}&deg;, ${a3}&deg;, x. Find x`, answer: a4 };
    }

    function genSimilarityQ() {
        const scale = randInt(2, 5);
        const side = randInt(3, 12);
        return { text: `Similar shapes, scale factor ${scale}. Side = ${side}. Corresponding side?`, answer: side * scale };
    }

    function genPythagorasQ() {
        // Generate Pythagorean triples
        const triples = [[3,4,5],[5,12,13],[6,8,10],[8,15,17],[7,24,25],[9,12,15]];
        const t = triples[randInt(0, triples.length - 1)];
        const mult = randInt(1, 2);
        const a = t[0] * mult, b = t[1] * mult, c = t[2] * mult;
        const type = randInt(0, 1);
        if (type === 0) {
            return { text: `Right triangle: a=${a}, b=${b}. Find hypotenuse`, answer: c };
        } else {
            return { text: `Right triangle: hypotenuse=${c}, a=${a}. Find b`, answer: b };
        }
    }

    function genTransformQ() {
        const type = randInt(0, 2);
        const x = randInt(-8, 8), y = randInt(-8, 8);
        if (type === 0) {
            return { text: `Reflect (${x}, ${y}) in x-axis. New y-coordinate?`, answer: -y };
        } else if (type === 1) {
            const dx = randInt(-5, 5), dy = randInt(-5, 5);
            return { text: `Translate (${x}, ${y}) by (${dx}, ${dy}). New x?`, answer: x + dx };
        } else {
            return { text: `Rotate (${x}, ${y}) 180&deg; about origin. New x?`, answer: -x };
        }
    }

    function genAreaQ() {
        const type = randInt(0, 2);
        if (type === 0) { // rectangle
            const l = randInt(3, 15), w = randInt(3, 15);
            return { text: `Rectangle: l=${l}cm, w=${w}cm. Area?`, answer: l * w };
        } else if (type === 1) { // triangle
            const b = randInt(4, 20), h = randInt(2, 15);
            return { text: `Triangle: base=${b}cm, height=${h}cm. Area?`, answer: b * h / 2 };
        } else { // circle
            const r = randInt(2, 10);
            return { text: `Circle: r=${r}cm. Area? (round to 2 d.p.)`, answer: +(Math.PI * r * r).toFixed(2) };
        }
    }

    function genVolumeQ() {
        const type = randInt(0, 1);
        if (type === 0) { // rectangular prism
            const l = randInt(2, 10), w = randInt(2, 10), h = randInt(2, 10);
            return { text: `Prism: l=${l}cm, w=${w}cm, h=${h}cm. Volume?`, answer: l * w * h };
        } else { // cube
            const s = randInt(2, 8);
            return { text: `Cube: side=${s}cm. Volume?`, answer: s * s * s };
        }
    }

    function genStatsQ() {
        const type = randInt(0, 2);
        const count = randInt(5, 7);
        const nums = [];
        for (let i = 0; i < count; i++) nums.push(randInt(2, 20));
        nums.sort((a, b) => a - b);
        if (type === 0) { // mean
            const sum = nums.reduce((a, b) => a + b, 0);
            return { text: `Find the mean: ${nums.join(', ')}`, answer: +(sum / count).toFixed(2) };
        } else if (type === 1) { // median
            const mid = Math.floor(count / 2);
            const median = count % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
            return { text: `Find the median: ${nums.join(', ')}`, answer: median };
        } else { // range
            return { text: `Find the range: ${nums.join(', ')}`, answer: nums[count - 1] - nums[0] };
        }
    }

    function genProbabilityQ() {
        const total = randInt(8, 20);
        const fav = randInt(1, total - 1);
        const g = fracUtils.simplify(fav, total);
        return { text: `P(event) = ? (${fav} favourable out of ${total})`, answer: { num: g.num, den: g.den }, isFraction: true };
    }

    /* ---- Learn View Rendering ---- */
    function initLearnView() {
        renderSidebar();
        renderWelcome();
    }

    function renderSidebar() {
        let html = '';
        learnCategories.forEach(cat => {
            html += `<div class="learn-cat-group">
                <button class="learn-cat-btn" data-cat="${cat.id}">${cat.name}</button>
                <div class="learn-topic-list" data-catlist="${cat.id}">`;
            cat.topics.forEach(t => {
                html += `<button class="learn-topic-btn" data-topic="${t.id}">${t.name}</button>`;
            });
            html += `</div></div>`;
        });
        $learnSidebar.innerHTML = html;

        // Event: toggle category
        $learnSidebar.querySelectorAll('.learn-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const list = $learnSidebar.querySelector(`[data-catlist="${btn.dataset.cat}"]`);
                const isOpen = list.classList.contains('open');
                // Close all
                $learnSidebar.querySelectorAll('.learn-topic-list').forEach(l => l.classList.remove('open'));
                $learnSidebar.querySelectorAll('.learn-cat-btn').forEach(b => b.classList.remove('active'));
                if (!isOpen) {
                    list.classList.add('open');
                    btn.classList.add('active');
                }
            });
        });

        // Event: select topic
        $learnSidebar.querySelectorAll('.learn-topic-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $learnSidebar.querySelectorAll('.learn-topic-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showTopic(btn.dataset.topic);
            });
        });
    }

    function renderWelcome() {
        let html = '';
        learnCategories.forEach(cat => {
            html += `<div class="learn-cat-card" data-catcard="${cat.id}">
                <h3>${cat.name}</h3>
                <p>${cat.desc} (${cat.topics.length} topics)</p>
            </div>`;
        });
        const overview = document.getElementById('learnCatsOverview');
        if (overview) overview.innerHTML = html;
        // Click cards to expand sidebar
        document.querySelectorAll('.learn-cat-card').forEach(card => {
            card.addEventListener('click', () => {
                const btn = $learnSidebar.querySelector(`[data-cat="${card.dataset.catcard}"]`);
                if (btn) btn.click();
            });
        });
    }

    function findTopic(id) {
        for (const cat of learnCategories) {
            for (const t of cat.topics) {
                if (t.id === id) return t;
            }
        }
        return null;
    }

    function showTopic(topicId) {
        const topic = findTopic(topicId);
        if (!topic) return;
        currentTopic = topicId;
        currentLessonTab = 'theory';
        renderLesson(topic);
    }

    function renderLesson(topic) {
        const hasPractice = !!practiceGenerators[topic.id];
        let html = `<h2 class="lesson-title">${topic.name}</h2>
            <div class="lesson-tabs">
                <button class="lesson-tab active" data-ltab="theory">Theory</button>
                <button class="lesson-tab" data-ltab="examples">Examples</button>
            </div>
            <div class="lesson-body" id="lessonBody">${topic.theory}</div>`;
        if (hasPractice) {
            html += `<button class="practice-btn" id="practiceTopicBtn">Practice This Topic</button>`;
        }
        $learnContent.innerHTML = html;

        // Tab switching
        $learnContent.querySelectorAll('.lesson-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                $learnContent.querySelectorAll('.lesson-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentLessonTab = tab.dataset.ltab;
                const body = document.getElementById('lessonBody');
                if (currentLessonTab === 'theory') {
                    body.innerHTML = topic.theory;
                } else {
                    body.innerHTML = topic.examples || '<p>No examples yet.</p>';
                }
            });
        });

        // Practice button
        const $pracBtn = document.getElementById('practiceTopicBtn');
        if ($pracBtn) {
            $pracBtn.addEventListener('click', () => startTopicPractice(topic.id));
        }
    }

    function startTopicPractice(topicId) {
        const gen = practiceGenerators[topicId];
        if (!gen) return;
        game.settings.practiceTopic = topicId;
        game.settings.mode = 'topic-practice';
        game.settings.count = 12;
        switchView('game');
        startGame();
    }

    initLearnView();

    /* =========================================================
       REPORT SYSTEM
       ========================================================= */
    let pendingAction = null;

    const $nameModal = document.getElementById('nameModal');
    const $nameModalInput = document.getElementById('nameModalInput');
    const $nameModalSave = document.getElementById('nameModalSave');
    const $reportsView = document.getElementById('reportsView');
    const $reportsBody = document.getElementById('reportsBody');
    const $reportsSummary = document.getElementById('reportsSummary');
    const $reportFilterName = document.getElementById('reportFilterName');
    const $reportFilterFrom = document.getElementById('reportFilterFrom');
    const $reportFilterTo = document.getElementById('reportFilterTo');
    const $reportApplyFilter = document.getElementById('reportApplyFilter');
    const $reportClearFilter = document.getElementById('reportClearFilter');
    const $reportDownload = document.getElementById('reportDownload');
    const $footerTrigger = document.getElementById('footerTrigger');
    const $reportsBackBtn = document.getElementById('reportsBackBtn');

    const REPORTS_KEY = 'mathArena_reports';
    const GITHUB_REPO = 'XalebXEn99/Math-Arena';
    const GITHUB_TOKEN = '';
    const REPORTS_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/master/reports.json`;
    const DISPATCH_URL = `https://api.github.com/repos/${GITHUB_REPO}/dispatches`;

    // Cache reports locally for offline access
    let reportsCache = null;

    async function getReports() {
        // Try to fetch from GitHub first
        try {
            const response = await fetch(REPORTS_URL + '?t=' + Date.now());
            if (response.ok) {
                const reports = await response.json();
                reportsCache = reports;
                // Update local cache
                localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
                return reports;
            }
        } catch (e) {
            console.log('Could not fetch reports from GitHub, using cache');
        }
        // Fallback to localStorage cache
        try { return JSON.parse(localStorage.getItem(REPORTS_KEY)) || []; }
        catch { return []; }
    }

    async function triggerReportWorkflow(report) {
        if (!GITHUB_TOKEN) {
            console.warn('GitHub token not set. Report saved locally only.');
            // Fallback to localStorage
            const reports = getReportsSync();
            reports.push(report);
            localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
            return false;
        }

        try {
            const encodedReport = encodeURIComponent(JSON.stringify(report));
            const response = await fetch(DISPATCH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event_type: 'add-report',
                    client_payload: { report: encodedReport }
                })
            });

            if (response.status === 204) {
                console.log('Report workflow triggered successfully');
                // Also save to local cache immediately
                const reports = getReportsSync();
                reports.push(report);
                localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
                return true;
            } else {
                console.error('Failed to trigger workflow:', response.status, response.statusText);
                return false;
            }
        } catch (e) {
            console.error('Error triggering workflow:', e);
            return false;
        }
    }

    function getReportsSync() {
        try { return JSON.parse(localStorage.getItem(REPORTS_KEY)) || []; }
        catch { return []; }
    }

    function showNameModal() {
        $nameModalInput.value = '';
        $nameModal.classList.add('open');
        setTimeout(() => $nameModalInput.focus(), 100);
    }

    function hideNameModal() {
        $nameModal.classList.remove('open');
    }

    $nameModalSave.addEventListener('click', () => {
        const name = $nameModalInput.value.trim();
        if (!name) { $nameModalInput.focus(); return; }
        saveCurrentReport(name);
        hideNameModal();
        if (pendingAction) { pendingAction(); pendingAction = null; }
    });

    $nameModalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $nameModalSave.click();
    });

    function saveCurrentReport(name) {
        const s = game.settings;
        let modeLabel = 'Quiz';
        let topicLabel = '';

        if (s.mode === 'timestables') {
            modeLabel = 'Times Tables';
            topicLabel = s.ttTable === 'all' ? 'All Tables' : `${s.ttTable} Times Table`;
        } else if (s.mode === 'fractions') {
            modeLabel = 'Fractions';
            const fracLabels = { simplify: 'Simplify', add: 'Addition', subtract: 'Subtraction', multiply: 'Multiplication', divide: 'Division', lcm: 'LCM', hcf: 'HCF' };
            topicLabel = fracLabels[s.fracType] || s.fracType;
        } else if (s.mode === 'topic-practice') {
            modeLabel = 'Practice';
            const topic = learnCategories.flatMap(c => c.topics).find(t => t.id === s.practiceTopic);
            topicLabel = topic ? topic.title : s.practiceTopic || '';
        } else {
            const opLabels = { mixed: 'All Mixed', '+': 'Addition', '-': 'Subtraction', '*': 'Multiplication', '/': 'Division' };
            topicLabel = opLabels[s.operation] || s.operation || '';
        }

        const total = game.questions.length;
        const correct = game.score;
        const pct = Math.round((correct / total) * 100);

        const report = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: name,
            date: new Date().toISOString(),
            mode: modeLabel,
            topic: topicLabel,
            score: correct,
            total: total,
            pct: pct,
            time: game.elapsed,
            answers: game.answers.map(a => ({
                question: a.question,
                userAnswer: a.userAnswer,
                correctAnswer: a.correctAnswer,
                correct: a.correct
            }))
        };

        const reports = getReportsSync();
        reports.push(report);
        localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));

        // Trigger GitHub Actions workflow to save to shared database
        triggerReportWorkflow(report);
    }

    /* ---- Reports View ---- */
    async function showReportsView() {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        $reportsView.classList.add('active');
        $navTabs.forEach(t => t.classList.remove('active'));
        await renderReports();
    }

    async function renderReports() {
        const reports = await getReports();
        const nameFilter = $reportFilterName.value.trim().toLowerCase();
        const fromFilter = $reportFilterFrom.value;
        const toFilter = $reportFilterTo.value;

        let filtered = reports;
        if (nameFilter) {
            filtered = filtered.filter(r => r.name.toLowerCase().includes(nameFilter));
        }
        if (fromFilter) {
            const fromDate = new Date(fromFilter);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(r => new Date(r.date) >= fromDate);
        }
        if (toFilter) {
            const toDate = new Date(toFilter);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(r => new Date(r.date) <= toDate);
        }

        // Sort by date descending
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Summary
        const totalSessions = filtered.length;
        const totalQuestions = filtered.reduce((s, r) => s + r.total, 0);
        const totalCorrect = filtered.reduce((s, r) => s + r.score, 0);
        const avgPct = totalSessions > 0 ? Math.round(filtered.reduce((s, r) => s + r.pct, 0) / totalSessions) : 0;
        $reportsSummary.textContent = `${totalSessions} session${totalSessions !== 1 ? 's' : ''} | ${totalQuestions} questions | ${totalCorrect} correct | ${avgPct}% average`;

        // Table rows
        let html = '';
        filtered.forEach(r => {
            const d = new Date(r.date);
            const dateStr = d.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
            const scoreCls = r.pct >= 90 ? 'score-good' : r.pct >= 60 ? 'score-mid' : 'score-bad';
            const time = formatTime(r.time);
            const details = `${r.score}/${r.total}`;
            html += `<tr>
                <td>${dateStr} ${timeStr}</td>
                <td>${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.mode)}</td>
                <td>${escapeHtml(r.topic)}</td>
                <td class="${scoreCls}">${r.pct}%</td>
                <td>${time}</td>
                <td>${details}</td>
            </tr>`;
        });
        $reportsBody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.4);padding:24px;">No reports found</td></tr>';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    $reportApplyFilter.addEventListener('click', renderReports);
    $reportClearFilter.addEventListener('click', () => {
        $reportFilterName.value = '';
        $reportFilterFrom.value = '';
        $reportFilterTo.value = '';
        renderReports();
    });

    $reportDownload.addEventListener('click', async () => {
        const reports = await getReports();
        const nameFilter = $reportFilterName.value.trim().toLowerCase();
        const fromFilter = $reportFilterFrom.value;
        const toFilter = $reportFilterTo.value;

        let filtered = reports;
        if (nameFilter) filtered = filtered.filter(r => r.name.toLowerCase().includes(nameFilter));
        if (fromFilter) {
            const fromDate = new Date(fromFilter); fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(r => new Date(r.date) >= fromDate);
        }
        if (toFilter) {
            const toDate = new Date(toFilter); toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(r => new Date(r.date) <= toDate);
        }
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filtered.length === 0) return;

        let csv = 'Date,Name,Mode,Topic,Score,Total,Percentage,Time\n';
        filtered.forEach(r => {
            const d = new Date(r.date);
            const dateStr = d.toLocaleDateString('en-ZA') + ' ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
            csv += `"${dateStr}","${r.name}","${r.mode}","${r.topic}",${r.score},${r.total},${r.pct}%,"${formatTime(r.time)}"\n`;
        });

        // Add detailed breakdown per session
        csv += '\n\nDetailed Answers\n';
        filtered.forEach(r => {
            const d = new Date(r.date);
            csv += `\n${d.toLocaleDateString('en-ZA')} - ${r.name} - ${r.mode}: ${r.topic}\n`;
            csv += 'Question,Your Answer,Correct Answer,Result\n';
            r.answers.forEach((a, i) => {
                csv += `"${i + 1}. ${a.question}","${a.userAnswer}","${a.correctAnswer}",${a.correct ? 'Correct' : 'Wrong'}\n`;
            });
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `math-arena-reports-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    $reportsBackBtn.addEventListener('click', () => {
        $reportsView.classList.remove('active');
        $gameView.classList.add('active');
        $navTabs.forEach(t => t.classList.toggle('active', t.dataset.view === 'game'));
    });

    /* ---- Footer button ---- */
    $footerTrigger.addEventListener('click', () => {
        showReportsView();
    });

    /* ---- Init ---- */
    updateCalcDisplay();

})();
