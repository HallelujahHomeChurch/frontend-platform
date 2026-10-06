"""Build-time only: record full licensed-font cmap, not a sample-specific subset."""
import hashlib
import json
from pathlib import Path
import sys

from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
directory = root / "packages/ui/src/bulletin-reader"
if "--v2" in sys.argv[2:]:
    directory /= "v2"
assets = json.loads((directory / "template-assets.json").read_text())
coverage = {}
for asset in assets:
    if asset["kind"] != "font":
        continue
    path = Path(sys.argv[1]) / Path(asset["url"]).name
    if hashlib.sha256(path.read_bytes()).hexdigest() != asset["sha256"]:
        raise ValueError("asset_checksum")
    points = sorted(TTFont(path).getBestCmap())
    ranges = []
    for point in points:
        if ranges and point == ranges[-1][1] + 1:
            ranges[-1][1] = point
        else:
            ranges.append([point, point])
    coverage[asset["sha256"]] = ranges
(directory / "font-coverage.json").write_text(json.dumps(coverage, separators=(",", ":")) + "\n")
