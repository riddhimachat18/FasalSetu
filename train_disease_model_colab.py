"""
train_disease_model_colab.py
============================
Run this in Google Colab (free tier, T4 GPU).
Training time: ~25-35 minutes for 38 classes.
Expected accuracy: 88–93% on PlantVillage test set.

STEP-BY-STEP COLAB INSTRUCTIONS:
  1. Go to colab.research.google.com
  2. New notebook
  3. Runtime → Change runtime type → T4 GPU → Save
  4. Copy this entire file into a single code cell
  5. Run it (Ctrl+Enter)
  6. At the end, download: disease_model.pt, disease_classes.json

Architecture: MobileNetV2 pretrained on ImageNet, final layer replaced
for 38 PlantVillage classes. Fine-tuning: freeze base, train head (5 epochs),
then unfreeze last 3 blocks and train full (10 epochs).
"""

# ── CELL 1: Install and imports ───────────────────────────────────────────────
# (paste everything below into ONE Colab cell)

import subprocess, sys

# Install kaggle to download PlantVillage
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "kaggle"], check=True)

import os, json, zipfile, shutil
from pathlib import Path
import numpy as np

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms, models
from torch.optim.lr_scheduler import CosineAnnealingLR

# Verify GPU
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")
if device.type == "cuda":
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
else:
    print("WARNING: No GPU detected. Training will be slow (~3 hours).")
    print("Go to Runtime → Change runtime type → T4 GPU")


# ── CELL 2: Download PlantVillage dataset ─────────────────────────────────────

def download_plantvillage():
    """
    Downloads PlantVillage from Kaggle.

    Before running:
      1. Go to kaggle.com → Account → Create New API Token
      2. Download kaggle.json
      3. Upload kaggle.json to Colab:
           from google.colab import files
           files.upload()   ← click this, upload kaggle.json
      4. Then run this function
    """
    # Set up kaggle credentials
    os.makedirs("/root/.kaggle", exist_ok=True)

    # Check if kaggle.json was uploaded
    if os.path.exists("kaggle.json"):
        shutil.copy("kaggle.json", "/root/.kaggle/kaggle.json")
        os.chmod("/root/.kaggle/kaggle.json", 0o600)
        print("kaggle.json found and configured.")
    else:
        print("""
ERROR: kaggle.json not found.

To fix:
  1. Go to https://www.kaggle.com/account
  2. Scroll to 'API' section
  3. Click 'Create New API Token' → downloads kaggle.json
  4. In Colab, run:
       from google.colab import files
       files.upload()
  5. Then run this cell again.
        """)
        return False

    # Download PlantVillage (colour, segmented version)
    print("Downloading PlantVillage dataset (~1.1GB)...")
    result = subprocess.run([
        "kaggle", "datasets", "download",
        "-d", "abdallahalidev/plantvillage-dataset",
        "--path", "/content/"
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print(f"Kaggle download error: {result.stderr}")
        return False

    # Unzip
    zip_path = "/content/plantvillage-dataset.zip"
    print("Extracting...")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall("/content/plantvillage/")

    # Find the colour folder (has highest quality images)
    for candidate in [
        "/content/plantvillage/plantvillage dataset/color",
        "/content/plantvillage/color",
        "/content/plantvillage/Plant_leave_diseases_dataset_with_augmentation",
    ]:
        if Path(candidate).exists():
            print(f"Dataset root: {candidate}")
            return candidate

    # Fallback: find any folder with 38+ subdirs
    for root, dirs, files in os.walk("/content/plantvillage/"):
        if len(dirs) >= 30:
            print(f"Dataset root found: {root}")
            return root

    print("Could not find dataset root. Check /content/plantvillage/ manually.")
    return False


DATA_ROOT = download_plantvillage()


# ── CELL 3: Verify dataset ────────────────────────────────────────────────────

if DATA_ROOT:
    classes = sorted(os.listdir(DATA_ROOT))
    # Filter out hidden files/system folders
    classes = [c for c in classes if not c.startswith(".") and
               os.path.isdir(os.path.join(DATA_ROOT, c))]
    print(f"\nDataset: {len(classes)} disease classes")
    print("Classes:")
    for i, c in enumerate(classes):
        n_images = len(os.listdir(os.path.join(DATA_ROOT, c)))
        print(f"  [{i:02d}] {c}: {n_images} images")

    # Save class list — you'll need this for inference
    with open("/content/disease_classes.json", "w") as f:
        json.dump(classes, f, indent=2)
    print(f"\nSaved disease_classes.json ({len(classes)} classes)")


# ── CELL 4: Data loaders ──────────────────────────────────────────────────────

IMG_SIZE   = 224   # MobileNetV2 input size
BATCH_SIZE = 32
NUM_WORKERS = 2

# Augmentation for training (prevents overfitting)
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
    transforms.RandomRotation(30),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],   # ImageNet stats
                         std=[0.229, 0.224, 0.225]),
])

# No augmentation for validation/test
val_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# Load full dataset, then split 80/10/10
full_dataset = datasets.ImageFolder(DATA_ROOT, transform=train_transform)
n_total = len(full_dataset)
n_val   = int(n_total * 0.10)
n_test  = int(n_total * 0.10)
n_train = n_total - n_val - n_test

train_set, val_set, test_set = random_split(
    full_dataset, [n_train, n_val, n_test],
    generator=torch.Generator().manual_seed(42)
)

# Apply val/test transforms properly
# (random_split inherits train transforms, we override)
val_set.dataset  = datasets.ImageFolder(DATA_ROOT, transform=val_transform)
test_set.dataset = datasets.ImageFolder(DATA_ROOT, transform=val_transform)

train_loader = DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True,
                          num_workers=NUM_WORKERS, pin_memory=True)
val_loader   = DataLoader(val_set,   batch_size=BATCH_SIZE, shuffle=False,
                          num_workers=NUM_WORKERS, pin_memory=True)
test_loader  = DataLoader(test_set,  batch_size=BATCH_SIZE, shuffle=False,
                          num_workers=NUM_WORKERS, pin_memory=True)

num_classes = len(full_dataset.classes)
print(f"Train: {n_train}  Val: {n_val}  Test: {n_test}")
print(f"Classes: {num_classes}")
print(f"Batches per epoch: {len(train_loader)}")


# ── CELL 5: Build model ───────────────────────────────────────────────────────

def build_model(num_classes: int) -> nn.Module:
    """
    MobileNetV2 pretrained on ImageNet.
    Replace classifier head for our 38 disease classes.
    """
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)

    # Freeze all layers first
    for param in model.parameters():
        param.requires_grad = False

    # Replace the classifier head
    # MobileNetV2 classifier: [Dropout, Linear(1280, 1000)]
    in_features = model.classifier[1].in_features   # 1280
    model.classifier = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(0.2),
        nn.Linear(512, num_classes)
    )

    return model

model = build_model(num_classes).to(device)

# Count trainable parameters
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
total     = sum(p.numel() for p in model.parameters())
print(f"Trainable params: {trainable:,} / {total:,}")


# ── CELL 6: Training functions ────────────────────────────────────────────────

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, total = 0, 0, 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * imgs.size(0)
        _, preds = outputs.max(1)
        correct  += preds.eq(labels).sum().item()
        total    += imgs.size(0)
    return total_loss / total, 100.0 * correct / total


@torch.no_grad()
def eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0, 0, 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        total_loss += loss.item() * imgs.size(0)
        _, preds = outputs.max(1)
        correct  += preds.eq(labels).sum().item()
        total    += imgs.size(0)
    return total_loss / total, 100.0 * correct / total


def unfreeze_last_n_blocks(model, n_blocks: int = 3):
    """
    Unfreeze the last N feature blocks of MobileNetV2 for fine-tuning.
    MobileNetV2 has 18 feature blocks (indices 0–17) + conv layers.
    """
    # First freeze everything
    for param in model.parameters():
        param.requires_grad = False

    # Unfreeze classifier always
    for param in model.classifier.parameters():
        param.requires_grad = True

    # Unfreeze last n_blocks of features
    feature_blocks = list(model.features.children())
    for block in feature_blocks[-n_blocks:]:
        for param in block.parameters():
            param.requires_grad = True

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Unfroze last {n_blocks} feature blocks. Trainable params: {trainable:,}")


# ── CELL 7: Phase 1 training — head only (5 epochs) ──────────────────────────

print("\n═══ PHASE 1: Training classifier head (base frozen) ═══")
criterion  = nn.CrossEntropyLoss(label_smoothing=0.1)
optimizer  = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()),
                        lr=1e-3, weight_decay=1e-4)
scheduler  = CosineAnnealingLR(optimizer, T_max=5)

PHASE1_EPOCHS = 5
best_val_acc  = 0
best_state    = None

for epoch in range(1, PHASE1_EPOCHS + 1):
    tr_loss, tr_acc = train_epoch(model, train_loader, optimizer, criterion, device)
    va_loss, va_acc = eval_epoch(model,   val_loader,   criterion, device)
    scheduler.step()

    print(f"Epoch {epoch:2d}/{PHASE1_EPOCHS}  "
          f"train: loss={tr_loss:.3f} acc={tr_acc:.1f}%  "
          f"val: loss={va_loss:.3f} acc={va_acc:.1f}%")

    if va_acc > best_val_acc:
        best_val_acc = va_acc
        best_state   = {k: v.clone() for k, v in model.state_dict().items()}

print(f"\nPhase 1 best val accuracy: {best_val_acc:.1f}%")


# ── CELL 8: Phase 2 — fine-tune last 3 blocks (10 epochs) ────────────────────

print("\n═══ PHASE 2: Fine-tuning last 3 feature blocks ═══")
model.load_state_dict(best_state)   # start from best phase 1
unfreeze_last_n_blocks(model, n_blocks=3)

optimizer2 = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()),
                        lr=3e-4, weight_decay=1e-4)
scheduler2 = CosineAnnealingLR(optimizer2, T_max=10)

PHASE2_EPOCHS = 10

for epoch in range(1, PHASE2_EPOCHS + 1):
    tr_loss, tr_acc = train_epoch(model, train_loader, optimizer2, criterion, device)
    va_loss, va_acc = eval_epoch(model,   val_loader,   criterion, device)
    scheduler2.step()

    print(f"Epoch {epoch:2d}/{PHASE2_EPOCHS}  "
          f"train: loss={tr_loss:.3f} acc={tr_acc:.1f}%  "
          f"val: loss={va_loss:.3f} acc={va_acc:.1f}%")

    if va_acc > best_val_acc:
        best_val_acc = va_acc
        best_state   = {k: v.clone() for k, v in model.state_dict().items()}
        print(f"  ★ New best: {best_val_acc:.1f}%")

# Load best weights
model.load_state_dict(best_state)
print(f"\nFinal best val accuracy: {best_val_acc:.1f}%")


# ── CELL 9: Test set evaluation ───────────────────────────────────────────────

_, test_acc = eval_epoch(model, test_loader, criterion, device)
print(f"\nTest set accuracy: {test_acc:.1f}%")

# Per-class accuracy
print("\nPer-class accuracy (top 10 worst):")
model.eval()
class_correct = {c: 0 for c in full_dataset.classes}
class_total   = {c: 0 for c in full_dataset.classes}

with torch.no_grad():
    for imgs, labels in test_loader:
        imgs, labels = imgs.to(device), labels.to(device)
        outputs = model(imgs)
        _, preds = outputs.max(1)
        for label, pred in zip(labels, preds):
            c = full_dataset.classes[label.item()]
            class_total[c]   += 1
            class_correct[c] += (label == pred).item()

class_acc = {c: (class_correct[c] / max(class_total[c], 1) * 100)
             for c in full_dataset.classes}
worst = sorted(class_acc.items(), key=lambda x: x[1])[:10]
for cls, acc in worst:
    print(f"  {acc:5.1f}%  {cls}")


# ── CELL 10: Save model ────────────────────────────────────────────────────────

# Save full model (easier to load for inference)
torch.save(model, "/content/disease_model.pt")
print("Saved: /content/disease_model.pt")

# Save state dict (smaller, safer for production)
torch.save(model.state_dict(), "/content/disease_model_weights.pth")
print("Saved: /content/disease_model_weights.pth")

# disease_classes.json was saved in Cell 3
print("Saved: /content/disease_classes.json")

# ── CELL 11: Download files to your computer ──────────────────────────────────

from google.colab import files
print("Downloading disease_model.pt (~14MB)...")
files.download("/content/disease_model.pt")
print("Downloading disease_classes.json...")
files.download("/content/disease_classes.json")
print("\nDone! Copy both files to your FasalSetu project's models/ folder.")


# ── CELL 12: Inference test (verify model works before downloading) ───────────

def predict_disease(image_path: str, model, classes: list,
                    device, threshold: float = 0.5) -> dict:
    """
    Test inference — run on a single image.
    Use this in Colab to verify the model before downloading.
    """
    from PIL import Image

    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    img = Image.open(image_path).convert("RGB")
    tensor = transform(img).unsqueeze(0).to(device)

    model.eval()
    with torch.no_grad():
        logits = model(tensor)
        probs  = torch.softmax(logits, dim=1)[0]
        confidence = float(probs.max())
        class_idx  = int(probs.argmax())

    disease = classes[class_idx]

    # Top-3 predictions
    top3_idx  = probs.topk(3).indices.tolist()
    top3_conf = probs.topk(3).values.tolist()
    top3 = [(classes[i], round(c * 100, 1)) for i, c in zip(top3_idx, top3_conf)]

    return {
        "disease":    disease,
        "confidence": round(confidence * 100, 1),
        "top3":       top3,
        "is_healthy": "healthy" in disease.lower(),
        "low_confidence": confidence < threshold,
    }


# Quick test with a sample image from the dataset
sample_class = full_dataset.classes[0]
sample_dir   = Path(DATA_ROOT) / sample_class
sample_img   = list(sample_dir.iterdir())[0]

result = predict_disease(str(sample_img), model, full_dataset.classes, device)
print(f"\nSample prediction:")
print(f"  Image:      {sample_img.name}")
print(f"  True class: {sample_class}")
print(f"  Predicted:  {result['disease']} ({result['confidence']}%)")
print(f"  Top 3:      {result['top3']}")
