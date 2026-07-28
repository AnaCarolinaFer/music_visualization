const MODO = { JARDIM: 'jardim', ESTUDO: 'estudo' };
let modoAtual     = null;
let plantaEstudo  = null;

let modoEstudoEstado   = 'selecao';
let especieEstudoAtual = null;
let sintetizador       = null;


function entrarModoJardim() {
    modoAtual = MODO.JARDIM;
    _restaurarCanvasFullscreen();
    renderizarTela('tpl-modo-jardim');
    plantaEstudo = null;

    // Init tabs da sidebar
    const tabsEl = document.getElementById('sidebar-tabs');
    if (tabsEl && typeof criarTab === 'function') {
        criarTab(tabsEl, [
            { label: TEXTOS.explorar.tabBiblioteca, paneId: 'pane-biblioteca' },
            { label: TEXTOS.explorar.tabFiltros,    paneId: 'pane-filtros'    },
        ]);
    }

    // Restaura estado do áudio ao voltar de outro modo
    if (typeof gerenciador !== 'undefined' && gerenciador?.pronto) {
        const playBtn = document.getElementById('play-btn');
        const volArea = document.getElementById('volume-area');
        if (playBtn) {
            playBtn.style.display = 'flex';
            playBtn.innerHTML = gerenciador.tocando ? TEXTOS.explorar.pause : TEXTOS.explorar.play;
        }
        if (volArea) volArea.style.display = 'flex';
        for (const [nome, ativo] of Object.entries(FILTROS_STEM)) {
            const stemKey = nome === 'melodia' ? 'harmonia' : nome;
            gerenciador?.stems?.[stemKey]?.audio?.setVolume?.(ativo ? 1 : 0);
        }
    }

    const dp = document.getElementById('debug-panel');
    if (dp) dp.style.display = debugVisivel ? 'block' : 'none';

    if (typeof atualizarCheckboxesFiltros === 'function') atualizarCheckboxesFiltros();

    if (typeof criarJardim === 'function' && typeof atlasMap !== 'undefined') {
        jardim = criarJardim(atlasMap);
        todasPlantas = [...jardim.arvores, ...jardim.arbustos, ...jardim.flores, ...jardim.dentes];
    }
}

function entrarModoEstudo() {
    if (typeof resetarFiltros === 'function') resetarFiltros();
    modoAtual          = MODO.ESTUDO;
    modoEstudoEstado   = 'selecao';
    especieEstudoAtual = null;
    plantaEstudo       = null;

    if (typeof gerenciador !== 'undefined' && gerenciador.tocando) {
        gerenciador.togglePlay();
    }

    if (!sintetizador && typeof Sintetizador !== 'undefined') {
        sintetizador = new Sintetizador();
    }

    renderizarTela('tpl-laboratorio');

    jardim = { arvores: [], flores: [], arbustos: [], dentes: [] };
    todasPlantas = [];

    // Posiciona canvas dentro do palco e seleciona a primeira espécie
    requestAnimationFrame(() => {
        _posicionarCanvasLaboratorio();
        selecionarEspecieEstudo('arvore');
    });
}

function selecionarEspecieEstudo(especie) {
    especieEstudoAtual = especie;
    modoEstudoEstado   = 'estudando';

    // Atualiza pills
    document.querySelectorAll('.pill-especie').forEach(p => {
        p.classList.toggle('ativa', p.dataset.especie === especie);
    });

    const x = typeof width  !== 'undefined' ? width  / 2 : 250;
    const y = typeof height !== 'undefined' ? height * 0.75 : 255;

    const atlasArr = (typeof atlasMap !== 'undefined') ? {
        arvore:  atlasMap.arvores,
        flor:    atlasMap.flores,
        arbusto: atlasMap.arbustos,
        dente:   atlasMap.dentes
    }[especie] : null;

    if (!atlasArr) return;
    const atlas = random(atlasArr);

    const alturaUtil   = y - 30;
    const fatorEspecie = especie === 'flor' ? CONFIG.flor.escalaYMax : 1.0;
    const escala       = (alturaUtil * 0.80) / ((atlas.frameHeight || 200) * fatorEspecie);

    if (especie === 'arvore')  plantaEstudo = new Arvore(x, y, atlas, escala);
    if (especie === 'flor')    plantaEstudo = new Flor(x, y, atlas, escala);
    if (especie === 'arbusto') plantaEstudo = new Arbusto(x, y, atlas, escala);
    if (especie === 'dente')   plantaEstudo = new DenteDeLeao(x, y, atlas, escala);

    if (!plantaEstudo) return;
    plantaEstudo.animador.iniciarNascimento();

    if (sintetizador) sintetizador.setEspecieAtiva(especie);

    // Atualiza estímulos
    const notasEl = document.getElementById('estudo-notas');
    if (notasEl) {
        notasEl.innerHTML = (TEXTOS.estimulos[especie] || []).map(e =>
            `<button class="btn-estimulo" onclick="dispararEstimulo('${e.label}')">${e.emoji}<span>${e.label}</span></button>`
        ).join('');
    }

    atualizarTabelaEstudo({ amplitude: 0, onset: false, energia: 0 });
}

function abrirModalProfessor() {
    if (document.getElementById('modal-professor-overlay')) return;

    const p = TEXTOS.professor;

    // Pane Sobre
    const paneSobre = document.createElement('div');
    paneSobre.id = 'pane-sobre';
    paneSobre.className = 'modal-pane';
    p.sobre.forEach(s => {
        paneSobre.innerHTML += `<p class="modal-subtitulo-secao">${s.subtitulo}</p><p class="modal-paragrafo">${s.texto}</p>`;
    });

    // Pane Legenda
    const paneLegenda = document.createElement('div');
    paneLegenda.id = 'pane-legenda';
    paneLegenda.className = 'modal-pane';
    paneLegenda.style.display = 'none';
    const linhas = p.legenda.map(r =>
        `<tr><td>${r.planta}</td><td>${r.stem}</td><td>${r.instrumento}</td><td>${r.movimento}</td></tr>`
    ).join('');
    paneLegenda.innerHTML = `<table class="modal-tabela">
        <thead><tr><th>Planta</th><th>Stem</th><th>Instrumento</th><th>Movimento</th></tr></thead>
        <tbody>${linhas}</tbody>
    </table>`;

    // Pane Atividades
    const paneAtividades = document.createElement('div');
    paneAtividades.id = 'pane-atividades';
    paneAtividades.className = 'modal-pane';
    paneAtividades.style.display = 'none';
    p.atividades.forEach(a => {
        paneAtividades.innerHTML += `<div class="card-atividade">
            <span class="card-atividade-titulo">${a.titulo}</span>
            <p class="card-atividade-desc">${a.desc}</p>
        </div>`;
    });

    // Pane Projeto
    const paneProjeto = document.createElement('div');
    paneProjeto.id = 'pane-projeto';
    paneProjeto.className = 'modal-pane';
    paneProjeto.style.display = 'none';
    p.projeto.forEach(s => {
        paneProjeto.innerHTML += `<p class="modal-subtitulo-secao">${s.subtitulo}</p><p class="modal-paragrafo">${s.texto}</p>`;
    });

    // Tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.id = 'modal-tabs-container';
    const panes = [paneSobre, paneLegenda, paneAtividades, paneProjeto];
    p.tabs.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.className = 'modal-tab' + (i === 0 ? ' ativa' : '');
        btn.textContent = label;
        btn.onclick = () => {
            tabsContainer.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('ativa'));
            btn.classList.add('ativa');
            panes.forEach(pane => pane.style.display = 'none');
            panes[i].style.display = 'flex';
        };
        tabsContainer.appendChild(btn);
    });

    // Modal
    const modal = document.createElement('div');
    modal.id = 'modal-professor';
    modal.innerHTML = `
        <button id="modal-fechar" onclick="fecharModalProfessor()">✕</button>
        <div id="modal-header">
            <span id="modal-titulo">${p.titulo}</span>
            <p id="modal-subtitulo">${p.subtitulo}</p>
        </div>
    `;
    modal.appendChild(tabsContainer);
    panes.forEach(pane => modal.appendChild(pane));

    const overlay = document.createElement('div');
    overlay.id = 'modal-professor-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) fecharModalProfessor(); };
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function fecharModalProfessor() {
    const overlay = document.getElementById('modal-professor-overlay');
    if (overlay) overlay.remove();
}

function voltarMenu() {
    if (typeof resetarFiltros === 'function') resetarFiltros();
    if (sintetizador) sintetizador.setEspecieAtiva(null);
    modoAtual          = null;
    plantaEstudo       = null;
    modoEstudoEstado   = 'selecao';
    _restaurarCanvasFullscreen();
    especieEstudoAtual = null;
    renderizarTela('tpl-tela-inicial');
}

function dispararEstimulo(nome) {
    if (modoEstudoEstado !== 'estudando' || !especieEstudoAtual) return;
    if (sintetizador) sintetizador.tocarEstimulo(nome);
}

function atualizarTabelaEstudo(stem) {
    const tabelaEl = document.getElementById('estudo-tabela');
    if (!tabelaEl || !especieEstudoAtual) return;

    const info      = TEXTOS.infoEducativa[especieEstudoAtual];
    const especie   = TEXTOS.especies[especieEstudoAtual];
    const animador  = plantaEstudo ? plantaEstudo.animador : null;
    const estado    = animador ? animador.estado : 'dormente';
    const estadoTrad = TEXTOS.estudo.estadoTrad[estado] || estado;

    const frameAtual     = animador ? animador.frameAtual()  : 0;
    const totalFrames    = animador ? animador.totalFrames   : 0;
    const ultimoEstimulo = sintetizador?.ultimoEstimulo ?? TEXTOS.estudo.semEstimulo;

    const t = TEXTOS.estudo;

    tabelaEl.innerHTML = `
        <div class="info-especie-header">
            <span class="info-especie-emoji">${especie.emoji}</span>
            <span class="info-especie-nome">${especie.nome}</span>
        </div>
        <div class="info-campo">
            <span class="info-label">${t.tipoSom}</span>
            <span class="info-valor">${info.tipoSom}</span>
        </div>
        <div class="info-campo">
            <span class="info-label">${t.instrumentos}</span>
            <span class="info-valor">${info.instrumentos}</span>
        </div>
        <div class="info-campo">
            <span class="info-label">${t.comoReage}</span>
            <span class="info-valor">${info.comoReage}</span>
        </div>
        <div class="info-campo" style="background:var(--creme-fundo);border-radius:8px;padding:10px;">
            <span class="info-valor" style="font-style:italic;color:var(--texto-claro);">${info.curiosidade}</span>
        </div>
        <div class="info-campo" style="background:#f0f0f0;border-radius:8px;padding:8px;margin-top:4px;">
            <span class="info-label" style="font-size:9px;">SINAIS (debug)</span>
            <span class="info-valor" style="font-size:11px;font-family:monospace;line-height:1.6;">
                ampl: ${(stem.amplitude||0).toFixed(3)}<br>
                pico: ${(stem.pico||0).toFixed(3)}<br>
                decay: ${(stem.taxaDecaimento||0).toFixed(4)}<br>
                variab: ${(stem.variabilidade||0).toFixed(3)}
            </span>
        </div>
    `;
}

function _posicionarCanvasLaboratorio() {
    const palco = document.getElementById('lab-palco');
    if (!palco) return;
    const rect = palco.getBoundingClientRect();
    const cc   = document.getElementById('canvas-container');
    cc.style.cssText = [
        'position:fixed',
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        'overflow:hidden',
        'border-radius:12px',
        'z-index:4',
    ].join(';');
    if (typeof resizeCanvas === 'function') resizeCanvas(rect.width, rect.height);

    // Frame marrom ao nível do body (z:6 > canvas z:4)
    let frame = document.getElementById('_lab-frame');
    if (!frame) {
        frame = document.createElement('div');
        frame.id = '_lab-frame';
        frame.style.cssText = 'position:fixed;pointer-events:none;border:12px solid #8B5C3B;border-radius:16px;z-index:6;box-shadow:0 4px 20px rgba(0,0,0,0.15);';
        document.body.appendChild(frame);
    }
    frame.style.left   = rect.left   + 'px';
    frame.style.top    = rect.top    + 'px';
    frame.style.width  = rect.width  + 'px';
    frame.style.height = rect.height + 'px';
}

function _restaurarCanvasFullscreen() {
    const frame = document.getElementById('_lab-frame');
    if (frame) frame.remove();

    const cc = document.getElementById('canvas-container');
    cc.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;';
    if (typeof resizeCanvas === 'function' && windowWidth > 0) {
        resizeCanvas(windowWidth, windowHeight);
        if (typeof criarNuvens === 'function') criarNuvens();
        if (typeof criarTrilha === 'function') criarTrilha();
    }
}
