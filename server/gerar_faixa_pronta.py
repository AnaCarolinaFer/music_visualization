"""
Gera uma "faixa pronta": separa uma música em 4 stems via Spleeter,
comprime para MP3 e registra em faixas-prontas/manifest.json.

Uso:
    python gerar_faixa_pronta.py <audio.mp3> <slug> "<Nome de exibição>"
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from separar import separar_musica


def main():
    if len(sys.argv) != 4:
        print('Uso: python gerar_faixa_pronta.py <audio.mp3> <slug> "<Nome de exibição>"')
        sys.exit(1)

    arquivo, slug, nome = sys.argv[1:4]
    tmp_out = Path(__file__).parent / "output"
    session_id = f"_faixa_{slug}"

    stems = separar_musica(arquivo, str(tmp_out), session_id)

    destino = Path(__file__).parent.parent / "faixas-prontas" / slug
    destino.mkdir(parents=True, exist_ok=True)
    for nome_stem, caminho in stems.items():
        subprocess.run(
            ["ffmpeg", "-y", "-i", caminho, "-codec:a", "libmp3lame", "-b:a", "128k",
             str(destino / f"{nome_stem}.mp3")],
            check=True,
        )
    shutil.rmtree(tmp_out / session_id)

    manifest_path = Path(__file__).parent.parent / "faixas-prontas" / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    manifest = [f for f in manifest if f["slug"] != slug]
    manifest.append({"slug": slug, "nome": nome})
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    print(f"Faixa pronta criada em faixas-prontas/{slug}/")


if __name__ == "__main__":
    main()
