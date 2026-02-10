

# 🌿🎶 FICHA TÉCNICA — JARDIM DE VISUALIZAÇÃO MUSICAL
## Versão 2.0 — Otimizada para Implementação

---

## 1. 🎯 OBJETIVO DO PROJETO

Criar uma visualização musical interativa onde **4 grupos de plantas dançam de formas distintas**, cada um respondendo a um canal de áudio separado (stem).

**Princípio central:** Cada grupo de planta tem uma identidade de movimento única que representa sua função musical.

---

## 2. 🔧 ARQUITETURA DO SISTEMA
clau
### 2.1 Pipeline de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│  PRÉ-PROCESSAMENTO (Python — executado uma vez por música)      │
│                                                                 │
│  Entrada: musica_original.mp3                                   │
│                                                                 │
│  Processamento:                                                 │
│  ├── Spleeter ou Demucs → separa em 4 stems                    │
│  ├── librosa → detecta onsets (picos) de cada stem             │
│  └── Exporta:                                                   │
│      ├── graves.mp3                                            │
│      ├── harmonia.mp3                                          │
│      ├── percussao.mp3                                         │
│      ├── agudos.mp3                                            │
│      └── eventos.json (opcional: onsets pré-calculados)        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  RUNTIME (p5.js no browser)                                     │
│                                                                 │
│  1. Carrega os 4 arquivos de áudio                             │
│  2. Cria 4 analisadores FFT (um por stem)                      │
│  3. Inicia todos os áudios simultaneamente (sync)              │
│  4. A cada frame:                                               │
│     ├── Lê amplitude/energia de cada FFT                       │
│     ├── Detecta onsets em tempo real (ou usa JSON)             │
│     └── Atualiza plantas correspondentes
              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Mapeamento Stem → Planta

| Stem | Spleeter | Arquivo | Planta | Tipo de Dança |
|------|----------|---------|--------|---------------|
| Cordas/Melodia | other | `graves.mp3` | 🌳 Árvores | Balanço pendular lento |
| Harmonia/Voz | vocals | `harmonia.mp3` | 🌸 Flores | Respiração e pulso suave |
| Percussão | drums | `percussao.mp3` | 🌿 Arbustos | Compressão elástica rápida |
| Baixo | bass | `agudos.mp3` | 🌼 Dentes-de-leão | Emissão de partículas |

---

## 3. 🎼 ANÁLISE DE ÁUDIO EM TEMPO REAL

### 3.1 Setup do p5.js

```javascript
// Estrutura de dados para cada canal
let canais = {
  graves: { audio: null, fft: null, amplitude: 0, energia: 0 },
  harmonia: { audio: null, fft: null, amplitude: 0, energia: 0 },
  percussao: { audio: null, fft: null, amplitude: 0, energia: 0 },
  agudos: { audio: null, fft: null, amplitude: 0, energia: 0 }
};
```

### 3.2 Parâmetros Extraídos de Cada Stem

| Parâmetro | Como Obter | Uso |
|-----------|-----------|-----|
| **Amplitude (volume)** | `fft.getEnergy("bass")` ou RMS | Intensidade do movimento |
| **Energia** | Média do espectro | Escala geral da animação |
| **Onset (ataque)** | Comparar amplitude atual vs anterior | Gatilho de eventos |

### 3.3 Detecção de Onset Simplificada

```javascript
// Detecta pico quando amplitude sobe rapidamente
function detectarOnset(canalAtual, canalAnterior, threshold = 0.15) {
  let delta = canalAtual - canalAnterior;
  return delta > threshold;
}
```

---

## 4. 🌱 SISTEMA DE PLANTAS

### 4.1 Estrutura Base de uma Planta

```javascript
class Planta {
  constructor(x, y, tipo, sprite) {
    this.x = x;
    this.y = y;
    this.tipo = tipo;           // 'arvore', 'flor', 'arbusto', 'dente'
    this.sprite = sprite;        // imagem PNG
    this.escalaBase = 1.0;
    this.escalaAtual = 1.0;
    this.rotacao = 0;
    this.velocidadeRotacao = 0;
  }

  atualizar(amplitude, onset) {
    // Sobrescrito por cada tipo
  }

  desenhar() {
    push();
    translate(this.x, this.y);
    rotate(this.rotacao);
    scale(this.escalaAtual);
    imageMode(CENTER);
    image(this.sprite, 0, -this.sprite.height/2); // Pivô na base
    pop();
  }
}
```

### 4.2 Especificação das Danças por Tipo

---

#### 🌳 ÁRVORE (Graves)
**Conceito:** Balanço pesado e estrutural, como cordas de violoncelo

| Input Musical | Transformação Visual |
|---------------|---------------------|
| Amplitude | Ângulo máximo do balanço |
| Energia sustentada | Velocidade da oscilação |
| Onset | Impulso inicial (acelera o balanço) |

**Implementação:**
```javascript
class Arvore extends Planta {
  constructor(x, y, sprite) {
    super(x, y, 'arvore', sprite);
    this.anguloMax = 0;
    this.fase = random(TWO_PI); // Dessincroniza árvores
  }

  atualizar(amplitude, onset) {
    // Amplitude controla quanto balança
    this.anguloMax = lerp(this.anguloMax, amplitude * 0.15, 0.1);

    // Onset dá impulso
    if (onset) {
      this.anguloMax += 0.05;
    }

    // Oscilação senoidal lenta
    this.rotacao = sin(frameCount * 0.02 + this.fase) * this.anguloMax;
  }
}
```

**Parâmetros de ajuste:**
- `0.15` → intensidade máxima do balanço (radianos)
- `0.02` → velocidade da oscilação
- `0.1` → suavização (lerp)

---

#### 🌸 FLOR (Harmonia/Voz)
**Conceito:** Respiração orgânica, como se a flor "cantasse"

| Input Musical | Transformação Visual |
|---------------|---------------------|
| Amplitude | Escala (flor "abre" e "fecha") |
| Energia | Intensidade da pulsação |
| Onset | Pequeno giro |

**Implementação:**
```javascript
class Flor extends Planta {
  constructor(x, y, sprite) {
    super(x, y, 'flor', sprite);
    this.pulso = 0;
  }

  atualizar(amplitude, onset) {
    // Escala pulsa com a amplitude
    this.pulso = lerp(this.pulso, amplitude, 0.15);
    this.escalaAtual = this.escalaBase + this.pulso * 0.3;

    // Onset causa leve giro
    if (onset) {
      this.rotacao += random(-0.1, 0.1);
    }

    // Rotação retorna suavemente a zero
    this.rotacao = lerp(this.rotacao, 0, 0.05);
  }
}
```

**Parâmetros de ajuste:**
- `0.3` → amplitude máxima da pulsação de escala
- `0.15` → responsividade ao som
- `0.1` → intensidade do giro no onset

---

#### 🌿 ARBUSTO (Percussão)
**Conceito:** Compressão elástica rápida, como uma mola

| Input Musical | Transformação Visual |
|---------------|---------------------|
| Onset | Gatilho da compressão |
| Amplitude | Intensidade da compressão |

**Implementação:**
```javascript
class Arbusto extends Planta {
  constructor(x, y, sprite) {
    super(x, y, 'arbusto', sprite);
    this.compressao = 0;
  }

  atualizar(amplitude, onset) {
    // Onset comprime o arbusto
    if (onset) {
      this.compressao = amplitude * 0.4; // Comprime baseado na força
    }

    // Retorno elástico rápido
    this.compressao = lerp(this.compressao, 0, 0.3);

    // Aplica como escala Y (achata verticalmente)
    // scale(1, 1 - compressao) no desenho
  }

  desenhar() {
    push();
    translate(this.x, this.y);
    scale(1 + this.compressao * 0.2, 1 - this.compressao); // Alarga ao comprimir
    imageMode(CENTER);
    image(this.sprite, 0, -this.sprite.height/2);
    pop();
  }
}
```

**Parâmetros de ajuste:**
- `0.4` → compressão máxima
- `0.3` → velocidade do retorno elástico (alto = rápido)
- `0.2` → quanto alarga horizontalmente ao comprimir

---

#### 🌼 DENTE-DE-LEÃO (Agudos)
**Conceito:** Emissão de sementes/partículas em picos

| Input Musical | Transformação Visual |
|---------------|---------------------|
| Onset | Dispara partículas |
| Amplitude | Quantidade de partículas |
| Energia sustentada | Duração da emissão |

**Implementação:**
```javascript
class DenteDeLeao extends Planta {
  constructor(x, y, sprite) {
    super(x, y, 'dente', sprite);
    this.particulas = [];
  }

  atualizar(amplitude, onset) {
    // Onset dispara novas partículas
    if (onset) {
      let quantidade = floor(amplitude * 5) + 1;
      for (let i = 0; i < quantidade; i++) {
        this.particulas.push(new Semente(this.x, this.y - this.sprite.height));
      }
    }

    // Atualiza partículas existentes
    for (let i = this.particulas.length - 1; i >= 0; i--) {
      this.particulas[i].atualizar();
      if (this.particulas[i].morta()) {
        this.particulas.splice(i, 1);
      }
    }
  }

  desenhar() {
    // Desenha planta base
    super.desenhar();

    // Desenha partículas
    for (let p of this.particulas) {
      p.desenhar();
    }
  }
}

class Semente {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-1, 1);
    this.vy = random(-2, -0.5);
    this.vida = 255;
    this.tamanho = random(3, 6);
    this.oscilacao = random(TWO_PI);
  }

  atualizar() {
    // Movimento com oscilação (simula vento)
    this.x += this.vx + sin(frameCount * 0.1 + this.oscilacao) * 0.5;
    this.y += this.vy;
    this.vy += 0.01; // Leve gravidade
    this.vida -= 3;
  }

  morta() {
    return this.vida <= 0;
  }

  desenhar() {
    push();
    noStroke();
    fill(255, this.vida);
    ellipse(this.x, this.y, this.tamanho);
    pop();
  }
}
```

**Parâmetros de ajuste:**
- `5` → multiplicador de quantidade de partículas
- `-2, -0.5` → velocidade inicial vertical
- `3` → decremento de vida por frame
- `0.5` → intensidade da oscilação lateral

---

## 5. 🎨 ORGANIZAÇÃO DA CENA

### 5.1 Camadas (ordem de renderização)

| Ordem | Camada | Conteúdo | Escala | Z-index |
|-------|--------|----------|--------|---------|
| 1 | Céu | Gradiente + nuvens | — | Fundo |
| 2 | Árvores | 6-10 unidades | 1.2x - 1.5x | Atrás |
| 3 | Flores | 8-12 unidades | 1.0x | Meio |
| 4 | Arbustos | 8-12 unidades | 0.8x | Frente |
| 5 | Dentes-de-leão | 4-6 unidades | 0.7x | Frente |
| 6 | Partículas | Sementes | Variável | Topo |

### 5.2 Posicionamento

```javascript
// Distribuição em linha com variação
function criarFileira(y, quantidade, tipoPlanta, sprites) {
  let plantas = [];
  let espacamento = width / (quantidade + 1);

  for (let i = 0; i < quantidade; i++) {
    let x = espacamento * (i + 1) + random(-20, 20);
    let sprite = random(sprites); // Sorteia variação
    plantas.push(new tipoPlanta(x, y + random(-10, 10), sprite));
  }

  return plantas;
}
```

### 5.3 Céu Dinâmico

```javascript
function desenharCeu(energiaGeral) {
  // Gradiente que reage à energia
  let corTopo = lerpColor(color(135, 180, 220), color(255, 200, 150), energiaGeral);
  let corBase = lerpColor(color(200, 220, 255), color(255, 230, 200), energiaGeral);

  for (let y = 0; y < height * 0.6; y++) {
    let inter = map(y, 0, height * 0.6, 0, 1);
    stroke(lerpColor(corTopo, corBase, inter));
    line(0, y, width, y);
  }
}
```

---

## 6. 🖼️ ASSETS NECESSÁRIOS

### 6.1 Sprites PNG

| Tipo | Quantidade | Tamanho Sugerido | Estilo |
|------|------------|------------------|--------|
| Árvores | 8-12 variações | 200x400 px | Cartoon, silhueta simples |
| Flores | 8-12 variações | 100x150 px | Colorido, formas arredondadas |
| Arbustos | 6-10 variações | 120x80 px | Compacto, denso |
| Dentes-de-leão | 6-8 variações | 80x120 px | Delicado, haste fina |
| Nuvens | 4-6 variações | 200x100 px | Suave, semi-transparente |

### 6.2 Organização de Arquivos

```
/assets
  /plantas
    /arvores
      arvore_01.png
      arvore_02.png
      ...
    /flores
      flor_01.png
      ...
    /arbustos
      arbusto_01.png
      ...
    /dentes
      dente_01.png
      ...
  /ceu
    nuvem_01.png
    ...
  /audio
    graves.mp3
    harmonia.mp3
    percussao.mp3
    agudos.mp3
```

---

## 7. 💻 ESTRUTURA DO CÓDIGO

### 7.1 Arquivos Principais

```
/projeto
  index.html
  sketch.js          // Setup, draw, controle geral
  plantas.js         // Classes de plantas
  audio.js           // Gerenciamento de áudio e FFT
  cena.js            // Céu, chão, camadas
  particulas.js      // Sistema de sementes
  /assets
    ...
```

### 7.2 Fluxo Principal (sketch.js)

```javascript
let gerenciadorAudio;
let arvores = [];
let flores = [];
let arbustos = [];
let dentes = [];

function preload() {
  // Carregar sprites
  // Carregar áudios
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Inicializar audio
  gerenciadorAudio = new GerenciadorAudio();

  // Criar plantas
  arvores = criarFileira(height * 0.5, 8, Arvore, spritesArvores);
  flores = criarFileira(height * 0.6, 10, Flor, spritesFlores);
  arbustos = criarFileira(height * 0.75, 10, Arbusto, spritesArbustos);
  dentes = criarFileira(height * 0.85, 5, DenteDeLeao, spritesDentes);
}

function draw() {
  // Atualizar análise de áudio
  let dados = gerenciadorAudio.analisar();

  // Desenhar céu
  desenharCeu(dados.energiaGeral);

  // Desenhar chão
  desenharChao();

  // Atualizar e desenhar plantas (ordem de trás para frente)
  for (let a of arvores) {
    a.atualizar(dados.graves.amplitude, dados.graves.onset);
    a.desenhar();
  }

  for (let f of flores) {
    f.atualizar(dados.harmonia.amplitude, dados.harmonia.onset);
    f.desenhar();
  }

  for (let b of arbustos) {
    b.atualizar(dados.percussao.amplitude, dados.percussao.onset);
    b.desenhar();
  }

  for (let d of dentes) {
    d.atualizar(dados.agudos.amplitude, dados.agudos.onset);
    d.desenhar();
  }
}

function mousePressed() {
  gerenciadorAudio.iniciar(); // Necessário para política de autoplay
}
```

---

## 8. ⚡ OTIMIZAÇÕES DE PERFORMANCE

### 8.1 Limites Recomendados

| Elemento | Quantidade Máxima |
|----------|------------------|
| Árvores | 10 |
| Flores | 15 |
| Arbustos | 15 |
| Dentes-de-leão | 8 |
| Partículas simultâneas | 100 |

### 8.2 Técnicas

1. **Pooling de partículas:** Reutilizar objetos em vez de criar/destruir
2. **Sprites únicos:** Carregar cada PNG uma vez, referenciar múltiplas vezes
3. **Análise de áudio throttled:** Não precisa analisar todo frame (a cada 2-3 frames basta)
4. **Culling:** Não desenhar plantas fora da tela

---

## 9. 🐍 SCRIPT PYTHON DE PRÉ-PROCESSAMENTO

### 9.1 Dependências

```bash
pip install spleeter librosa
```

### 9.2 Script Básico

```python
# preparar_musica.py

from spleeter.separator import Separator
import librosa
import json
import os

def separar_stems(arquivo_entrada, pasta_saida):
    """Separa música em 4 stems usando Spleeter"""
    separator = Separator('spleeter:4stems')
    separator.separate_to_file(arquivo_entrada, pasta_saida)

def detectar_onsets(arquivo_audio):
    """Detecta momentos de ataque no áudio"""
    y, sr = librosa.load(arquivo_audio)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    return onset_times.tolist()

def processar_musica(arquivo_entrada):
    pasta_saida = "stems_output"

    # 1. Separar stems
    print("Separando stems...")
    separar_stems(arquivo_entrada, pasta_saida)

    # 2. Detectar onsets de cada stem (opcional)
    print("Detectando onsets...")
    eventos = {}
    for stem in ['bass', 'drums', 'vocals', 'other']:
        caminho = f"{pasta_saida}/{arquivo_entrada.split('.')[0]}/{stem}.wav"
        if os.path.exists(caminho):
            eventos[stem] = detectar_onsets(caminho)

    # 3. Salvar JSON de eventos
    with open(f"{pasta_saida}/eventos.json", 'w') as f:
        json.dump(eventos, f)

    print("Processamento concluído!")

if __name__ == "__main__":
    processar_musica("minha_musica.mp3")
```

### 9.3 Mapeamento Spleeter → Projeto

| Output Spleeter | Renomear para | Planta |
|-----------------|---------------|--------|
| other.wav | graves.mp3 | Árvores (cordas/melodia) |
| vocals.wav | harmonia.mp3 | Flores |
| drums.wav | percussao.mp3 | Arbustos |
| bass.wav | agudos.mp3 | Dentes-de-leão (baixo) |

---

## 10. 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Setup Básico
- [ ] Criar estrutura de pastas
- [ ] Configurar p5.js com canvas
- [ ] Carregar um sprite de teste
- [ ] Desenhar planta estática

### Fase 2: Sistema de Áudio
- [ ] Carregar 4 stems de áudio
- [ ] Criar 4 FFTs independentes
- [ ] Sincronizar reprodução
- [ ] Extrair amplitude de cada canal
- [ ] Implementar detecção de onset

### Fase 3: Danças das Plantas
- [ ] Implementar classe Arvore com balanço
- [ ] Implementar classe Flor com respiração
- [ ] Implementar classe Arbusto com compressão
- [ ] Implementar classe DenteDeLeao com partículas
- [ ] Testar cada tipo isoladamente

### Fase 4: Cena Completa
- [ ] Criar múltiplas instâncias de cada planta
- [ ] Posicionar em camadas
- [ ] Implementar céu dinâmico
- [ ] Ajustar escalas por profundidade

### Fase 5: Polish
- [ ] Ajustar parâmetros de movimento
- [ ] Otimizar performance
- [ ] Adicionar variação entre plantas do mesmo tipo
- [ ] Testar com diferentes músicas

---

## 11. 🎛️ PARÂMETROS PARA AJUSTE FINO

Todos os valores numéricos nos códigos de dança são ajustáveis. Crie um painel de controle ou arquivo de configuração:

```javascript
const CONFIG = {
  arvore: {
    anguloMaximo: 0.15,
    velocidadeOscilacao: 0.02,
    suavizacao: 0.1,
    impulsoOnset: 0.05
  },
  flor: {
    amplitudeEscala: 0.3,
    responsividade: 0.15,
    intensidadeGiro: 0.1,
    retornoGiro: 0.05
  },
  arbusto: {
    compressaoMaxima: 0.4,
    velocidadeRetorno: 0.3,
    alargamentoHorizontal: 0.2
  },
  dente: {
    multiplicadorParticulas: 5,
    velocidadeInicialMin: -2,
    velocidadeInicialMax: -0.5,
    decrementoVida: 3,
    intensidadeOscilacao: 0.5
  }
};
```

---

## 12. 🚀 TECNOLOGIAS FINAIS

| Finalidade | Tecnologia |
|------------|------------|
| Renderização | p5.js (modo P2D) |
| Análise de áudio | p5.sound (FFT) |
| Sprites | PNG com transparência |
| Partículas | Sistema próprio em JS |
| Pré-processamento | Python + Spleeter + librosa |

---

*Documento preparado para implementação no Claude Code.*
*Versão 2.0 — Revisada com foco em viabilidade e clareza de implementação.*
