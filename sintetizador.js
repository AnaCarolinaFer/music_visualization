class AnalisadorStem {
    constructor(nome = '') {
        this._hist              = [];
        this.HIST_FRAMES        = 30;
        this.PICO_FRAMES        = 12;
        this.DECAIMENTO_LKB     = 6;
        this.SUBONSET_LOOKBACK  = 3;
        this.SUBONSET_LIMIAR    = 0.015;
        this.SUBONSET_COOLDOWN  = 8;
        this._framesDesdeSubOnset = 999;
    }

    enriquecer(amplitude) {
        const h = this._hist;
        h.push(amplitude);
        if (h.length > this.HIST_FRAMES) h.shift();

        const slice          = h.length <= this.PICO_FRAMES ? h : h.slice(-this.PICO_FRAMES);
        const pico           = slice.reduce((m, a) => Math.max(m, a), 0);

        const idxAntes       = h.length - this.DECAIMENTO_LKB - 1;
        const ampAntes       = idxAntes >= 0 ? h[idxAntes] : amplitude;
        const taxaDecaimento = Math.max(0, (ampAntes - amplitude) / this.DECAIMENTO_LKB);

        const n             = h.length;
        const media         = h.reduce((s, a) => s + a, 0) / n;
        const variabilidade = Math.sqrt(h.reduce((s, a) => s + (a - media) ** 2, 0) / n);

        const idxSubAntes = h.length - 1 - this.SUBONSET_LOOKBACK;
        const ampSubAntes = idxSubAntes >= 0 ? h[idxSubAntes] : 0;
        const taxaAtaque  = amplitude - ampSubAntes;
        let subOnset = false;
        if (taxaAtaque > this.SUBONSET_LIMIAR && this._framesDesdeSubOnset > this.SUBONSET_COOLDOWN) {
            subOnset = true;
            this._framesDesdeSubOnset = 0;
        } else {
            this._framesDesdeSubOnset++;
        }

        return { pico, taxaDecaimento, variabilidade, subOnset };
    }
}

class Sintetizador {
    constructor() {
        this.audioCtx       = null;
        this.especieAtiva   = null;
        this._stimAtivo     = null;
        this.ultimoEstimulo = null;
        this._analisadores  = {
            graves:    new AnalisadorStem('graves'),
            melodia:   new AnalisadorStem('melodia'),
            percussao: new AnalisadorStem('percussao'),
            agudos:    new AnalisadorStem('agudos'),
        };
    }

    setEspecieAtiva(especie) {
        this.especieAtiva = especie;
        this._pararTudo();
        this.ultimoEstimulo = null;
    }

    _iniciarCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }

    _pararTudo() {
        if (!this._stimAtivo) return;
        const now = this.audioCtx ? this.audioCtx.currentTime : 0;
        for (const n of this._stimAtivo.nodes) {
            try { n.gain.cancelScheduledValues(now); n.gain.linearRampToValueAtTime(0, now + 0.03); } catch (_) {}
            try { n.osc.stop(now + 0.04); } catch (_) {}
        }
        this._stimAtivo = null;
    }

    tocarEstimulo(nome) {
        if (!this.especieAtiva) return;
        this._iniciarCtx();
        this._pararTudo();

        const vol  = (typeof gerenciador !== 'undefined' && gerenciador.volume != null)
            ? gerenciador.volume * 0.3 : 0.3;
        const ctx  = this.audioCtx;
        const now  = ctx.currentTime;
        const nodes = [];
        let duracao = 1.5;

        if      (this.especieAtiva === 'arvore')  duracao = this._arvore(ctx, now, nome, vol, nodes);
        else if (this.especieAtiva === 'flor')    duracao = this._flor(ctx, now, nome, vol, nodes);
        else if (this.especieAtiva === 'arbusto') duracao = this._arbusto(ctx, now, nome, vol, nodes);
        else if (this.especieAtiva === 'dente')   duracao = this._dente(ctx, now, nome, vol, nodes);

        this._stimAtivo     = { nome, startPerf: performance.now(), duracao, nodes };
        this.ultimoEstimulo = nome;
    }

    // ── helpers ───────────────────────────────────────────────

    _sawGain(ctx, now, freq, gainKF, vol, nodes, dur) {
        const osc  = ctx.createOscillator();
        osc.type   = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        const filt = ctx.createBiquadFilter();
        filt.type  = 'lowpass';
        filt.frequency.value = 400;
        filt.Q.value = 4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        for (const [t, v] of gainKF) g.gain.linearRampToValueAtTime(v * vol, now + t);
        osc.connect(filt); filt.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + dur + 0.05);
        nodes.push({ osc, gain: g });
    }

    _sineGain(ctx, now, freq0, freq1, gainKF, vol, nodes, dur, lfoHz) {
        const osc = ctx.createOscillator();
        osc.type  = 'sine';
        osc.frequency.setValueAtTime(freq0, now);
        if (freq1 !== freq0) osc.frequency.linearRampToValueAtTime(freq1, now + dur);
        if (lfoHz) {
            const lfo  = ctx.createOscillator();
            lfo.type   = 'sine';
            lfo.frequency.value = lfoHz;
            const lfoG = ctx.createGain(); lfoG.gain.value = 2;
            lfo.connect(lfoG); lfoG.connect(osc.frequency);
            lfo.start(now); lfo.stop(now + dur + 0.05);
            nodes.push({ osc: lfo, gain: lfoG });
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        for (const [t, v] of gainKF) g.gain.linearRampToValueAtTime(v * vol, now + t);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + dur + 0.05);
        nodes.push({ osc, gain: g });
    }

    _squareBeat(ctx, now, t0, amp, vol, nodes) {
        const osc = ctx.createOscillator();
        osc.type  = 'square';
        osc.frequency.value = 100;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now + t0);
        g.gain.linearRampToValueAtTime(amp * vol, now + t0 + 0.005);
        g.gain.linearRampToValueAtTime(0, now + t0 + 0.105);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + t0); osc.stop(now + t0 + 0.12);
        nodes.push({ osc, gain: g });
    }

    _triHpGain(ctx, now, t0, freq, gainKF, vol, nodes, dur) {
        const osc = ctx.createOscillator();
        osc.type  = 'triangle';
        osc.frequency.setValueAtTime(freq, now + t0);
        const hp  = ctx.createBiquadFilter();
        hp.type   = 'highpass'; hp.frequency.value = 800;
        const g   = ctx.createGain();
        g.gain.setValueAtTime(0, now + t0);
        for (const [dt, v] of gainKF) g.gain.linearRampToValueAtTime(v * vol, now + t0 + dt);
        osc.connect(hp); hp.connect(g); g.connect(ctx.destination);
        osc.start(now + t0); osc.stop(now + t0 + dur + 0.05);
        nodes.push({ osc, gain: g });
    }

    // ── espécies ──────────────────────────────────────────────

    _arvore(ctx, now, nome, vol, nodes) {
        if (nome === 'Grave suave') {
            this._sawGain(ctx, now, 110, [[0.05, 0.08], [0.85, 0.08], [1.25, 0]], vol, nodes, 1.25);
            return 1.3;
        }
        if (nome === 'Grave forte') {
            this._sawGain(ctx, now, 110, [[0.03, 0.22], [1.03, 0.22], [1.53, 0]], vol, nodes, 1.55);
            return 1.6;
        }
        if (nome === 'Trovão') {
            this._sawGain(ctx, now, 100, [[0.005, 0.30], [0.105, 0.10], [0.805, 0.10], [1.405, 0]], vol, nodes, 1.45);
            return 1.5;
        }
        if (nome === 'Onda grave') {
            this._sawGain(ctx, now, 110, [
                [0.05, 0.20], [0.50, 0.10], [1.00, 0.20], [1.50, 0.10], [2.00, 0.20], [2.20, 0]
            ], vol, nodes, 2.25);
            return 2.25;
        }
        return 1.5;
    }

    _flor(ctx, now, nome, vol, nodes) {
        if (nome === 'Canto curto') {
            this._sineGain(ctx, now, 330, 330, [[0.03, 0.15], [0.28, 0.15], [0.48, 0]], vol, nodes, 0.5, 5);
            return 0.55;
        }
        if (nome === 'Canto longo') {
            this._sineGain(ctx, now, 330, 330, [[0.10, 0.18], [1.95, 0.18], [2.35, 0]], vol, nodes, 2.4, 5);
            return 2.4;
        }
        if (nome === 'Canto subindo') {
            this._sineGain(ctx, now, 261, 440, [[0.05, 0.05], [2.0, 0.25], [2.3, 0]], vol, nodes, 2.35, 4);
            return 2.35;
        }
        if (nome === 'Canto descendo') {
            this._sineGain(ctx, now, 440, 261, [[0.05, 0.25], [2.0, 0.05], [2.3, 0]], vol, nodes, 2.35, 4);
            return 2.35;
        }
        return 1.5;
    }

    _arbusto(ctx, now, nome, vol, nodes) {
        if (nome === 'Batida fraca') {
            this._squareBeat(ctx, now, 0, 0.10, vol, nodes);
            return 0.15;
        }
        if (nome === 'Batida forte') {
            const osc = ctx.createOscillator();
            osc.type  = 'square'; osc.frequency.value = 100;
            const g   = ctx.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.25 * vol, now + 0.003);
            g.gain.linearRampToValueAtTime(0, now + 0.083);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.10);
            nodes.push({ osc, gain: g });
            return 0.12;
        }
        if (nome === 'Ritmo lento') {
            for (let i = 0; i < 4; i++) this._squareBeat(ctx, now, i * 1.0, 0.10, vol, nodes);
            return 3.2;
        }
        if (nome === 'Ritmo rápido') {
            for (let i = 0; i < 8; i++) this._squareBeat(ctx, now, i * 0.25, 0.10, vol, nodes);
            return 2.0;
        }
        return 0.2;
    }

    _dente(ctx, now, nome, vol, nodes) {
        if (nome === 'Som leve') {
            this._triHpGain(ctx, now, 0, 880, [[0.10, 0.10], [0.90, 0.10], [1.20, 0]], vol, nodes, 1.25);
            return 1.3;
        }
        if (nome === 'Faísca') {
            this._triHpGain(ctx, now, 0, 880, [[0.05, 0.24], [0.15, 0.15], [1.15, 0.15], [1.55, 0]], vol, nodes, 1.6);
            return 1.6;
        }
        if (nome === 'Tilintar') {
            const freqs = [880, 1047, 1175, 1319];
            for (let i = 0; i < 4; i++) {
                this._triHpGain(ctx, now, i * 0.25, freqs[i],
                    [[0.01, 0.15], [0.09, 0]], vol, nodes, 0.10);
            }
            return 0.95;
        }
        if (nome === 'Sussurro') {
            this._triHpGain(ctx, now, 0, 880, [
                [0.10, 0.05], [0.70, 0.10], [1.40, 0.05], [2.10, 0.10], [2.50, 0.05], [2.70, 0]
            ], vol, nodes, 2.75);
            return 2.75;
        }
        return 1.3;
    }

    // ── analisarVirtual ───────────────────────────────────────

    _enriquecerTodos(r) {
        for (const chave of ['graves', 'melodia', 'percussao', 'agudos']) {
            Object.assign(r[chave], this._analisadores[chave].enriquecer(r[chave].amplitude));
        }
        return r;
    }

    analisarVirtual() {
        const zero = { amplitude: 0, onset: false, energia: 0 };
        const r    = { graves: { ...zero }, melodia: { ...zero }, percussao: { ...zero }, agudos: { ...zero } };

        if (!this._stimAtivo || !this.especieAtiva) return this._enriquecerTodos(r);

        const t = (performance.now() - this._stimAtivo.startPerf) / 1000;
        if (t > this._stimAtivo.duracao) { this._stimAtivo = null; return this._enriquecerTodos(r); }

        const chave = { arvore: 'graves', flor: 'melodia', arbusto: 'percussao', dente: 'agudos' }[this.especieAtiva];
        const nome  = this._stimAtivo.nome;

        let amp   = 0;
        let onset = false;

        if (this.especieAtiva === 'arvore') {
            if (nome === 'Grave suave') {
                amp   = _interpKF(t, [[0, 0], [0.05, 0.08], [0.85, 0.08], [1.25, 0]]);
                onset = t < 0.083;
            } else if (nome === 'Grave forte') {
                amp   = _interpKF(t, [[0, 0], [0.03, 0.22], [1.03, 0.22], [1.53, 0]]);
                onset = t < 0.083;
            } else if (nome === 'Trovão') {
                amp   = _interpKF(t, [[0, 0], [0.005, 0.30], [0.105, 0.10], [0.805, 0.10], [1.405, 0]]);
                onset = t < 0.083;
            } else if (nome === 'Onda grave') {
                amp   = _interpKF(t, [[0, 0], [0.05, 0.20], [0.50, 0.10], [1.00, 0.20], [1.50, 0.10], [2.00, 0.20], [2.20, 0]]);
                onset = t < 0.083 || (t > 0.917 && t < 1.083);
            }
        } else if (this.especieAtiva === 'flor') {
            if (nome === 'Canto curto') {
                amp   = _interpKF(t, [[0, 0], [0.03, 0.15], [0.28, 0.15], [0.48, 0]]);
                onset = t < 0.083;
            } else if (nome === 'Canto longo') {
                amp   = _interpKF(t, [[0, 0], [0.10, 0.18], [1.95, 0.18], [2.35, 0]]);
                onset = t < 0.083;
            } else if (nome === 'Canto subindo') {
                amp   = _interpKF(t, [[0, 0], [0.05, 0.05], [2.0, 0.25], [2.3, 0]]);
                onset = t < 0.083;
            } else if (nome === 'Canto descendo') {
                amp   = _interpKF(t, [[0, 0], [0.05, 0.25], [2.0, 0.05], [2.3, 0]]);
                onset = t < 0.083;
            }
        } else if (this.especieAtiva === 'arbusto') {
            const beatTimes = nome === 'Ritmo lento'  ? [0, 1.0, 2.0, 3.0]
                            : nome === 'Ritmo rápido' ? [0, .25, .5, .75, 1.0, 1.25, 1.5, 1.75]
                            : [0];
            const peakAmp = nome === 'Batida forte' ? 0.25 : 0.10;
            for (const bt of beatTimes) {
                const dt = t - bt;
                if (dt >= 0 && dt < 0.110) {
                    amp   = Math.max(amp, _interpKF(dt, [[0, 0], [0.005, peakAmp], [0.110, 0]]));
                    onset = onset || dt < 0.083;
                }
            }
        } else if (this.especieAtiva === 'dente') {
            if (nome === 'Som leve') {
                amp   = _interpKF(t, [[0, 0], [0.10, 0.10], [0.90, 0.10], [1.20, 0]]);
                onset = t < 0.083;
            } else if (nome === 'Faísca') {
                amp   = _interpKF(t, [[0, 0], [0.05, 0.24], [0.15, 0.15], [1.15, 0.15], [1.55, 0]]);
                onset = t < 0.083;
            } else if (nome === 'Tilintar') {
                for (let i = 0; i < 4; i++) {
                    const dt = t - i * 0.25;
                    if (dt >= 0 && dt < 0.10) {
                        amp   = Math.max(amp, _interpKF(dt, [[0, 0], [0.01, 0.15], [0.09, 0]]));
                        onset = onset || dt < 0.083;
                    }
                }
            } else if (nome === 'Sussurro') {
                amp   = _interpKF(t, [[0, 0], [0.10, 0.05], [0.70, 0.10], [1.40, 0.05], [2.10, 0.10], [2.50, 0.05], [2.70, 0]]);
                onset = t < 0.083;
            }
        }

        r[chave] = { amplitude: amp, onset, energia: amp * 2 };
        return this._enriquecerTodos(r);
    }
}

function _interpKF(t, kf) {
    if (t <= kf[0][0]) return kf[0][1];
    if (t >= kf[kf.length - 1][0]) return kf[kf.length - 1][1];
    for (let i = 1; i < kf.length; i++) {
        if (t <= kf[i][0]) {
            const t0 = kf[i-1][0], a0 = kf[i-1][1];
            const t1 = kf[i][0],   a1 = kf[i][1];
            return a0 + (a1 - a0) * ((t - t0) / (t1 - t0));
        }
    }
    return 0;
}

// Estímulos definidos em js/textos.js como TEXTOS.estimulos
