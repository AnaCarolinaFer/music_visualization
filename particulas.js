/**
 * Sistema de particulas para dentes-de-leao.
 * Sementes flutuam para cima e desaparecem gradualmente.
 */

class Semente {
    constructor(x, y, dispersao = 1, opcoes = {}) {
        this.x = x;
        this.y = y;
        this.vx = random(-1.5, 1.5) * dispersao;
        this.vy = random(-3, -0.8) * (opcoes.velocidadeBase ?? 1.0);
        this.vida = CONFIG.dente.vidaParticula;
        this.tamanho = random(2, 5) * (opcoes.tamanho ?? 1.0);
        this.ondulacao = random(0.01, 0.04);
        this.fase = random(TWO_PI);
    }

    atualizar() {
        // Movimento com ondulacao
        this.x += this.vx + sin(frameCount * this.ondulacao + this.fase) * 0.3;
        this.y += this.vy;
        // Desacelerar subida gradualmente
        this.vy *= 0.995;
        // Perder vida
        this.vida -= CONFIG.dente.decremento;
    }

    desenhar() {
        const wx = this.x - width / 2;
        const wy = this.y - height / 2;
        const alpha = this.vida;
        noStroke();
        fill(255, 255, 240, alpha);
        ellipse(wx, wy, this.tamanho, this.tamanho * 1.3);
        stroke(255, 255, 220, alpha * 0.7);
        strokeWeight(0.5);
        line(wx, wy, wx + this.vx * 2, wy - this.tamanho * 2);
    }

    morta() {
        return this.vida <= 0;
    }
}

// Array global de particulas
let particulas = [];

function atualizarParticulas() {
    for (let i = particulas.length - 1; i >= 0; i--) {
        particulas[i].atualizar();
        particulas[i].desenhar();
        if (particulas[i].morta()) {
            particulas.splice(i, 1);
        }
    }
}

function emitirSementes(x, y, quantidade, dispersao = 1) {
    const max = CONFIG.limites.maxParticulas;
    const qtd = Math.min(quantidade, max - particulas.length);
    for (let i = 0; i < qtd; i++) {
        particulas.push(new Semente(x + random(-10, 10), y - random(20, 60), dispersao));
    }
}

function emitirSemente(x, y, opcoes = {}) {
    if (particulas.length >= CONFIG.limites.maxParticulas) return;
    const dispersao = opcoes.dispersao ?? 1;
    particulas.push(new Semente(x + random(-10, 10), y - random(20, 60), dispersao, opcoes));
}
