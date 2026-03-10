import os
import yaml
from PIL import Image, ImageDraw, ImageFont

METADATA_PATH = "archive/books/metadata/books_metadata.yml"
COVERS_DIR = "archive/books/book-covers"
THUMBNAILS_DIR = os.path.join(COVERS_DIR, "thumbnails")

def generate_placeholders():
    os.makedirs(COVERS_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        books = yaml.safe_load(f)

    for book in books:
        title = book.get("title", "Unknown Title")
        year = book.get("original_publication_year", "TBD")
        if year is None:
            year = "TBD"

        slug = book.get("slug", "unknown")

        # Determine cover filename. Use placeholder name.
        # The instructions say: "a generated placeholder archive/books/book-covers/{slug}__cover_placeholder.png"
        filename = f"{slug}__cover_placeholder.png"
        cover_path = os.path.join(COVERS_DIR, filename)

        # Update metadata's cover_filename to the placeholder to ensure it's pointing to the correct file
        # In the generate-book-graphics script, we will validate the cover_filename

        # Generate 2000x3000 placeholder
        if not os.path.exists(cover_path):
            print(f"Generating placeholder for {title}...")
            img = Image.new("RGB", (2000, 3000), color=(50, 50, 50))
            draw = ImageDraw.Draw(img)

            # Simple fallback since we might not have a specific font
            font_title = None
            font_watermark = None
            font_year = None

            # Try to load a truetype font, if not, it uses default bitmap font which is tiny
            try:
                # This might not work on all systems, so we catch OSError
                font_title = ImageFont.truetype("DejaVuSans-Bold.ttf", 100)
                font_watermark = ImageFont.truetype("DejaVuSans-Bold.ttf", 200)
                font_year = ImageFont.truetype("DejaVuSans.ttf", 80)
            except IOError:
                font_title = ImageFont.load_default()
                font_watermark = ImageFont.load_default()
                font_year = ImageFont.load_default()

            # Center text calculation
            # Title
            title_bbox = draw.textbbox((0, 0), title, font=font_title)
            title_w = title_bbox[2] - title_bbox[0]
            title_h = title_bbox[3] - title_bbox[1]
            draw.text(((2000 - title_w) / 2, 800), title, fill=(255, 255, 255), font=font_title)

            # Year
            year_str = str(year)
            year_bbox = draw.textbbox((0, 0), year_str, font=font_year)
            year_w = year_bbox[2] - year_bbox[0]
            year_h = year_bbox[3] - year_bbox[1]
            draw.text(((2000 - year_w) / 2, 1000), year_str, fill=(200, 200, 200), font=font_year)

            # Watermark
            wm_text = "PLACEHOLDER"
            wm_bbox = draw.textbbox((0, 0), wm_text, font=font_watermark)
            wm_w = wm_bbox[2] - wm_bbox[0]
            wm_h = wm_bbox[3] - wm_bbox[1]
            draw.text(((2000 - wm_w) / 2, 1500), wm_text, fill=(255, 0, 0, 128), font=font_watermark)

            img.save(cover_path)
        else:
            print(f"Placeholder {cover_path} already exists.")

        # Generate thumbnail (300x450)
        thumb_path = os.path.join(THUMBNAILS_DIR, filename)
        if not os.path.exists(thumb_path):
            img = Image.open(cover_path)
            img.thumbnail((300, 450))
            img.save(thumb_path)
            print(f"Generated thumbnail for {title}.")

        # Generate sidecar YAML files for both original and thumbnail
        sidecar_filename = f"{os.path.splitext(filename)[0]}.yml"
        sidecar_path = os.path.join(COVERS_DIR, sidecar_filename)
        thumb_sidecar_path = os.path.join(THUMBNAILS_DIR, sidecar_filename)

        sidecar_content = {
            "title": title,
            "slug": slug,
            "original_publication_year": year,
            "license": "contributor-provided",
            "type": "placeholder"
        }

        with open(sidecar_path, "w", encoding="utf-8") as yf:
            yaml.dump(sidecar_content, yf)

        with open(thumb_sidecar_path, "w", encoding="utf-8") as yf:
            yaml.dump(sidecar_content, yf)

if __name__ == "__main__":
    generate_placeholders()
