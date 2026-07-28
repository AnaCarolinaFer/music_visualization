/**
 * Extração de sprites de sheets de animação.
 * Empacota frames em texture atlas WEBGL (Framebuffer).
 * Cache de bounding boxes via localStorage.
 */

/**
 * Agrupa bounding boxes que provavelmente pertencem à mesma planta
 * (ex: folha solta acima do caule, separadas por pixels pretos).
 * Heurística: dois bboxes são do mesmo frame se há sobreposição ou
 * centros horizontais próximos, e o gap vertical é menor que tolY.
 */
function agruparFragmentos(bboxes, frameAlturaMedia) {
    if (bboxes.length === 0) return [];

    const tolY = frameAlturaMedia * 0.30;

    const pais = bboxes.map((_, i) => i);
    function find(i) {
        while (pais[i] !== i) { pais[i] = pais[pais[i]]; i = pais[i]; }
        return i;
    }
    function union(a, b) { pais[find(a)] = find(b); }

    for (let i = 0; i < bboxes.length; i++) {
        const a  = bboxes[i];
        const aCx = a.x + a.width / 2;
        for (let j = i + 1; j < bboxes.length; j++) {
            const b   = bboxes[j];
            const bCx = b.x + b.width / 2;

            const overlapX      = !(a.x + a.width < b.x || b.x + b.width < a.x);
            const centrosProx   = Math.abs(aCx - bCx) < Math.min(a.width, b.width) * 0.6;
            if (!overlapX && !centrosProx) continue;

            const aBottom = a.y + a.height;
            const bBottom = b.y + b.height;
            const gapY = (a.y > bBottom) ? (a.y - bBottom)
                       : (b.y > aBottom) ? (b.y - aBottom)
                       : 0;

            if (gapY <= tolY) union(i, j);
        }
    }

    const grupos = new Map();
    for (let i = 0; i < bboxes.length; i++) {
        const raiz = find(i);
        if (!grupos.has(raiz)) grupos.set(raiz, []);
        grupos.get(raiz).push(bboxes[i]);
    }

    const merged = [];
    for (const grupo of grupos.values()) {
        let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
        let area = 0;
        for (const b of grupo) {
            xmin = Math.min(xmin, b.x);
            ymin = Math.min(ymin, b.y);
            xmax = Math.max(xmax, b.x + b.width);
            ymax = Math.max(ymax, b.y + b.height);
            area += b.area;
        }
        merged.push({ x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin, area });
    }
    return merged;
}

function _limparFundo(sheetImg, threshold) {
    if (sheetImg._fundoLimpo) return;
    sheetImg.loadPixels();
    const px = sheetImg.pixels;
    for (let i = 0; i < px.length; i += 4) {
        if (px[i] <= threshold && px[i + 1] <= threshold && px[i + 2] <= threshold) {
            px[i + 3] = 0;
        }
    }
    sheetImg.updatePixels();
    sheetImg._fundoLimpo = true;
}

function criarPixelClassifier(threshold) {
    const rgbaWord = new Uint32Array(1);
    const rgba = new Uint8Array(rgbaWord.buffer);
    return (pixel) => {
        rgbaWord[0] = pixel;
        return rgba[0] > threshold || rgba[1] > threshold || rgba[2] > threshold ? 1 : 0;
    };
}

function spriteBoundingBox(runs) {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    let area = 0;
    for (const run of runs) {
        xmin = Math.min(xmin, run.x);
        xmax = Math.max(xmax, run.x + run.len);
        ymin = Math.min(ymin, run.y);
        ymax = Math.max(ymax, run.y + 1);
        area += run.len;
    }
    return { x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin, area };
}

/**
 * Extrai frames de um sprite sheet de fundo escuro via union-find.
 * Ordena por área crescente (menor = broto, maior = planta adulta).
 * Retorna { fb, frames, frameWidth, frameHeight, totalFrames }.
 */
function extrairFramesAnimacao(sheetImg, threshold) {
    sheetImg.pixelDensity(1);
    sheetImg.loadPixels();

    const classifier = criarPixelClassifier(threshold);
    const components = imageComponents(
        sheetImg.pixels, sheetImg.width, sheetImg.height, classifier
    );

    let rawFrames = [];
    let frameWidth = 0, frameHeight = 0;

    for (const comp of components) {
        const bb = spriteBoundingBox(comp);
        const { width: w, height: h } = bb;
        if (w < sheetImg.width * 0.8 && w > 5 && h > 5) {
            rawFrames.push(bb);
        } else {
            paintComponent(sheetImg.pixels, sheetImg.width, sheetImg.height, comp, 0);
        }
    }
    sheetImg.updatePixels();
    _limparFundo(sheetImg, threshold);

    if (rawFrames.length === 0) {
        console.warn('extrairFramesAnimacao: nenhum frame encontrado');
        return { fb: null, frames: [], frameWidth: 0, frameHeight: 0, totalFrames: 0 };
    }

    const nBrutos    = rawFrames.length;
    const alturaMedia = rawFrames.reduce((s, f) => s + f.height, 0) / nBrutos;
    rawFrames = agruparFragmentos(rawFrames, alturaMedia);
    console.log(`Componentes brutos: ${nBrutos}, após agrupamento: ${rawFrames.length}`);

    for (const f of rawFrames) {
        frameWidth  = Math.max(frameWidth,  f.width);
        frameHeight = Math.max(frameHeight, f.height);
    }

    rawFrames.sort((a, b) => a.area - b.area);

    for (const f of rawFrames) {
        f.img     = sheetImg.get(f.x, f.y, f.width, f.height);
        f.offsetX = (frameWidth  - f.width)  / 2;
        f.offsetY = (frameHeight - f.height);
    }

    const n         = rawFrames.length;
    const atlasWidth = frameWidth * n;
    const fb = createFramebuffer({ width: atlasWidth, height: frameHeight, density: 1 });
    fb.begin();
    imageMode(CORNER);
    clear();
    for (let i = 0; i < n; i++) {
        const f = rawFrames[i];
        image(f.img,
            -atlasWidth / 2 + i * frameWidth + f.offsetX,
            -frameHeight   / 2 + f.offsetY
        );
    }
    fb.end();

    const frames = rawFrames.map((f, i) => ({
        u0:   i / n,
        u1:   (i + 1) / n,
        vTop: (frameHeight - f.height) / frameHeight,
        w:    f.width,
        h:    f.height,
        area: f.area,
        bbox: { x: f.x, y: f.y, w: f.width, h: f.height }
    }));

    console.log(`extrairFramesAnimacao: ${n} frames. Atlas ${atlasWidth}x${frameHeight}`);
    return { fb, frames, frameWidth, frameHeight, totalFrames: n };
}

// ============================================================
// Cache localStorage — bounding boxes apenas (recria o atlas)
// ============================================================

function _chaveCache(especie, nomeArquivo) {
    return `sprite_v${CONFIG.sprites.versaoCache}_${especie}_${nomeArquivo}`;
}

function _lerCache(chave) {
    try {
        const raw = localStorage.getItem(chave);
        return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
}

function _gravarCache(chave, frameWidth, frameHeight, frames) {
    try {
        localStorage.setItem(chave, JSON.stringify({
            frameWidth, frameHeight,
            bboxes: frames.map(f => ({ ...f.bbox, area: f.area }))
        }));
    } catch (_) { /* localStorage cheio — ok */ }
}

function _montarAtlasDeBboxes(sheetImg, meta, threshold) {
    sheetImg.pixelDensity(1);
    _limparFundo(sheetImg, threshold);
    const { frameWidth, frameHeight, bboxes } = meta;
    const n         = bboxes.length;
    const atlasWidth = frameWidth * n;

    const cells = bboxes.map(bb => ({
        img:     sheetImg.get(bb.x, bb.y, bb.w, bb.h),
        offsetX: (frameWidth  - bb.w) / 2,
        offsetY: (frameHeight - bb.h),
        area:    bb.area,
        w: bb.w, h: bb.h
    }));

    const fb = createFramebuffer({ width: atlasWidth, height: frameHeight, density: 1 });
    fb.begin();
    imageMode(CORNER);
    clear();
    for (let i = 0; i < n; i++) {
        const c = cells[i];
        image(c.img,
            -atlasWidth / 2 + i * frameWidth + c.offsetX,
            -frameHeight   / 2 + c.offsetY
        );
    }
    fb.end();

    const frames = cells.map((c, i) => ({
        u0:   i / n,
        u1:   (i + 1) / n,
        vTop: (frameHeight - c.h) / frameHeight,
        w: c.w, h: c.h,
        area: c.area,
        bbox: bboxes[i]
    }));

    return { fb, frames, frameWidth, frameHeight, totalFrames: n };
}

/**
 * API pública. Tenta cache localStorage; senão extrai via union-find.
 */
function carregarOuExtrair(sheetImg, especie, nomeArquivo) {
    const chave     = _chaveCache(especie, nomeArquivo);
    const threshold = CONFIG.sprites.thresholdPorEspecie[especie] || CONFIG.sprites.thresholdPadrao;

    const cached = _lerCache(chave);
    if (cached) {
        console.log(`Sprites cache HIT: ${especie}`);
        return _montarAtlasDeBboxes(sheetImg, cached, threshold);
    }

    console.log(`Sprites cache MISS: ${especie} — extraindo...`);
    console.time(`extrair_${especie}`);
    const resultado = extrairFramesAnimacao(sheetImg, threshold);
    console.timeEnd(`extrair_${especie}`);

    if (resultado.totalFrames > 0) {
        _gravarCache(chave, resultado.frameWidth, resultado.frameHeight, resultado.frames);
    }
    return resultado;
}

/** Limpa todas as entradas de sprite do localStorage. */
function limparCacheSprites() {
    for (const k of Object.keys(localStorage)) {
        if (k.startsWith('sprite_')) localStorage.removeItem(k);
    }
    console.log('Cache de sprites limpo.');
}
