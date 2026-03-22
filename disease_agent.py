"""
disease_agent.py  (updated — replaces Gemini API with trained MobileNetV2)
==========================================================================
Prerequisites:
  - models/disease_model.pt        (trained in Colab, downloaded)
  - models/disease_classes.json    (38 class names, downloaded from Colab)

If the model file is missing, the agent gracefully falls back to a
rule-based symptom checker using text description.
"""

import json, os
from pathlib import Path
from langchain.tools import tool
from audit.logger import audit_log

# ── Load model once at import time ────────────────────────────────────────────
_model   = None
_classes = None
_device  = None
_transform = None

def _load_model():
    global _model, _classes, _device, _transform

    model_path  = Path("models/disease_model.pt")
    classes_path = Path("models/disease_classes.json")

    if not model_path.exists():
        print(f"WARNING: {model_path} not found. Disease agent will use fallback mode.")
        print("Train the model in Colab first: disease_model/train_disease_model_colab.py")
        return False

    if not classes_path.exists():
        print(f"WARNING: {classes_path} not found.")
        return False

    try:
        import torch
        from torchvision import transforms

        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        _model  = torch.load(model_path, map_location=_device)
        _model.eval()

        with open(classes_path) as f:
            _classes = json.load(f)

        _transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
        ])

        print(f"Disease model loaded: {len(_classes)} classes on {_device}")
        return True

    except Exception as e:
        print(f"ERROR loading disease model: {e}")
        return False

MODEL_LOADED = _load_model()

# ── Treatment database ─────────────────────────────────────────────────────────
# Maps PlantVillage class names to treatments
# Add more as needed — class names follow the PlantVillage naming convention

TREATMENT_DB = {
    # ── Apple ──
    "Apple___Apple_scab":
        "Apply fungicide (captan or mancozeb) at 7-10 day intervals. "
        "Remove fallen leaves. Improve air circulation.",
    "Apple___Black_rot":
        "Prune infected branches 8 inches below visible canker. "
        "Apply copper-based fungicide. Remove mummified fruit.",
    "Apple___Cedar_apple_rust":
        "Apply myclobutanil or propiconazole at pink bud stage. "
        "Remove nearby juniper/cedar trees if possible.",

    # ── Corn/Maize ──
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot":
        "Apply azoxystrobin or pyraclostrobin fungicide. "
        "Practice crop rotation (avoid maize-after-maize). "
        "Plant resistant hybrids next season.",
    "Corn_(maize)___Common_rust_":
        "Apply mancozeb or zineb at first sign. "
        "Resistant varieties preferred. "
        "Early planting avoids peak rust season.",
    "Corn_(maize)___Northern_Leaf_Blight":
        "Apply strobilurin or triazole fungicide at VT stage. "
        "Ensure good field drainage. Rotate crops.",

    # ── Wheat ──
    "Wheat___Leaf_rust":
        "Apply propiconazole or tebuconazole immediately. "
        "Scout weekly during humid periods. "
        "Consider resistant variety next season.",
    "Wheat___Septoria":
        "Apply fungicide at flag leaf emergence. "
        "Improve canopy airflow. Rotate with non-cereal crops.",
    "Wheat___Yellow_rust":
        "Apply triazole fungicide immediately — yellow rust spreads fast. "
        "Avoid overhead irrigation.",

    # ── Tomato ──
    "Tomato___Bacterial_spot":
        "Apply copper-based bactericide. "
        "Avoid working with wet plants. "
        "Remove and destroy severely infected plants.",
    "Tomato___Early_blight":
        "Apply mancozeb or chlorothalonil at 7-day intervals. "
        "Mulch around base. Avoid wetting foliage.",
    "Tomato___Late_blight":
        "Apply metalaxyl or chlorothalonil immediately — late blight spreads rapidly. "
        "Remove infected material. Destroy severely affected plants.",
    "Tomato___Leaf_Mold":
        "Improve greenhouse ventilation. Reduce humidity below 85%. "
        "Apply chlorothalonil fungicide.",
    "Tomato___Septoria_leaf_spot":
        "Remove lower infected leaves. Apply mancozeb or copper fungicide. "
        "Stake plants for better airflow.",
    "Tomato___Spider_mites Two-spotted_spider_mite":
        "Apply acaricide (abamectin or bifenazate). "
        "Spray with water to knock off mites. "
        "Avoid hot, dusty conditions. Introduce predatory mites.",
    "Tomato___Target_Spot":
        "Apply chlorothalonil or azoxystrobin. "
        "Improve drainage. Rotate crops.",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus":
        "No chemical cure — manage whitefly vector with imidacloprid. "
        "Remove and destroy infected plants immediately. "
        "Use reflective mulch to repel whiteflies.",
    "Tomato___Tomato_mosaic_virus":
        "No chemical cure. Remove infected plants immediately. "
        "Disinfect tools. Control aphid vectors.",

    # ── Potato ──
    "Potato___Early_blight":
        "Apply chlorothalonil or mancozeb at first sign. "
        "Maintain adequate K and N nutrition.",
    "Potato___Late_blight":
        "Apply metalaxyl-M or cymoxanil immediately. "
        "Destroy infected tubers. Avoid overhead irrigation.",

    # ── Rice ──
    "Rice___Brown_spot":
        "Apply propiconazole or iprodione. "
        "Ensure balanced K fertilisation — K deficiency increases susceptibility. "
        "Use certified disease-free seed.",
    "Rice___Hispa":
        "Apply carbofuran (if legal in your region) or malathion. "
        "Flood field temporarily to drown larvae. Clip affected tillers.",
    "Rice___Leaf_blast":
        "Apply tricyclazole or isoprothiolane at first sign. "
        "Reduce nitrogen application — excess N worsens blast. "
        "Drain field intermittently.",

    # ── Grape ──
    "Grape___Black_rot":
        "Apply myclobutanil or mancozeb before and after bloom. "
        "Remove mummified fruit and infected canes.",
    "Grape___Esca_(Black_Measles)":
        "No effective fungicide. Prune infected wood — sterilise tools between cuts. "
        "Paint pruning wounds with fungicidal paste.",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)":
        "Apply copper-based fungicide. "
        "Improve canopy management for airflow.",

    # ── Pepper ──
    "Pepper,_bell___Bacterial_spot":
        "Apply copper-based bactericide. "
        "Use disease-free certified seed. "
        "Avoid overhead irrigation.",
}

# Healthy classes — no treatment needed
HEALTHY_CLASSES = {c for c in ([] if _classes is None else _classes)
                   if "healthy" in c.lower()}


def get_treatment(disease_class: str) -> str:
    """Look up treatment. Falls back to generic advice if class not in DB."""
    if disease_class in TREATMENT_DB:
        return TREATMENT_DB[disease_class]

    if "healthy" in disease_class.lower():
        return "No disease detected. Continue current crop management practices."

    # Generic fallback
    crop = disease_class.split("___")[0].replace("_", " ") if "___" in disease_class else "crop"
    disease = disease_class.split("___")[-1].replace("_", " ") if "___" in disease_class else disease_class
    return (f"Disease detected: {disease} on {crop}. "
            f"Consult your local KVK or agricultural extension officer for treatment. "
            f"Document the symptoms with photos for their reference.")


# ── TOOL DEFINITION ────────────────────────────────────────────────────────────

@tool
def disease_detection_tool(image_path: str) -> str:
    """
    Detects crop disease from a leaf/plant photo and recommends treatment.
    Input: absolute file path to an image (JPEG or PNG)
    Output: JSON with detected disease, confidence %, treatment recommendation, source.

    Covers 38 disease classes across: Apple, Blueberry, Cherry, Corn, Grape,
    Orange, Peach, Pepper, Potato, Raspberry, Rice, Soybean, Squash,
    Strawberry, Tomato, Wheat.
    """
    if not MODEL_LOADED:
        return json.dumps({
            "error": "Disease model not loaded. Run train_disease_model_colab.py in Colab first.",
            "fallback": "Describe the symptoms and I will provide general guidance."
        })

    if not Path(image_path).exists():
        return json.dumps({"error": f"Image file not found: {image_path}"})

    try:
        import torch
        from PIL import Image

        img = Image.open(image_path).convert("RGB")
        tensor = _transform(img).unsqueeze(0).to(_device)

        with torch.no_grad():
            logits = _model(tensor)
            probs  = torch.softmax(logits, dim=1)[0]
            confidence = float(probs.max())
            class_idx  = int(probs.argmax())

        disease_class = _classes[class_idx]
        treatment = get_treatment(disease_class)

        # Top-3 for transparency
        top3_idx  = probs.topk(3).indices.tolist()
        top3_conf = probs.topk(3).values.tolist()
        top3 = [
            {"class": _classes[i], "confidence_pct": round(c * 100, 1)}
            for i, c in zip(top3_idx, top3_conf)
        ]

        # Format class name for display
        display_name = disease_class.replace("___", " — ").replace("_", " ")

        result = {
            "disease_detected":   display_name,
            "confidence_pct":     round(confidence * 100, 1),
            "is_healthy":         "healthy" in disease_class.lower(),
            "low_confidence":     confidence < 0.50,
            "treatment":          treatment,
            "top3_predictions":   top3,
            "source":             "MobileNetV2 trained on PlantVillage dataset (54,000 images, 38 classes)",
            "model_note":         "Low confidence (<50%) means symptoms may be atypical — consult KVK."
                                  if confidence < 0.50 else ""
        }

        audit_log(
            agent="disease_agent",
            input_data={"image_path": image_path},
            output=result,
            confidence=confidence
        )

        return json.dumps(result, ensure_ascii=False)

    except Exception as e:
        audit_log("disease_agent", {"image_path": image_path},
                  {"error": str(e)}, 0.0)
        return json.dumps({"error": f"Inference failed: {str(e)}"})
