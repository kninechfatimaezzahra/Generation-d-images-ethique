# check_paths.py
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
MODELS_DIR = BASE_DIR / "models"

print(f"BASE_DIR: {BASE_DIR}")
print(f"MODELS_DIR: {MODELS_DIR}")
print(f"MODELS_DIR existe: {MODELS_DIR.exists()}")

print("\nContenu de models/:")
if MODELS_DIR.exists():
    for item in MODELS_DIR.iterdir():
        if item.is_dir():
            print(f"📁 {item.name}/")
            # Montrer les sous-dossiers
            for sub in item.iterdir():
                print(f"    └── {sub.name}")
        else:
            print(f"📄 {item.name}")
else:
    print("❌ Le dossier models/ n'existe pas!")