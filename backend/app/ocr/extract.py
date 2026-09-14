"""Image-to-text OCR via pytesseract.

IMPORTANT deployment note: pytesseract is just a Python wrapper - it shells
out to the actual Tesseract OCR binary, which is a SYSTEM package, not a pip
package. `pip install -r requirements.txt` alone is not enough:
  - Render/Railway (buildpack-based): add an aptfile/apt.txt with
    `tesseract-ocr`, or switch that service to a Dockerfile that installs it.
  - Local dev: `sudo apt install tesseract-ocr` (Linux) or
    `brew install tesseract` (Mac), or the installer from
    https://github.com/UB-Mannheim/tesseract/wiki (Windows).
Without the binary installed, every call here raises TesseractNotFoundError,
which the route below turns into a clear 503 instead of a crash.
"""
import io

from PIL import Image

SUPPORTED_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff")


def extract_text_from_image(content: bytes) -> str:
    import pytesseract  # imported lazily so a missing binary only breaks OCR calls

    image = Image.open(io.BytesIO(content))
    return pytesseract.image_to_string(image)
