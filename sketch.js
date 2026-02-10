/**
 * Jardim Musical — Fase 5 (Polish)
 * Ceu dinamico, debug toggle (D), volume, space para play/pause.
 */

let gerenciador;
let jardim = null;

// Sprite sheets (carregados no preload)
let sheetArvores, sheetFlores, sheetArbustos, sheetDentes, sheetNuvens;

// Sprites individuais extraidos dos sheets
let spritesMap = {
    arvores: [],
    flores: [],
    arbustos: [],
    dentes: [],
    nuvens: []
};

// Cache do gradiente do ceu
let ceuGradiente = null;

// Ceu dinamico
let energiaAtual = 0;

// Nuvens
let nuvens = [];

// Debug overlay
let debugVisivel = true;

function preload() {
    sheetArvores = loadImage('trees.png');
    sheetFlores = loadImage('flowers.png');
    sheetArbustos = loadImage('bushes.png');
    sheetDentes = loadImage('dandelions.png');
    sheetNuvens = loadImage('nuvens.png');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    imageMode(CORNER);

    gerenciador = new GerenciadorAudio();

    // Extrair sprites individuais dos sheets (deteccao automatica de ilhas)
    spritesMap.arvores = extrairSprites(sheetArvores);
    spritesMap.flores = extrairSprites(sheetFlores);
    spritesMap.arbustos = extrairSprites(sheetArbustos);
    spritesMap.dentes = extrairSprites(sheetDentes);
    spritesMap.nuvens = extrairSprites(sheetNuvens);

    // Criar jardim
    jardim = criarJardim(spritesMap);

    // Gerar gradiente do ceu inicial
    gerarCeuGradiente(0);

    // Criar nuvens
    criarNuvens();

    // Listener de upload
    document.getElementById('audio-file').addEventListener('change', (e) => {
        const arquivo = e.target.files[0];
        if (arquivo) {
            gerenciador.enviarParaSeparacao(arquivo);
        }
    });
}

// ============================================================
// Nuvens com sprites
// ============================================================

class Nuvem {
    constructor(x, y, sprite) {
        this.x = x;
        this.y = y;
        this.sprite = sprite;
        this.escala = random(0.4, 0.8);
        this.largura = this.sprite.width * this.escala;
        this.velocidade = CONFIG.nuvens.velocidadeBase + random(-0.1, 0.1);
        this.opacidade = CONFIG.nuvens.opacidade + random(-30, 30);
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
        push();
        tint(255, this.opacidade);
        image(this.sprite, this.x - this.largura / 2, this.y,
              this.largura, this.sprite.height * this.escala);
        noTint();
        pop();
    }
}

function criarNuvens() {
    nuvens = [];
    if (spritesMap.nuvens.length === 0) return;
    const cfg = CONFIG.nuvens;
    for (let i = 0; i < cfg.quantidade; i++) {
        const x = random(-100, width + 100);
        const y = random(height * cfg.yMin, height * cfg.yMax);
        const sprite = random(spritesMap.nuvens);
        nuvens.push(new Nuvem(x, y, sprite));
    }
}

function gerarCeuGradiente(energia) {
    if (!ceuGradiente) {
        ceuGradiente = createGraphics(1, height);
    }
    const cfg = CONFIG.ceu;
    const e = constrain(energia, 0, 1);

    const topR = lerp(cfg.corTopBase[0], cfg.corTopEnergia[0], e);
    const topG = lerp(cfg.corTopBase[1], cfg.corTopEnergia[1], e);
    const topB = lerp(cfg.corTopBase[2], cfg.corTopEnergia[2], e);
    const botR = lerp(cfg.corBottomBase[0], cfg.corBottomEnergia[0], e);
    const botG = lerp(cfg.corBottomBase[1], cfg.corBottomEnergia[1], e);
    const botB = lerp(cfg.corBottomBase[2], cfg.corBottomEnergia[2], e);

    const corTop = color(topR, topG, topB);
    const corBot = color(botR, botG, botB);

    for (let y = 0; y < ceuGradiente.height; y++) {
        let inter = map(y, 0, ceuGradiente.height, 0, 1);
        let c = lerpColor(corTop, corBot, inter);
        ceuGradiente.stroke(c);
        ceuGradiente.point(0, y);
    }
}

function draw() {
    // Analisar audio
    let dados = gerenciador.analisar();

    // Calcular energia geral (media das 4 amplitudes)
    const energiaAlvo = (dados.graves.amplitude + dados.harmonia.amplitude
                       + dados.percussao.amplitude + dados.agudos.amplitude) / 4;
    energiaAtual = lerp(energiaAtual, energiaAlvo * 5, CONFIG.ceu.responsividade);

    // Ceu dinamico — regenera gradiente apenas a cada 3 frames para performance
    if (frameCount % 3 === 0) {
        gerarCeuGradiente(energiaAtual);
    }
    if (ceuGradiente) {
        image(ceuGradiente, 0, 0, width, height);
    }

    // Nuvens — atras de tudo, sobre o gradiente
    for (let nv of nuvens) {
        nv.atualizar(energiaAtual);
        nv.desenhar();
    }

    // Chao — cor levemente reativa
    noStroke();
    const chaoG = lerp(128, 90, constrain(energiaAtual, 0, 1));
    fill(51, chaoG, 26);
    rect(0, height * 0.7, width, height * 0.3);

    // Desenhar plantas em ordem de camadas (tras -> frente)
    if (jardim) {
        for (let a of jardim.arvores)  a.reagir(dados.graves.amplitude, dados.graves.onset);
        for (let b of jardim.arbustos) b.reagir(dados.percussao.amplitude, dados.percussao.onset);
        for (let f of jardim.flores)   f.reagir(dados.harmonia.amplitude, dados.harmonia.onset);
        for (let d of jardim.dentes)   d.reagir(dados.agudos.amplitude, dados.agudos.onset);

        // Ordem de desenho: tras -> frente (arvores > arbustos > flores > dentes)
        for (let a of jardim.arvores)  a.desenhar();
        for (let b of jardim.arbustos) b.desenhar();
        for (let f of jardim.flores)   f.desenhar();
        for (let d of jardim.dentes)   d.desenhar();
    }

    // Particulas dos dentes-de-leao
    atualizarParticulas();

    // Debug panel
    if (debugVisivel) {
        atualizarDebugPanel(dados);
    }

    document.getElementById('fps').textContent = 'FPS: ' + frameRate().toFixed(0);
}

function atualizarDebugPanel(dados) {
    let nomes = ['graves', 'harmonia', 'percussao', 'agudos'];

    for (let nome of nomes) {
        let bar = document.getElementById(nome + '-bar');
        if (!bar) continue;

        let amp = dados[nome].amplitude;
        let pct = constrain(amp * 500, 0, 100);

        let fillEl = bar.querySelector('.bar-fill');
        let value = bar.querySelector('.value');

        fillEl.style.width = pct + '%';
        value.textContent = amp.toFixed(3);
    }
}

function togglePlay() {
    if (!gerenciador || !gerenciador.pronto) return;

    gerenciador.togglePlay();

    let btn = document.getElementById('play-btn');
    btn.textContent = gerenciador.tocando ? 'Pause' : 'Play';

    document.getElementById('status').textContent = gerenciador.tocando
        ? 'Tocando...'
        : 'Pausado';

    document.getElementById('volume-area').style.display = 'flex';
}

function ajustarVolume(val) {
    if (gerenciador) {
        gerenciador.setVolume(val / 100);
    }
}

function keyPressed() {
    if (key === 'd' || key === 'D') {
        debugVisivel = !debugVisivel;
        document.getElementById('debug-panel').style.display = debugVisivel ? 'block' : 'none';
    }
    if (key === ' ') {
        togglePlay();
        return false; // prevent page scroll
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    ceuGradiente = null;
    gerarCeuGradiente(energiaAtual);
    jardim = criarJardim(spritesMap);
    criarNuvens();
}
