/* ============================================
   Sharp EL-W535HT - Calculator Engine
   Expression parser, evaluator, and state
   ============================================ */

class CalculatorEngine {
    constructor() {
        this.tokens = [];
        this.cursor = 0;
        this.result = '0';
        this.lastAnswer = 0;
        this.memory = 0;
        this.memoryActive = false;
        this.angleMode = 'DEG';
        this.calcMode = 'NORMAL';
        this.fixDigits = -1;
        this.shiftActive = false;
        this.alphaActive = false;
        this.history = [];
        this.justEvaluated = false;
    }

    /* ---- Input Methods ---- */

    inputNumber(digit) {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
            this.result = '0';
        }
        const last = this.tokens[this.cursor - 1];
        if (last && last.type === 'number') {
            if (digit === '0' && last.value === '0') return;
            last.value += digit;
        } else {
            this.tokens.splice(this.cursor, 0, { type: 'number', value: digit });
            this.cursor++;
        }
        this._insertImplicitMul();
    }

    inputDecimal() {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
            this.result = '0';
        }
        const last = this.tokens[this.cursor - 1];
        if (last && last.type === 'number') {
            if (!last.value.includes('.')) {
                last.value += '.';
            }
        } else {
            this.tokens.splice(this.cursor, 0, { type: 'number', value: '0.' });
            this.cursor++;
        }
    }

    inputOperator(op) {
        this.justEvaluated = false;
        const last = this.tokens[this.cursor - 1];
        const opMap = { add: '+', sub: '-', mul: '*', div: '/' };
        const symbol = opMap[op] || op;

        // Helper: check if token is a "value-like" token (can precede an operator)
        const isValueToken = (t) => t && (
            t.type === 'number' || t.type === 'constant' ||
            t.value === ')' || t.type === 'postfix'
        );

        if (last && last.type === 'operator') {
            if (symbol === '-' && (last.value === '+' || last.value === '-')) {
                this.tokens.splice(this.cursor, 0, { type: 'number', value: '0' });
                this.cursor++;
            } else {
                last.value = symbol;
            }
        } else if (!isValueToken(last)) {
            if (symbol === '-') {
                this.tokens.splice(this.cursor, 0, { type: 'number', value: '0' });
                this.cursor++;
            }
        }
        if (isValueToken(this.tokens[this.cursor - 1])) {
            this.tokens.splice(this.cursor, 0, { type: 'operator', value: symbol });
            this.cursor++;
        }
    }

    inputFunction(name) {
        if (this.justEvaluated) {
            const funcNames = {
                'sin': 'sin', 'cos': 'cos', 'tan': 'tan',
                'sin-inv': 'asin', 'cos-inv': 'acos', 'tan-inv': 'atan',
                'log': 'log', 'ln': 'ln',
                'sqrt': 'sqrt', 'cbrt': 'cbrt',
                'square': 'sq', 'cube': 'cb',
                'exp10': 'tenpow', 'expE': 'epow',
                'abs': 'abs', 'recip': 'recip',
                'neg': 'neg', 'factorial': 'fact',
                'recip-sqrt': 'rsqrt'
            };
            const fn = funcNames[name] || name;
            const postfix = ['sq', 'cb', 'fact', 'recip', 'rsqrt'];
            if (postfix.includes(fn)) {
                this.tokens = [{ type: 'number', value: this.result }];
                this.cursor = 1;
            } else {
                this.tokens = [];
                this.cursor = 0;
            }
            this.justEvaluated = false;
            this.result = '0';
        }

        const funcMap = {
            'sin': { type: 'function', value: 'sin', display: 'sin(' },
            'cos': { type: 'function', value: 'cos', display: 'cos(' },
            'tan': { type: 'function', value: 'tan', display: 'tan(' },
            'sin-inv': { type: 'function', value: 'asin', display: 'sin\u207B\u00B9(' },
            'cos-inv': { type: 'function', value: 'acos', display: 'cos\u207B\u00B9(' },
            'tan-inv': { type: 'function', value: 'atan', display: 'tan\u207B\u00B9(' },
            'log': { type: 'function', value: 'log', display: 'log(' },
            'ln': { type: 'function', value: 'ln', display: 'ln(' },
            'sqrt': { type: 'function', value: 'sqrt', display: '\u221A(' },
            'cbrt': { type: 'function', value: 'cbrt', display: '\u00B3\u221A(' },
            'exp10': { type: 'function', value: 'tenpow', display: '10^(' },
            'expE': { type: 'function', value: 'epow', display: 'e^(' },
            'abs': { type: 'function', value: 'abs', display: 'abs(' },
            'neg': { type: 'function', value: 'neg', display: '-(' },
        };

        const postfixMap = {
            'square': { type: 'postfix', value: 'sq', display: '^2' },
            'cube': { type: 'postfix', value: 'cb', display: '^3' },
            'factorial': { type: 'postfix', value: 'fact', display: '!' },
            'recip': { type: 'postfix', value: 'recip', display: '\u207B\u00B9' },
            'recip-sqrt': { type: 'postfix', value: 'rsqrt', display: '\u207B\u00B9/\u221A' },
        };

        if (funcMap[name]) {
            this.tokens.splice(this.cursor, 0, funcMap[name]);
            this.cursor++;
            this._autoOpenParen();
        } else if (postfixMap[name]) {
            this.tokens.splice(this.cursor, 0, postfixMap[name]);
            this.cursor++;
        }
        this._insertImplicitMul();
    }

    inputPower() {
        if (this.justEvaluated) {
            this.tokens = [{ type: 'number', value: this.result }];
            this.cursor = 1;
            this.justEvaluated = false;
        }
        this.tokens.splice(this.cursor, 0, { type: 'operator', value: '^' });
        this.cursor++;
    }

    inputLParen() {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
            this.result = '0';
        }
        this.tokens.splice(this.cursor, 0, { type: 'paren', value: '(' });
        this.cursor++;
        this._insertImplicitMul(true);
    }

    inputRParen() {
        const openCount = this.tokens.slice(0, this.cursor).filter(t => t.value === '(').length;
        const closeCount = this.tokens.slice(0, this.cursor).filter(t => t.value === ')').length;
        if (openCount > closeCount) {
            this.tokens.splice(this.cursor, 0, { type: 'paren', value: ')' });
            this.cursor++;
            this.justEvaluated = false;
        }
    }

    inputFraction() {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
        }
        this.tokens.splice(this.cursor, 0, { type: 'fraction', value: '/', display: '\u00F7' });
        this.cursor++;
        this._insertImplicitMul();
    }

    inputExp() {
        if (this.justEvaluated) {
            this.tokens = [{ type: 'number', value: this.result }];
            this.cursor = 1;
            this.justEvaluated = false;
        }
        this.tokens.splice(this.cursor, 0, { type: 'operator', value: 'E' });
        this.cursor++;
    }

    inputConstant(name) {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
            this.result = '0';
        }
        const val = name === 'pi' ? Math.PI : Math.E;
        this.tokens.splice(this.cursor, 0, { type: 'constant', value: name, numValue: val, display: name === 'pi' ? '\u03C0' : 'e' });
        this.cursor++;
        this._insertImplicitMul();
    }

    inputAns() {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
        }
        this.tokens.splice(this.cursor, 0, { type: 'constant', value: 'ans', numValue: this.lastAnswer, display: 'Ans' });
        this.cursor++;
        this._insertImplicitMul();
    }

    inputPercent() {
        this.tokens.splice(this.cursor, 0, { type: 'postfix', value: 'percent', display: '%' });
        this.cursor++;
    }

    /* ---- Navigation ---- */

    moveCursorLeft() {
        if (this.cursor > 0) {
            this.cursor--;
            this.justEvaluated = false;
        }
    }

    moveCursorRight() {
        if (this.cursor < this.tokens.length) {
            this.cursor++;
            this.justEvaluated = false;
        }
    }

    deleteToken() {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
            this.result = '0';
            return;
        }
        if (this.cursor > 0) {
            this.tokens.splice(this.cursor - 1, 1);
            this.cursor--;
        }
    }

    backspace() {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
            this.result = '0';
            return;
        }
        if (this.cursor > 0) {
            const token = this.tokens[this.cursor - 1];
            if (token.type === 'number' && token.value.length > 1) {
                token.value = token.value.slice(0, -1);
            } else {
                this.tokens.splice(this.cursor - 1, 1);
                this.cursor--;
            }
        }
    }

    clearAll() {
        this.tokens = [];
        this.cursor = 0;
        this.result = '0';
        this.justEvaluated = false;
        this.shiftActive = false;
        this.alphaActive = false;
    }

    home() {
        this.clearAll();
    }

    /* ---- Evaluation ---- */

    evaluate() {
        try {
            if (this.tokens.length === 0) return;

            let evalTokens = this._prepareForEval();
            if (evalTokens.length === 0) return;

            const result = this._evaluateTokens(evalTokens);

            if (typeof result === 'number') {
                if (!isFinite(result) && !isNaN(result)) {
                    this.result = 'ERROR';
                    return;
                }
                if (isNaN(result)) {
                    this.result = 'ERROR';
                    return;
                }
                this.lastAnswer = result;
                this.result = this._formatNumber(result);
                this.history.push({
                    expr: this._renderExpression(false),
                    result: this.result
                });
                this.justEvaluated = true;
            } else {
                this.result = 'ERROR';
            }
        } catch (e) {
            this.result = 'ERROR';
        }
    }

    _prepareForEval() {
        let tokens = [...this.tokens];

        // Auto-close open parentheses
        const openCount = tokens.filter(t => t.value === '(').length;
        const closeCount = tokens.filter(t => t.value === ')').length;
        for (let i = 0; i < openCount - closeCount; i++) {
            tokens.push({ type: 'paren', value: ')' });
        }

        return tokens;
    }

    _evaluateTokens(tokens) {
        const postfix = this._toPostfix(tokens);
        return this._evalPostfix(postfix);
    }

    _toPostfix(tokens) {
        const output = [];
        const opStack = [];
        const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4, 'E': 5 };
        const rightAssoc = { '^': true };

        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];

            if (t.type === 'number') {
                output.push({ type: 'number', value: parseFloat(t.value) });
            } else if (t.type === 'constant') {
                output.push({ type: 'number', value: t.numValue });
            } else if (t.type === 'function') {
                opStack.push({ type: 'function', value: t.value });
            } else if (t.type === 'postfix') {
                output.push({ type: 'postfix', value: t.value });
            } else if (t.type === 'operator') {
                if (t.value === 'E') {
                    // Scientific notation: combine with next number
                    const base = output.pop();
                    i++;
                    if (i < tokens.length && tokens[i].type === 'number') {
                        const exp = parseFloat(tokens[i].value);
                        output.push({ type: 'number', value: base.value * Math.pow(10, exp) });
                    }
                    i--;
                } else {
                    while (opStack.length > 0) {
                        const top = opStack[opStack.length - 1];
                        if (top.type === 'function') {
                            output.push(opStack.pop());
                        } else if (top.type === 'operator' &&
                            ((rightAssoc[t.value] && precedence[top.value] > precedence[t.value]) ||
                             (!rightAssoc[t.value] && precedence[top.value] >= precedence[t.value]))) {
                            output.push(opStack.pop());
                        } else {
                            break;
                        }
                    }
                    opStack.push({ type: 'operator', value: t.value });
                }
            } else if (t.type === 'paren') {
                if (t.value === '(') {
                    opStack.push({ type: 'paren', value: '(' });
                } else {
                    while (opStack.length > 0 && !(opStack[opStack.length - 1].type === 'paren' && opStack[opStack.length - 1].value === '(')) {
                        output.push(opStack.pop());
                    }
                    if (opStack.length > 0) opStack.pop(); // remove '('
                    if (opStack.length > 0 && opStack[opStack.length - 1].type === 'function') {
                        output.push(opStack.pop());
                    }
                }
            } else if (t.type === 'fraction') {
                while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'paren') {
                    output.push(opStack.pop());
                }
                opStack.push({ type: 'operator', value: '/' });
            }
            i++;
        }

        while (opStack.length > 0) {
            output.push(opStack.pop());
        }

        return output;
    }

    _evalPostfix(postfix) {
        const stack = [];

        for (const t of postfix) {
            if (t.type === 'number') {
                stack.push(t.value);
            } else if (t.type === 'operator') {
                const b = stack.pop();
                const a = stack.pop();
                if (a === undefined || b === undefined) throw new Error('Syntax error');
                switch (t.value) {
                    case '+': stack.push(a + b); break;
                    case '-': stack.push(a - b); break;
                    case '*': stack.push(a * b); break;
                    case '/':
                        if (b === 0) throw new Error('Divide by zero');
                        stack.push(a / b);
                        break;
                    case '^': stack.push(Math.pow(a, b)); break;
                }
            } else if (t.type === 'function') {
                const a = stack.pop();
                if (a === undefined) throw new Error('Syntax error');
                stack.push(this._applyFunction(t.value, a));
            } else if (t.type === 'postfix') {
                const a = stack.pop();
                if (a === undefined) throw new Error('Syntax error');
                stack.push(this._applyPostfix(t.value, a));
            }
        }

        return stack.length === 1 ? stack[0] : NaN;
    }

    _applyFunction(name, value) {
        const toRad = { DEG: Math.PI / 180, RAD: 1, GRA: Math.PI / 200 };
        const fromRad = { DEG: 180 / Math.PI, RAD: 1, GRA: 200 / Math.PI };
        const factor = toRad[this.angleMode];
        const invFactor = fromRad[this.angleMode];

        switch (name) {
            case 'sin': return Math.sin(value * factor);
            case 'cos': return Math.cos(value * factor);
            case 'tan': return Math.tan(value * factor);
            case 'asin':
                if (value < -1 || value > 1) throw new Error('Domain error');
                return Math.asin(value) * invFactor;
            case 'acos':
                if (value < -1 || value > 1) throw new Error('Domain error');
                return Math.acos(value) * invFactor;
            case 'atan': return Math.atan(value) * invFactor;
            case 'log':
                if (value <= 0) throw new Error('Domain error');
                return Math.log10(value);
            case 'ln':
                if (value <= 0) throw new Error('Domain error');
                return Math.log(value);
            case 'sqrt':
                if (value < 0) throw new Error('Domain error');
                return Math.sqrt(value);
            case 'cbrt': return Math.cbrt(value);
            case 'abs': return Math.abs(value);
            case 'tenpow': return Math.pow(10, value);
            case 'epow': return Math.exp(value);
            case 'neg': return -value;
            default: throw new Error('Unknown function: ' + name);
        }
    }

    _applyPostfix(name, value) {
        switch (name) {
            case 'sq': return value * value;
            case 'cb': return value * value * value;
            case 'fact': return this._factorial(value);
            case 'recip':
                if (value === 0) throw new Error('Divide by zero');
                return 1 / value;
            case 'rsqrt':
                if (value <= 0) throw new Error('Domain error');
                return 1 / Math.sqrt(value);
            case 'percent': return value / 100;
            default: return value;
        }
    }

    _factorial(n) {
        if (n < 0) throw new Error('Domain error');
        if (!Number.isInteger(n)) {
            return this._gamma(n + 1);
        }
        if (n > 170) return Infinity;
        let result = 1;
        for (let i = 2; i <= n; i++) result *= i;
        return result;
    }

    _gamma(z) {
        if (z < 0.5) {
            return Math.PI / (Math.sin(Math.PI * z) * this._gamma(1 - z));
        }
        z -= 1;
        const g = 7;
        const c = [
            0.99999999999980993, 676.5203681218851, -1259.1392167224028,
            771.32342877765313, -176.61502916214059, 12.507343278686905,
            -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
        ];
        const x = c[0];
        let t = 0;
        for (let i = 1; i < g + 2; i++) {
            t += c[i] / (z + i);
        }
        const result = x + t;
        return Math.sqrt(2 * Math.PI) * Math.pow(z + g + 0.5, z + 0.5) * Math.exp(-(z + g + 0.5)) * result;
    }

    /* ---- Implicit Multiplication ---- */

    _insertImplicitMul(skipParen) {
        if (this.cursor < 2) return;
        const prev = this.tokens[this.cursor - 2];
        const curr = this.tokens[this.cursor - 1];
        if (!prev || !curr) return;

        const prevIsValue = prev.type === 'number' || prev.type === 'constant' ||
                           prev.value === ')' || prev.value === '!' ||
                           ['sq', 'cb', 'fact', 'recip', 'rsqrt', 'percent'].includes(prev.value);
        const currNeedsMul = curr.type === 'number' || curr.type === 'constant' ||
                            curr.type === 'function' || (curr.type === 'paren' && curr.value === '(' && !skipParen);

        if (prevIsValue && currNeedsMul) {
            this.tokens.splice(this.cursor - 1, 0, { type: 'operator', value: '*' });
            this.cursor++;
        }
    }

    _autoOpenParen() {
        // Functions automatically open a paren context
    }

    /* ---- Number Formatting ---- */

    _formatNumber(num) {
        if (Number.isInteger(num) && Math.abs(num) < 1e15) {
            return num.toString();
        }

        if (Math.abs(num) > 1e15 || (Math.abs(num) < 1e-10 && num !== 0)) {
            return num.toExponential(9).replace(/\.?0+e/, 'e');
        }

        if (this.fixDigits >= 0) {
            return num.toFixed(this.fixDigits);
        }

        let str = num.toPrecision(12);
        if (str.includes('.')) {
            str = str.replace(/\.?0+$/, '');
        }
        return str;
    }

    /* ---- Display Rendering ---- */

    renderExpression() {
        return this._renderExpression(true);
    }

    _renderExpression(withCursor) {
        let html = '';
        for (let i = 0; i < this.tokens.length; i++) {
            if (withCursor && i === this.cursor) {
                html += '<span class="cursor"></span>';
            }
            const t = this.tokens[i];
            switch (t.type) {
                case 'number': html += this._escHtml(t.value); break;
                case 'operator':
                    if (t.value === '*') html += '\u00D7';
                    else if (t.value === '/') html += '\u00F7';
                    else html += t.value;
                    break;
                case 'function': html += t.display || (t.value + '('); break;
                case 'postfix': html += t.display || t.value; break;
                case 'paren': html += t.value; break;
                case 'constant': html += t.display || t.value; break;
                case 'fraction': html += '\u00F7'; break;
            }
        }
        if (withCursor && this.cursor >= this.tokens.length) {
            html += '<span class="cursor"></span>';
        }
        return html;
    }

    _escHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* ---- Mode Switching ---- */

    cycleAngleMode() {
        const modes = ['DEG', 'RAD', 'GRA'];
        const idx = modes.indexOf(this.angleMode);
        this.angleMode = modes[(idx + 1) % modes.length];
    }

    cycleCalcMode() {
        return 'NORMAL';
    }

    setCalcMode(mode) {
        this.calcMode = 'NORMAL';
    }

    /* ---- Memory ---- */

    memoryClear() {
        this.memory = 0;
        this.memoryActive = false;
    }

    memoryRecall() {
        if (this.justEvaluated) {
            this.tokens = [];
            this.cursor = 0;
            this.justEvaluated = false;
        }
        this.tokens.splice(this.cursor, 0, { type: 'number', value: this._formatNumber(this.memory) });
        this.cursor++;
        this._insertImplicitMul();
    }

    memoryStore() {
        try {
            const val = this.justEvaluated ? parseFloat(this.result) : this._evaluateTokens(this._prepareForEval());
            if (!isNaN(val)) {
                this.memory = val;
                this.memoryActive = true;
            }
        } catch (e) { /* ignore */ }
    }

    memoryAdd() {
        try {
            const val = this.justEvaluated ? parseFloat(this.result) : this._evaluateTokens(this._prepareForEval());
            if (!isNaN(val)) {
                this.memory += val;
                this.memoryActive = true;
            }
        } catch (e) { /* ignore */ }
    }

    memorySubtract() {
        try {
            const val = this.justEvaluated ? parseFloat(this.result) : this._evaluateTokens(this._prepareForEval());
            if (!isNaN(val)) {
                this.memory -= val;
                this.memoryActive = true;
            }
        } catch (e) { /* ignore */ }
    }
}
