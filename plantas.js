/**
 * Classes de plantas para o Jardim Musical.
 * Cada tipo de planta reage a um stem de audio diferente.
 *
 * Ordem de desenho (tras -> frente):
 *   Arvores > Arbustos > Flores > Dentes-de-leao
 */

// ============================================================
// Utilidade: extrair sprites individuais de um sprite sheet
// ============================================================

function extrairSprites(sheetImg) {
    const sprites = [];

    // Copiar sheet e remover fundo preto
    const img = sheetImg.get();
    img.loadPixels();
    for (let i = 0; i < img.pixels.length; i += 4) {
        if (img.pixels[i] < 10 && img.pixels[i + 1] < 10 && img.pixels[i + 2] < 10) {
            img.pixels[i + 3] = 0;
        }
    }
    img.updatePixels();

    // Grid de ocupacao em blocos (reduz 1024x1024 para 256x256)
    const BS = 4;
    const gw = Math.ceil(img.width / BS);
    const gh = Math.ceil(img.height / BS);
    const occ = new Uint8Array(gw * gh);

    for (let by = 0; by < gh; by++) {
        for (let bx = 0; bx < gw; bx++) {
            const yEnd = Math.min((by + 1) * BS, img.height);
            const xEnd = Math.min((bx + 1) * BS, img.width);
            let found = false;
            for (let py = by * BS; py < yEnd && !found; py++) {
                for (let px = bx * BS; px < xEnd && !found; px++) {
                    if (img.pixels[(py * img.width + px) * 4 + 3] > 0) {
                        found = true;
                    }
                }
            }
            if (found) occ[by * gw + bx] = 1;
        }
    }

    // Encontrar componentes conectados (BFS, 8-vizinhos)
    const visited = new Uint8Array(gw * gh);
    const regions = [];

    for (let by = 0; by < gh; by++) {
        for (let bx = 0; bx < gw; bx++) {
            const idx = by * gw + bx;
            if (!occ[idx] || visited[idx]) continue;

            const queue = [bx, by];
            visited[idx] = 1;
            let x0 = bx, y0 = by, x1 = bx, y1 = by;
            let qi = 0;

            while (qi < queue.length) {
                const cx = queue[qi++];
                const cy = queue[qi++];

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = cx + dx;
                        const ny = cy + dy;
                        if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
                        const ni = ny * gw + nx;
                        if (occ[ni] && !visited[ni]) {
                            visited[ni] = 1;
                            queue.push(nx, ny);
                            if (nx < x0) x0 = nx;
                            if (nx > x1) x1 = nx;
                            if (ny < y0) y0 = ny;
                            if (ny > y1) y1 = ny;
                        }
                    }
                }
            }

            regions.push({ x0, y0, x1, y1 });
        }
    }

    // Extrair sprites, filtrar pequenos (sementes soltas, fragmentos)
    const MIN_SIZE = 50;
    for (const r of regions) {
        const sx = r.x0 * BS;
        const sy = r.y0 * BS;
        const sw = Math.min((r.x1 + 1) * BS, img.width) - sx;
        const sh = Math.min((r.y1 + 1) * BS, img.height) - sy;

        if (sw < MIN_SIZE || sh < MIN_SIZE) continue;

        sprites.push(img.get(sx, sy, sw, sh));
    }

    return sprites;
}

// ============================================================
// Classe base
// ============================================================

class Planta {
    constructor(x, y, sprite, escalaBase) {
        this.x = x;
        this.y = y;
        this.sprite = sprite;
        this.escalaBase = escalaBase || 1.0;
        this.escalaAtual = this.escalaBase;
        this.escalaX = 1.0;
        this.escalaY = 1.0;
        this.rotacao = 0;
    }

    desenhar() {
        push();
        translate(this.x, this.y);
        rotate(this.rotacao);
        scale(this.escalaAtual * this.escalaX, this.escalaAtual * this.escalaY);
        // Pivo na base: desenha para cima a partir do ponto de ancoragem
        image(this.sprite, -this.sprite.width / 2, -this.sprite.height);
        pop();
    }

    reagir(_amplitude, _onset) {
        // Sobrescrito pelas subclasses
    }
}

// ============================================================
// Arvore — balanco pendular lento com os graves
// Movimento: rotate suave, tipo vento
// ============================================================

class Arvore extends Planta {
    constructor(x, y, sprite, escalaBase) {
        super(x, y, sprite, escalaBase);
        this.fase = random(TWO_PI);  // fase para dessincronizar arvores
        this.direcao = random() > 0.5 ? 1 : -1;
        this.impulsoExtra = 0;  // impulso adicional do onset
    }

    reagir(amplitude, onset, energia = 0) {
        const cfg = CONFIG.arvore;

        // 1. BALANCO CONTINUO baseado na energia
        const velocidadeOscilacao = cfg.velocidadeBase + (energia * cfg.velocidadeEnergia);
        const anguloEnergia = energia * cfg.anguloBase;
        const balancoContinuo = sin(frameCount * velocidadeOscilacao + this.fase) * anguloEnergia;

        // 2. IMPULSO EXTRA do onset (decai com o tempo)
        if (onset) {
            this.impulsoExtra = cfg.impulsoOnset;
            this.direcao *= -1;  // inverte direcao no onset
        }
        this.impulsoExtra *= cfg.decaimentoImpulso;

        // 3. ROTACAO FINAL = balanco continuo + impulso extra
        const rotacaoAlvo = balancoContinuo + (this.impulsoExtra * this.direcao);

        // 4. Suavizacao
        this.rotacao = lerp(this.rotacao, rotacaoAlvo, cfg.suavizacao);
    }
}

// ============================================================
// Flor — respiracao/pulso uniforme com a harmonia
// Movimento: scale uniforme, como se estivesse respirando
// ============================================================

class Flor extends Planta {
    constructor(x, y, sprite, escalaBase) {
        super(x, y, sprite, escalaBase);
        this.fase = random(TWO_PI);
    }

    reagir(amplitude, _onset) {
        const cfg = CONFIG.flor;
        // Respiracao: escala cresce e volta proporcionalmente a amplitude
        const intensidade = map(amplitude, 0, 0.2, 0, 1.0, true);
        const pulso = this.escalaBase + intensidade * cfg.escalaMax;
        this.escalaAtual = lerp(this.escalaAtual, pulso, cfg.responsividade);
    }
}

// ============================================================
// Arbusto — compressao elastica rapida com a percussao
// Movimento: achata e alarga no onset (squash & stretch)
// ============================================================

class Arbusto extends Planta {
    constructor(x, y, sprite, escalaBase) {
        super(x, y, sprite, escalaBase);
        this.velocidadeRetorno = CONFIG.arbusto.retorno + random(-0.03, 0.03);
    }

    reagir(amplitude, onset) {
        const cfg = CONFIG.arbusto;
        if (onset) {
            // Squash instantaneo: achata verticalmente, alarga horizontalmente
            this.escalaY = 1.0 - cfg.compressaoMax;
            this.escalaX = 1.0 + cfg.compressaoMax * 0.6;
        } else {
            // Retorno elastico — volta com overshoot leve
            const alvoY = 1.0 + amplitude * 0.1; // leve esticada com amplitude
            const alvoX = 1.0 - amplitude * 0.05;
            this.escalaY = lerp(this.escalaY, alvoY, this.velocidadeRetorno);
            this.escalaX = lerp(this.escalaX, alvoX, this.velocidadeRetorno);
        }
    }
}

// ============================================================
// Dente-de-leao — emite sementes nos picos dos agudos
// Movimento: leve tremor + emissao de particulas
// ============================================================

class DenteDeLeao extends Planta {
    constructor(x, y, sprite, escalaBase) {
        super(x, y, sprite, escalaBase);
        this.fase = random(TWO_PI);
    }

    reagir(amplitude, onset) {
        const cfg = CONFIG.dente;

        // Tremor proporcional a amplitude
        const intensidade = map(amplitude, 0, 0.15, 0, 1.0, true);
        this.rotacao = sin(frameCount * 0.08 + this.fase) * 0.04 * intensidade;

        // Emitir sementes no onset
        if (onset) {
            const qtd = Math.ceil(cfg.particulas * map(amplitude, 0, 0.2, 1, 3, true));
            emitirSementes(this.x, this.y, qtd);
        }

        // Emissao continua sutil quando amplitude alta
        if (amplitude > 0.08 && random() < amplitude * 2) {
            emitirSementes(this.x, this.y, cfg.emissaoContinua);
        }
    }
}

// ============================================================
// Funcao para criar o jardim completo
// ============================================================

function distribuirGrid(qtd, margemPct) {
    const margem = width * margemPct;
    const posicoes = [];
    for (let i = 0; i < qtd; i++) {
        // Posicao base uniforme + jitter aleatorio para parecer natural
        const base = map(i, 0, qtd - 1, margem, width - margem);
        const jitter = (width / qtd) * random(-0.3, 0.3);
        posicoes.push(constrain(base + jitter, margem * 0.5, width - margem * 0.5));
    }
    return posicoes;
}

function criarJardim(spritesMap) {
    const plantas = {
        arvores: [],
        flores: [],
        arbustos: [],
        dentes: []
    };

    const linhaChao = height * 0.72;
    const cfg = CONFIG.quantidade;

    // Todas as plantas com base no mesmo chao, apenas ±10px de variacao natural
    // Profundidade vem da ORDEM DE DESENHO e ESCALA, nao da posicao Y

    // Arvores — fundo (desenhadas primeiro, maiores)
    const posArvores = distribuirGrid(cfg.arvores, 0.03);
    for (let i = 0; i < cfg.arvores; i++) {
        const x = posArvores[i];
        const y = linhaChao + random(-10, 10);
        const sprite = random(spritesMap.arvores);
        const escala = CONFIG.escala.arvore + random(-0.08, 0.08);
        plantas.arvores.push(new Arvore(x, y, sprite, escala));
    }

    // Arbustos — meio-fundo (desenhados segundo)
    const posArbustos = distribuirGrid(cfg.arbustos, 0.02);
    for (let i = 0; i < cfg.arbustos; i++) {
        const x = posArbustos[i];
        const y = linhaChao + random(-10, 10);
        const sprite = random(spritesMap.arbustos);
        const escala = CONFIG.escala.arbusto + random(-0.04, 0.04);
        plantas.arbustos.push(new Arbusto(x, y, sprite, escala));
    }

    // Flores — meio-frente (desenhadas terceiro)
    const posFlores = distribuirGrid(cfg.flores, 0.02);
    for (let i = 0; i < cfg.flores; i++) {
        const x = posFlores[i];
        const y = linhaChao + random(-10, 10);
        const sprite = random(spritesMap.flores);
        const escala = CONFIG.escala.flor + random(-0.04, 0.04);
        plantas.flores.push(new Flor(x, y, sprite, escala));
    }

    // Dentes-de-leao — frente (desenhados por ultimo, menores)
    const posDentes = distribuirGrid(cfg.dentes, 0.02);
    for (let i = 0; i < cfg.dentes; i++) {
        const x = posDentes[i];
        const y = linhaChao + random(-10, 10);
        const sprite = random(spritesMap.dentes);
        const escala = CONFIG.escala.dente + random(-0.04, 0.04);
        plantas.dentes.push(new DenteDeLeao(x, y, sprite, escala));
    }

    return plantas;
}
