"""
Módulo de separação de áudio usando Spleeter.
Separa uma música em 4 stems: bass, drums, vocals, other
Renomeia para: graves, percussao, harmonia, agudos
"""

import os
import shutil
from pathlib import Path


def separar_musica(arquivo_entrada, pasta_saida, session_id):
    """
    Separa um arquivo de áudio em 4 stems usando Spleeter.

    Args:
        arquivo_entrada: Caminho do arquivo de áudio original
        pasta_saida: Pasta base para output
        session_id: ID único da sessão (para organizar outputs)

    Returns:
        dict com caminhos dos 4 stems gerados
    """
    from spleeter.separator import Separator

    # Criar pasta de output para esta sessão
    output_dir = Path(pasta_saida) / session_id
    output_dir.mkdir(parents=True, exist_ok=True)

    # Separar usando modelo 4stems
    separator = Separator('spleeter:4stems')

    # Spleeter cria uma subpasta com o nome do arquivo
    separator.separate_to_file(arquivo_entrada, str(output_dir))

    # Encontrar a pasta criada pelo Spleeter (nome do arquivo sem extensão)
    arquivo_nome = Path(arquivo_entrada).stem
    spleeter_output = output_dir / arquivo_nome

    # Mapeamento de nomes Spleeter → nomes do projeto
    mapeamento = {
        'bass.wav':   'graves.wav',
        'drums.wav':  'percussao.wav',
        'vocals.wav': 'harmonia.wav',
        'other.wav':  'agudos.wav'
    }

    # Renomear e mover arquivos para a pasta da sessão
    stems = {}
    for original, novo in mapeamento.items():
        origem = spleeter_output / original
        destino = output_dir / novo

        if origem.exists():
            shutil.move(str(origem), str(destino))
            nome_stem = novo.replace('.wav', '')
            stems[nome_stem] = str(destino)

    # Limpar pasta temporária do Spleeter
    if spleeter_output.exists():
        shutil.rmtree(str(spleeter_output))

    return stems


def limpar_outputs_antigos(pasta_output, max_idade_horas=1):
    """
    Remove pastas de output com mais de X horas.

    Args:
        pasta_output: Pasta base de outputs
        max_idade_horas: Idade máxima em horas antes de deletar
    """
    import time

    pasta = Path(pasta_output)
    if not pasta.exists():
        return

    agora = time.time()
    max_idade_segundos = max_idade_horas * 3600

    for item in pasta.iterdir():
        if item.is_dir():
            idade = agora - item.stat().st_mtime
            if idade > max_idade_segundos:
                shutil.rmtree(str(item))
                print(f"Removido output antigo: {item.name}")
