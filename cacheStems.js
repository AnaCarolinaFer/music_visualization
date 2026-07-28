/**
 * Cache de stems de áudio via IndexedDB.
 * Armazena os blobs de áudio (WAV) para reutilização entre sessões.
 * Evita re-processar via Spleeter quando o mesmo ficheiro é carregado novamente.
 * Não modifica audio.js — injeta na estrutura do gerenciador a partir de sketch.js.
 */

const _IDB_DB      = 'JardimMusical_v2';
const _IDB_STORE   = 'stems';
const _IDB_VERSION = 1;
const _LIMITE_MB   = 500;

// ============================================================
// Hash rápido (SHA-256 de início + fim + tamanho do ficheiro)
// ============================================================

async function calcularHashAudio(arquivo) {
    const TRECHO = 64 * 1024;
    const tam    = arquivo.size;
    const inicio = arquivo.slice(0, Math.min(TRECHO, tam));
    const fim    = arquivo.slice(Math.max(0, tam - TRECHO), tam);
    const b1     = await inicio.arrayBuffer();
    const b2     = await fim.arrayBuffer();

    const combined = new Uint8Array(b1.byteLength + b2.byteLength + 8);
    combined.set(new Uint8Array(b1), 0);
    combined.set(new Uint8Array(b2), b1.byteLength);
    new DataView(combined.buffer, b1.byteLength + b2.byteLength).setFloat64(0, tam);

    const hashBuf = await crypto.subtle.digest('SHA-256', combined);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// IndexedDB helpers
// ============================================================

function _idbAbrir() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(_IDB_DB, _IDB_VERSION);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(_IDB_STORE)) {
                const store = db.createObjectStore(_IDB_STORE, { keyPath: 'hash' });
                store.createIndex('ultimoAcesso', 'ultimoAcesso');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

async function _idbObter(hash) {
    const db = await _idbAbrir();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(_IDB_STORE, 'readwrite');
        const store = tx.objectStore(_IDB_STORE);
        const req   = store.get(hash);
        req.onsuccess = () => {
            if (req.result) {
                req.result.ultimoAcesso = Date.now();
                store.put(req.result);
                resolve(req.result);
            } else {
                resolve(null);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

async function _idbGuardar(hash, blobs, tamanhoBytes, nomeArquivo) {
    const db = await _idbAbrir();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(_IDB_STORE, 'readwrite');
        const store = tx.objectStore(_IDB_STORE);
        const req   = store.put({
            hash,
            blobs,
            tamanhoBytes,
            nomeArquivo:  nomeArquivo || 'Música sem nome',
            criadoEm:     Date.now(),
            ultimoAcesso: Date.now()
        });
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

async function _idbAtualizarNome(hash, nomeArquivo) {
    const db = await _idbAbrir();
    return new Promise(resolve => {
        const tx    = db.transaction(_IDB_STORE, 'readwrite');
        const store = tx.objectStore(_IDB_STORE);
        const req   = store.get(hash);
        req.onsuccess = () => {
            if (req.result) {
                req.result.nomeArquivo  = nomeArquivo;
                req.result.ultimoAcesso = Date.now();
                store.put(req.result);
            }
            resolve();
        };
        req.onerror = () => resolve();
    });
}

async function _aplicarLRU() {
    const db = await _idbAbrir();
    return new Promise(resolve => {
        const tx    = db.transaction(_IDB_STORE, 'readwrite');
        const store = tx.objectStore(_IDB_STORE);
        const todos = [];
        store.openCursor().onsuccess = e => {
            const cur = e.target.result;
            if (cur) { todos.push(cur.value); cur.continue(); }
            else {
                let total = todos.reduce((s, x) => s + (x.tamanhoBytes || 0), 0);
                const limite = _LIMITE_MB * 1024 * 1024;
                if (total <= limite) { resolve(); return; }
                todos.sort((a, b) => a.ultimoAcesso - b.ultimoAcesso);
                for (const item of todos) {
                    if (total <= limite) break;
                    store.delete(item.hash);
                    total -= item.tamanhoBytes || 0;
                }
                tx.oncomplete = () => resolve();
            }
        };
    });
}

// ============================================================
// API pública
// ============================================================

async function verificarCacheStems(arquivo) {
    try {
        const hash   = await calcularHashAudio(arquivo);
        const cached = await _idbObter(hash);
        if (cached) {
            console.log(`Stems cache HIT: ${hash.slice(0, 12)}...`);
            const nome = arquivo.name.replace(/\.[^.]+$/, '');
            if (cached.nomeArquivo !== nome) _idbAtualizarNome(hash, nome);
            return { hash, blobs: cached.blobs };
        }
        console.log(`Stems cache MISS: ${hash.slice(0, 12)}...`);
        return { hash, blobs: null };
    } catch (e) {
        console.warn('Erro ao verificar cache de stems:', e);
        return { hash: null, blobs: null };
    }
}

async function gravarCacheStems(hash, blobs, nomeArquivo) {
    if (!hash) return;
    try {
        let total = 0;
        for (const k of Object.keys(blobs)) {
            if (blobs[k] && blobs[k].byteLength) total += blobs[k].byteLength;
        }
        await _idbGuardar(hash, blobs, total, nomeArquivo);
        console.log(`Stems gravados no cache (${(total / 1e6).toFixed(1)} MB)`);
        _aplicarLRU();
    } catch (e) {
        console.warn('Erro ao gravar cache de stems:', e);
    }
}

async function listarMusicasCache() {
    try {
        const db = await _idbAbrir();
        return new Promise(resolve => {
            const tx    = db.transaction(_IDB_STORE, 'readonly');
            const store = tx.objectStore(_IDB_STORE);
            const todos = [];
            store.openCursor().onsuccess = e => {
                const cur = e.target.result;
                if (cur) {
                    const { hash, nomeArquivo, tamanhoBytes, ultimoAcesso } = cur.value;
                    todos.push({ hash, nomeArquivo: nomeArquivo || 'Música sem nome', tamanhoBytes, ultimoAcesso });
                    cur.continue();
                } else {
                    todos.sort((a, b) => b.ultimoAcesso - a.ultimoAcesso);
                    resolve(todos);
                }
            };
            tx.onerror = () => resolve([]);
        });
    } catch (e) {
        return [];
    }
}

async function removerDoCache(hash) {
    try {
        const db = await _idbAbrir();
        return new Promise(resolve => {
            const tx = db.transaction(_IDB_STORE, 'readwrite');
            tx.objectStore(_IDB_STORE).delete(hash);
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
}

async function limparCacheStems() {
    const db = await _idbAbrir();
    return new Promise(resolve => {
        const tx = db.transaction(_IDB_STORE, 'readwrite');
        tx.objectStore(_IDB_STORE).clear();
        tx.oncomplete = () => { console.log('Cache de stems limpo.'); resolve(); };
    });
}
