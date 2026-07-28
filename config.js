/**
 * Configuracoes centralizadas do Jardim Musical.
 */
const CONFIG = {
    arvore: {
        // Balanco continuo (energia)
        anguloBase: 0.12,
        velocidadeBase: 0.015,
        velocidadeEnergia: 0.03,

        // Impulso extra (onset)
        impulsoOnset: 0.55,
        decaimentoImpulso: 0.88,

        // Suavizacao geral
        suavizacao: 0.14,

        // Bezier
        bendMax: 0.75,
        segmentos: 8,
        alturaFator: 1.0,

        // Tremor: vibração rápida da copa (taxaDecaimento alta)
        tremorLimiar:     0.006,
        tremorGanho:      4.0,
        tremorMax:        0.20,
        tremorDecaimento: 0.92,
        tremorFreq:       0.5,

        // Balanço: oscilação lateral lenta (variabilidade alta)
        balancoFator: 4.0,
        balancoFreq:  0.05,
    },
    flor: {
        escalaMax: 0.5,
        responsividade: 0.10,
        segmentos: 8,
        amplitudeMin: 0.07,
        esticamentoAmpl: 1.5,       // legado — não usado
        esticamentoQuadAmpl: 10.0,  // amplitude² * fator = stretch (capped at escalaYMax-1)
        escalaYMax: 1.55,           // max vertical stretch (55% above rest)
        respiracaoBase: 0.04,
        respiracaoFreq: 0.025,
        escalaXCompressao: 0.167
    },
    arbusto: {
        compressaoMax: 0.40,
        retorno: 0.15,
        amplitudeMin: 0.02,
        fatorPico: 4.0,           // legado — não usado
        fatorPulsoQuad: 100,      // (pico-0.03)² * fator = intensidade do squash
    },
    dente: {
        particulas: 4,            // legado
        vidaParticula: 255,
        decremento: 2.5,
        emissaoContinua: 1,
        quantidadePorPico: 30,    // legado — não usado
        dispersaoFator: 10,
        brilhoFator: 80,          // amplitude × variabilidade × fator = intensidade do brilho da coroa
    },
    audio: {
        onsetThreshold: 0.04,  // diferenca de amplitude para detectar onset
        smoothing: 0.8         // suavizacao do FFT (0-1)
    },
    limites: {
        maxPlantas: 120,
        maxParticulas: 100
    },
    quantidade: {
        arvores: 22,
        flores: 38,
        arbustos: 28,
        dentes: 22
    },
    escala: {
        arvore: 1.0,
        flor: 0.35,
        arbusto: 0.5,
        dente: 0.25
    },
    nuvens: {
        quantidade: 5,
        velocidadeBase: 0.3,
        velocidadeMax: 0.8,
        opacidade: 180,
        yMin: 0.05,
        yMax: 0.30
    },
    ceu: {
        corTopBase: [135, 180, 220],
        corBottomBase: [200, 220, 180],
        corTopEnergia: [60, 30, 120],
        corBottomEnergia: [180, 100, 80],
        responsividade: 0.05
    },
    caminhada: {
        velocidadeBase: 1,
        velocidadeMultiplier: 3,
        limiteEsquerda: -200,
        spawnDireita: { min: 50, max: 600 }
    },
    parallax: {
        nuvens: 0.3
    },
    sprites: {
        thresholdPadrao: 0x12,
        thresholdPorEspecie: {
            arvore:  0x20,
            flor:    0x12,
            arbusto: 0x18,
            dente:   0x12
        },
        versaoCache: 3
    },
    animacao: {
        velocidadeNascimentoMin: 0.15,
        velocidadeNascimentoMax: 0.35,
        velocidadeMorteMin: 0.20,
        velocidadeMorteMax: 0.40,
        framesDanca: 3
    },
    crescimento: {
        habilitado: false
    },
    vida: {
        janelaMediaFrames: 60,
        limiarNascimento:  0.05,
        limiarMorte:       0.02,
        framesMinimoVida:  90,
    },
    profundidade: {
        //            yMin  yMax   fatorEscala (±% da escalaBase com a posição Y)
        arvore:  { yMin: 0.72, yMax: 0.76, fator: 0.20 },
        arbusto: { yMin: 0.76, yMax: 0.82, fator: 0.15 },
        flor:    { yMin: 0.80, yMax: 0.87, fator: 0.12 },
        dente:   { yMin: 0.83, yMax: 0.91, fator: 0.10 }
    }
};
