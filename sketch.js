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

// Caminhada musical
let velocidadeCaminhada = 0;

// Trilha no chao
let trilhaLinhas = [];

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

    // Criar marcas de trilha no chao
    criarTrilha();

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

function criarTrilha() {
    trilhaLinhas = [];
    for (let i = 0; i < 10; i++) {
        trilhaLinhas.push({ x: random(0, width) });
    }
}

function reciclarPlantas() {
    const cfg = CONFIG.caminhada;
    const linhaChao = height * 0.72;

    for (let a of jardim.arvores) {
        if (a.x < cfg.limiteEsquerda) {
            a.x = width + random(cfg.spawnDireita.min, cfg.spawnDireita.max);
            a.y = linhaChao + random(-10, 10);
            a.sprite = random(spritesMap.arvores);
            a.rotacao = 0;
            a.escalaAtual = a.escalaBase;
            a.escalaX = 1;
            a.escalaY = 1;
        }
    }

    for (let b of jardim.arbustos) {
        if (b.x < cfg.limiteEsquerda) {
            b.x = width + random(cfg.spawnDireita.min, cfg.spawnDireita.max);
            b.y = linhaChao + random(-10, 10);
            b.sprite = random(spritesMap.arbustos);
            b.rotacao = 0;
            b.escalaAtual = b.escalaBase;
            b.escalaX = 1;
            b.escalaY = 1;
        }
    }

    for (let f of jardim.flores) {
        if (f.x < cfg.limiteEsquerda) {
            f.x = width + random(cfg.spawnDireita.min, cfg.spawnDireita.max);
            f.y = linhaChao + random(-10, 10);
            f.sprite = random(spritesMap.flores);
            f.rotacao = 0;
            f.escalaAtual = f.escalaBase;
            f.escalaX = 1;
            f.escalaY = 1;
        }
    }

    for (let d of jardim.dentes) {
        if (d.x < cfg.limiteEsquerda) {
            d.x = width + random(cfg.spawnDireita.min, cfg.spawnDireita.max);
            d.y = linhaChao + random(-10, 10);
            d.sprite = random(spritesMap.dentes);
            d.rotacao = 0;
            d.escalaAtual = d.escalaBase;
            d.escalaX = 1;
            d.escalaY = 1;
        }
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

    // Calcular velocidade da caminhada
    if (gerenciador.tocando) {
        velocidadeCaminhada = CONFIG.caminhada.velocidadeBase + (energiaAtual * CONFIG.caminhada.velocidadeMultiplier);
    } else {
        velocidadeCaminhada = 0;
    }

    // Nuvens — atras de tudo, sobre o gradiente (com parallax da caminhada)
    for (let nv of nuvens) {
        nv.atualizar(energiaAtual);
        nv.x -= velocidadeCaminhada * CONFIG.parallax.nuvens;
        nv.desenhar();
    }

    // Chao — cor levemente reativa
    noStroke();
    const chaoG = lerp(128, 90, constrain(energiaAtual, 0, 1));
    fill(51, chaoG, 26);
    rect(0, height * 0.7, width, height * 0.3);

    // Trilha no chao
    const chaoY = height * 0.72;
    stroke(0, 50);
    strokeWeight(1);
    for (let linha of trilhaLinhas) {
        linha.x -= velocidadeCaminhada;
        if (linha.x < 0) {
            linha.x = width + random(50, 100);
        }
        line(linha.x, chaoY, linha.x, chaoY + 20);
    }
    noStroke();

    // Plantas
    if (jardim) {
        // Mover plantas com a caminhada
        for (let a of jardim.arvores)  a.x -= velocidadeCaminhada;
        for (let b of jardim.arbustos) b.x -= velocidadeCaminhada;
        for (let f of jardim.flores)   f.x -= velocidadeCaminhada;
        for (let d of jardim.dentes)   d.x -= velocidadeCaminhada;

        // Reciclar plantas que sairam pela esquerda
        reciclarPlantas();

        // Reagir ao audio
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

    // Particulas dos dentes-de-leao (com scroll da caminhada)
    for (let p of particulas) p.x -= velocidadeCaminhada;
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
    criarTrilha();
}
