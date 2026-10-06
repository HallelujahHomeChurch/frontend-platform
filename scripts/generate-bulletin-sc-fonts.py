"""Build-time V2 Noto Serif SC static regular/bold; retain the pinned OFL license."""
import hashlib
import io
import json
from pathlib import Path
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SOURCE_URL = "https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
SOURCE_SHA = "050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9"
source = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(source).hexdigest() == SOURCE_SHA, "source_hash_mismatch"
directory = Path(sys.argv[2])
directory.mkdir(parents=True, exist_ok=True)
for weight, style in [(400, "Regular"), (700, "Bold")]:
    font = instantiateVariableFont(TTFont(io.BytesIO(source), recalcTimestamp=False), {"wght": weight}, inplace=True)
    assert "fvar" not in font and font["OS/2"].usWeightClass == weight
    for identifier, name in [(1, "HHC Weekly Serif SC"), (2, style), (4, f"HHC Weekly Serif SC {style}"), (6, f"HHCWeeklySerifSC-{style}")]:
        font["name"].removeNames(nameID=identifier)
        font["name"].setName(name, identifier, 3, 1, 0x409)
    font.flavor = "woff2"
    output = io.BytesIO()
    font.save(output)
    data = output.getvalue()
    digest = hashlib.sha256(data).hexdigest()
    filename = f"body-sc-{weight}-{digest}.woff2"
    (directory / filename).write_bytes(data)
    print(json.dumps({"url": f"/assets/weekly/v2/{filename}", "sha256": digest, "sizeBytes": len(data), "weight": weight, "sourceUrl": SOURCE_URL, "sourceSha256": SOURCE_SHA}))
