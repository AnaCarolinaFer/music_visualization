# 🌱 Jardim Musical

Visualização musical interativa em [p5.js](https://p5js.org/) (WEBGL): um jardim de plantas que dança ao ritmo de uma música, cada grupo reagindo a um instrumento diferente.

A música é separada em 4 "stems" (graves, harmonia, percussão, agudos) e cada stem controla a dança de um grupo de plantas:

| Stem       | Origem (Spleeter) | Planta          | Dança                         |
|------------|--------------------|-----------------|--------------------------------|
| Graves     | other              | Árvores         | balanço pendular               |
| Harmonia   | vocals             | Flores          | respiração (escala uniforme)   |
| Percussão  | drums              | Arbustos        | squash & stretch (escala vertical) |
| Agudos     | bass               | Dentes-de-leão  | emissão de partículas          |

## Demo

🔗 **[Abrir o Jardim Musical](https://anacarolinafer.github.io/music_visualization/)** — já vem com faixas prontas, não precisa instalar nada.

## Modos

- **Explorar o jardim** — escolha uma música (das faixas prontas ou envie a sua), veja as plantas dançarem e filtre quais stems ficam audíveis.
- **Laboratório das plantas** — estude a dança de cada espécie isoladamente, com estímulos avulsos.

## Rodando localmente

### Opção 1 — só com as faixas prontas (sem backend)

As faixas em `faixas-prontas/` já vêm com os stems separados, então basta um servidor estático:

```bash
python -m http.server 8000
# depois abra http://localhost:8000
```

### Opção 2 — separando suas próprias músicas

Para o upload de músicas novas funcionar, é preciso rodar o backend Flask + Spleeter:

```bash
cd server
mise install          # instala Python 3.11 via mise
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py          # roda em http://localhost:5000
```

Depois abra `http://localhost:5000` (o Flask também serve o frontend). Envie um arquivo de música (mp3/wav/ogg), aguarde a separação (1–2 minutos) e clique em Play.

> Áudio não funciona via `file://` por restrições da Web Audio API — sempre sirva por HTTP.

## Gerando novas faixas prontas

Para deixar uma música pronta para tocar sem depender do backend (útil para o GitHub Pages, que só serve arquivos estáticos):

```bash
cd server
source venv/bin/activate
python gerar_faixa_pronta.py <musica.mp3> <slug> "<Nome de exibição>"
```

Isso separa a música, comprime os stems para MP3 e registra a faixa em `faixas-prontas/manifest.json`.

## Arquitetura

**Frontend (p5.js, WEBGL)**
- `sketch.js` — setup/draw principal: céu com gradiente, nuvens com parallax, caminhada lateral, reciclagem de plantas, debug panel (tecla `D`), play/pause (espaço).
- `audio.js` — `GerenciadorAudio`: envia música ao servidor, carrega os 4 stems, cria FFT/Amplitude independentes por stem.
- `plantas.js` — hierarquia `Planta → Arvore/Flor/Arbusto/DenteDeLeao`, extração automática de sprites de sprite sheets.
- `particulas.js` — sistema de partículas emitidas pelos dentes-de-leão.
- `config.js` — todos os parâmetros numéricos de animação, centralizados em `CONFIG`.
- `js/textos.js`, `js/componentes.js`, `css/` — textos, componentes de UI e estilos por tela (Home / Explorar / Laboratório).
- `cacheStems.js` — cache de stems já separados via IndexedDB, para não reprocessar a mesma música.

**Backend (Python/Flask)**
- `server/app.py` — endpoint `POST /separar` que recebe um arquivo e devolve os 4 stems separados via Spleeter.
- `server/separar.py` — chama o Spleeter (`4stems`) e mapeia os nomes para os do projeto.
- `server/gerar_faixa_pronta.py` — gera faixas pré-separadas para `faixas-prontas/`.

## Tecnologias

- [p5.js](https://p5js.org/) + p5.sound (WEBGL, Web Audio API)
- Flask + [Spleeter](https://github.com/deezer/spleeter) (separação de áudio em 4 stems)
- IndexedDB (cache de stems no navegador)
