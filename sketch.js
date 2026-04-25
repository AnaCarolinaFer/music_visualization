/**
 * Jardim Musical — WEBGL renderer
 * Gradiente de ceu via vertex colors, sprites em texture atlas (Framebuffer),
 * arvores e flores com haste Bezier, caminhada lateral, nuvens com parallax.
 */

let gerenciador;
let jardim = null;

let sheetArvores, sheetFlores, sheetArbustos, sheetDentes, sheetNuvens;
let atlasMap = {};

let energiaAtual = 0;
let nuvens = [];
let debugVisivel = true;
let velocidadeCaminhada = 0;
let trilhaLinhas = [];

function preload() {
    sheetArvores = loadImage('trees.png');
    sheetFlores  = loadImage('flowers.png');
    sheetArbustos = loadImage('bushes.png');
    sheetDentes  = loadImage('dandelions.png');
    sheetNuvens  = loadImage('nuvens.png');
}

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);
    pixelDensity(1);
    imageMode(CORNER);

    // Painter's algorithm: ordem de desenho controla profundidade
    drawingContext.disable(drawingContext.DEPTH_TEST);

    gerenciador = new GerenciadorAudio();

    atlasMap.arvores  = extrairSpritesAtlas(sheetArvores);
    atlasMap.flores   = extrairSpritesAtlas(sheetFlores);
    atlasMap.arbustos = extrairSpritesAtlas(sheetArbustos);
    atlasMap.dentes   = extrairSpritesAtlas(sheetDentes);
    atlasMap.nuvens   = extrairSpritesAtlas(sheetNuvens);

    jardim = criarJardim(atlasMap);
    criarNuvens();
    criarTrilha();

    document.getElementById('audio-file').addEventListener('change', (e) => {
        const arquivo = e.target.files[0];
        if (arquivo) gerenciador.enviarParaSeparacao(arquivo);
    });
}

// ============================================================
// Nuvens
// ============================================================

class Nuvem {
    constructor(x, y, atlas, frameIdx) {
        this.x = x;
        this.y = y;
        this.atlas = atlas;
        this.frameIdx = frameIdx;
        const s = atlas.sprites[frameIdx];
        this.escala = random(0.4, 0.8);
        this.largura = s.w * this.escala;
        this.altura  = s.h * this.escala;
        this.velocidade = CONFIG.nuvens.velocidadeBase + random(-0.1, 0.1);
        this.opacidade  = CONFIG.nuvens.opacidade + random(-30, 30);
    }

    atualizar(energia) {
        const vel = lerp(this.velocidade, CONFIG.nuvens.velocidadeMax, constrain(energia, 0, 1));
        this.x -= vel;
        if (this.x < -this.largura) {
            this.x = width + this.largura;
            this.y = random(height * CONFIG.nuvens.yMin, height * CONFIG.nuvens.yMax);
        }
    }

    desenhar() {
        if (!this.atlas.fb) return;
        const {u0, u1, vTop} = this.atlas.sprites[this.frameIdx];
        // this.x = centro horizontal; this.y = topo da nuvem (screen space)
        const wx = this.x - this.largura / 2 - width / 2;
        const wy = this.y - height / 2;

        push();
        tint(255, this.opacidade);
        texture(this.atlas.fb);
        noStroke();
        beginShape(QUAD_STRIP);
        vertex(wx,               wy,              0, u0, vTop);
        vertex(wx + this.largura, wy,              0, u1, vTop);
        vertex(wx,               wy + this.altura, 0, u0, 1);
        vertex(wx + this.largura, wy + this.altura, 0, u1, 1);
        endShape();
        noTint();
        pop();
    }
}

function criarNuvens() {
    nuvens = [];
    const atlas = atlasMap.nuvens;
    if (!atlas || atlas.sprites.length === 0) return;
    const cfg = CONFIG.nuvens;
    for (let i = 0; i < cfg.quantidade; i++) {
        const x = random(-100, width + 100);
        const y = random(height * cfg.yMin, height * cfg.yMax);
        const fi = floor(random(atlas.sprites.length));
        nuvens.push(new Nuvem(x, y, atlas, fi));
    }
}

function criarTrilha() {
    trilhaLinhas = [];
    for (let i = 0; i < 10; i++) {
        trilhaLinhas.push({x: random(0, width)});
    }
}

function reciclarPlantas() {
    const cfg = CONFIG.caminhada;
    const linhaChao = height * 0.72;

    const spawnMin = cfg.spawnDireita.min;
    const spawnMax = width;

    for (let a of jardim.arvores) {
        if (a.x < cfg.limiteEsquerda) {
            a.x = width + random(spawnMin, spawnMax);
            a.y = linhaChao + random(-10, 10);
            a.frameIdx = floor(random(a.atlas.sprites.length || 1));
            a.bend = 0;
            a.impulsoExtra = 0;
        }
    }
    for (let b of jardim.arbustos) {
        if (b.x < cfg.limiteEsquerda) {
            b.x = width + random(spawnMin, spawnMax);
            b.y = linhaChao + random(-10, 10);
            b.frameIdx = floor(random(b.atlas.sprites.length || 1));
            b.escalaX = 1; b.escalaY = 1;
        }
    }
    for (let f of jardim.flores) {
        if (f.x < cfg.limiteEsquerda) {
            f.x = width + random(spawnMin, spawnMax);
            f.y = linhaChao + random(-10, 10);
            f.frameIdx = floor(random(f.atlas.sprites.length || 1));
            f.bend = 0;
        }
    }
    for (let d of jardim.dentes) {
        if (d.x < cfg.limiteEsquerda) {
            d.x = width + random(spawnMin, spawnMax);
            d.y = linhaChao + random(-10, 10);
            d.frameIdx = floor(random(d.atlas.sprites.length || 1));
            d.rotacao = 0;
        }
    }
}

// ============================================================
// Ceu — quad com vertex colors (substitui createGraphics + point)
// ============================================================

function desenharCeu(energia) {
    const cfg = CONFIG.ceu;
    const e = constrain(energia, 0, 1);
    const topR = lerp(cfg.corTopBase[0], cfg.corTopEnergia[0], e);
    const topG = lerp(cfg.corTopBase[1], cfg.corTopEnergia[1], e);
    const topB = lerp(cfg.corTopBase[2], cfg.corTopEnergia[2], e);
    const botR = lerp(cfg.corBottomBase[0], cfg.corBottomEnergia[0], e);
    const botG = lerp(cfg.corBottomBase[1], cfg.corBottomEnergia[1], e);
    const botB = lerp(cfg.corBottomBase[2], cfg.corBottomEnergia[2], e);

    noStroke();
    beginShape(QUAD_STRIP);
    fill(topR, topG, topB);
    vertex(-width / 2, -height / 2);
    vertex( width / 2, -height / 2);
    fill(botR, botG, botB);
    vertex(-width / 2,  height / 2);
    vertex( width / 2,  height / 2);
    endShape();
}

// ============================================================
// Draw loop
// ============================================================

function draw() {
    const dados = gerenciador.analisar();

    const energiaAlvo = (dados.graves.amplitude + dados.harmonia.amplitude
                       + dados.percussao.amplitude + dados.agudos.amplitude) / 4;
    energiaAtual = lerp(energiaAtual, energiaAlvo * 5, CONFIG.ceu.responsividade);

    desenharCeu(energiaAtual);

    if (gerenciador.tocando) {
        velocidadeCaminhada = CONFIG.caminhada.velocidadeBase
                            + energiaAtual * CONFIG.caminhada.velocidadeMultiplier;
    } else {
        velocidadeCaminhada = 0;
    }

    // Nuvens (atras de tudo, sobre o gradiente)
    for (const nv of nuvens) {
        nv.atualizar(energiaAtual);
        nv.x -= velocidadeCaminhada * CONFIG.parallax.nuvens;
        nv.desenhar();
    }

    // Chao
    noStroke();
    const chaoG = lerp(128, 90, constrain(energiaAtual, 0, 1));
    fill(51, chaoG, 26);
    // height*0.72 em screen space = height*0.22 em WEBGL (origem no centro)
    rect(-width / 2, height * 0.22, width, height * 0.28);

    // Trilha no chao
    const chaoY_webgl = height * 0.22;
    stroke(0, 50);
    strokeWeight(1);
    for (const linha of trilhaLinhas) {
        linha.x -= velocidadeCaminhada;
        if (linha.x < 0) linha.x = width + random(50, 100);
        const lx = linha.x - width / 2;
        line(lx, chaoY_webgl, lx, chaoY_webgl + 20);
    }
    noStroke();

    // Plantas
    if (jardim) {
        for (const a of jardim.arvores)  a.x -= velocidadeCaminhada;
        for (const b of jardim.arbustos) b.x -= velocidadeCaminhada;
        for (const f of jardim.flores)   f.x -= velocidadeCaminhada;
        for (const d of jardim.dentes)   d.x -= velocidadeCaminhada;

        reciclarPlantas();

        for (const a of jardim.arvores)  a.reagir(dados.graves.amplitude, dados.graves.onset, dados.graves.energia);
        for (const b of jardim.arbustos) b.reagir(dados.percussao.amplitude, dados.percussao.onset);
        for (const f of jardim.flores)   f.reagir(dados.harmonia.amplitude, dados.harmonia.onset);
        for (const d of jardim.dentes)   d.reagir(dados.agudos.amplitude, dados.agudos.onset);

        // Ordem de desenho: tras → frente
        for (const a of jardim.arvores)  a.desenhar();
        for (const b of jardim.arbustos) b.desenhar();
        for (const f of jardim.flores)   f.desenhar();
        for (const d of jardim.dentes)   d.desenhar();
    }

    // Particulas (coordenadas ajustadas em particulas.js)
    for (const p of particulas) p.x -= velocidadeCaminhada;
    atualizarParticulas();

    if (debugVisivel) atualizarDebugPanel(dados);
    document.getElementById('fps').textContent = 'FPS: ' + frameRate().toFixed(0);
}

// ============================================================
// UI
// ============================================================

function atualizarDebugPanel(dados) {
    for (const nome of ['graves', 'harmonia', 'percussao', 'agudos']) {
        const bar = document.getElementById(nome + '-bar');
        if (!bar) continue;
        const amp = dados[nome].amplitude;
        bar.querySelector('.bar-fill').style.width = constrain(amp * 500, 0, 100) + '%';
        bar.querySelector('.value').textContent = amp.toFixed(3);
    }
}

function togglePlay() {
    if (!gerenciador || !gerenciador.pronto) return;
    gerenciador.togglePlay();
    document.getElementById('play-btn').textContent = gerenciador.tocando ? 'Pause' : 'Play';
    document.getElementById('status').textContent = gerenciador.tocando ? 'Tocando...' : 'Pausado';
    document.getElementById('volume-area').style.display = 'flex';
}

function ajustarVolume(val) {
    if (gerenciador) gerenciador.setVolume(val / 100);
}

function keyPressed() {
    if (key === 'd' || key === 'D') {
        debugVisivel = !debugVisivel;
        document.getElementById('debug-panel').style.display = debugVisivel ? 'block' : 'none';
    }
    if (key === ' ') {
        togglePlay();
        return false;
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    jardim = criarJardim(atlasMap);
    criarNuvens();
    criarTrilha();
}
