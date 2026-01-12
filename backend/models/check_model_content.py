# check_model_content.py
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

def check_model_structure(path):
    print(f"\n🔍 Contenu de {path.name}:")
    if not path.exists():
        print("   ❌ N'existe pas")
        return
    
    # Lister tous les fichiers
    all_files = list(path.rglob("*"))
    if not all_files:
        print("   📁 Dossier vide")
        return
    
    for file in all_files:
        rel_path = file.relative_to(path)
        if file.is_file():
            size = file.stat().st_size / 1024
            print(f"   📄 {rel_path} ({size:.1f} KB)")
            if file.name == "config.json":
                try:
                    import json
                    with open(file, 'r') as f:
                        config = json.load(f)
                        print(f"      model_type: {config.get('model_type', 'N/A')}")
                        print(f"      num_labels: {config.get('num_labels', 'N/A')}")
                except:
                    pass

# Vérifier chaque modèle
paths = {
    "domain": MODELS_DIR / "text_domain" / "domain_classifier_20251211_221749",
    "ethics": MODELS_DIR / "text_ethics" / "final_ethics_classifier_text",
    "prompt": MODELS_DIR / "prompt_generator" / "prompt_generator_model_20",
    "vit": MODELS_DIR / "image_ethics" / "vit_ethic_classifier_final_img",
    "sdxl": MODELS_DIR / "image_generation" / "lora_sdxl"
}

for name, path in paths.items():
    check_model_structure(path)