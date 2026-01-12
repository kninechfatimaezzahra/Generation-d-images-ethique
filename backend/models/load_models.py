from pathlib import Path
import torch
import json
import os
from diffusers import StableDiffusionPipeline, StableDiffusionImg2ImgPipeline

# ======================
# CONFIGURATION
# ======================
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["CUDA_VISIBLE_DEVICES"] = ""  # ⚡ Forcer CPU-only

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

print(f"📂 Base directory: {BASE_DIR}")
print(f"📂 Models directory: {MODELS_DIR}")

# ======================
# CHEMINS
# ======================
PATHS = {
    "domain": MODELS_DIR / "text_domain" / "domain_classifier_20251211_221749",
    "ethics": MODELS_DIR / "text_ethics" / "final_deberta_large_classifier",
    "prompt": MODELS_DIR / "prompt_generator" / "prompt_generator_model_20",
    "vit_ethics": MODELS_DIR / "image_ethics" / "vit_ethic_classifier_final_img",
    "vit_domain": MODELS_DIR / "image_domain" ,
    # LoRA: pointer directement vers le sous-dossier "unet"
    "sd_lora": MODELS_DIR / "image_generation" / "lora_sdxl" / "unet",
}

print("\n🔍 Chemins vérifiés:")
for name, path in PATHS.items():
    print(f"{'✅' if path.exists() else '❌'} {name}: {path}")

# ======================
# CHARGEMENT DES MODÈLES
# ======================
print("\n" + "="*60)
print("🚀 CHARGEMENT DES MODÈLES")
print("="*60)

# Variables globales
domain_text_model = domain_text_tokenizer = None
ethics_text_model = ethics_text_tokenizer = None
prompt_model = prompt_tokenizer = None
vit_ethic_model = vit_ethic_processor = None
vit_domain_model = None
sd_pipeline = None
sd_img2img_pipeline = None   # ⚡ Ajouté

try:
    # ----------------------
    # 1. DOMAIN CLASSIFIER
    # ----------------------
    print("\n1. 📊 Domain Classifier (DistilBERT)")
    if PATHS["domain"].exists():
        model_dir = PATHS["domain"] / "model"
        tokenizer_dir = PATHS["domain"] / "tokenizer"
        if model_dir.exists() and tokenizer_dir.exists():
            from transformers import AutoTokenizer, AutoModelForSequenceClassification

            config_file = model_dir / "config.json"
            num_labels = 3
            if config_file.exists():
                with open(config_file, "r") as f:
                    config = json.load(f)
                    num_labels = config.get("num_labels", 3)
                    print(f"   Type: {config.get('model_type', 'N/A')}, Labels: {num_labels}")

            domain_text_tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_dir))
            domain_text_model = AutoModelForSequenceClassification.from_pretrained(
                str(model_dir),
                num_labels=num_labels,
                ignore_mismatched_sizes=True,
            )
            domain_text_model.eval()
            print(f"   ✅ Chargé avec {num_labels} labels")
        else:
            print("   ❌ Sous-dossiers model/ ou tokenizer/ manquants")
    else:
        print("   ❌ Dossier non trouvé")

    # ----------------------
    # 2. ETHICS CLASSIFIER
    # ----------------------
    print("\n2. ⚖️ Ethics Classifier (deBERTa)")
    if PATHS["ethics"].exists():
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        config_file = PATHS["ethics"] / "config.json"
        num_labels = 2
        if config_file.exists():
            with open(config_file, "r") as f:
                config = json.load(f)
                num_labels = config.get("num_labels", 2)
                print(f"   Type: {config.get('model_type', 'N/A')}, Labels: {num_labels}")

        ethics_text_tokenizer = AutoTokenizer.from_pretrained(str(PATHS["ethics"]))
        ethics_text_model = AutoModelForSequenceClassification.from_pretrained(
            str(PATHS["ethics"]),
            num_labels=num_labels,
        )
        ethics_text_model.eval()
        print("   ✅ Chargé")
    else:
        print("   ❌ Dossier non trouvé")

    # ----------------------
    # 3. PROMPT GENERATOR (T5)
    # ----------------------
    print("\n3. 🎨 Prompt Generator (T5)")
    if PATHS["prompt"].exists():
        from transformers import AutoTokenizer, T5ForConditionalGeneration

        prompt_tokenizer = AutoTokenizer.from_pretrained(str(PATHS["prompt"]))
        prompt_model = T5ForConditionalGeneration.from_pretrained(str(PATHS["prompt"]))
        prompt_model.eval()
        print("   ✅ Chargé (T5)")
    else:
        print("   ❌ Dossier non trouvé")

    # ----------------------
    # 4. VIT ETHICS
    # ----------------------
    print("\n4. 🖼️ ViT Ethics Classifier")
    if PATHS["vit_ethics"].exists():
        from transformers import AutoImageProcessor, AutoModelForImageClassification

        vit_ethic_processor = AutoImageProcessor.from_pretrained(str(PATHS["vit_ethics"]), use_fast=True)
        vit_ethic_model = AutoModelForImageClassification.from_pretrained(str(PATHS["vit_ethics"]))
        vit_ethic_model.eval()
        print("   ✅ Chargé")
    else:
        print("   ❌ Dossier non trouvé")

    # ----------------------
    # 5. VIT DOMAIN (.pth via loader.py)
    # ----------------------
    print("\n5. 🔬 ViT Domain Model (.pth via loader.py)")
    try:
        from backend.models.image_domain.loader import predict_image_domain
        print("   ✅ ViT Domain Model chargé via loader.py")
    except Exception as e:
        print(f"   ❌ Erreur chargement ViT Domain Model: {e}")
        predict_image_domain = None

    # ----------------------
    # 6. STABLE DIFFUSION v1.5 (Texte→Image)
    # ----------------------
    print("\n6. 🎨 Stable Diffusion v1.5 (Texte→Image)")
    try:
        device = "cpu"
        sd_pipeline = StableDiffusionPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            dtype=torch.float32
        ).to(device)
        if PATHS["sd_lora"].exists():
            try:
                sd_pipeline.load_lora_weights(str(PATHS["sd_lora"]))
                print("   ✅ SD v1.5 texte→image + LoRA appliqué")
            except Exception as e:
                print(f"   ⚠️ Erreur LoRA: {e}")
        else:
            print("   ⚠️ Dossier LoRA introuvable")
    except Exception as e:
        print(f"   ❌ Erreur chargement SD v1.5 texte→image: {e}")
        sd_pipeline = None

    # ----------------------
    # 7. STABLE DIFFUSION v1.5 Img2Img (Image+Texte→Image)
    # ----------------------
    print("\n7. 🎨 Stable Diffusion v1.5 Img2Img")
    try:
        device = "cpu"
        sd_img2img_pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            dtype=torch.float32
        ).to(device)
        if PATHS["sd_lora"].exists():
            try:
                sd_img2img_pipeline.load_lora_weights(str(PATHS["sd_lora"]))
                print("   ✅ SD v1.5 Img2Img + LoRA appliqué")
            except Exception as e:
                print(f"   ⚠️ Erreur LoRA Img2Img: {e}")
        else:
            print("   ⚠️ Dossier LoRA introuvable")
    except Exception as e:
        print(f"   ❌ Erreur chargement SD v1.5 Img2Img: {e}")
        sd_img2img_pipeline = None

    print("\n" + "="*60)
    print("✅ CHARGEMENT TERMINÉ AVEC SUCCÈS!")
    print("="*60)

except Exception as e:
    print(f"\n❌ ERREUR CRITIQUE: {e}")
    import traceback
    traceback.print_exc()
    domain_text_model = domain_text_tokenizer = None
    ethics_text_model = ethics_text_tokenizer = None
    prompt_model = prompt_tokenizer = None
    vit_ethic_model = vit_ethic_processor = None
    vit_domain_model = None
    sd_pipeline = None
    sd_img2img_pipeline = None
    print("\n⚠️  Utilisation du mode de secours...")
