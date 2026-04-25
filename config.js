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
        impulsoOnset: 0.2,
        decaimentoImpulso: 0.95,

        // Suavizacao geral
        suavizacao: 0.06,

        // Bezier
        bendMax: 0.35,
        segmentos: 8,
        alturaFator: 1.0
    },
    flor: {
        escalaMax: 0.5,
        responsividade: 0.12,

        // Bezier
        bendMax: 0.45,
        segmentos: 8,
        amplitudeMin: 0.4,   // fator minimo para manter balanco visivel mesmo com amplitude baixa
        amplitudeMult: 8     // multiplica amplitude para escalar a intensidade
    },
    arbusto: {
        compressaoMax: 0.35,   // quanto achata verticalmente no onset
        retorno: 0.15,         // velocidade de retorno (elastico)
        amplitudeMin: 0.02     // amplitude minima para reagir continuamente
    },
    dente: {
        particulas: 4,         // quantidade de sementes por onset
        vidaParticula: 255,    // frames ate morrer
        decremento: 2.5,       // vida perdida por frame
        emissaoContinua: 1     // particulas por frame quando amplitude alta
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
        spawnDireita: { min: 50, max: 200 }
    },
    parallax: {
        nuvens: 0.3
    }
};
