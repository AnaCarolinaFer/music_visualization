function renderizarTela(idTemplate) {
    const tpl = document.getElementById(idTemplate);
    if (!tpl) return;
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(tpl.content.cloneNode(true));
    aplicarTextos(app);
}

function criarTab(container, abas, tabAtiva = 0) {
    container.innerHTML = '';
    abas.forEach(({ label, paneId }, i) => {
        const btn = document.createElement('button');
        btn.className = 'sidebar-tab' + (i === tabAtiva ? ' ativa' : '');
        btn.textContent = label;
        btn.onclick = () => {
            container.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('ativa'));
            btn.classList.add('ativa');
            abas.forEach(a => {
                const pane = document.getElementById(a.paneId);
                if (pane) pane.style.display = 'none';
            });
            const pane = document.getElementById(paneId);
            if (pane) pane.style.display = 'flex';
        };
        container.appendChild(btn);
    });
}

function criarCardPlanta({ key, emoji, nome, sub, cor, ativo }) {
    const btn = document.createElement('button');
    btn.className = 'card-planta' + (ativo ? '' : ' inativo');
    btn.style.background = cor;
    btn.onclick = () => toggleFiltro(key);
    btn.innerHTML = `
        <span class="cp-emoji">${emoji}</span>
        <span class="cp-nome">${nome}</span>
        <span class="cp-sub">${sub}</span>
    `;
    return btn;
}

function criarItemMusica({ hash, nomeArquivo }) {
    const div = document.createElement('div');
    div.className = 'item-musica';
    div.innerHTML = `
        <span class="nome-item">${nomeArquivo}</span>
        <button onclick="tocarMusicaCache('${hash}')" title="Tocar">▶</button>
        <button onclick="confirmarRemoverCache('${hash}')" title="Remover">✕</button>
    `;
    return div;
}

function criarItemFaixaPronta({ slug, nome }) {
    const div = document.createElement('div');
    div.className = 'item-musica';
    div.innerHTML = `
        <span class="nome-item">${nome}</span>
        <button onclick="carregarFaixaPronta('${slug}', '${nome}')" title="Tocar">▶</button>
    `;
    return div;
}

document.addEventListener('DOMContentLoaded', () => renderizarTela('tpl-tela-inicial'));
