// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO GLOBAL E VARIÁVEIS
// ═══════════════════════════════════════════════════════════════════════════════

let ambientShader;
let groundShader;
let plantGroups = [];
let fft, amplitude, peakDetect;
let sound, mic, testOsc;
let audioMode = 'none';
let isPlaying = false;
let isSetupComplete = false;

// Variáveis para as imagens
let trees, bushes, flowers, roots;

// Parâmetros ajustáveis
let sensitivity = 2.0; // Aumentado para mais sensibilidade
let danceIntensity = 1.5; // Aumentado para mais movimento
let depthScale = 400;
let smoothing = 0.2; // Mais rápido

// Análise de áudio
let previousSpectrum = null;
let spectrum = [];
let volume = 0;
let beatDetected = false;

// Nuvens
let clouds = [];
let cloudTime = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// MEYDA & ESSENTIA.JS - ANÁLISE AVANÇADA DE TIMBRE
// ═══════════════════════════════════════════════════════════════════════════════

// === Meyda Real-Time Analyzer ===
let meydaAnalyzer = null;
let meydaFeatures = null;

// === Essentia.js ML Refinement ===
let essentiaModel = null;
let essentiaInferenceInterval = 1000; // ms between inferences
let lastInferenceTime = 0;
let mlInstrumentScores = {
    strings: 0,
    winds: 0,
    vocals: 0,
    bass: 0
};

// === Frequency Band Definitions ===
// FFT bin ranges for per-band analysis
const bandRanges = {
    bass:    { start: 0,   end: 8 },   // ~0-172 Hz
    lowMid:  { start: 8,   end: 32 },  // ~172-689 Hz
    highMid: { start: 32,  end: 128 }, // ~689-2756 Hz
    treble:  { start: 128, end: 256 }  // ~2756-5512 Hz
};

// === Instrument Classification Weights ===
// Tuned for heuristic classification (Meyda layer)
const instrumentWeights = {
    strings: {  // TREES - Bass/Strings (60-250Hz)
        centroid: 0.15,  // LOW centroid (inverted scoring)
        rolloff: 0.30,   // Energy in low frequencies
        energy: 0.30,    // High bass band energy
        flatness: 0.15,  // Tonal
        sustain: 0.10
    },
    vocals: {  // FLOWERS - Vocals/Synth
        mfcc: 0.40,
        flux: 0.25,
        centroid: 0.15,
        flatness: 0.10,
        spread: 0.10
    },
    percussion: {  // BUSHES - Drums/Percussion (NEW)
        flux: 0.40,
        flatness: 0.25,
        zcr: 0.20,
        kurtosis: 0.15
    },
    winds: {  // ROOTS - Flute/Highs
        centroid: 0.30,
        rolloff: 0.25,
        kurtosis: 0.20,
        zcr: 0.15,
        flatness: 0.10
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSE NUVEM
// ═══════════════════════════════════════════════════════════════════════════════

class Cloud {
    constructor(x, y, z, size) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.size = size;
        this.speed = random(0.2, 0.5);
        this.phase = random(TWO_PI);
    }

    update() {
        this.x += this.speed;
        if (this.x > width/2 + 200) {
            this.x = -width/2 - 200;
        }
        // Movimento vertical sutil
        this.y += sin(cloudTime * 0.5 + this.phase) * 0.1;
    }

    display() {
        push();
        translate(this.x, this.y, this.z);
        noStroke();
        fill(255, 255, 255, 200);

        // Criar nuvem com múltiplas esferas
        for (let i = 0; i < 5; i++) {
            let offsetX = sin(i * PI/2.5) * this.size * 0.5;
            let offsetY = cos(i * PI/3) * this.size * 0.2;
            push();
            translate(offsetX, offsetY, 0);
            sphere(this.size * 0.6);
            pop();
        }
        pop();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSE PLANTGROUP PARA WEBGL
// ═══════════════════════════════════════════════════════════════════════════════

class PlantGroup {
    constructor(name, fileName, yPosRatio, zPos, baseHue, fftBand, scaleMultiplier) {
        this.name = name;
        this.fileName = fileName;
        this.yPosRatio = yPosRatio;
        this.zPos = zPos;
        this.baseHue = baseHue;
        this.fftBand = fftBand;
        this.scaleMultiplier = scaleMultiplier || 1.0; // NEW: Scale control
        this.sprites = [];
        this.instances = [];

        // Parâmetros de áudio - iniciados com valores para teste
        this.amplitude = 0;
        this.centroid = 0.5;
        this.flux = 0;
        this.flatness = 0.5;

        // Novos parâmetros para movimentos específicos
        this.vocalPitch = 0;
        this.beatIntensity = 0;
        this.timeSinceBeat = 0;
        this.lastUpdateTime = 0;

        // Estados de animação
        this.time = 0;
        this.testTime = 0; // Para animação de teste
    }

    createInstance(x, index, total) {
        if (this.sprites.length === 0) return;

        let sprite = random(this.sprites);

        // Z-depth variation
        let z = this.zPos + random(-50, 50);

        // Posição Y baseada no grupo - Plantas posicionadas no chão
        let groundY = 100;  // Ground level
        let y;

        if (this.name === 'trees') {
            y = groundY - 200; // Trees: tall, base touches ground (y=-100)
        } else if (this.name === 'flowers') {
            y = groundY - 80;  // Flowers: medium height (y=20)
        } else if (this.name === 'bushes') {
            y = groundY - 60;  // Bushes: short-medium (y=40)
        } else if (this.name === 'roots') {
            y = groundY;       // Roots: at ground level (y=100)
        } else {
            y = groundY + (this.yPosRatio - 0.5) * 200;
        }

        this.instances.push({
            x: x,
            y: y,
            z: z,
            sprite: sprite,
            phaseOffset: random(TWO_PI),
            sizeModifier: random(0.8, 1.2) * this.scaleMultiplier, // APPLY SCALE
            swaySpeed: random(0.8, 1.2),
            planeWidth: sprite.width,
            planeHeight: sprite.height
        });
    }

    update() {
        this.time += 0.05; // Muito mais rápido
        this.testTime += 0.03;

        // FORCE HIGH AMPLITUDE - Always keep plants visible
        this.amplitude = 0.9;
        this.flux = 0.8;
        this.centroid = 0.7;
        this.flatness = 0.5;

        // Safety check: ensure no NaN values
        if (isNaN(this.amplitude)) this.amplitude = 0.9;
        if (isNaN(this.flux)) this.flux = 0.8;
        if (isNaN(this.centroid)) this.centroid = 0.7;
        if (isNaN(this.flatness)) this.flatness = 0.5;
    }

    display() {
        if (!ambientShader) return;

        for (let inst of this.instances) {
            push();
            translate(inst.x, inst.y, inst.z);

            // Movimento manual além do shader para garantir visualização
            let manualSway = sin(this.time + inst.phaseOffset) * 10 * this.amplitude;
            translate(manualSway, 0, 0);

            // Rotação sutil
            rotateZ(sin(this.time * inst.swaySpeed) * 0.05 * this.flux);

            shader(ambientShader);

            // Valores forçados para debug - garantir que algo chegue ao shader
            ambientShader.setUniform('u_texture', inst.sprite.img);
            ambientShader.setUniform('u_time', this.time);

            // Safety: Never pass NaN or invalid values to shader
            let safeAmplitude = isNaN(this.amplitude) ? 0.9 : max(0.1, this.amplitude);
            let safeFlux = isNaN(this.flux) ? 0.8 : max(0.1, this.flux);
            let safeFlatness = isNaN(this.flatness) ? 0.5 : this.flatness;
            let safeCentroid = isNaN(this.centroid) ? 0.7 : this.centroid;

            ambientShader.setUniform('u_amplitude', safeAmplitude);
            ambientShader.setUniform('u_flux', safeFlux);
            ambientShader.setUniform('u_flatness', safeFlatness);
            ambientShader.setUniform('u_centroid', safeCentroid);
            ambientShader.setUniform('u_baseHue', this.baseHue / 360.0);
            ambientShader.setUniform('u_danceIntensity', danceIntensity);

            // Novos uniforms para movimentos específicos por planta
            ambientShader.setUniform('u_vocalPitch', this.vocalPitch || 0);
            ambientShader.setUniform('u_beatIntensity', this.beatIntensity || 0);
            ambientShader.setUniform('u_timeSinceBeat', this.timeSinceBeat || 0);

            // Identificador do tipo de planta
            let plantTypeIndex = ['trees', 'flowers', 'bushes', 'roots'].indexOf(this.name);
            ambientShader.setUniform('u_plantType', plantTypeIndex);

            texture(inst.sprite.img);

            // IMPORTANTE: Mais subdivisões para permitir deformação do shader
            plane(
                inst.planeWidth * inst.sizeModifier,
                inst.planeHeight * inst.sizeModifier,
                24, // Muito mais subdivisões horizontais
                24  // Muito mais subdivisões verticais
            );

            resetShader();
            pop();
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE SEGMENTAÇÃO DE SPRITES (NÃO ALTERAR)
// ═══════════════════════════════════════════════════════════════════════════════
const pixelClassify = (() => {
	let rgbaWord = new Uint32Array(1);
	let rgba = new Uint8Array(rgbaWord.buffer);
	const T = 0x12
	return (pixel) => {
		rgbaWord[0] = pixel;
		return rgba[0] > T || rgba[1] > T || rgba[2] > T ? 1 : 0
	}
})();

const blackWhite = (threshold = 128) => {
	let rgbaWord = new Uint32Array(1);
	let rgba = new Uint8Array(rgbaWord.buffer);
	return (pixel) => {
		rgbaWord[0] = pixel;
		return rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722 >= threshold ? 1 : 0
	}
};

const opaque = (() => {
	let rgbaWord = new Uint32Array(1);
	let rgba = new Uint8Array(rgbaWord.buffer);
	return (pixel) => {
		rgbaWord[0] = pixel;
		return rgba[3] ? 0 : 1
	}
})();

function imageComponents(pixels, w, h, pixelClassify = blackWhite()) {
	let data = new Uint32Array(pixels.buffer);

	function getRuns(y) {
		let lastClass = -1;
		let run;
		let runs = [];
		for (let x = 0; x < w; x++) {
			const pixel = data[(w * y + x)];
			const pixelClass = pixelClassify(pixel);
			if (pixelClass !== lastClass) {
				run = {
					pixelClass,
					x,
					y,
					len: 1
				};
				runs.push(run)
				lastClass = pixelClass;
			} else {
				run.len++;
			}
		}
		return runs
	}

	let components = []
	const addComponent = (run) => {
		components.push({
			run,
			parent: -1
		});
		return components.length - 1
	}

	const findCompressNonRecursive = (i) => {
		const path = [];
		while (components[i].parent >= 0) {
			path.push(i);
			i = components[i].parent;
		}
		for (let j of path) components[j].parent = i;
		return i;
	}

	const findCompressRecursive = (i) => {
		if (components[i].parent >= 0) {
			const result = findCompressRecursive(components[i].parent);
			components[i].parent = result;
			return result;
		}
		return i;
	}

	const findSimple = (i) => {
		while (components[i].parent >= 0) {
			i = components[i].parent;
		}
		return i;
	}

	const find = findCompressRecursive;

	const union = (s, t) => {
		if (components[s].parent >= 0 || components[t].parent >= 0) throw "Not sets";
		if (components[s].parent < components[t].parent)[s, t] = [t, s];
		let srank = components[s].parent;
		components[s].parent = t;
		components[t].parent = min(components[t].parent, srank - 1);
		return t
	}

	let scanlineStart = 0,
		scanlineEnd = 0;

	for (let y = 0; y < h; y++) {
		let runs = getRuns(y);
		for (let run of runs) addComponent(run);
		let i = scanlineStart,
			j = scanlineEnd,
			k = components.length;
		while (i < scanlineEnd && j < k) {
			let irun = components[i].run;
			let jrun = components[j].run;
			const overlap = !(irun.x + irun.len <= jrun.x || jrun.x + jrun.len <= irun.x);
			if (overlap && irun.pixelClass === jrun.pixelClass) {
				let icomp = find(i);
				let jcomp = find(j);
				if (jcomp != icomp) {
					let u = union(icomp, jcomp);
				}
			}
			if (irun.x + irun.len >= jrun.x + jrun.len) j++;
			else i++;
		}
		scanlineStart = scanlineEnd;
		scanlineEnd = k;
	}

	let compMap = new Map();
	for (let i = 0; i < components.length; i++) {
		let j = find(i);
		if (compMap.has(j)) compMap.get(j).push(components[i].run);
		else compMap.set(j, [components[i].run])
	}

	return [...compMap.values()];
}

function componentBoundingBox(runs) {
	let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
	let area = 0;
	for (let run of runs) {
		xmin = min(xmin, run.x)
		xmax = max(xmax, run.x + run.len)
		ymin = min(ymin, run.y)
		ymax = max(ymax, run.y + 1);
		area += run.len;
	}
	return {x:xmin,y:ymin, width: xmax-xmin,height: ymax-ymin, area}
}

function paintComponent(pixels, w, h, component, kolor) {
	let data = new Uint32Array(pixels.buffer);
	for (let {x, y, len} of component) {
		let i = y * w + x;
		while (len-- > 0) {
			data[i++] = kolor
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE ÁUDIO
// ═══════════════════════════════════════════════════════════════════════════════

function calculateSpectralFlux(spectrum) {
    if (!previousSpectrum) {
        previousSpectrum = Array.from(spectrum);
        return 0;
    }

    let flux = 0;
    for (let i = 0; i < spectrum.length; i++) {
        let diff = spectrum[i] - previousSpectrum[i];
        if (diff > 0) flux += diff;
    }

    previousSpectrum = Array.from(spectrum);
    return constrain(flux / 2000, 0, 1); // Muito mais sensível
}

function calculateSpectralFlatness(spectrum) {
    let sumLog = 0;
    let sumLinear = 0;
    let count = 0;

    for (let i = 0; i < spectrum.length; i++) {
        if (spectrum[i] > 1) {
            let val = spectrum[i];
            sumLog += log(val);
            sumLinear += val;
            count++;
        }
    }

    if (count === 0 || sumLinear === 0) return 0.5;

    let geometricMean = exp(sumLog / count);
    let arithmeticMean = sumLinear / count;

    return constrain(geometricMean / arithmeticMean, 0, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEYDA INITIALIZATION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function initializeMeyda(p5AudioSource) {
    if (typeof Meyda === 'undefined') return;

    // Stop existing analyzer if any
    if (meydaAnalyzer) {
        try {
            meydaAnalyzer.stop();
        } catch (e) {
            // Ignore errors when stopping
        }
    }

    // Get Web Audio API source node from p5.sound object
    let sourceNode = null;

    if (p5AudioSource && p5AudioSource.disconnect) {
        // p5.sound objects have an internal Web Audio API node
        // We need to create a ScriptProcessorNode to connect to Meyda
        const audioContext = getAudioContext();

        try {
            // Create Meyda analyzer with the Web Audio context
            meydaAnalyzer = Meyda.createMeydaAnalyzer({
                audioContext: audioContext,
                source: p5AudioSource,
                bufferSize: 1024,
                featureExtractors: [
                    'rms',
                    'energy',
                    'zcr',
                    'spectralCentroid',
                    'spectralFlatness',
                    // 'spectralFlux', // Using our own implementation instead
                    'spectralRolloff',
                    'spectralSpread',
                    'spectralKurtosis',
                    'mfcc'
                ],
                callback: (features) => {
                    meydaFeatures = features;
                }
            });

            meydaAnalyzer.start();
            console.log('✓ Meyda analyzer started successfully');
        } catch (error) {
            console.warn('⚠ Could not initialize Meyda:', error.message);
            console.log('→ Continuing with basic analysis');
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESSENTIA.JS ML MODEL LOADING
// ═══════════════════════════════════════════════════════════════════════════════

async function loadEssentiaModel() {
    if (typeof Essentia === 'undefined' || typeof tf === 'undefined') {
        console.warn('⚠ Essentia.js or TensorFlow.js not loaded, ML refinement disabled');
        return;
    }

    try {
        // Note: Essentia.js instrument detection models may require different loading approach
        // This is a placeholder - actual model URL and loading needs to be verified
        console.log('→ Attempting to load Essentia.js ML model...');

        // For now, we'll gracefully continue without the model
        // The hybrid approach will work with Meyda-only analysis
        console.log('→ Continuing with Meyda-only analysis (ML refinement optional)');

    } catch (error) {
        console.error('✗ Failed to load Essentia.js model:', error);
        console.log('→ Continuing with Meyda-only analysis');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PER-BAND TIMBRE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracts timbre features from a specific frequency band
 */
function extractBandTimbre(spectrum, startBin, endBin) {
    const bandSpectrum = spectrum.slice(startBin, endBin);
    const bandLength = bandSpectrum.length;

    // Energy calculation
    let bandEnergy = 0;
    for (let i = 0; i < bandLength; i++) {
        bandEnergy += bandSpectrum[i] * bandSpectrum[i];
    }
    bandEnergy = Math.sqrt(bandEnergy / bandLength);

    // Band centroid (brightness within this frequency range)
    let weightedSum = 0;
    let totalMagnitude = 0;
    for (let i = 0; i < bandLength; i++) {
        const magnitude = bandSpectrum[i];
        weightedSum += magnitude * (startBin + i);
        totalMagnitude += magnitude;
    }
    const bandCentroid = totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;

    // Band flatness (tonality vs noise)
    let geometricMean = 0;
    let arithmeticMean = 0;
    let validCount = 0;

    for (let i = 0; i < bandLength; i++) {
        const magnitude = bandSpectrum[i];
        if (magnitude > 1) {
            geometricMean += Math.log(magnitude);
            arithmeticMean += magnitude;
            validCount++;
        }
    }

    let bandFlatness = 0.5; // Default
    if (validCount > 0 && arithmeticMean > 0) {
        geometricMean = Math.exp(geometricMean / validCount);
        arithmeticMean = arithmeticMean / validCount;
        bandFlatness = geometricMean / arithmeticMean;
    }

    return {
        energy: constrain(bandEnergy / 100, 0, 1),
        centroid: bandCentroid,
        flatness: constrain(bandFlatness, 0, 1)
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEURISTIC INSTRUMENT CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Classifies instrument intensity using heuristic rules based on timbre features
 */
function classifyInstrumentHeuristic(bandFeatures, globalFeatures, instrumentType) {
    const weights = instrumentWeights[instrumentType];
    if (!weights) return 0;

    let score = 0;

    // Spectral Centroid Analysis
    if (weights.centroid && globalFeatures.spectralCentroid) {
        const centroidNorm = constrain(globalFeatures.spectralCentroid / 4000, 0, 1);

        switch (instrumentType) {
            case 'strings':
                // Strings prefer medium-high centroid (0.45-0.65 range)
                score += weights.centroid * (1 - Math.abs(centroidNorm - 0.55) / 0.55);
                break;
            case 'winds':
                // Winds have variable brightness, reward higher centroid
                score += weights.centroid * centroidNorm;
                break;
            case 'vocals':
                // Vocals typically medium centroid (0.35-0.55 range)
                score += weights.centroid * (1 - Math.abs(centroidNorm - 0.45) / 0.45);
                break;
            case 'bass':
                // Bass instruments have low centroid
                score += weights.centroid * (1 - centroidNorm);
                break;
        }
    }

    // Spectral Rolloff Analysis
    if (weights.rolloff && globalFeatures.spectralRolloff) {
        const rolloffNorm = constrain(globalFeatures.spectralRolloff / 8000, 0, 1);

        if (instrumentType === 'strings') {
            score += weights.rolloff * (1 - Math.abs(rolloffNorm - 0.6) / 0.6);
        } else if (instrumentType === 'winds') {
            score += weights.rolloff * rolloffNorm;
        } else if (instrumentType === 'bass') {
            score += weights.rolloff * (1 - rolloffNorm);
        }
    }

    // Spectral Flatness (Tonality)
    if (weights.flatness) {
        const flatness = bandFeatures.flatness;
        // Most instruments are tonal (low flatness)
        if (instrumentType !== 'percussion') {
            score += weights.flatness * (1 - flatness);
        }
    }

    // Energy (especially important for bass)
    if (weights.energy) {
        score += weights.energy * bandFeatures.energy;
    }

    // Spectral Kurtosis (peakiness)
    if (weights.kurtosis && globalFeatures.spectralKurtosis) {
        const kurtosis = constrain(globalFeatures.spectralKurtosis / 10, 0, 1);
        if (instrumentType === 'winds') {
            score += weights.kurtosis * kurtosis;
        }
    }

    // Spectral Flux (temporal variation)
    if (weights.flux && globalFeatures.spectralFlux) {
        const flux = constrain(globalFeatures.spectralFlux / 100, 0, 1);
        if (instrumentType === 'winds' || instrumentType === 'vocals') {
            score += weights.flux * flux;
        }
    }

    // Zero Crossing Rate
    if (weights.zcr && globalFeatures.zcr) {
        const zcrNorm = constrain(globalFeatures.zcr / 200, 0, 1);
        if (instrumentType === 'winds') {
            score += weights.zcr * zcrNorm;
        } else if (instrumentType === 'bass') {
            score += weights.zcr * (1 - zcrNorm);
        }
    }

    // MFCC Analysis (timbre signature)
    if (weights.mfcc && globalFeatures.mfcc) {
        // Use MFCC variance as timbre distinctiveness
        let mfccVariance = 0;
        for (let coeff of globalFeatures.mfcc) {
            mfccVariance += Math.abs(coeff);
        }
        mfccVariance /= globalFeatures.mfcc.length;
        const mfccNorm = constrain(mfccVariance / 50, 0, 1);
        score += weights.mfcc * mfccNorm;
    }

    return constrain(score, 0, 1);
}

/**
 * Classifies percussion intensity using beat detection and spectral features
 */
function classifyPercussion(bandFeatures, globalFeatures, beatDetected) {
    const weights = instrumentWeights.percussion;
    let score = 0;

    // Spectral Flux (temporal variation) - KEY for percussion
    if (weights.flux && globalFeatures.spectralFlux) {
        const flux = constrain(globalFeatures.spectralFlux / 100, 0, 1);
        score += weights.flux * flux;
    }

    // Spectral Flatness (noise vs tone) - Percussion is noisy
    if (weights.flatness) {
        const flatness = bandFeatures.flatness;
        score += weights.flatness * flatness; // High flatness = more noise = more percussion
    }

    // Zero Crossing Rate - Percussion has high ZCR
    if (weights.zcr && globalFeatures.zcr) {
        const zcrNorm = constrain(globalFeatures.zcr / 200, 0, 1);
        score += weights.zcr * zcrNorm;
    }

    // Kurtosis (peakiness)
    if (weights.kurtosis && globalFeatures.spectralKurtosis) {
        const kurtosis = constrain(globalFeatures.spectralKurtosis / 10, 0, 1);
        score += weights.kurtosis * kurtosis;
    }

    // Beat detection boost - If beat detected, significantly boost percussion score
    if (beatDetected) {
        score = min(1.0, score * 1.5 + 0.3);
    }

    return constrain(score, 0, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESSENTIA.JS ML REFINEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Runs ML-based instrument detection using Essentia.js (periodic refinement)
 * Called at reduced rate (1-2x per second) to refine heuristic classification
 */
async function runEssentiaRefinement() {
    if (!essentiaModel || !spectrum) return;

    const currentTime = millis();
    if (currentTime - lastInferenceTime < essentiaInferenceInterval) {
        return; // Too soon, skip inference
    }

    try {
        // Placeholder for ML inference
        // When Essentia model is loaded, this will run actual predictions
        lastInferenceTime = currentTime;

    } catch (error) {
        console.error('Essentia inference error:', error);
    }
}

function analyzeAudio() {
    if (!fft || !amplitude) return;

    // TEMPORARY: Skip audio analysis to debug visibility issues
    return;

    // Get FFT spectrum
    spectrum = fft.analyze();
    volume = amplitude.getLevel();

    // Beat detection
    peakDetect.update(fft);
    beatDetected = peakDetect.isDetected;

    // Get global features from Meyda (or fallback)
    const globalFeatures = meydaFeatures || {
        spectralCentroid: fft.getCentroid(),
        spectralFlux: calculateSpectralFlux(spectrum),
        spectralFlatness: calculateSpectralFlatness(spectrum),
        spectralRolloff: null,
        spectralKurtosis: null,
        zcr: null,
        mfcc: null
    };

    // Extract per-band timbre features
    const bassTimbre = extractBandTimbre(spectrum, bandRanges.bass.start, bandRanges.bass.end);
    const lowMidTimbre = extractBandTimbre(spectrum, bandRanges.lowMid.start, bandRanges.lowMid.end);
    const highMidTimbre = extractBandTimbre(spectrum, bandRanges.highMid.start, bandRanges.highMid.end);
    const trebleTimbre = extractBandTimbre(spectrum, bandRanges.treble.start, bandRanges.treble.end);

    // LAYER 1: Heuristic classification (real-time, every frame)
    let heuristicScores = {
        strings: classifyInstrumentHeuristic(bassTimbre, globalFeatures, 'strings'),
        vocals: classifyInstrumentHeuristic(lowMidTimbre, globalFeatures, 'vocals'),
        percussion: classifyPercussion(lowMidTimbre, globalFeatures, beatDetected),
        winds: classifyInstrumentHeuristic(trebleTimbre, globalFeatures, 'winds')
    };

    // FALLBACK: If all scores are very low, use band energy as fallback
    const totalScore = heuristicScores.strings + heuristicScores.winds +
                       heuristicScores.vocals + heuristicScores.percussion;
    if (totalScore < 0.5) {
        // Blend with raw band energy to maintain visibility
        heuristicScores.strings = Math.max(heuristicScores.strings, bassTimbre.energy * 0.7);
        heuristicScores.vocals = Math.max(heuristicScores.vocals, lowMidTimbre.energy * 0.7);
        heuristicScores.percussion = Math.max(heuristicScores.percussion, lowMidTimbre.energy * 0.7);
        heuristicScores.winds = Math.max(heuristicScores.winds, trebleTimbre.energy * 0.7);
    }

    // LAYER 2: ML refinement (periodic, non-blocking)
    runEssentiaRefinement(); // Async, only runs if interval elapsed

    // HYBRID BLENDING: Only blend with ML if model is loaded, otherwise use heuristic only
    let finalScores;
    if (essentiaModel) {
        // Blend heuristic (70%) + ML (30%) when ML is available
        const blendWeight = { heuristic: 0.7, ml: 0.3 };
        finalScores = {
            strings: heuristicScores.strings * blendWeight.heuristic +
                     mlInstrumentScores.strings * blendWeight.ml,
            vocals: heuristicScores.vocals * blendWeight.heuristic +
                    mlInstrumentScores.vocals * blendWeight.ml,
            percussion: heuristicScores.percussion * blendWeight.heuristic,
            winds: heuristicScores.winds * blendWeight.heuristic +
                   mlInstrumentScores.winds * blendWeight.ml
        };
    } else {
        // Use heuristic scores only when ML is not available
        // Map scores to range [0.7, 1.0] so plants are ALWAYS visible
        const minVisible = 0.7; // Plants always at least 70% active
        finalScores = {
            strings: minVisible + (heuristicScores.strings * (1 - minVisible)),
            vocals: minVisible + (heuristicScores.vocals * (1 - minVisible)),
            percussion: minVisible + (heuristicScores.percussion * (1 - minVisible)),
            winds: minVisible + (heuristicScores.winds * (1 - minVisible))
        };
    }

    // SAFETY GUARD: Ensure finalScores are ALWAYS >= 0.7, even if everything fails
    finalScores.strings = Math.max(0.7, finalScores.strings);
    finalScores.vocals = Math.max(0.7, finalScores.vocals);
    finalScores.percussion = Math.max(0.7, finalScores.percussion);
    finalScores.winds = Math.max(0.7, finalScores.winds);

    // Update plant groups with NEW INSTRUMENT MAPPING
    // NOTE: plantGroups array order: [0]=trees, [1]=flowers, [2]=bushes, [3]=roots

    // Trees → Strings/Bass (contrabaixo, cordas graves)
    plantGroups[0].amplitude = max(0.7, lerp(
        plantGroups[0].amplitude,
        constrain(finalScores.strings * sensitivity, 0.7, 1.0),
        smoothing * 1.5
    ));
    plantGroups[0].centroid = lerp(
        plantGroups[0].centroid,
        constrain(globalFeatures.spectralCentroid / 8000, 0, 1),
        smoothing
    );
    plantGroups[0].flux = lerp(
        plantGroups[0].flux,
        constrain(globalFeatures.spectralFlux / 100, 0, 1),
        smoothing * 2
    );
    plantGroups[0].flatness = lerp(
        plantGroups[0].flatness,
        bassTimbre.flatness,
        smoothing
    );

    // Flowers → Vocals/Synthesizers (vozes)
    plantGroups[1].amplitude = max(0.7, lerp(
        plantGroups[1].amplitude,
        constrain(finalScores.vocals * sensitivity, 0.7, 1.0),
        smoothing * 1.5
    ));
    plantGroups[1].centroid = lerp(
        plantGroups[1].centroid,
        constrain(globalFeatures.spectralCentroid / 8000, 0, 1),
        smoothing
    );
    plantGroups[1].flux = lerp(
        plantGroups[1].flux,
        constrain(globalFeatures.spectralFlux / 100, 0, 1),
        smoothing * 2
    );
    plantGroups[1].flatness = lerp(
        plantGroups[1].flatness,
        lowMidTimbre.flatness,
        smoothing
    );
    // Vocal pitch tracking for flowers (height variation)
    if (globalFeatures.spectralCentroid) {
        plantGroups[1].vocalPitch = constrain(globalFeatures.spectralCentroid / 4000, 0, 1);
    }

    // Bushes → Percussion (bateria, percussão)
    plantGroups[2].amplitude = max(0.7, lerp(
        plantGroups[2].amplitude,
        constrain(finalScores.percussion * sensitivity, 0.7, 1.0),
        smoothing * 1.5
    ));
    plantGroups[2].centroid = lerp(
        plantGroups[2].centroid,
        constrain(globalFeatures.spectralCentroid / 8000, 0, 1),
        smoothing
    );
    plantGroups[2].flux = lerp(
        plantGroups[2].flux,
        constrain(globalFeatures.spectralFlux / 100, 0, 1),
        smoothing * 2
    );
    plantGroups[2].flatness = lerp(
        plantGroups[2].flatness,
        lowMidTimbre.flatness,
        smoothing
    );
    // Beat tracking for bushes (pulse effect)
    if (beatDetected) {
        plantGroups[2].beatIntensity = 1.0;
        plantGroups[2].timeSinceBeat = 0;
        plantGroups[2].lastUpdateTime = millis();
    } else {
        plantGroups[2].timeSinceBeat = millis() - plantGroups[2].lastUpdateTime;
        plantGroups[2].beatIntensity = max(0, 1.0 - plantGroups[2].timeSinceBeat / 500);
    }

    // Roots → Winds/Highs (flauta, agudos)
    plantGroups[3].amplitude = max(0.7, lerp(
        plantGroups[3].amplitude,
        constrain(finalScores.winds * sensitivity, 0.7, 1.0),
        smoothing * 1.5
    ));
    plantGroups[3].centroid = lerp(
        plantGroups[3].centroid,
        constrain(globalFeatures.spectralCentroid / 8000, 0, 1),
        smoothing
    );
    plantGroups[3].flux = lerp(
        plantGroups[3].flux,
        constrain(globalFeatures.spectralFlux / 100, 0, 1),
        smoothing * 2
    );
    plantGroups[3].flatness = lerp(
        plantGroups[3].flatness,
        trebleTimbre.flatness,
        smoothing
    );

    // Beat boost removed to prevent oscillation
    // Beat effects are now handled by individual plant shader parameters
    // (bushes use beatIntensity for pulse effects)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRAÇÃO DE SPRITES
// ═══════════════════════════════════════════════════════════════════════════════

function extractSpritesFromImage(img) {
    pixelDensity(1);
    img.loadPixels();

    let components = imageComponents(img.pixels, img.width, img.height, pixelClassify);
    let sprites = [];

    for (let comp of components) {
        const bbox = componentBoundingBox(comp);
        const { x, y, width:w, height:h } = bbox;

        if (w < img.width / 4 && w > 5) {
            sprites.push({
                x, y, width: w, height: h,
                area: w * h,
                comp
            });
        } else {
            paintComponent(img.pixels, img.width, img.height, comp, 0);
        }
    }

    img.updatePixels();

    for (let sprite of sprites) {
        const { x, y, width, height } = sprite;
        sprite.img = img.get(x, y, width, height);
    }

    sprites.sort((a,b) => a.area - b.area);
    return sprites;
}

// ═══════════════════════════════════════════════════════════════════════════════
// P5.JS SETUP E DRAW
// ═══════════════════════════════════════════════════════════════════════════════

function preload() {
    trees = loadImage('trees.png');
    bushes = loadImage('bushes.png');
    flowers = loadImage('flowers.png');
    roots = loadImage('roots.png');
}

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);

    // Criar shader
    try {
        ambientShader = createShader(
            window.vertexShaderSource,
            window.fragmentShaderSource
        );
        console.log('Shader criado com sucesso!');
    } catch(e) {
        console.error('Erro ao criar shader:', e);
    }

    // Criar ground shader
    try {
        groundShader = createShader(
            window.groundVertexShader,
            window.groundFragmentShader
        );
        console.log('Ground shader criado com sucesso!');
    } catch(e) {
        console.error('Erro ao criar ground shader:', e);
    }

    textureMode(NORMAL);

    // Inicializar áudio
    fft = new p5.FFT(0.9, 1024);
    amplitude = new p5.Amplitude();
    peakDetect = new p5.PeakDetect(20, 200, 0.35);

    // Meyda will be initialized when audio source is connected
    if (typeof Meyda !== 'undefined') {
        console.log('✓ Meyda library loaded, ready for initialization');
    } else {
        console.warn('⚠ Meyda not loaded, using fallback analysis');
    }

    // Carregar modelo Essentia.js para refinamento ML
    loadEssentiaModel();

    // Extrair sprites
    const treeSprites   = extractSpritesFromImage(trees);
    const bushSprites   = extractSpritesFromImage(bushes);
    const flowerSprites = extractSpritesFromImage(flowers);
    const rootSprites   = extractSpritesFromImage(roots);

    console.log('Sprites extraídos:', {
        trees: treeSprites.length,
        bushes: bushSprites.length,
        flowers: flowerSprites.length,
        roots: rootSprites.length
    });

    // NOVA ORDEM: Trees → Flowers → Bushes → Roots
    plantGroups.push(new PlantGroup('trees',   'trees.png',   0.30, -400, 120, 'bass', 1.8));
    plantGroups.push(new PlantGroup('flowers', 'flowers.png', 0.20, -200, 320, 'highMid', 1.4));
    plantGroups.push(new PlantGroup('bushes',  'bushes.png',  0.25, 0,    220, 'lowMid', 1.0));
    plantGroups.push(new PlantGroup('roots',   'roots.png',   0.15, 200,  30,  'treble', 1.1));

    plantGroups[0].sprites = treeSprites;
    plantGroups[1].sprites = flowerSprites;  // CHANGED
    plantGroups[2].sprites = bushSprites;    // CHANGED
    plantGroups[3].sprites = rootSprites;

    // Criar instâncias com mais espaçamento
    for (let group of plantGroups) {
        let numPlants = floor(random(8, 12)); // Menos plantas para melhor visibilidade

        for (let i = 0; i < numPlants; i++) {
            let x = map(i, 0, numPlants - 1, -width/3, width/3);
            x += random(-20, 20);
            group.createInstance(x, i, numPlants);
        }
    }

    // Criar nuvens
    for (let i = 0; i < 6; i++) {
        clouds.push(new Cloud(
            random(-width/2, width/2),
            random(-300, -200),
            random(-500, -300),
            random(30, 60)
        ));
    }

    isSetupComplete = true;
    document.getElementById('status').textContent = '✅ WebGL Pronto! As plantas já devem estar dançando!';
}

function draw() {
    noStroke();

    // Céu azul
    background(135, 206, 250);

    // Iluminação
    ambientLight(200);
    directionalLight(255, 255, 255, 0, 0.5, -1);

    // Câmera levemente acima, olhando para baixo no chão
    let camX = 0;
    let camY = -200;  // Above ground level (ground is at y=100)
    let camZ = 800;   // Closer for better view
    camera(camX, camY, camZ, 0, 50, 0, 0, 1, 0); // Looking at y=50 (slightly above ground)

    // Atualizar nuvens
    cloudTime += 0.01;
    for (let cloud of clouds) {
        cloud.update();
        cloud.display();
    }

    // Análise de áudio
    if (audioMode !== 'none') {
        // Only analyze if sound is actually playing
        if (audioMode === 'mic' || audioMode === 'test' || (sound && sound.isPlaying())) {
            analyzeAudio();
        }
    }

    // Desenhar chão com shader de gradiente (verde → marrom)
    if (groundShader) {
        push();
        translate(0, 100, 0);
        rotateX(HALF_PI);
        shader(groundShader);
        plane(width * 2, 800);
        resetShader();
        pop();
    }

    // Atualizar e desenhar plantas
    for (let group of plantGroups) {
        group.update();
        group.display();
    }

    // Debug
    if (keyIsDown(68)) {
        drawDebugInfo();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLES DE ÁUDIO
// ═══════════════════════════════════════════════════════════════════════════════

function useMicrophone() {
    if (!isSetupComplete) return;

    if (mic) {
        mic.stop();
        mic = null;
        audioMode = 'none';
        if (meydaAnalyzer) meydaAnalyzer.stop();
        document.getElementById('status').textContent = '🔇 Microfone desativado';
        return;
    }

    mic = new p5.AudioIn();
    mic.start(() => {
        audioMode = 'mic';
        fft.setInput(mic);
        amplitude.setInput(mic);

        // Initialize Meyda with microphone
        initializeMeyda(mic);

        document.getElementById('status').textContent = '🎤 Microfone ativo';
    });
}

function playTestSound() {
    if (!isSetupComplete) return;

    if (testOsc) {
        testOsc.stop();
        testOsc = null;
        audioMode = 'none';
        if (meydaAnalyzer) meydaAnalyzer.stop();
        document.getElementById('status').textContent = '🔇 Som de teste parado';
        return;
    }

    testOsc = new p5.Oscillator('sine');
    testOsc.start();

    audioMode = 'test';
    fft.setInput(testOsc);
    amplitude.setInput(testOsc);

    // Initialize Meyda with test oscillator
    initializeMeyda(testOsc);

    document.getElementById('status').textContent = '🎹 Tocando som de teste';

    playTestSequence();
}

function playTestSequence() {
    if (!testOsc) return;

    let notes = [130, 165, 196, 262, 330, 392, 523, 659];
    let volumes = [0.8, 0.4, 0.6, 0.9, 0.3, 0.7, 0.5, 0.4];
    let i = 0;

    function playNext() {
        if (!testOsc || audioMode !== 'test') return;

        testOsc.freq(notes[i % notes.length]);
        testOsc.amp(volumes[i % volumes.length], 0.02);

        setTimeout(() => {
            if (testOsc) testOsc.amp(0.1, 0.05);
        }, 100);

        i++;
        setTimeout(playNext, 200);
    }

    playNext();
}

function togglePlay() {
    if (!sound) return;

    if (isPlaying) {
        sound.pause();
        document.getElementById('playBtn').textContent = '▶️ Play';
    } else {
        sound.loop();
        document.getElementById('playBtn').textContent = '⏸️ Pause';
    }

    isPlaying = !isPlaying;
}

// Controles
window.updateSensitivity = function(value) {
    sensitivity = parseFloat(value);
    document.getElementById('sensVal').textContent = value;
}

window.updateDanceIntensity = function(value) {
    danceIntensity = parseFloat(value);
    document.getElementById('danceVal').textContent = value;
}

window.updateDepthScale = function(value) {
    depthScale = parseFloat(value);
    document.getElementById('depthVal').textContent = value;
}

// Upload de arquivo
document.getElementById('audioFile').addEventListener('change', (e) => {
    let file = e.target.files[0];
    if (file && isSetupComplete) {
        let url = URL.createObjectURL(file);

        if (sound) sound.stop();

        sound = loadSound(url, () => {
            audioMode = 'file';
            fft.setInput(sound);
            amplitude.setInput(sound);

            // Initialize Meyda with loaded sound
            initializeMeyda(sound);

            document.getElementById('status').textContent = '✅ ' + file.name;
        });
    }
});

// Debug
function drawDebugInfo() {
    let debug = document.getElementById('debug');
    debug.classList.add('active');

    let info = `FPS: ${frameRate().toFixed(1)}\n`;
    info += `Volume: ${volume.toFixed(3)}\n`;
    info += `Beat: ${beatDetected ? '🔥' : '○'}\n`;
    info += `Mode: ${audioMode}\n`;
    info += `Meyda: ${meydaFeatures ? '✓' : '✗'}\n`;
    info += `Essentia: ${essentiaModel ? '✓' : '✗'}\n\n`;

    if (meydaFeatures) {
        info += `=== Timbre Features ===\n`;
        info += `Centroid: ${(meydaFeatures.spectralCentroid || 0).toFixed(0)} Hz\n`;
        info += `Rolloff: ${(meydaFeatures.spectralRolloff || 0).toFixed(0)} Hz\n`;
        info += `Flatness: ${(meydaFeatures.spectralFlatness || 0).toFixed(3)}\n`;
        info += `ZCR: ${(meydaFeatures.zcr || 0).toFixed(1)}\n\n`;
    }

    info += `=== Plant Groups (Instrument Mapping) ===\n`;
    const groupNames = ['Árvores (Cordas)', 'Arbustos (Vozes)', 'Flores (Sopros)', 'Raízes (Baixo)'];
    for (let i = 0; i < plantGroups.length; i++) {
        const group = plantGroups[i];
        info += `${groupNames[i]}:\n`;
        info += `  Amp: ${group.amplitude.toFixed(3)} | `;
        info += `Flux: ${group.flux.toFixed(3)}\n`;
    }

    document.getElementById('debugInfo').textContent = info;
}

function keyReleased() {
    if (key === 'd' || key === 'D') {
        document.getElementById('debug').classList.toggle('active');
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}