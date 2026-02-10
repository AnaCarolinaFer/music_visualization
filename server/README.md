# Servidor de Separação de Áudio

Backend Flask que usa Spleeter para separar músicas em 4 stems.

## Requisitos do Sistema

- Python 3.11 (já configurado via mise)
- ffmpeg (necessário para processamento de áudio)

```bash
# Instalar ffmpeg (Ubuntu/Debian)
sudo apt-get install ffmpeg
```

## Setup

O ambiente virtual já está configurado. Para usar:

```bash
cd server

# Ativar venv
source venv/bin/activate

# Iniciar servidor
python app.py
```

O servidor roda em `http://localhost:5000`

## Endpoints

### POST /separar

Recebe arquivo de áudio e retorna URLs dos 4 stems.

```bash
curl -X POST -F "file=@musica.mp3" http://localhost:5000/separar
```

Resposta:
```json
{
  "success": true,
  "session_id": "abc123",
  "stems": {
    "graves": "/output/abc123/graves.wav",
    "harmonia": "/output/abc123/harmonia.wav",
    "percussao": "/output/abc123/percussao.wav",
    "agudos": "/output/abc123/agudos.wav"
  }
}
```

### GET /output/{session_id}/{filename}

Baixa um stem específico.

### GET /status

Health check.

## Mapeamento de Stems

| Spleeter | Projeto | Planta |
|----------|---------|--------|
| other.wav | graves.wav | Árvores (cordas/melodia) |
| drums.wav | percussao.wav | Arbustos |
| vocals.wav | harmonia.wav | Flores |
| bass.wav | agudos.wav | Dentes-de-leão (baixo) |

## Limpeza Automática

Outputs com mais de 1 hora são automaticamente removidos.
