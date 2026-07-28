const TEXTOS = {
    geral: {
        voltar: '← Menu',
    },
    home: {
        titulo: 'JARDIM MUSICAL',
        subtitulo: 'Veja a música florescer em um jardim cheio de vida!',
        botaoJardim: 'Explorar o jardim',
        subJardim: 'Veja muitas plantas juntas dançando com sua música!',
        botaoEstudo: 'Laboratório das plantas',
        subEstudo: 'Descubra de pertinho como cada plantinha reage aos sons!',
        professor: 'Área do professor',
        professorSub: 'Recursos e atividades',
    },
    explorar: {
        instrucao: 'Envie uma música para começar',
        envieMusica: 'Envie uma música para começar',
        play: '<svg width="14" height="14" viewBox="0 0 14 14" fill="white"><polygon points="3,2 12,7 3,12"/></svg>',
        pause: '<svg width="14" height="14" viewBox="0 0 14 14" fill="white"><rect x="2" y="2" width="4" height="10"/><rect x="8" y="2" width="4" height="10"/></svg>',
        tocando: 'Tocando...',
        pausado: 'Pausado',
        prontoCache: 'Pronto! (do cache)',
        carregandoCache: 'A carregar do cache...',
        semMusicas: 'Nenhuma música salva ainda.',
        tabBiblioteca: 'Biblioteca',
        tabFiltros: 'Filtros',
        filtrosDesc: 'Escolha quais partes da música você quer ouvir e ver as plantinhas dançarem!',
        adicionarMusica: 'Adicionar música',
        confirmarRemover: 'Remover esta música do cache?',
        debugHint: 'D: debug | Espaço: play/pause',
        faixasProntas: 'Faixas prontas',
        carregandoFaixaPronta: 'Carregando faixa...',
        prontoFaixaPronta: 'Pronto!',
        erroServidorIndisponivel: 'Servidor de separação indisponível. Tente uma das faixas prontas na Biblioteca.',
    },
    estudo: {
        titulo: 'Laboratório das plantas',
        tipoSom: 'TIPO DE SOM',
        instrumentos: 'INSTRUMENTOS',
        comoReage: 'COMO REAGE',
        oQueEstaFazendo: 'O que está fazendo:',
        faseCrescimento: 'Fase do crescimento:',
        forcaSom: 'Força do som agora:',
        ultimoEstimulo: 'Último estímulo:',
        semEstimulo: '—',
        estadoTrad: {
            dormente: 'dormindo',
            nascendo: 'crescendo',
            viva: 'dançando',
            morrendo: 'voltando a dormir',
        },
    },
    especies: {
        arvore:  { nome: 'Árvore',       emoji: '🌳' },
        flor:    { nome: 'Flor',         emoji: '🌸' },
        arbusto: { nome: 'Arbusto',      emoji: '🌿' },
        dente:   { nome: 'Dente-de-leão', emoji: '🌼' },
    },
    infoEducativa: {
        arvore: {
            tipoSom: 'Sons graves',
            instrumentos: 'Tambor, baixo, contrabaixo',
            comoReage: 'Verga forte como ao vento',
            curiosidade: 'Sons graves fazem o chão tremer!',
        },
        flor: {
            tipoSom: 'Melodia',
            instrumentos: 'Vozes, violino, piano',
            comoReage: 'Estica pra cima como cantando',
            curiosidade: 'A melodia é o canto da música!',
        },
        arbusto: {
            tipoSom: 'Percussão',
            instrumentos: 'Bateria, palmas',
            comoReage: 'Pula e se achata na batida',
            curiosidade: 'Toda música tem uma pulsação!',
        },
        dente: {
            tipoSom: 'Sons agudos',
            instrumentos: 'Sino, flauta, chocalho',
            comoReage: 'Treme e solta sementes',
            curiosidade: 'Sons agudos são leves e brilhantes!',
        },
    },
    filtros: [
        { key: 'graves',    emoji: '🌳', nome: 'Árvores',        sub: 'graves',    cor: 'var(--verde-folha)' },
        { key: 'melodia',   emoji: '🌸', nome: 'Flores',         sub: 'melodia',   cor: 'var(--rosa-botao)'  },
        { key: 'percussao', emoji: '🌿', nome: 'Arbustos',       sub: 'percussão', cor: 'var(--verde-grama)' },
        { key: 'agudos',    emoji: '🌼', nome: 'Dentes-de-leão', sub: 'agudos',    cor: '#F4D03F'            },
    ],
    professor: {
        titulo: '👩🏽‍🏫 Área do Professor',
        subtitulo: 'Guia prático para usar o Jardim Musical em sala de aula',
        tabs: ['Sobre', 'Legenda', 'Atividades', 'Projeto'],
        sobre: [
            { subtitulo: 'O que é o Jardim Musical?', texto: 'O Jardim Musical é uma ferramenta de visualização musical interativa onde plantas animadas reagem em tempo real aos diferentes elementos de uma música — graves, melodia, percussão e sons agudos.' },
            { subtitulo: 'Como funciona?', texto: 'A ferramenta separa automaticamente os 4 elementos sonoros de qualquer música enviada. Cada grupo de plantas responde a um desses elementos com um movimento específico, tornando a música visível.' },
            { subtitulo: 'Como usar em sala?', texto: 'Explore o Jardim com toda a turma projetado na tela. Use o Laboratório para estudar uma planta de perto e disparar estímulos individualmente. Os filtros permitem silenciar partes da música e observar quais plantas param de dançar.' },
        ],
        legenda: [
            { planta: '🌳 Árvore',        stem: 'Graves',    instrumento: 'Tambor, baixo, contrabaixo', movimento: 'Balança como ao vento' },
            { planta: '🌸 Flor',          stem: 'Melodia',   instrumento: 'Vozes, violino, piano',      movimento: 'Estica como cantando'  },
            { planta: '🌿 Arbusto',       stem: 'Percussão', instrumento: 'Bateria, palmas',            movimento: 'Salta e se achata'     },
            { planta: '🌼 Dente-de-leão', stem: 'Agudos',    instrumento: 'Sino, flauta, chocalho',    movimento: 'Tremula e solta sementes' },
        ],
        atividades: [
            { titulo: 'Atividade 1 — Descoberta', desc: 'Toque uma música conhecida da turma e peça que os alunos observem quais plantas dançam mais. Pergunte: "O que essa planta está ouvindo?"' },
            { titulo: 'Atividade 2 — Comparação', desc: 'Use os filtros para silenciar um stem de cada vez. Pergunte: "O que mudou no jardim? Que instrumento sumiu?"' },
            { titulo: 'Atividade 3 — Laboratório', desc: 'No Laboratório, explore cada planta individualmente. Dispare os estímulos e descreva o movimento que aparece.' },
            { titulo: 'Atividade 4 — Adivinha', desc: 'Silencia a música mas mantenha as plantas animando. Peça que os alunos digam quais instrumentos estão tocando só pelo movimento das plantas.' },
            { titulo: 'Atividade 5 — Classificação', desc: 'Traga músicas de diferentes gêneros (samba, clássico, rock). Compare quais plantas dançam mais em cada gênero e discuta por quê.' },
            { titulo: 'Atividade 6 — Criação', desc: 'Peça que alunos escolham uma planta favorita e descrevam — em texto ou desenho — o tipo de música que faria essa planta dançar muito.' },
        ],
        projeto: [
            { subtitulo: 'Origem', texto: 'O Jardim Musical nasceu como projeto de visualização musical educativa, com o objetivo de tornar conceitos de teoria musical acessíveis a crianças usando linguagem visual e lúdica.' },
            { subtitulo: 'Tecnologia', texto: 'A separação de áudio é feita com Spleeter (IA da Deezer). A visualização usa p5.js com renderização WEBGL para animações fluidas em tempo real.' },
            { subtitulo: 'Contribuição', texto: 'Esta é uma ferramenta de código aberto em desenvolvimento. Feedbacks, sugestões de atividades e relatos de uso em sala de aula são muito bem-vindos.' },
        ],
    },

    estimulos: {
        arvore: [
            { emoji: '🌑',    label: 'Grave suave' },
            { emoji: '🌑🌑',  label: 'Grave forte' },
            { emoji: '💥',    label: 'Trovão'      },
            { emoji: '🌊',    label: 'Onda grave'  },
        ],
        flor: [
            { emoji: '🎵', label: 'Canto curto'    },
            { emoji: '🎶', label: 'Canto longo'    },
            { emoji: '📈', label: 'Canto subindo'  },
            { emoji: '📉', label: 'Canto descendo' },
        ],
        arbusto: [
            { emoji: '👏',   label: 'Batida fraca' },
            { emoji: '💥',   label: 'Batida forte' },
            { emoji: '🥁',   label: 'Ritmo lento'  },
            { emoji: '🥁🥁', label: 'Ritmo rápido' },
        ],
        dente: [
            { emoji: '✨', label: 'Som leve' },
            { emoji: '⭐', label: 'Faísca'   },
            { emoji: '🎐', label: 'Tilintar' },
            { emoji: '🌬', label: 'Sussurro' },
        ],
    },
};

function aplicarTextos(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const chave = el.dataset.i18n;
        const valor = chave.split('.').reduce((obj, k) => obj?.[k], TEXTOS);
        if (typeof valor === 'string') el.innerHTML = valor;
    });
}
