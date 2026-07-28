/**
 * GerenciadorAudio — Gerencia 4 stems de audio com FFT independente.
 *
 * Mapeamento Spleeter → Projeto:
 *   other  → graves.wav   → Arvores
 *   vocals → harmonia.wav → Flores
 *   drums  → percussao.wav→ Arbustos
 *   bass   → agudos.wav   → Dentes-de-leao
 */
class GerenciadorAudio {
    constructor() {
        this.stems = {
            graves:    { audio: null, fft: null, amp: null, amplitude: 0, amplitudeAnterior: 0, onset: false, energiaAnterior: 0 },
            harmonia:  { audio: null, fft: null, amp: null, amplitude: 0, amplitudeAnterior: 0, onset: false },
            percussao: { audio: null, fft: null, amp: null, amplitude: 0, amplitudeAnterior: 0, onset: false },
            agudos:    { audio: null, fft: null, amp: null, amplitude: 0, amplitudeAnterior: 0, onset: false }
        };
        this.pronto = false;
        this.tocando = false;
        this.volume = 1.0;
        this.serverUrl = 'http://localhost:5000';
        this.stemsBuffer = null;
        this.blobUrls    = null;
    }

    /**
     * Envia arquivo de audio para o servidor Spleeter e carrega os stems retornados.
     */
    async enviarParaSeparacao(arquivo) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = 'Enviando musica para separacao... pode levar 1-2 minutos';

        if (this.blobUrls) { for (const u of Object.values(this.blobUrls)) URL.revokeObjectURL(u); }

        const formData = new FormData();
        formData.append('file', arquivo);

        try {
            const response = await fetch(`${this.serverUrl}/separar`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Erro na separacao');
            }

            statusEl.textContent = 'Carregando stems de audio...';

            // Capturar ArrayBuffers antes do loadSound — necessário para o cache IndexedDB
            const nomes = ['graves', 'harmonia', 'percussao', 'agudos'];
            const buffers = await Promise.all(nomes.map(n => fetch(this.serverUrl + data.stems[n]).then(r => r.arrayBuffer())));
            this.stemsBuffer = Object.fromEntries(nomes.map((n, i) => [n, buffers[i]]));
            this.blobUrls    = {};
            const promessas = nomes.map((nome, i) => {
                return new Promise((resolve, reject) => {
                    const url = URL.createObjectURL(new Blob([buffers[i]], { type: 'audio/wav' }));
                    this.blobUrls[nome] = url;
                    this.stems[nome].audio = loadSound(url,
                        () => resolve(nome),
                        (err) => reject(new Error(`Erro ao carregar ${nome}: ${err}`))
                    );
                });
            });

            await Promise.all(promessas);

            // Criar FFT e Amplitude para cada stem
            for (const nome of nomes) {
                const stem = this.stems[nome];
                stem.fft = new p5.FFT(0.8, 256);
                stem.fft.setInput(stem.audio);
                stem.amp = new p5.Amplitude();
                stem.amp.setInput(stem.audio);
            }

            this.pronto = true;
            statusEl.textContent = 'Pronto! Clique Play para comecar.';
            document.getElementById('play-btn').style.display = 'inline-block';
            document.getElementById('volume-area').style.display = 'flex';

        } catch (err) {
            statusEl.textContent = 'Erro: ' + err.message;
            console.error('Erro na separacao:', err);
        }
    }

    /**
     * Inicia/pausa todos os stems simultaneamente.
     */
    togglePlay() {
        if (!this.pronto) return;

        if (this.tocando) {
            for (const nome in this.stems) {
                const stem = this.stems[nome];
                if (stem.audio && stem.audio.isPlaying()) {
                    stem.audio.pause();
                }
            }
            this.tocando = false;
        } else {
            for (const nome in this.stems) {
                const stem = this.stems[nome];
                if (stem.audio) {
                    stem.audio.setVolume(this.volume);
                    stem.audio.loop();
                }
            }
            this.tocando = true;
        }
    }

    /**
     * Ajusta volume de todos os stems (0.0 a 1.0).
     */
    setVolume(vol) {
        this.volume = constrain(vol, 0, 1);
        for (const nome in this.stems) {
            const stem = this.stems[nome];
            if (stem.audio) {
                stem.audio.setVolume(this.volume);
            }
        }
    }

    /**
     * Analisa cada stem e retorna dados de amplitude e onset.
     */
    analisar() {
        const resultado = {};
        const threshold = CONFIG.audio.onsetThreshold;

        for (const nome in this.stems) {
            const stem = this.stems[nome];

            if (stem.amp && this.tocando) {
                stem.amplitudeAnterior = stem.amplitude;
                const nivel = stem.amp.getLevel();
                // Suavizar amplitude para movimentos mais fluidos
                stem.amplitude = lerp(stem.amplitude, nivel, 0.3);
                // Onset padrao para todos EXCETO graves
                if (nome !== 'graves') {
                    stem.onset = (nivel - stem.amplitudeAnterior) > threshold;
                }
            } else {
                stem.amplitude = 0;
                stem.onset = false;
            }

            resultado[nome] = {
                amplitude: stem.amplitude,
                onset: stem.onset
            };
        }

        // ONSET ESPECIFICO PARA GRAVES — baseado em delta da energia do FFT
        if (this.stems.graves.fft && this.tocando) {
            this.stems.graves.fft.analyze();
            const energiaBass   = this.stems.graves.fft.getEnergy("bass");
            const energiaLowMid = this.stems.graves.fft.getEnergy("lowMid");
            const energiaAtual  = (energiaBass * 0.7 + energiaLowMid * 0.3) / 255;

            const deltaEnergia = energiaAtual - this.stems.graves.energiaAnterior;
            const thresholdGraves = 0.03;
            this.stems.graves.onset = deltaEnergia > thresholdGraves;
            this.stems.graves.energiaAnterior = energiaAtual;

            resultado.graves.energia = energiaAtual;
            resultado.graves.onset   = this.stems.graves.onset;

        } else {
            resultado.graves.energia = 0;
        }

        return resultado;
    }
}
