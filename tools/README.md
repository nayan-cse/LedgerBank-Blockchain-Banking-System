# Optional report generation

Normal application setup and evaluation need Node.js only. The PDF generator is optional Python tooling:

```sh
python -m pip install reportlab matplotlib
python tools/build_report.py
```

It reads the actual results in `evidence/` and writes `docs/Assignment_3_Report.pdf`. Edit the cover's identity fields in the script before regeneration if desired. The supplied report uses 14 pages; recheck the page count and every page after changes.

The generator expects DejaVu Sans, DejaVu Sans Bold and DejaVu Sans Mono in `/usr/share/fonts/truetype/dejavu`. On Windows, set its `FONT` path to a directory containing those `.ttf` files. PDF rendering can be checked with Poppler (`pdftoppm`). These dependencies are unrelated to the banking application itself.

Charts use the recorded operation trials, three-run TPS comparisons and scoped process CPU/RSS measurements. They are not mock data or public-network estimates. Re-running performance tests does not update the PDF until you run this script.
