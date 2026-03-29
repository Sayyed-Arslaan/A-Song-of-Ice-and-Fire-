import os
import sys
import yaml
import json
import argparse
import csv
from PIL import Image
from datetime import datetime
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import networkx as nx

def load_and_validate_metadata(metadata_path, covers_dir):
    if not os.path.exists(metadata_path):
        print(f"Error: Metadata file {metadata_path} not found.")
        sys.exit(1)

    with open(metadata_path, "r", encoding="utf-8") as f:
        try:
            books = yaml.safe_load(f)
        except Exception as e:
            print(f"Error parsing metadata YAML: {e}")
            sys.exit(1)

    if not isinstance(books, list) or len(books) == 0:
        print("Error: Metadata must be a non-empty list of books.")
        sys.exit(1)

    for book in books:
        if "title" not in book or "slug" not in book:
            print("Error: Every book must have a 'title' and 'slug'.")
            sys.exit(1)

        slug = book["slug"]
        cover_filename = book.get("cover_filename")
        cover_path = os.path.join(covers_dir, cover_filename) if cover_filename else None

        # Check if real cover exists
        if not cover_path or not os.path.exists(cover_path):
            # Fallback to placeholder
            placeholder_filename = f"{slug}__cover_placeholder.png"
            placeholder_path = os.path.join(covers_dir, placeholder_filename)
            if os.path.exists(placeholder_path):
                print(f"Info: Using placeholder for {book['title']}")
                book["cover_filename"] = placeholder_filename
            else:
                print(f"Warning: Neither cover nor placeholder found for {book['title']}")

    return books

def generate_covers_grid(books, covers_dir, out_dir):
    grid_path = os.path.join(out_dir, "covers-grid.png")
    csv_path = os.path.join(out_dir, "covers-grid-captions.csv")

    # Target size for each cover in the grid (using thumbnail aspect ratio)
    # Full size is 2000x3000, let's resize to 600x900 for the grid
    target_w, target_h = 600, 900

    # Layout: single row if <= 4, else 2 rows
    num_books = len(books)
    cols = num_books if num_books <= 4 else (num_books + 1) // 2
    rows = 1 if num_books <= 4 else 2

    grid_w = cols * target_w
    grid_h = rows * target_h

    grid_img = Image.new("RGB", (grid_w, grid_h), color=(255, 255, 255))

    captions = []

    for i, book in enumerate(books):
        cover_path = os.path.join(covers_dir, book.get("cover_filename", ""))

        # Draw image
        if os.path.exists(cover_path):
            try:
                img = Image.open(cover_path)
                # Auto-detect aspect ratio and crop/pad to consistent size (600x900) without distortion
                img_aspect = img.width / img.height
                target_aspect = target_w / target_h

                if img_aspect > target_aspect:
                    # Image is wider than target: scale by height, crop width
                    new_h = target_h
                    new_w = int(new_h * img_aspect)
                    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    left = (new_w - target_w) / 2
                    img = img.crop((left, 0, left + target_w, target_h))
                else:
                    # Image is taller than target: scale by width, crop height
                    new_w = target_w
                    new_h = int(new_w / img_aspect)
                    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    top = (new_h - target_h) / 2
                    img = img.crop((0, top, target_w, top + target_h))

                col = i % cols
                row = i // cols

                x = col * target_w
                y = row * target_h

                grid_img.paste(img, (x, y))
            except Exception as e:
                print(f"Error processing image {cover_path}: {e}")

        # Prepare caption
        title = book.get("title", "Unknown")
        year = book.get("original_publication_year", "TBD")
        if year is None:
            year = "TBD"
        caption = f"{title} ({year})"
        alt_text = f"Book cover for {title}, published in {year}"
        captions.append({"slug": book["slug"], "caption": caption, "alt_text": alt_text})

    # Save grid (~300 DPI equivalent for crispness depending on viewing, 4000px width is requested approx)
    # For 7 books, 4 cols = 2400px. Let's scale it up to ~4000px width.
    if grid_w < 4000:
        scale_factor = 4000 / grid_w
        new_w = int(grid_w * scale_factor)
        new_h = int(grid_h * scale_factor)
        grid_img = grid_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    grid_img.save(grid_path, dpi=(300, 300))
    print(f"Generated covers grid: {grid_path}")

    # Save captions CSV
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["slug", "caption", "alt_text"])
        writer.writeheader()
        writer.writerows(captions)
    print(f"Generated captions CSV: {csv_path}")

def generate_publication_timeline(books, out_dir):
    timeline_path = os.path.join(out_dir, "publication-timeline.svg")

    dates = []
    labels = []
    markers = []

    for book in books:
        pub_date = book.get("publication_date")
        if pub_date:
            dates.append(datetime.strptime(pub_date, "%Y-%m-%d"))
            labels.append(book["title"])
            markers.append("o")  # Solid node for released
        else:
            # Unreleased, put it slightly in the future or last date + 5 years
            last_date = dates[-1] if dates else datetime(2000, 1, 1)
            future_date = datetime(last_date.year + 5, 1, 1)
            dates.append(future_date)
            labels.append(f"{book['title']} (TBD)")
            markers.append("o")  # Will handle hollow separately

    fig, ax = plt.subplots(figsize=(12, 4))

    # Plot timeline line
    ax.plot(dates, [0]*len(dates), "-o", color="black", markerfacecolor="black")

    # Plot unreleased hollow nodes
    for i, book in enumerate(books):
        if not book.get("publication_date"):
            ax.plot(dates[i], 0, "o", color="black", markerfacecolor="white", markersize=10)

    # Annotate labels
    for i, (date, label) in enumerate(zip(dates, labels)):
        offset = 0.1 if i % 2 == 0 else -0.1
        valign = "bottom" if i % 2 == 0 else "top"
        ax.annotate(label, (date, 0), xytext=(0, offset*100), textcoords="offset points",
                    ha="center", va=valign, rotation=45 if i % 2 != 0 else 0)
        ax.plot([date, date], [0, offset], color="gray", linestyle="--", alpha=0.5)

    ax.set_yticks([])
    ax.spines["left"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["top"].set_visible(False)
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    plt.xticks(rotation=45)
    plt.title("A Song of Ice and Fire Publication Timeline")
    plt.tight_layout()
    plt.savefig(timeline_path, format="svg")
    plt.close()
    print(f"Generated publication timeline: {timeline_path}")

def generate_pagecount_chart(books, out_dir):
    chart_path = os.path.join(out_dir, "pagecounts.png")

    titles = []
    pages = []

    for book in books:
        titles.append(book["title"])
        pages.append(book.get("pages", 0))

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(titles, pages, color="skyblue", edgecolor="black")

    # Add labels on top
    for bar in bars:
        height = bar.get_height()
        ax.annotate(f"{height}",
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3),  # 3 points vertical offset
                    textcoords="offset points",
                    ha="center", va="bottom")

    plt.xticks(rotation=45, ha="right")
    plt.ylabel("Page Count")
    plt.title("Page Counts of A Song of Ice and Fire Books")
    plt.tight_layout()
    plt.savefig(chart_path, dpi=300)
    plt.close()
    print(f"Generated page-count chart: {chart_path}")

def generate_pov_network(books, out_dir, scripts_dir):
    pov_path = os.path.join(scripts_dir, "pov_list.yml")
    if not os.path.exists(pov_path):
        print("Info: pov_list.yml not found, skipping POV network generation.")
        return

    try:
        with open(pov_path, "r", encoding="utf-8") as f:
            pov_data = yaml.safe_load(f)

        G = nx.Graph()

        # Add book nodes
        book_titles = [book["title"] for book in books]
        for book_title in book_titles:
            G.add_node(book_title, type="book")

        # Add character nodes and edges
        for char, char_books in pov_data.items():
            G.add_node(char, type="character")
            for b in char_books:
                if b in book_titles:
                    G.add_edge(char, b)

        # Compute node sizes based on degree
        degrees = dict(G.degree())
        node_sizes = [degrees[n] * 300 for n in G.nodes()]

        # Color nodes by type
        node_colors = ["skyblue" if G.nodes[n]["type"] == "book" else "lightgreen" for n in G.nodes()]

        plt.figure(figsize=(12, 12))
        pos = nx.spring_layout(G, k=0.5, seed=42)
        nx.draw_networkx_nodes(G, pos, node_size=node_sizes, node_color=node_colors, alpha=0.8)
        nx.draw_networkx_edges(G, pos, alpha=0.5)

        # Labels
        labels = {n: n for n in G.nodes()}
        nx.draw_networkx_labels(G, pos, labels, font_size=8)

        plt.title("POV Characters and Books Network")
        plt.axis("off")

        network_path = os.path.join(out_dir, "pov-network.png")
        plt.savefig(network_path, dpi=300, bbox_inches="tight")
        plt.close()
        print(f"Generated POV network: {network_path}")

    except Exception as e:
        print(f"Warning: Failed to generate POV network: {e}")

def generate_interactive_timeline(books, out_dir):
    html_path = os.path.join(out_dir, "interactive-timeline.html")

    books_json = json.dumps(books)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Timeline</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {{ font-family: sans-serif; margin: 20px; }}
        #timeline {{ width: 100%; height: 300px; overflow-x: auto; }}
        .node {{ cursor: pointer; }}
        .tooltip {{
            position: absolute; text-align: left; width: 250px;
            padding: 10px; font: 12px sans-serif; background: lightsteelblue;
            border: 0px; border-radius: 8px; pointer-events: none; opacity: 0;
        }}
        .tooltip img {{ width: 100%; height: auto; }}
    </style>
</head>
<body>
    <h2>Interactive Book Timeline</h2>
    <div id="timeline"></div>
    <div id="tooltip" class="tooltip"></div>

    <script>
        const books = {books_json};

        const width = 1000;
        const height = 200;
        const margin = {{top: 20, right: 20, bottom: 20, left: 50}};

        const svg = d3.select("#timeline").append("svg")
            .attr("width", width)
            .attr("height", height);

        // Filter out unreleased for timeline scale
        const releasedBooks = books.filter(d => d.publication_date);

        const parseTime = d3.timeParse("%Y-%m-%d");
        releasedBooks.forEach(d => {{
            d.date = parseTime(d.publication_date);
        }});

        // Let's just use a simple linear scale based on year for unreleased
        const dates = releasedBooks.map(d => d.date);
        const minDate = d3.min(dates);
        const maxDate = new Date(d3.max(dates).getFullYear() + 5, 0, 1);

        books.forEach(d => {{
            if (!d.publication_date) {{
                d.date = new Date(maxDate.getFullYear() + (books.indexOf(d) * 2), 0, 1);
            }}
        }});

        const x = d3.scaleTime()
            .domain([minDate, d3.max(books.map(d => d.date))])
            .range([margin.left, width - margin.right]);

        svg.append("g")
            .attr("transform", `translate(0,${{height / 2}})`)
            .call(d3.axisBottom(x));

        const tooltip = d3.select("#tooltip");

        svg.selectAll("circle")
            .data(books)
            .enter().append("circle")
            .attr("class", "node")
            .attr("cx", d => x(d.date))
            .attr("cy", height / 2)
            .attr("r", 8)
            .style("fill", d => d.publication_date ? "steelblue" : "white")
            .style("stroke", "steelblue")
            .style("stroke-width", 2)
            .on("mouseover", function(event, d) {{
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`
                    <strong>${{d.title}}</strong><br/>
                    Pages: ${{d.pages}}<br/>
                    Year: ${{d.original_publication_year || 'TBD'}}<br/>
                    License: ${{d.license}}<br/>
                    <img src="../archive/books/book-covers/thumbnails/${{d.cover_filename}}" alt="${{d.title}} cover">
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            }})
            .on("mouseout", function(d) {{
                tooltip.transition().duration(500).style("opacity", 0);
            }});
    </script>
</body>
</html>"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Generated interactive timeline: {html_path}")

def generate_index_json(books, metadata_path):
    # archive/books/index.json
    base_dir = os.path.dirname(os.path.dirname(metadata_path))
    index_path = os.path.join(base_dir, "index.json")

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(books, f, indent=2)
    print(f"Generated index JSON: {index_path}")

def perform_unit_checks(books, covers_dir, out_dir):
    print("\nRunning unit checks...")
    success = True

    # Check metadata validity
    if not books:
        print("✗ Metadata is empty.")
        success = False
    else:
        print("✓ Metadata loaded.")

    # Check image existence
    for book in books:
        cover_path = os.path.join(covers_dir, book.get("cover_filename", ""))
        if not os.path.exists(cover_path):
            print(f"✗ Cover image missing for {book['title']}: {cover_path}")
            success = False

    # Check output creation
    expected_outputs = [
        "covers-grid.png",
        "covers-grid-captions.csv",
        "publication-timeline.svg",
        "pagecounts.png",
    ]

    for f in expected_outputs:
        if not os.path.exists(os.path.join(out_dir, f)):
            print(f"✗ Missing expected output: {f}")
            success = False
        else:
            print(f"✓ Output exists: {f}")

    if success:
        print("All checks passed successfully.\n")
    else:
        print("Some checks failed.\n")

def main():
    parser = argparse.ArgumentParser(description="Generate book graphics and galleries.")
    parser.add_argument("--metadata", required=True, help="Path to books_metadata.yml")
    parser.add_argument("--out", required=True, help="Output directory for graphs")
    args = parser.parse_args()

    metadata_path = args.metadata
    out_dir = args.out

    # Assume covers dir is relative to metadata path
    base_dir = os.path.dirname(os.path.dirname(metadata_path))
    covers_dir = os.path.join(base_dir, "book-covers")

    os.makedirs(out_dir, exist_ok=True)

    scripts_dir = os.path.dirname(os.path.abspath(__file__))

    books = load_and_validate_metadata(metadata_path, covers_dir)
    generate_covers_grid(books, covers_dir, out_dir)
    generate_publication_timeline(books, out_dir)
    generate_pagecount_chart(books, out_dir)
    generate_pov_network(books, out_dir, scripts_dir)
    generate_interactive_timeline(books, out_dir)
    generate_index_json(books, metadata_path)

    perform_unit_checks(books, covers_dir, out_dir)

if __name__ == "__main__":
    main()
