from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import torch
import base64
from io import BytesIO
from PIL import Image

from transformers import ViTForImageClassification, ViTImageProcessor

from backend.models.load_models import (
    ethics_text_model,
    ethics_text_tokenizer,
    domain_text_model,
    domain_text_tokenizer,
    prompt_model,
    prompt_tokenizer,
    sd_pipeline,          # Texte → Image
    sd_img2img_pipeline   # Image + Texte → Image
)

# ------------------------
# Initialisation FastAPI
# ------------------------
app = FastAPI(title="AI Content Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------
# Device et modèles
# ------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
for model in [ethics_text_model, domain_text_model, prompt_model]:
    if model:
        model.to(device)
        model.eval()

# ------------------------
# Charger modèle éthique image (ViT)
# ------------------------
image_ethics_model = ViTForImageClassification.from_pretrained(
    "C:/Users/pc/Documents/projet_image/backend/models/image_ethics/vit_ethic_classifier_final_img"
).to(device)
image_ethics_processor = ViTImageProcessor.from_pretrained(
    "C:/Users/pc/Documents/projet_image/backend/models/image_ethics/vit_ethic_classifier_final_img",
    use_fast=True
)

def predict_image_ethics(pil_img: Image.Image):
    inputs = image_ethics_processor(images=pil_img, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = image_ethics_model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
        pred_class = torch.argmax(probs).item()
        score = probs[0][pred_class].item()

    # ⚡ mapping clair
    label_map = {0: "ethique", 1: "non_ethique"}
    return {"ethics": label_map.get(pred_class, "unknown"), "score": score}

# ✅ Fonction utilitaire pour redimensionner en multiples de 8
def resize_to_multiple_of_8(img: Image.Image):
    w, h = img.size
    new_w = (w // 8) * 8
    new_h = (h // 8) * 8
    return img.resize((new_w, new_h), Image.LANCZOS)

# ------------------------
# Endpoint Texte → Image
# ------------------------
@app.post("/generate")
async def generate(text: str = Form(...)):
    result = {}

    # 1. Vérification éthique du texte
    if ethics_text_model and ethics_text_tokenizer:
        inputs = ethics_text_tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            logits = ethics_text_model(**inputs).logits
        ethics_pred = torch.argmax(logits, dim=1).item()
        result["ethics_text"] = "passed" if ethics_pred == 0 else "blocked"

        # ⚠️ Bloquer si texte non éthique
        if result["ethics_text"] == "blocked":
            return {
                "status": "blocked",
                "message": "⚠️ Le texte est jugé non éthique, génération refusée.",
                "domain": None,
                "prompt": text
            }

    # 2. Classification du domaine
    if domain_text_model and domain_text_tokenizer:
        inputs = domain_text_tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            logits = domain_text_model(**inputs).logits
        domain_id = torch.argmax(logits, dim=1).item()
        domain_map = {0: "fashion", 1: "food", 2: "real_estate"}
        result["domain"] = domain_map.get(domain_id, "unknown")

    # 3. Génération du prompt amélioré
    enhanced_prompt = text
    if prompt_model and prompt_tokenizer:
        inputs = prompt_tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            outputs = prompt_model.generate(**inputs, max_length=50)
        enhanced_prompt = prompt_tokenizer.decode(outputs[0], skip_special_tokens=True)
    result["prompt"] = enhanced_prompt

    # 4. Génération de l’image
    try:
        sd_result = sd_pipeline(
            prompt=enhanced_prompt,
            num_inference_steps=25,
            guidance_scale=7.5,
            height=512,
            width=512
        )
        img = sd_result.images[0]
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode()
        result["image_url"] = f"data:image/png;base64,{img_base64}"

        # 5. Vérification éthique de l’image générée
        image_ethics_resp = predict_image_ethics(img)
        result["ethics_image"] = image_ethics_resp.get("ethics", "unknown")
        result["ethics_image_score"] = image_ethics_resp.get("score", None)

    except Exception as e:
        print(f"⚠️ Erreur génération image: {e}")
        result["status"] = "error"
        result["message"] = str(e)
        return result

    result["status"] = "success"
    return result

# ------------------------
# Endpoint Image + Texte → Image
# ------------------------
@app.post("/edit_image")
async def edit_image(file: UploadFile, description: str = Form(...)):
    result = {}

    # 1. Vérification éthique du texte
    if ethics_text_model and ethics_text_tokenizer:
        inputs = ethics_text_tokenizer(description, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            logits = ethics_text_model(**inputs).logits
        ethics_pred = torch.argmax(logits, dim=1).item()
        result["ethics_text"] = "passed" if ethics_pred == 0 else "blocked"

        if result["ethics_text"] == "blocked":
            return {
                "status": "blocked",
                "message": "⚠️ Le texte est jugé non éthique, édition refusée.",
                "domain": None,
                "prompt": description
            }

    # 2. Classification du domaine
    if domain_text_model and domain_text_tokenizer:
        inputs = domain_text_tokenizer(description, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            logits = domain_text_model(**inputs).logits
        domain_id = torch.argmax(logits, dim=1).item()
        domain_map = {0: "fashion", 1: "food", 2: "real_estate"}
        result["domain"] = domain_map.get(domain_id, "unknown")

    # ⚡ 3. Utiliser directement la description comme prompt (pas de générateur)
    enhanced_prompt = description
    result["prompt"] = enhanced_prompt

    # 4. Vérification éthique de l'image uploadée
    try:
        image_bytes = await file.read()
        pil_img = Image.open(BytesIO(image_bytes)).convert("RGB")
        pil_img = resize_to_multiple_of_8(pil_img)

        uploaded_ethics = predict_image_ethics(pil_img)
        result["uploaded_image_ethics"] = uploaded_ethics.get("ethics", "unknown")
        result["uploaded_image_ethics_score"] = uploaded_ethics.get("score", None)

        # ⚠️ Bloquer si l'image uploadée est non éthique
        if result["uploaded_image_ethics"] == "non_ethique":
            return {
                "status": "blocked",
                "message": "⚠️ L'image uploadée est jugée non éthique, édition refusée.",
                "domain": result.get("domain"),
                "prompt": enhanced_prompt
            }

        # 5. Génération avec SD Img2Img
        result_sd = sd_img2img_pipeline(
            prompt=enhanced_prompt,
            negative_prompt="low quality, blurry, distorted, artifacts",
            image=pil_img,
            strength=0.7,
            guidance_scale=7.5,
            num_inference_steps=25
        )

        edited_img = result_sd.images[0]
        buf = BytesIO()
        edited_img.save(buf, format="PNG")
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode()
        result["image_url"] = f"data:image/png;base64,{img_base64}"

        # 6. Vérification éthique de l’image générée
        image_ethics_resp = predict_image_ethics(edited_img)
        result["ethics_image"] = image_ethics_resp.get("ethics", "unknown")
        result["ethics_image_score"] = image_ethics_resp.get("score", None)

    except Exception as e:
        print(f"⚠️ Erreur édition image: {e}")
        result["status"] = "error"
        result["message"] = str(e)
        return result

    result["status"] = "success"
    return result


# ------------------------
# Endpoint racine
# ------------------------
@app.get("/")
def root():
    return {"message": "API is running. Use /generate or /edit_image."}
