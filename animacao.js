/**
 * Máquina de estados de animação por planta.
 * Estados: dormente → nascendo → viva → morrendo → dormente.
 * Métodos de dança específicos por espécie (frame oscillation).
 */

const ESTADO_ANIM = {
    DORMENTE:  'dormente',
    NASCENDO:  'nascendo',
    VIVA:      'viva',
    MORRENDO:  'morrendo'
};

class AnimadorPlanta {
    constructor(totalFrames, especie) {
        this.totalFrames    = totalFrames;
        this.especie        = especie;
        this.estado         = ESTADO_ANIM.DORMENTE;
        this.floatFrameIdx  = 0;
        this.fase           = Math.random() * Math.PI * 2;
        this.dancaOffset    = 0;
        this.impulso        = 0;
        this.direcao        = Math.random() > 0.5 ? 1 : -1;

        const cfg = CONFIG.animacao;
        this.velocidadeNascimento = cfg.velocidadeNascimentoMin
            + Math.random() * (cfg.velocidadeNascimentoMax - cfg.velocidadeNascimentoMin);
        this.velocidadeMorte = cfg.velocidadeMorteMin
            + Math.random() * (cfg.velocidadeMorteMax - cfg.velocidadeMorteMin);

        this.atrasoNascimento = Math.random() * 30;
    }

    iniciarNascimento() {
        if (this.estado === ESTADO_ANIM.VIVA || this.estado === ESTADO_ANIM.NASCENDO) return;
        this.estado = ESTADO_ANIM.NASCENDO;
    }

    iniciarMorte() {
        if (this.estado === ESTADO_ANIM.DORMENTE || this.estado === ESTADO_ANIM.MORRENDO) return;
        this.estado = ESTADO_ANIM.MORRENDO;
    }

    atualizar(dadosStem) {
        const ultimo = this.totalFrames - 1;

        switch (this.estado) {
            case ESTADO_ANIM.DORMENTE:
                this.floatFrameIdx = 0;
                break;

            case ESTADO_ANIM.NASCENDO:
                if (this.atrasoNascimento > 0) { this.atrasoNascimento--; break; }
                this.floatFrameIdx += this.velocidadeNascimento;
                if (this.floatFrameIdx >= ultimo) {
                    this.floatFrameIdx = ultimo;
                    this.estado = ESTADO_ANIM.VIVA;
                }
                break;

            case ESTADO_ANIM.VIVA:
                this._dancar(dadosStem, ultimo);
                break;

            case ESTADO_ANIM.MORRENDO:
                this.floatFrameIdx -= this.velocidadeMorte;
                if (this.floatFrameIdx <= 0) {
                    this.floatFrameIdx    = 0;
                    this.estado           = ESTADO_ANIM.DORMENTE;
                    this.atrasoNascimento = Math.random() * 30;
                }
                break;
        }
    }

    _dancar(d, ultimo) {
        const framesOsc = CONFIG.animacao.framesDanca;
        switch (this.especie) {
            case 'arvore':  this._dancarArvore (d, ultimo, framesOsc); break;
            case 'flor':    this._dancarFlor   (d, ultimo, framesOsc); break;
            case 'arbusto': this._dancarArbusto(d, ultimo, framesOsc); break;
            case 'dente':   this._dancarDente  (d, ultimo, framesOsc); break;
        }
    }

    _dancarArvore(d, ultimo, framesOsc) {
        const energia  = d.energia || 0;
        const noiseVal = noise(frameCount * 0.008 + this.fase) * 2 - 1;
        const oscAlvo  = noiseVal * framesOsc * (0.3 + energia * 0.7);
        if (d.onset) {
            this.impulso   = framesOsc * 0.5 * this.direcao;
            this.direcao  *= -1;
        }
        this.impulso    *= 0.95;
        this.dancaOffset = lerp(this.dancaOffset, oscAlvo + this.impulso * 0.3, 0.06);
        this.floatFrameIdx = constrain(ultimo + this.dancaOffset, ultimo - framesOsc, ultimo);
    }

    _dancarFlor(d, ultimo, framesOsc) {
        this.floatFrameIdx = ultimo;
    }

    _dancarArbusto(d, ultimo, framesOsc) {
        if (d.onset) {
            this.dancaOffset = -framesOsc;
        } else {
            this.dancaOffset = lerp(this.dancaOffset, d.amplitude * framesOsc * 0.3, 0.15);
        }
        this.floatFrameIdx = constrain(ultimo + this.dancaOffset, Math.max(0, ultimo - framesOsc), ultimo);
    }

    _dancarDente(d, ultimo, framesOsc) {
        this.floatFrameIdx = ultimo;
    }

    frameAtual() {
        return Math.max(0, Math.min(Math.floor(this.floatFrameIdx), this.totalFrames - 1));
    }
}
