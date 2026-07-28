/**
 * Classes de plantas para o Jardim Musical — renderer WEBGL.
 * Sprites empacotados em texture atlas (Framebuffer).
 * Arvores e Flores usam curva de Bezier para a haste.
 * Arbustos e Dentes usam quad texturizado simples.
 */

// ============================================================
// Extração de sprites com union-find (via connected.js)
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
    return {x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin, area};
}

/**
 * Extrai sprites de um sprite sheet de fundo preto e empacota num Framebuffer atlas.
 * Retorna { fb, sprites: [{u0,u1,vTop,w,h}], spriteWidth, spriteHeight }
 */
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
        const {width: w, height: h} = bb;
        if (w < sheetImg.width * 0.8 && w > 5 && h > 5) {
            spriteWidth = max(spriteWidth, w);
            spriteHeight = max(spriteHeight, h);
            rawSprites.push(bb);
        } else {
            paintComponent(sheetImg.pixels, sheetImg.width, sheetImg.height, comp, 0);
        }
    }
    sheetImg.updatePixels();

    if (rawSprites.length === 0) return {fb: null, sprites: [], spriteWidth: 0, spriteHeight: 0};

    // Extrair imagens recortadas
    for (const s of rawSprites) {
        s.img = sheetImg.get(s.x, s.y, s.width, s.height);
    }
    rawSprites.sort((a, b) => a.x - b.x);

    // Montar framebuffer atlas
    const n = rawSprites.length;
    const atlasWidth = spriteWidth * n;
    const fb = createFramebuffer({width: atlasWidth, height: spriteHeight});
    fb.begin();
    imageMode(CORNER);
    clear();
    for (let i = 0; i < n; i++) {
        const {img, height: h} = rawSprites[i];
        image(img,
            -atlasWidth / 2 + i * spriteWidth,
            -spriteHeight / 2 + (spriteHeight - h)
        );
    }
    fb.end();

    // Coordenadas UV por sprite
    const sprites = rawSprites.map((s, i) => ({
        u0:   i / n,
        u1:   (i + 1) / n,
        vTop: (spriteHeight - s.height) / spriteHeight,
        w:    s.width,
        h:    s.height
    }));

    return {fb, sprites, spriteWidth, spriteHeight};
}

// ============================================================
// Geometria Bezier
// ============================================================

/**
 * Gera 4 pontos de controle de uma curva cubica de Bezier para a haste.
 * xbase, ybase = base da planta (pivot). h = altura. bend ∈ [-1, 1].
 */
function bezierStalk(xbase, ybase, h, bend) {
    const r = h / 3;
    let ang = -PI / 2;
    const x2 = xbase + r * cos(ang);
    const y2 = ybase + r * sin(ang);
    ang += PI / 2 * bend;
    const x3 = x2 + r * cos(ang);
    const y3 = y2 + r * sin(ang);
    ang += PI / 2 * bend;
    const x4 = x3 + r * cos(ang);
    const y4 = y3 + r * sin(ang);
    return [xbase, ybase, x2, y2, x3, y3, x4, y4];
}

/**
 * Desenha uma faixa texturizada ao longo de uma curva Bezier cubica.
 * sz = largura da faixa. n = numero de segmentos.
 * u1,u2 = range UV horizontal (selecao do sprite no atlas).
 * vTop,vBot = range UV vertical (topo e base do sprite no atlas).
 */
function bezierQuad(x1, y1, x2, y2, x3, y3, x4, y4, sz, n, u1, u2, vTop, vBot) {
    beginShape(QUAD_STRIP);
    const step = 1 / (n - 1);
    for (let i = 0; i < n; i++) {
        const t = step * i;
        const xs = bezierPoint(x1, x2, x3, x4, t);
        const ys = bezierPoint(y1, y2, y3, y4, t);
        const xtan = bezierTangent(x1, x2, x3, x4, t);
        const ytan = bezierTangent(y1, y2, y3, y4, t);
        const delta = (sz / 2) / Math.hypot(xtan, ytan);
        const xnorm = -ytan * delta;
        const ynorm =  xtan * delta;
        const v = lerp(vBot, vTop, t);
        vertex(xs + xnorm, ys + ynorm, 0, u1, v);
        vertex(xs - xnorm, ys - ynorm, 0, u2, v);
    }
    endShape();
}

// ============================================================
// Classe base
// ============================================================

class Planta {
    constructor(x, y, atlas, escalaBase, frameIdx) {
        this.x = x;
        this.y = y;
        this.atlas = atlas;
        this.escalaBase = escalaBase || 1.0;
        this.frameIdx = frameIdx || 0;
        this.bend = 0;
        this.rotacao = 0;
        this.escalaX = 1.0;
        this.escalaY = 1.0;
    }

    desenhar() {}
    reagir(_amplitude, _onset) {}
}

// ============================================================
// Arvore — haste Bezier modulada por noise (vento) + onset
// ============================================================

class Arvore extends Planta {
    constructor(x, y, atlas, escalaBase, frameIdx) {
        super(x, y, atlas, escalaBase, frameIdx);
        this.fase = random(TWO_PI);
        this.direcao = random() > 0.5 ? 1 : -1;
        this.impulsoExtra = 0;
    }

    reagir(amplitude, onset, energia = 0) {
        const cfg = CONFIG.arvore;
        // bend base: noise suave modulado pela energia dos graves
        const noiseVal = map(noise(frameCount * 0.008 + this.fase), 0, 1, -1, 1);
        const targetBend = noiseVal * cfg.bendMax * (0.3 + energia * 0.7);

        if (onset) {
            this.impulsoExtra = cfg.impulsoOnset * this.direcao;
            this.direcao *= -1;
        }
        this.impulsoExtra *= cfg.decaimentoImpulso;

        this.bend = lerp(this.bend, targetBend + this.impulsoExtra * 0.3, cfg.suavizacao);
    }

    desenhar() {
        if (!this.atlas.fb || this.atlas.sprites.length === 0) return;
        const {u0, u1, vTop, w: sw, h: sh} = this.atlas.sprites[this.frameIdx];
        const uContent = u0 + (sw / this.atlas.spriteWidth) * (u1 - u0);
        const wx = this.x - width / 2;
        const wy = this.y - height / 2;
        const h = sh * this.escalaBase * CONFIG.arvore.alturaFator;
        const w = sw * this.escalaBase;
        const bez = bezierStalk(wx, wy, h, this.bend);

        push();
        texture(this.atlas.fb);
        noStroke();
        bezierQuad(...bez, w, CONFIG.arvore.segmentos, u0, uContent, vTop, 1);
        pop();
    }
}

// ============================================================
// Flor — haste Bezier responsiva a harmonia + frame cycling no onset
// ============================================================

class Flor extends Planta {
    constructor(x, y, atlas, escalaBase, frameIdx) {
        super(x, y, atlas, escalaBase, frameIdx);
        this.fase = random(TWO_PI);
    }

    reagir(amplitude, onset) {
        const cfg = CONFIG.flor;
        const amplitudeFator = max(cfg.amplitudeMin, amplitude * cfg.amplitudeMult);
        const sway = sin(frameCount * 0.018 + this.fase) * cfg.bendMax * amplitudeFator;
        this.bend = lerp(this.bend, sway, cfg.responsividade);
    }

    desenhar() {
        if (!this.atlas.fb || this.atlas.sprites.length === 0) return;
        const {u0, u1, vTop, w: sw, h: sh} = this.atlas.sprites[this.frameIdx];
        const uContent = u0 + (sw / this.atlas.spriteWidth) * (u1 - u0);
        const wx = this.x - width / 2;
        const wy = this.y - height / 2;
        const h = sh * this.escalaBase;
        const w = sw * this.escalaBase;
        const bez = bezierStalk(wx, wy, h, this.bend);

        push();
        texture(this.atlas.fb);
        noStroke();
        bezierQuad(...bez, w, CONFIG.flor.segmentos, u0, uContent, vTop, 1);
        pop();
    }
}

// ============================================================
// Arbusto — squash & stretch com quad texturizado
// ============================================================

class Arbusto extends Planta {
    constructor(x, y, atlas, escalaBase, frameIdx) {
        super(x, y, atlas, escalaBase, frameIdx);
        this.velocidadeRetorno = CONFIG.arbusto.retorno + random(-0.03, 0.03);
    }

    reagir(amplitude, onset) {
        const cfg = CONFIG.arbusto;
        if (onset) {
            this.escalaY = 1.0 - cfg.compressaoMax;
            this.escalaX = 1.0 + cfg.compressaoMax * 0.6;
        } else {
            this.escalaY = lerp(this.escalaY, 1.0 + amplitude * 0.1, this.velocidadeRetorno);
            this.escalaX = lerp(this.escalaX, 1.0 - amplitude * 0.05, this.velocidadeRetorno);
        }
    }

    desenhar() {
        if (!this.atlas.fb || this.atlas.sprites.length === 0) return;
        const {u0, u1, vTop} = this.atlas.sprites[this.frameIdx];
        const wx = this.x - width / 2;
        const wy = this.y - height / 2;
        const hw = (this.atlas.spriteWidth * this.escalaBase * this.escalaX) / 2;
        const sh = this.atlas.spriteHeight * this.escalaBase * this.escalaY;

        push();
        texture(this.atlas.fb);
        noStroke();
        beginShape(QUAD_STRIP);
        vertex(wx - hw, wy - sh, 0, u0, vTop);
        vertex(wx + hw, wy - sh, 0, u1, vTop);
        vertex(wx - hw, wy,      0, u0, 1);
        vertex(wx + hw, wy,      0, u1, 1);
        endShape();
        pop();
    }
}

// ============================================================
// Dente-de-leao — tremor + emissao de particulas
// ============================================================

class DenteDeLeao extends Planta {
    constructor(x, y, atlas, escalaBase, frameIdx) {
        super(x, y, atlas, escalaBase, frameIdx);
        this.fase = random(TWO_PI);
    }

    reagir(amplitude, onset) {
        const cfg = CONFIG.dente;
        const intensidade = map(amplitude, 0, 0.15, 0, 1.0, true);
        this.rotacao = sin(frameCount * 0.08 + this.fase) * 0.04 * intensidade;

        if (onset) {
            const qtd = Math.ceil(cfg.particulas * map(amplitude, 0, 0.2, 1, 3, true));
            emitirSementes(this.x, this.y, qtd);
        }
        if (amplitude > 0.08 && random() < amplitude * 2) {
            emitirSementes(this.x, this.y, cfg.emissaoContinua);
        }
    }

    desenhar() {
        if (!this.atlas.fb || this.atlas.sprites.length === 0) return;
        const {u0, u1, vTop} = this.atlas.sprites[this.frameIdx];
        const wx = this.x - width / 2;
        const wy = this.y - height / 2;
        const hw = (this.atlas.spriteWidth * this.escalaBase) / 2;
        const sh = this.atlas.spriteHeight * this.escalaBase;

        push();
        translate(wx, wy, 0);
        rotate(this.rotacao);
        texture(this.atlas.fb);
        noStroke();
        beginShape(QUAD_STRIP);
        vertex(-hw, -sh, 0, u0, vTop);
        vertex( hw, -sh, 0, u1, vTop);
        vertex(-hw,  0,  0, u0, 1);
        vertex( hw,  0,  0, u1, 1);
        endShape();
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
        const base = map(i, 0, qtd - 1, margem, width - margem);
        const jitter = (width / qtd) * random(-0.3, 0.3);
        posicoes.push(constrain(base + jitter, margem * 0.5, width - margem * 0.5));
    }
    return posicoes;
}

function criarJardim(atlasMap) {
    const plantas = {arvores: [], flores: [], arbustos: [], dentes: []};
    const linhaChao = height * 0.72;
    const cfg = CONFIG.quantidade;

    function fi(atlas) {
        return atlas.sprites.length > 0 ? floor(random(atlas.sprites.length)) : 0;
    }

    const posArvores = distribuirGrid(cfg.arvores, 0.03);
    for (let i = 0; i < cfg.arvores; i++) {
        const escala = CONFIG.escala.arvore + random(-0.08, 0.08);
        plantas.arvores.push(new Arvore(posArvores[i], linhaChao + random(-10, 10), atlasMap.arvores, escala, fi(atlasMap.arvores)));
    }

    const posArbustos = distribuirGrid(cfg.arbustos, 0.02);
    for (let i = 0; i < cfg.arbustos; i++) {
        const escala = CONFIG.escala.arbusto + random(-0.04, 0.04);
        plantas.arbustos.push(new Arbusto(posArbustos[i], linhaChao + random(-10, 10), atlasMap.arbustos, escala, fi(atlasMap.arbustos)));
    }

    const posFlores = distribuirGrid(cfg.flores, 0.02);
    for (let i = 0; i < cfg.flores; i++) {
        const escala = CONFIG.escala.flor + random(-0.04, 0.04);
        plantas.flores.push(new Flor(posFlores[i], linhaChao + random(-10, 10), atlasMap.flores, escala, fi(atlasMap.flores)));
    }

    const posDentes = distribuirGrid(cfg.dentes, 0.02);
    for (let i = 0; i < cfg.dentes; i++) {
        const escala = CONFIG.escala.dente + random(-0.04, 0.04);
        plantas.dentes.push(new DenteDeLeao(posDentes[i], linhaChao + random(-10, 10), atlasMap.dentes, escala, fi(atlasMap.dentes)));
    }

    return plantas;
}
