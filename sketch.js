/**
 * Jardim Musical — WEBGL renderer
 * Plantas nascem ao Play e murcham ao Pause.
 * Gradiente de céu via vertex colors, nuvens com parallax, caminhada lateral.
 */

let gerenciador;
let jardim = null;
let atlasMap = {};

const _NOMES_ARVORES  = ['arvore_carvalho', 'arvore_cerejeira', 'arvore_pinheiro', 'arvore_salgueiro'];
const _NOMES_FLORES   = ['flor_vermelha', 'flor_amarela', 'flor_azul', 'flor_laranja', 'flor_rosa', 'flor_roxa'];
const _NOMES_ARBUSTOS = ['arbusto_redondo', 'arbusto_rosa', 'arbusto_folhas', 'arbusto_vermelho'];

let _sheetsArvores = [], _sheetsFlores = [], _sheetsArbustos = [];
let sheetDente, sheetNuvens;

let energiaAtual = 0;
let nuvens = [];
let debugVisivel = true;
let velocidadeCaminhada = 0;
let trilhaLinhas = [];
let todasPlantas = [];

const FILTROS_STEM = { graves: true, melodia: true, percussao: true, agudos: true };

const _analisadoresStem = {
    graves:    new AnalisadorStem('graves'),
    melodia:   new AnalisadorStem('melodia'),
    percussao: new AnalisadorStem('percussao'),
    agudos:    new AnalisadorStem('agudos'),
};

let _hashAtual = null;

function preload() {
    for (const n of _NOMES_ARVORES)  _sheetsArvores.push(loadImage(`plantas/arvores/${n}.png`));
    for (const n of _NOMES_FLORES)   _sheetsFlores.push(loadImage(`plantas/flores/${n}.png`));
    for (const n of _NOMES_ARBUSTOS) _sheetsArbustos.push(loadImage(`plantas/arbustos/${n}.png`));
    sheetDente  = loadImage('plantas/dentes/dente_leao.png');
    sheetNuvens = loadImage('nuvens.png');
}

function setup() {
    const cnv = createCanvas(windowWidth, windowHeight, WEBGL);
    cnv.parent('canvas-container');
    pixelDensity(1);
    imageMode(CORNER);
    drawingContext.disable(drawingContext.DEPTH_TEST);

    gerenciador  = new GerenciadorAudio();
    sintetizador = new Sintetizador();

    atlasMap.arvores  = _NOMES_ARVORES.map((n, i)  => carregarOuExtrair(_sheetsArvores[i],  'arvore',  n + '.png'));
    atlasMap.flores   = _NOMES_FLORES.map((n, i)   => carregarOuExtrair(_sheetsFlores[i],   'flor',    n + '.png'));
    atlasMap.arbustos = _NOMES_ARBUSTOS.map((n, i) => carregarOuExtrair(_sheetsArbustos[i], 'arbusto', n + '.png'));
    atlasMap.dentes   = [carregarOuExtrair(sheetDente, 'dente', 'dente_leao.png')];
    atlasMap.nuvens   = extrairSpritesAtlas(sheetNuvens);

    jardim = criarJardim(atlasMap);
    todasPlantas = [...jardim.arvores, ...jardim.arbustos, ...jardim.flores, ...jardim.dentes];
    criarNuvens();
    criarTrilha();

    // Event delegation — funciona mesmo quando o input é re-renderizado via template
    document.getElementById('app').addEventListener('change', async (e) => {
        if (e.target.id !== 'audio-file') return;
        const arquivo = e.target.files[0];
        if (!arquivo) return;

        const nomeEl = document.getElementById('nome-musica');
        if (nomeEl) nomeEl.textContent = `"${arquivo.name.replace(/\.[^.]+$/, '')}"`;


        const { hash, blobs } = await verificarCacheStems(arquivo);
        _hashAtual = hash;

        if (blobs) {
            await _carregarStemsDoBlobs(blobs);
        } else {
            await gerenciador.enviarParaSeparacao(arquivo);
            if (hash) _guardarStemsNoCache(hash, arquivo.name.replace(/\.[^.]+$/, ''));
        }
    });
}

// Carrega stems a partir de blobs cacheados, sem tocar em audio.js
async function _carregarStemsDoBlobs(blobs) {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = TEXTOS.explorar.carregandoCache;
    if (gerenciador.blobUrls) { for (const u of Object.values(gerenciador.blobUrls)) URL.revokeObjectURL(u); }
    gerenciador.stemsBuffer = blobs;
    gerenciador.blobUrls    = {};
    const nomes = ['graves', 'harmonia', 'percussao', 'agudos'];
    const promessas = nomes.map(nome => new Promise((resolve, reject) => {
        const blob    = new Blob([blobs[nome]], { type: 'audio/wav' });
        const blobUrl = URL.createObjectURL(blob);
        gerenciador.blobUrls[nome] = blobUrl;
        gerenciador.stems[nome].audio = loadSound(blobUrl,
            () => resolve(nome),
            err => reject(err)
        );
    }));
    await Promise.all(promessas);
    for (const nome of nomes) {
        const stem = gerenciador.stems[nome];
        stem.fft = new p5.FFT(CONFIG.audio.smoothing, 256);
        stem.fft.setInput(stem.audio);
        stem.amp = new p5.Amplitude();
        stem.amp.setInput(stem.audio);
    }
    gerenciador.pronto = true;
    if (statusEl) statusEl.textContent = TEXTOS.explorar.prontoCache;
    const playBtn  = document.getElementById('play-btn');
    const volArea  = document.getElementById('volume-area');
    if (playBtn)  playBtn.style.display   = 'flex';
    if (volArea)  volArea.style.display   = 'flex';
}

async function _guardarStemsNoCache(hash, nomeArquivo) {
    if (!gerenciador.stemsBuffer) return;
    await gravarCacheStems(hash, gerenciador.stemsBuffer, nomeArquivo);
    await atualizarListaMusicas();
    _marcarNovaMusicaDisponivel();
}

// ============================================================
// Lista de músicas em cache (sidebar do Modo Jardim)
// ============================================================

async function atualizarListaMusicas() {
    const conteudoEl = document.getElementById('lista-musicas-conteudo');
    const semEl      = document.getElementById('sidebar-sem-musicas');
    if (!conteudoEl) return;

    const lista = await listarMusicasCache();
    if (semEl) semEl.style.display = lista.length === 0 ? 'block' : 'none';
    conteudoEl.innerHTML = '';
    for (const m of lista) conteudoEl.appendChild(criarItemMusica(m));
}

async function tocarMusicaCache(hash) {
    const cached = await _idbObter(hash);
    if (!cached) return;
    if (gerenciador?.pronto && gerenciador.tocando) {
        gerenciador.togglePlay();
        const playBtn = document.getElementById('play-btn');
        if (playBtn) playBtn.innerHTML = TEXTOS.explorar.play;
    }
    await _carregarStemsDoBlobs(cached.blobs);
    for (const [nome, ativo] of Object.entries(FILTROS_STEM)) {
        if (!ativo) {
            const stemKey = nome === 'melodia' ? 'harmonia' : nome;
            gerenciador?.stems?.[stemKey]?.audio?.setVolume?.(0);
        }
    }
    const nomeEl = document.getElementById('nome-musica');
    if (nomeEl && cached.nomeArquivo) nomeEl.textContent = `"${cached.nomeArquivo}"`;
    fecharSidebar();
}

async function confirmarRemoverCache(hash) {
    if (!confirm(TEXTOS.explorar.confirmarRemover)) return;
    await removerDoCache(hash);
    atualizarListaMusicas();
}

// ============================================================
// Sidebar de músicas e filtros
// ============================================================

function abrirSidebar() {
    const painel  = document.getElementById('sidebar-painel');
    const btnMenu = document.querySelector('.btn-menu');
    if (painel)  painel.classList.add('aberto');
    if (btnMenu) btnMenu.textContent = '‹';
    document.body.classList.add('sidebar-aberta');
    atualizarListaMusicas();
    atualizarCheckboxesFiltros();
}

function fecharSidebar() {
    const painel  = document.getElementById('sidebar-painel');
    const btnMenu = document.querySelector('.btn-menu');
    if (painel)  painel.classList.remove('aberto');
    if (btnMenu) btnMenu.textContent = '☰';
    document.body.classList.remove('sidebar-aberta');
}

function toggleSidebar() {
    const painel = document.getElementById('sidebar-painel');
    if (!painel) return;
    if (painel.classList.contains('aberto')) fecharSidebar();
    else abrirSidebar();
}

function _marcarNovaMusicaDisponivel() {
    const painel = document.getElementById('sidebar-painel');
    if (!painel?.classList.contains('aberto')) abrirSidebar();
}

function resetarFiltros() {
    FILTROS_STEM.graves    = true;
    FILTROS_STEM.melodia   = true;
    FILTROS_STEM.percussao = true;
    FILTROS_STEM.agudos    = true;
    for (const [nome] of Object.entries(FILTROS_STEM)) {
        const stemKey = nome === 'melodia' ? 'harmonia' : nome;
        gerenciador?.stems?.[stemKey]?.audio?.setVolume?.(1);
    }
    atualizarCheckboxesFiltros();
}

function toggleFiltro(nome) {
    const ativosCount = Object.values(FILTROS_STEM).filter(v => v).length;
    if (FILTROS_STEM[nome] && ativosCount <= 1) return;
    FILTROS_STEM[nome] = !FILTROS_STEM[nome];
    const stemKey = nome === 'melodia' ? 'harmonia' : nome;
    gerenciador?.stems?.[stemKey]?.audio?.setVolume?.(FILTROS_STEM[nome] ? 1 : 0);
    atualizarCheckboxesFiltros();
}

function atualizarCheckboxesFiltros() {
    const container = document.getElementById('filtros-lista');
    if (!container) return;
    container.innerHTML = '';
    for (const item of TEXTOS.filtros) {
        container.appendChild(criarCardPlanta({ ...item, ativo: FILTROS_STEM[item.key] }));
    }
}

// ============================================================
// Nuvens
// ============================================================

class Nuvem {
    constructor(x, y, atlas, frameIdx) {
        this.x = x; this.y = y; this.atlas = atlas; this.frameIdx = frameIdx;
        const s = atlas.sprites[frameIdx];
        this.escala    = random(0.4, 0.8);
        this.largura   = s.w * this.escala;
        this.altura    = s.h * this.escala;
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
        const { u0, u1, vTop, vBot } = this.atlas.sprites[this.frameIdx];
        const wx = this.x - this.largura / 2 - width / 2;
        const wy = this.y - height / 2;
        push();
        tint(255, this.opacidade);
        texture(this.atlas.fb); noStroke();
        beginShape(QUAD_STRIP);
        vertex(wx,              wy,              0, u0, vTop);
        vertex(wx + this.largura, wy,            0, u1, vTop);
        vertex(wx,              wy + this.altura, 0, u0, vBot);
        vertex(wx + this.largura, wy + this.altura, 0, u1, vBot);
        endShape();
        noTint();
        pop();
    }
}

function criarNuvens() {
    nuvens = [];
    const atlas = atlasMap.nuvens;
    if (!atlas || atlas.sprites.length === 0) return;
    for (let i = 0; i < CONFIG.nuvens.quantidade; i++) {
        const x  = random(-100, width + 100);
        const y  = random(height * CONFIG.nuvens.yMin, height * CONFIG.nuvens.yMax);
        const fi = floor(random(atlas.sprites.length));
        nuvens.push(new Nuvem(x, y, atlas, fi));
    }
}

function criarTrilha() {
    trilhaLinhas = [];
    for (let i = 0; i < 10; i++) trilhaLinhas.push({ x: random(0, width) });
}

// ============================================================
// Reciclagem de plantas que saem pela esquerda
// ============================================================

function reciclarPlantas() {
    const cfg     = CONFIG.caminhada;
    const tocando = gerenciador && gerenciador.tocando;

    function contarAtivos(lista) {
        return lista.filter(p => p.x >= 0 && p.x <= width + 400).length;
    }

    const grupos = {
        arvores:  { lista: jardim.arvores,  total: CONFIG.quantidade.arvores },
        arbustos: { lista: jardim.arbustos, total: CONFIG.quantidade.arbustos },
        flores:   { lista: jardim.flores,   total: CONFIG.quantidade.flores },
        dentes:   { lista: jardim.dentes,   total: CONFIG.quantidade.dentes },
    };
    const ativos = {};
    for (const [k, g] of Object.entries(grupos)) ativos[k] = contarAtivos(g.lista);

    function reciclar(planta, grupoKey) {
        if (planta.x >= cfg.limiteEsquerda) return;
        const banda   = CONFIG.profundidade[planta.especie];
        const y       = random(height * banda.yMin, height * banda.yMax);
        const t       = (y - height * banda.yMin) / (height * (banda.yMax - banda.yMin));
        const escBase = CONFIG.escala[planta.especie];
        const g       = grupos[grupoKey];
        const perto   = ativos[grupoKey] < g.total * 0.60;
        planta.x          = width + (perto ? random(50, 200) : random(cfg.spawnDireita.min, cfg.spawnDireita.max));
        planta.y          = y;
        planta.escalaBase = escBase * (1 - banda.fator + t * 2 * banda.fator);
        planta.bend       = 0;
        planta.escalaX    = 1;
        planta.escalaY    = 1;
        planta.animador.floatFrameIdx    = 0;
        planta.animador.dancaOffset      = 0;
        planta.animador.atrasoNascimento = Math.random() * 30;
        planta.animador.estado = tocando ? ESTADO_ANIM.NASCENDO : ESTADO_ANIM.DORMENTE;
        if (perto) ativos[grupoKey]++;
    }

    for (const a of jardim.arvores)  reciclar(a, 'arvores');
    for (const b of jardim.arbustos) reciclar(b, 'arbustos');
    for (const f of jardim.flores)   reciclar(f, 'flores');
    for (const d of jardim.dentes)   reciclar(d, 'dentes');
}

// ============================================================
// Céu — quad com vertex colors
// ============================================================

function desenharCeu(energia) {
    const cfg = CONFIG.ceu;
    const e   = constrain(energia, 0, 1);
    const topR = lerp(cfg.corTopBase[0], cfg.corTopEnergia[0], e);
    const topG = lerp(cfg.corTopBase[1], cfg.corTopEnergia[1], e);
    const topB = lerp(cfg.corTopBase[2], cfg.corTopEnergia[2], e);
    const botR = lerp(cfg.corBottomBase[0], cfg.corBottomEnergia[0], e);
    const botG = lerp(cfg.corBottomBase[1], cfg.corBottomEnergia[1], e);
    const botB = lerp(cfg.corBottomBase[2], cfg.corBottomEnergia[2], e);
    noStroke();
    beginShape(QUAD_STRIP);
    fill(topR, topG, topB); vertex(-width / 2, -height / 2); vertex(width / 2, -height / 2);
    fill(botR, botG, botB); vertex(-width / 2,  height / 2); vertex(width / 2,  height / 2);
    endShape();
}

// ============================================================
// Draw loop
// ============================================================

function draw() {
    const dados = gerenciador.analisar();
    dados.melodia = dados.harmonia;

    const energiaAlvo = (dados.graves.amplitude + dados.melodia.amplitude
                       + dados.percussao.amplitude + dados.agudos.amplitude) / 4;
    energiaAtual = lerp(energiaAtual, energiaAlvo * 5, CONFIG.ceu.responsividade);

    desenharCeu(energiaAtual);

    velocidadeCaminhada = (gerenciador.tocando && modoAtual !== MODO.ESTUDO)
        ? CONFIG.caminhada.velocidadeBase + energiaAtual * CONFIG.caminhada.velocidadeMultiplier
        : 0;

    // Nuvens
    for (const nv of nuvens) {
        nv.atualizar(energiaAtual);
        nv.x -= velocidadeCaminhada * CONFIG.parallax.nuvens;
        nv.desenhar();
    }

    // Chão
    noStroke();
    const chaoG = lerp(128, 90, constrain(energiaAtual, 0, 1));
    fill(51, chaoG, 26);
    rect(-width / 2, height * 0.22, width, height * 0.28);

    // Trilha
    const chaoY_webgl = height * 0.22;
    stroke(0, 50); strokeWeight(1);
    for (const linha of trilhaLinhas) {
        linha.x -= velocidadeCaminhada;
        if (linha.x < 0) linha.x = width + random(50, 100);
        const lx = linha.x - width / 2;
        line(lx, chaoY_webgl, lx, chaoY_webgl + 20);
    }
    noStroke();

    if (modoAtual === MODO.JARDIM && jardim) {
        _drawJardim(dados);
    } else if (modoAtual === MODO.ESTUDO && plantaEstudo && modoEstudoEstado === 'estudando') {
        _drawEstudo();
    }

    if (debugVisivel) atualizarDebugPanel(dados);
    const fpsEl = document.getElementById('fps');
    if (fpsEl) fpsEl.textContent = 'FPS: ' + frameRate().toFixed(0);
}

function _drawJardim(dados) {
    for (const a of jardim.arvores)  a.x -= velocidadeCaminhada;
    for (const b of jardim.arbustos) b.x -= velocidadeCaminhada;
    for (const f of jardim.flores)   f.x -= velocidadeCaminhada;
    for (const d of jardim.dentes)   d.x -= velocidadeCaminhada;

    reciclarPlantas();

    for (const chave of ['graves', 'melodia', 'percussao', 'agudos']) {
        Object.assign(dados[chave], _analisadoresStem[chave].enriquecer(dados[chave].amplitude));
    }
    const _zero = { amplitude: 0, onset: false, subOnset: false, energia: 0, pico: 0, taxaDecaimento: 0, variabilidade: 0 };
    const sg = FILTROS_STEM.graves    ? dados.graves    : _zero;
    const sm = FILTROS_STEM.melodia   ? dados.melodia   : _zero;
    const sp = FILTROS_STEM.percussao ? dados.percussao : _zero;
    const sa = FILTROS_STEM.agudos    ? dados.agudos    : _zero;

    for (const a of jardim.arvores)  a.reagir(sg);
    for (const b of jardim.arbustos) b.reagir(sp);
    for (const f of jardim.flores)   f.reagir(sm);
    for (const d of jardim.dentes)   d.reagir(sa);

    // Ordenação global por Y (back-to-front) para painter's algorithm correcto
    const porY = [
        ...jardim.arvores, ...jardim.arbustos, ...jardim.flores, ...jardim.dentes
    ].sort((a, b) => a.y - b.y);
    for (const p of porY) p.desenhar();

    for (const p of particulas) p.x -= velocidadeCaminhada;
    atualizarParticulas();
}

function _drawEstudo() {
    const dadosVirtuais = sintetizador.analisarVirtual();
    const especie = plantaEstudo.especie;
    const stem    = especie === 'arvore'  ? dadosVirtuais.graves    :
                    especie === 'flor'    ? dadosVirtuais.melodia   :
                    especie === 'arbusto' ? dadosVirtuais.percussao : dadosVirtuais.agudos;

    plantaEstudo.reagir(stem);
    plantaEstudo.desenhar();

    if (especie === 'dente') atualizarParticulas();
    if (typeof atualizarTabelaEstudo === 'function' && frameCount % 6 === 0) {
        atualizarTabelaEstudo(stem);
    }
}

// ============================================================
// UI
// ============================================================

function atualizarDebugPanel(dados) {
    for (const nome of ['graves', 'melodia', 'percussao', 'agudos']) {
        const bar = document.getElementById(nome + '-bar');
        if (!bar) continue;
        const amp = dados[nome].amplitude;
        bar.querySelector('.bar-fill').style.width = constrain(amp * 500, 0, 100) + '%';
        bar.querySelector('.value').textContent    = amp.toFixed(3);
    }
}

function togglePlay() {
    if (modoAtual !== MODO.JARDIM) return;
    if (!gerenciador || !gerenciador.pronto) return;
    gerenciador.togglePlay();
    const playBtn  = document.getElementById('play-btn');
    const statusEl = document.getElementById('status');
    const volArea  = document.getElementById('volume-area');
    if (playBtn)  playBtn.innerHTML  = gerenciador.tocando ? TEXTOS.explorar.pause : TEXTOS.explorar.play;
    if (statusEl) statusEl.textContent = gerenciador.tocando ? TEXTOS.explorar.tocando : TEXTOS.explorar.pausado;
    if (volArea)  volArea.style.display = 'flex';
}

function ajustarVolume(val) {
    if (gerenciador) gerenciador.setVolume(val / 100);
}

function keyPressed() {
    if (keyCode === 27 && typeof fecharModalProfessor === 'function') fecharModalProfessor();
    if (modoAtual === MODO.ESTUDO) return;
    if (key === 'd' || key === 'D') {
        debugVisivel = !debugVisivel;
        const dp = document.getElementById('debug-panel');
        if (dp) dp.style.display = debugVisivel ? 'block' : 'none';
    }
    if ((key === 'm' || key === 'M') && modoAtual === MODO.JARDIM) toggleSidebar();
    if (key === ' ') { togglePlay(); return false; }
}

function windowResized() {
    if (modoAtual === MODO.ESTUDO) return;
    resizeCanvas(windowWidth, windowHeight);
    jardim = criarJardim(atlasMap);
    todasPlantas = [...jardim.arvores, ...jardim.arbustos, ...jardim.flores, ...jardim.dentes];
    criarNuvens();
    criarTrilha();
}

// Fecha sidebar ao clicar fora dela (só no modo jardim)
document.addEventListener('click', (e) => {
    if (modoAtual !== MODO.JARDIM) return;
    const painel  = document.getElementById('sidebar-painel');
    if (!painel?.classList.contains('aberto')) return;
    const btnMenu = document.querySelector('.btn-menu');
    if (!painel.contains(e.target) && !btnMenu?.contains(e.target)) fecharSidebar();
});
