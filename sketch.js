// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO GLOBAL E VARIÁVEIS
// ═══════════════════════════════════════════════════════════════════════════════

let ambientShader;
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
    constructor(name, fileName, yPosRatio, zPos, baseHue, fftBand) {
        this.name = name;
        this.fileName = fileName;
        this.yPosRatio = yPosRatio;
        this.zPos = zPos;
        this.baseHue = baseHue;
        this.fftBand = fftBand;
        this.sprites = [];
        this.instances = [];

        // Parâmetros de áudio - iniciados com valores para teste
        this.amplitude = 0;
        this.centroid = 0.5;
        this.flux = 0;
        this.flatness = 0.5;

        // Estados de animação
        this.time = 0;
        this.testTime = 0; // Para animação de teste
    }

    createInstance(x, index, total) {
        if (this.sprites.length === 0) return;

        let sprite = random(this.sprites);

        // Posição Y baseada no grupo - escalonada
        let groundY = 100;
        let y;

        // Escalonar verticalmente os grupos
        if (this.name === 'trees') {
            y = groundY - 150; // Mais alto (fundo)
        } else if (this.name === 'bushes') {
            y = groundY - 50;
        } else if (this.name === 'flowers') {
            y = groundY + 50;
        } else if (this.name === 'roots') {
            y = groundY + 150; // Mais baixo (frente)
        }

        let z = this.zPos;

        this.instances.push({
            x: x,
            y: y,
            z: z,
            sprite: sprite,
            phaseOffset: random(TWO_PI),
            sizeModifier: random(0.8, 1.2),
            swaySpeed: random(0.8, 1.2),
            planeWidth: sprite.width,
            planeHeight: sprite.height
        });
    }

    update() {
        this.time += 0.05; // Muito mais rápido
        this.testTime += 0.03;

        // Animação de teste sempre ativa para garantir movimento
        if (audioMode === 'none') {
            // Simular valores de áudio para teste visual
            this.amplitude = (sin(this.testTime) + 1) * 0.3;
            this.flux = (sin(this.testTime * 1.5) + 1) * 0.3;
            this.centroid = (sin(this.testTime * 0.7) + 1) * 0.5;
            this.flatness = 0.5;
        }
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
            ambientShader.setUniform('u_amplitude', max(0.1, this.amplitude)); // Nunca zero
            ambientShader.setUniform('u_flux', max(0.1, this.flux));
            ambientShader.setUniform('u_flatness', this.flatness);
            ambientShader.setUniform('u_centroid', this.centroid);
            ambientShader.setUniform('u_baseHue', this.baseHue / 360.0);
            ambientShader.setUniform('u_danceIntensity', danceIntensity);

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

function analyzeAudio() {
    if (!fft || !amplitude) return;

    spectrum = fft.analyze();
    volume = amplitude.getLevel();

    peakDetect.update(fft);
    beatDetected = peakDetect.isDetected;

    let centroid = constrain(map(fft.getCentroid(), 0, 8000, 0, 1), 0, 1);
    let flux = calculateSpectralFlux(spectrum);
    let flatness = calculateSpectralFlatness(spectrum);

    for (let group of plantGroups) {
        let bandEnergy = fft.getEnergy(group.fftBand);
        bandEnergy = map(bandEnergy, 0, 255, 0, 1);
        bandEnergy = constrain(bandEnergy, 0, 1);

        // Valores mais agressivos
        group.amplitude = lerp(group.amplitude, bandEnergy * sensitivity, smoothing * 2);
        group.centroid = lerp(group.centroid, centroid, smoothing);
        group.flux = lerp(group.flux, flux * 3, smoothing * 2);
        group.flatness = lerp(group.flatness, flatness, smoothing);

        // Boost forte na batida
        if (beatDetected) {
            group.amplitude = min(1, group.amplitude * 3);
            group.flux = min(1, group.flux * 3);
        }
    }
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

    textureMode(NORMAL);

    // Inicializar áudio
    fft = new p5.FFT(0.9, 1024);
    amplitude = new p5.Amplitude();
    peakDetect = new p5.PeakDetect(20, 200, 0.35);

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

    // Criar grupos com espaçamento maior em Z
    plantGroups.push(new PlantGroup('trees',   'trees.png',   0.30, -300, 120, 'bass'));
    plantGroups.push(new PlantGroup('bushes',  'bushes.png',  0.25, -100, 220, 'lowMid'));
    plantGroups.push(new PlantGroup('flowers', 'flowers.png', 0.20,  100, 320, 'highMid'));
    plantGroups.push(new PlantGroup('roots',   'roots.png',   0.15,  300,  30, 'treble'));

    plantGroups[0].sprites = treeSprites;
    plantGroups[1].sprites = bushSprites;
    plantGroups[2].sprites = flowerSprites;
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

    // Câmera inclinada para melhor visão
    let camX = 0;
    let camY = -400; // Mais alta
    let camZ = 600;  // Mais próxima
    camera(camX, camY, camZ, 0, 50, 0, 0, 1, 0); // Olhando levemente para cima

    // Atualizar nuvens
    cloudTime += 0.01;
    for (let cloud of clouds) {
        cloud.update();
        cloud.display();
    }

    // Análise de áudio
    if (audioMode !== 'none') {
        analyzeAudio();
    }

    // Desenhar chão verde (acima das raízes)
    push();
    translate(0, 100, -50);
    rotateX(HALF_PI);
    fill(34, 139, 34);
    plane(width * 2, 400);
    pop();

    // Desenhar chão terroso (abaixo das raízes)
    push();
    translate(0, 250, 200);
    rotateX(HALF_PI);
    fill(101, 67, 33);
    plane(width * 2, 600);
    pop();

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
        document.getElementById('status').textContent = '🔇 Microfone desativado';
        return;
    }

    mic = new p5.AudioIn();
    mic.start(() => {
        audioMode = 'mic';
        fft.setInput(mic);
        amplitude.setInput(mic);
        document.getElementById('status').textContent = '🎤 Microfone ativo';
    });
}

function playTestSound() {
    if (!isSetupComplete) return;

    if (testOsc) {
        testOsc.stop();
        testOsc = null;
        audioMode = 'none';
        document.getElementById('status').textContent = '🔇 Som de teste parado';
        return;
    }

    testOsc = new p5.Oscillator('sine');
    testOsc.start();

    audioMode = 'test';
    fft.setInput(testOsc);
    amplitude.setInput(testOsc);
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
    info += `Mode: ${audioMode}\n\n`;

    for (let group of plantGroups) {
        info += `${group.name}:\n`;
        info += `  Amp: ${group.amplitude.toFixed(3)}\n`;
        info += `  Flux: ${group.flux.toFixed(3)}\n`;
        info += `  Time: ${group.time.toFixed(2)}\n\n`;
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