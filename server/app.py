"""
Servidor Flask para separação de áudio com Spleeter.

Endpoints:
    POST /separar - Recebe arquivo de áudio, retorna URLs dos 4 stems
    GET /output/<session_id>/<filename> - Serve os arquivos de áudio separados
"""

import os
import uuid
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from separar import separar_musica, limpar_outputs_antigos

app = Flask(__name__)
CORS(app)

# Configurações
UPLOAD_FOLDER = Path(__file__).parent / 'uploads'
OUTPUT_FOLDER = Path(__file__).parent / 'output'
FRONTEND_FOLDER = Path(__file__).parent.parent  # Pasta raiz do projeto
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'flac', 'm4a'}

# Criar pastas se não existirem
UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)


def allowed_file(filename):
    """Verifica se a extensão do arquivo é permitida."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/separar', methods=['POST'])
def upload_e_separar():
    """
    Recebe arquivo de áudio e retorna URLs dos 4 stems separados.

    Request:
        POST com multipart/form-data
        Campo 'file' contendo o arquivo de áudio

    Response:
        JSON com URLs dos stems:
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
    """
    # Limpar outputs antigos (mais de 1 hora)
    limpar_outputs_antigos(OUTPUT_FOLDER, max_idade_horas=1)

    # Verificar se arquivo foi enviado
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': 'Nenhum arquivo enviado'
        }), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({
            'success': False,
            'error': 'Nome do arquivo vazio'
        }), 400

    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': f'Formato não suportado. Use: {", ".join(ALLOWED_EXTENSIONS)}'
        }), 400

    # Gerar ID único para esta sessão
    session_id = str(uuid.uuid4())[:8]

    # Salvar arquivo de upload
    filename = secure_filename(file.filename)
    upload_path = UPLOAD_FOLDER / f"{session_id}_{filename}"
    file.save(str(upload_path))

    try:
        # Separar música em stems
        stems = separar_musica(
            arquivo_entrada=str(upload_path),
            pasta_saida=str(OUTPUT_FOLDER),
            session_id=session_id
        )

        # Converter caminhos absolutos para URLs relativas
        stem_urls = {}
        for nome, caminho in stems.items():
            filename = Path(caminho).name
            stem_urls[nome] = f"/output/{session_id}/{filename}"

        # Remover arquivo de upload original
        upload_path.unlink(missing_ok=True)

        return jsonify({
            'success': True,
            'session_id': session_id,
            'stems': stem_urls
        })

    except Exception as e:
        # Limpar em caso de erro
        upload_path.unlink(missing_ok=True)

        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/output/<session_id>/<filename>')
def serve_stem(session_id, filename):
    """Serve os arquivos de áudio separados."""
    directory = OUTPUT_FOLDER / session_id
    return send_from_directory(str(directory), filename)


@app.route('/')
def serve_index():
    """Serve o frontend."""
    return send_from_directory(str(FRONTEND_FOLDER), 'index.html')


@app.route('/<path:filename>')
def serve_frontend(filename):
    """Serve arquivos estáticos do frontend (JS, CSS, imagens)."""
    filepath = FRONTEND_FOLDER / filename
    if filepath.exists() and filepath.is_file():
        return send_from_directory(str(FRONTEND_FOLDER), filename)
    return jsonify({'error': 'Arquivo não encontrado'}), 404


@app.route('/status')
def status():
    """Endpoint de health check."""
    return jsonify({
        'status': 'ok',
        'message': 'Servidor de separação de áudio funcionando'
    })


if __name__ == '__main__':
    print("=" * 50)
    print("Servidor de Separação de Áudio")
    print("=" * 50)
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Output folder: {OUTPUT_FOLDER}")
    print("Endpoints:")
    print("  POST /separar - Envia música para separar")
    print("  GET /output/<id>/<file> - Baixa stem")
    print("  GET /status - Health check")
    print("=" * 50)

    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
