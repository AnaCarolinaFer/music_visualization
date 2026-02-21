/**
 * Configuracoes centralizadas do Jardim Musical.
 */
const CONFIG = {
    arvore: {
        anguloMax: 0.25,       // radianos max de rotacao
        velocidade: 0.025,     // velocidade oscilacao pendular
        suavizacao: 0.08       // lerp (mais baixo = mais suave/lento)
    },
    flor: {
        escalaMax: 0.5,        // quanto cresce no pulso (multiplicado pela amplitude)
        responsividade: 0.12   // lerp
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
