/**
 * Classes de plantas para o Jardim Musical — renderer WEBGL.
 * Sprites animados em texture atlas (Framebuffer) gerado por sprites.js.
 * Arvores e Flores usam curva de Bezier para a haste.
 * Arbustos e Dentes usam quad texturizado simples.
 * Animação de crescimento gerida por AnimadorPlanta (animacao.js).
 */

// ============================================================
// Extração de sprites estáticos (para nuvens — sem animação)
// ============================================================

const pixelClassify = (() => {
    const rgbaWord = new Uint32Array(1);
    const rgba = new Uint8Array(rgbaWord.buffer);
    const T = 0x12;
    return (pixel) => {
        rgbaWord[0] = pixel;
        return rgba[0] > T || rgba[1] > T || rgba[2] > T ? 1 : 0;
    };
})();

function componentBoundingBox(runs) {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    let area = 0;
    for (const run of runs) {
        xmin = min(xmin, run.x);
        xmax = max(xmax, run.x + run.len);
        ymin = min(ymin, run.y);
        ymax = max(ymax, run.y + 1);
        area += run.len;
    }
    return { x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin, area };
}

function extrairSpritesAtlas(sheetImg) {
    sheetImg.pixelDensity(1);
    sheetImg.loadPixels();
    const components = imageComponents(
        sheetImg.pixels, sheetImg.width, sheetImg.height, pixelClassify
    );
    const rawSprites = [];
    let spriteWidth = 0, spriteHeight = 0;
    for (const comp of components) {
        const bb = componentBoundingBox(comp);
        const { width: w, height: h } = bb;
        if (w < sheetImg.width * 0.8 && w > 5 && h > 5) {
            spriteWidth  = max(spriteWidth,  w);
            spriteHeight = max(spriteHeight, h);
            rawSprites.push(bb);
        } else {
            paintComponent(sheetImg.pixels, sheetImg.width, sheetImg.height, comp, 0);
        }
    }
    sheetImg.updatePixels();
    if (rawSprites.length === 0) return { fb: null, sprites: [], spriteWidth: 0, spriteHeight: 0 };
    for (const s of rawSprites) s.img = sheetImg.get(s.x, s.y, s.width, s.height);
    rawSprites.sort((a, b) => a.x - b.x);
    const n = rawSprites.length;
    const atlasWidth = spriteWidth * n;
    const fb = createFramebuffer({ width: atlasWidth, height: spriteHeight, density: 1 });
    fb.begin();
    imageMode(CORNER);
    clear();
    for (let i = 0; i < n; i++) {
        const { img, height: h } = rawSprites[i];
        image(img, -atlasWidth / 2 + i * spriteWidth, -spriteHeight / 2 + (spriteHeight - h));
    }
    fb.end();
    const sprites = rawSprites.map((s, i) => ({
        u0:   i / n,
        u1:   (i + 1) / n,
        vTop: (spriteHeight - s.height) / spriteHeight,
        vBot: 1,
        w:    s.width,
        h:    s.height
    }));
    return { fb, sprites, spriteWidth, spriteHeight };
}

// ============================================================
// Geometria Bezier (Arvore e Flor)
// ============================================================

function bezierStalk(xbase, ybase, h, bend) {
    const r = h / 3;
    let ang = -PI / 2;
    const x2 = xbase + r * cos(ang); const y2 = ybase + r * sin(ang);
    ang += PI / 2 * bend;
    const x3 = x2 + r * cos(ang);   const y3 = y2 + r * sin(ang);
    ang += PI / 2 * bend;
    const x4 = x3 + r * cos(ang);   const y4 = y3 + r * sin(ang);
    return [xbase, ybase, x2, y2, x3, y3, x4, y4];
}

function bezierQuad(x1, y1, x2, y2, x3, y3, x4, y4, sz, n, u1, u2, vTop, vBot) {
    beginShape(QUAD_STRIP);
    const step = 1 / (n - 1);
    for (let i = 0; i < n; i++) {
        const t    = step * i;
        const xs   = bezierPoint(x1, x2, x3, x4, t);
        const ys   = bezierPoint(y1, y2, y3, y4, t);
        const xtan = bezierTangent(x1, x2, x3, x4, t);
        const ytan = bezierTangent(y1, y2, y3, y4, t);
        const delta = (sz / 2) / Math.hypot(xtan, ytan);
        const v = lerp(vBot, vTop, t);
        vertex(xs - ytan * delta, ys + xtan * delta, 0, u1, v);
        vertex(xs + ytan * delta, ys - xtan * delta, 0, u2, v);
    }
    endShape();
}

// ============================================================
// Classe base
// ============================================================

class Planta {
    constructor(x, y, atlas, escalaBase, especie) {
        this.x          = x;
        this.y          = y;
        this.atlas      = atlas;
        this.escalaBase = escalaBase || 1.0;
        this.especie    = especie;
        this.bend       = 0;
        this.rotacao    = 0;
        this.escalaX    = 1.0;
        this.escalaY    = 1.0;
        const nFrames   = (atlas && atlas.frames) ? atlas.frames.length : 1;
        this.animador   = new AnimadorPlanta(nFrames, especie);

        this.vidaAutomatica     = false;
        this.bufferAmplitudes   = [];
        this.framesVivaContador = 0;
    }

    _atualizarVida(amplitude) {
        const buf = this.bufferAmplitudes;
        buf.push(amplitude);
        if (buf.length > CONFIG.vida.janelaMediaFrames) buf.shift();

        const media  = buf.reduce((s, a) => s + a, 0) / buf.length;
        const estado = this.animador.estado;
        const v      = CONFIG.vida;

        if (estado === ESTADO_ANIM.DORMENTE && media > v.limiarNascimento) {
            this.animador.iniciarNascimento();
            this.framesVivaContador = 0;
        } else if (estado === ESTADO_ANIM.VIVA) {
            this.framesVivaContador++;
            if (this.framesVivaContador > v.framesMinimoVida && media < v.limiarMorte) {
                this.animador.iniciarMorte();
            }
        }
    }

    desenhar() {}

    reagir(d) {
        if (this.vidaAutomatica) this._atualizarVida(d.amplitude || 0);
        this.animador.atualizar({ ...d, onset: !!d.onset, energia: d.energia || 0 });
    }
}

// ============================================================
// Arvore
// ============================================================

class Arvore extends Planta {
    constructor(x, y, atlas, escalaBase) {
        super(x, y, atlas, escalaBase, 'arvore');
        this.fase         = random(TWO_PI);
        this.direcao      = random() > 0.5 ? 1 : -1;
        this.impulsoExtra = 0;
        this.tremor       = 0;
        this.tipo         = 'Árvore';
        this.stemNome     = 'Graves';
        this.stemKey      = 'graves';
        this.descricao    = 'Balança com a energia e batidas do bass.';
    }

    _bendEfetivo() {
        const t = Math.sin(frameCount * CONFIG.arvore.tremorFreq + this.fase * 2.3) * this.tremor;
        return constrain(this.bend + t, -0.95, 0.95);
    }

    reagir(d) {
        super.reagir(d);
        const cfg = CONFIG.arvore;
        const { energia = 0, onset = false, taxaDecaimento = 0, variabilidade = 0 } = d;

        const noiseVal       = map(noise(frameCount * 0.008 + this.fase), 0, 1, -1, 1);
        const targetBend     = noiseVal * cfg.bendMax * (0.3 + energia * 0.7);
        if (onset) { this.impulsoExtra = cfg.impulsoOnset * this.direcao; this.direcao *= -1; }
        this.impulsoExtra *= cfg.decaimentoImpulso;

        const balancoContrib = Math.sin(frameCount * cfg.balancoFreq + this.fase) * variabilidade * cfg.balancoFator;
        const alvo = constrain(targetBend + balancoContrib + this.impulsoExtra, -0.90, 0.90);
        this.bend = lerp(this.bend, alvo, cfg.suavizacao);

        if (taxaDecaimento > cfg.tremorLimiar) {
            this.tremor = Math.min(this.tremor + taxaDecaimento * cfg.tremorGanho, cfg.tremorMax);
        }
        this.tremor *= cfg.tremorDecaimento;
    }

    desenhar() {
        if (!this.atlas.fb || !this.atlas.frames || this.atlas.frames.length === 0) return;
        if (this.animador.estado === ESTADO_ANIM.DORMENTE) return;
        const frame = this.atlas.frames[this.animador.frameAtual()];
        const wx = this.x - width / 2; const wy = this.y - height / 2;
        const h  = frame.h * this.escalaBase * CONFIG.arvore.alturaFator;
        const w  = frame.w * this.escalaBase;
        push();
        texture(this.atlas.fb); noStroke();
        bezierQuad(...bezierStalk(wx, wy, h, this._bendEfetivo()), w, CONFIG.arvore.segmentos, frame.u0, frame.u1, frame.vTop, 1);
        pop();
    }

    desenharEstudo(wx, wy, escala) {
        if (!this.atlas.fb || !this.atlas.frames || this.atlas.frames.length === 0) return;
        const frame = this.atlas.frames[this.animador.frameAtual()];
        push();
        texture(this.atlas.fb); noStroke();
        bezierQuad(...bezierStalk(wx, wy, frame.h * escala * CONFIG.arvore.alturaFator, this._bendEfetivo()),
            frame.w * escala, CONFIG.arvore.segmentos, frame.u0, frame.u1, frame.vTop, 1);
        pop();
    }
}

// ============================================================
// Flor
// ============================================================

class Flor extends Planta {
    constructor(x, y, atlas, escalaBase) {
        super(x, y, atlas, escalaBase, 'flor');
        this.fase      = random(TWO_PI);
        this.tipo      = 'Flor';
        this.stemNome  = 'Harmonia';
        this.stemKey   = 'harmonia';
        this.descricao = 'Ondula com a harmonia e vozes.';
    }

    reagir(d) {
        super.reagir(d);
        const { amplitude = 0 } = d;
        const cfg    = CONFIG.flor;
        const estica = constrain(amplitude * amplitude * cfg.esticamentoQuadAmpl, 0, cfg.escalaYMax - 1.0);
        const respiro = cfg.respiracaoBase * Math.sin(frameCount * cfg.respiracaoFreq + this.fase);
        this.escalaY = lerp(this.escalaY, 1.0 + estica + respiro, cfg.responsividade);
        this.escalaX = lerp(this.escalaX, 1.0 - estica * cfg.escalaXCompressao, cfg.responsividade);
        this.bend    = 0;
    }

    desenhar() {
        if (!this.atlas.fb || !this.atlas.frames || this.atlas.frames.length === 0) return;
        if (this.animador.estado === ESTADO_ANIM.DORMENTE) return;
        const frame = this.atlas.frames[this.animador.frameAtual()];
        const wx = this.x - width / 2; const wy = this.y - height / 2;
        push();
        texture(this.atlas.fb); noStroke();
        bezierQuad(...bezierStalk(wx, wy, frame.h * this.escalaBase * this.escalaY, 0),
            frame.w * this.escalaBase * this.escalaX, CONFIG.flor.segmentos, frame.u0, frame.u1, frame.vTop, 1);
        pop();
    }

    desenharEstudo(wx, wy, escala) {
        if (!this.atlas.fb || !this.atlas.frames || this.atlas.frames.length === 0) return;
        const frame = this.atlas.frames[this.animador.frameAtual()];
        push();
        texture(this.atlas.fb); noStroke();
        bezierQuad(...bezierStalk(wx, wy, frame.h * escala * this.escalaY, 0),
            frame.w * escala * this.escalaX, CONFIG.flor.segmentos, frame.u0, frame.u1, frame.vTop, 1);
        pop();
    }
}

// ============================================================
// Arbusto
// ============================================================

class Arbusto extends Planta {
    constructor(x, y, atlas, escalaBase) {
        super(x, y, atlas, escalaBase, 'arbusto');
        this.escalaX           = 1.0;
        this.escalaY           = 1.0;
        this.velocidadeRetorno = CONFIG.arbusto.retorno + random(-0.03, 0.03);
        this.tipo              = 'Arbusto';
        this.stemNome          = 'Percussão';
        this.stemKey           = 'percussao';
        this.descricao         = 'Squash & stretch: comprime verticalmente em onsets de bateria.';
    }

    reagir(d) {
        super.reagir(d);
        const { amplitude = 0, onset = false, pico = 0 } = d;
        const cfg = CONFIG.arbusto;
        const intensidade = Math.min(Math.max(0, pico - 0.03) ** 2 * cfg.fatorPulsoQuad, 1.0);
        if (onset) {
            this.escalaY = 1.0 - cfg.compressaoMax * intensidade;
            this.escalaX = 1.0 + cfg.compressaoMax * 0.6 * intensidade;
        } else {
            this.escalaY = lerp(this.escalaY, 1.0 + amplitude * 0.1, this.velocidadeRetorno);
            this.escalaX = lerp(this.escalaX, 1.0 - amplitude * 0.05, this.velocidadeRetorno);
        }
    }

    _quad(wx, wy, hw, sh, frame) {
        texture(this.atlas.fb); noStroke();
        beginShape(QUAD_STRIP);
        vertex(wx - hw, wy - sh, 0, frame.u0, frame.vTop);
        vertex(wx + hw, wy - sh, 0, frame.u1, frame.vTop);
        vertex(wx - hw, wy,      0, frame.u0, 1);
        vertex(wx + hw, wy,      0, frame.u1, 1);
        endShape();
    }

    desenhar() {
        if (!this.atlas.fb || !this.atlas.frames || this.atlas.frames.length === 0) return;
        if (this.animador.estado === ESTADO_ANIM.DORMENTE) return;
        const frame = this.atlas.frames[this.animador.frameAtual()];
        const wx = this.x - width / 2; const wy = this.y - height / 2;
        push();
        this._quad(wx, wy,
            (frame.w * this.escalaBase * this.escalaX) / 2,
             frame.h * this.escalaBase * this.escalaY, frame);
        pop();
    }

    desenharEstudo(wx, wy, escala) {
        if (!this.atlas.fb || !this.atlas.frames || this.atlas.frames.length === 0) return;
        const frame = this.atlas.frames[this.animador.frameAtual()];
        push();
        this._quad(wx, wy,
            (frame.w * escala * this.escalaX) / 2,
             frame.h * escala * this.escalaY, frame);
        pop();
    }
}

// ============================================================
// Dente-de-leao
// ============================================================

class DenteDeLeao extends Planta {
    constructor(x, y, atlas, escalaBase) {
        super(x, y, atlas, escalaBase, 'dente');
        this.fase      = random(TWO_PI);
        this.rotacao   = 0;
        this.brilho    = 0;
        this.tipo      = 'Dente-de-leão';
        this.stemNome  = 'Agudos';
        this.stemKey   = 'agudos';
        this.descricao = 'Tremor em seno + emite sementes nos onsets de treble.';
    }

    reagir(d) {
        super.reagir(d);
        const { amplitude = 0, onset = false, subOnset = false, pico = 0, variabilidade = 0 } = d;
        const cfg = CONFIG.dente;
        const intensidade = Math.min(amplitude / 0.15, 1.0);
        this.rotacao = Math.sin(frameCount * 0.08 + this.fase) * 0.04 * intensidade;

        const brilhoAlvo = amplitude * variabilidade * cfg.brilhoFator;
        this.brilho = lerp(this.brilho, brilhoAlvo, 0.25);

        if (this.animador.estado !== ESTADO_ANIM.VIVA) return;
        const frame     = this.atlas.frames[this.animador.frameAtual()];
        const topoY     = this.y - frame.h * this.escalaBase;
        const dispersao = Math.max(1, 1 + variabilidade * cfg.dispersaoFator);
        if (onset) {
            const qtd = Math.floor(Math.max(0, pico - 0.02) ** 2 * 500);
            if (qtd > 0) emitirSementes(this.x, topoY, qtd, dispersao);
        }
        if (subOnset) {
            emitirSemente(this.x, topoY, { dispersao: 0.4, velocidadeBase: 0.7, tamanho: 1.0 });
        }
        if (amplitude > 0.08 && random() < amplitude * 2) {
            emitirSementes(this.x, topoY, cfg.emissaoContinua, dispersao);
        }
    }

    _quad(wx, wy, hw, sh, frame) {
        translate(wx, wy, 0);
        rotate(this.rotacao);
        if (this.brilho > 0.01) {
            const v = 255 * (1.0 + this.brilho);
            tint(v, v, v);
        }
        texture(this.atlas.fb); noStroke();
        beginShape(QUAD_STRIP);
        vertex(-hw, -sh, 0, frame.u0, frame.vTop);
        vertex( hw, -sh, 0, frame.u1, frame.vTop);
        vertex(-hw,   0, 0, frame.u0, 1);
        vertex( hw,   0, 0, frame.u1, 1);
        endShape();
        noTint();
    }

    desenhar() {
        if (!this.atlas.fb || !this.atlas.frames || this.atlas.frames.length === 0) return;
        if (this.animador.estado === ESTADO_ANIM.DORMENTE) return;
        const frame = this.atlas.frames[this.animador.frameAtual()];
        push();
        this._quad(this.x - width / 2, this.y - height / 2,
            (frame.w * this.escalaBase) / 2, frame.h * this.escalaBase, frame);
        pop();
    }

    desenharEstudo(wx, wy, escala) {
        if (!this.atlas.fb || !this.atlas.frames || this.atlas.frames.length === 0) return;
        const frame = this.atlas.frames[this.animador.frameAtual()];
        push();
        this._quad(wx, wy, (frame.w * escala) / 2, frame.h * escala, frame);
        pop();
    }
}

// ============================================================
// Distribuição e criação do jardim
// ============================================================

function distribuirGrid(qtd, margemPct) {
    const margem = width * margemPct;
    const posicoes = [];
    for (let i = 0; i < qtd; i++) {
        const base   = map(i, 0, qtd - 1, margem, width - margem);
        const jitter = (width / qtd) * random(-0.3, 0.3);
        posicoes.push(constrain(base + jitter, margem * 0.5, width - margem * 0.5));
    }
    return posicoes;
}

/**
 * Calcula Y e escala de uma planta baseado na sua banda de profundidade.
 * Plantas com Y maior (mais em baixo no ecrã) ficam mais próximas e maiores.
 */
function _posicaoProf(especie, escalaBase) {
    const banda = CONFIG.profundidade[especie];
    const y     = random(height * banda.yMin, height * banda.yMax);
    const t     = (y - height * banda.yMin) / (height * (banda.yMax - banda.yMin));
    const escala = escalaBase * (1 - banda.fator + t * 2 * banda.fator);
    return { y, escala };
}

function criarJardim(atlasMap) {
    const plantas = { arvores: [], flores: [], arbustos: [], dentes: [] };
    const cfg     = CONFIG.quantidade;

    const posArvores = distribuirGrid(cfg.arvores, 0.03);
    for (let i = 0; i < cfg.arvores; i++) {
        const { y, escala } = _posicaoProf('arvore', CONFIG.escala.arvore + random(-0.08, 0.08));
        const a = new Arvore(posArvores[i], y, random(atlasMap.arvores), escala);
        a.vidaAutomatica = true;
        plantas.arvores.push(a);
    }
    const posArbustos = distribuirGrid(cfg.arbustos, 0.02);
    for (let i = 0; i < cfg.arbustos; i++) {
        const { y, escala } = _posicaoProf('arbusto', CONFIG.escala.arbusto + random(-0.04, 0.04));
        const b = new Arbusto(posArbustos[i], y, random(atlasMap.arbustos), escala);
        b.vidaAutomatica = true;
        plantas.arbustos.push(b);
    }
    const posFlores = distribuirGrid(cfg.flores, 0.02);
    for (let i = 0; i < cfg.flores; i++) {
        const { y, escala } = _posicaoProf('flor', CONFIG.escala.flor + random(-0.04, 0.04));
        const f = new Flor(posFlores[i], y, random(atlasMap.flores), escala);
        f.vidaAutomatica = true;
        plantas.flores.push(f);
    }
    const posDentes = distribuirGrid(cfg.dentes, 0.02);
    for (let i = 0; i < cfg.dentes; i++) {
        const { y, escala } = _posicaoProf('dente', CONFIG.escala.dente + random(-0.04, 0.04));
        const d = new DenteDeLeao(posDentes[i], y, random(atlasMap.dentes), escala);
        d.vidaAutomatica = true;
        plantas.dentes.push(d);
    }
    return plantas;
}
