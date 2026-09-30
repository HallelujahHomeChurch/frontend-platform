"""Local-only typography corpus generator; never persist original words/images.

This is a renderer geometry fixture, not the production component extractor.
The visually reviewed 464pt back-cover boundary applies to 1739/1740 only.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path


def sanitize_character(character):
    text = character['text']
    if text.isspace():
        return ' '
    if text.isascii() and text.isdigit():
        return '0'
    ratio = abs(character['adv']) / character['size']
    if text.isascii():
        return 'i' if ratio < .4 else 'a' if ratio < .7 else 'W'
    return '測' if ratio >= .7 else '.'


def font_role(name):
    # Undefined is visually confirmed emphasis in these two fixtures only.
    if 'DFXingShu' in name or 'DFGirl' in name or 'Undefined' in name:
        return 'emphasis'
    if 'DFKai' in name:
        return 'scripture'
    return 'body'


def source_tracking(chars):
    if len(chars) < 2:
        return 0
    gap = chars[-1]['x1'] - chars[0]['x0'] - sum(c['x1'] - c['x0'] for c in chars)
    return round(gap / (len(chars) - 1) / chars[0]['size'], 6)


def generate(source, issue, output):
    import pdfplumber  # Existing bundled tool; no production dependency.
    root = Path(__file__).resolve().parent.parent
    assets = json.loads((root / 'packages/ui/src/bulletin-reader/template-assets.json').read_text())
    font_assets = [{'url': a['url'], 'sha256': a['sha256'], 'kind': 'font', 'fontRole': a['roles'][0]} for a in assets if a['kind'] == 'font']
    pages, layouts, cover, body, hymns, back = [], [], [], [], [], []
    with pdfplumber.open(source) as pdf:
        expected = {1739: 12, 1740: 16}[issue]
        if len(pdf.pages) != expected:
            raise ValueError('source_page_count')
        for index, page in enumerate(pdf.pages):
            page_id = f'page-{index + 1}'
            pages.append({'id': page_id, 'width': page.width, 'height': page.height})
            layout = {'pageId': page_id, 'slots': []}
            layouts.append(layout)
            words = page.extract_words(return_chars=True, keep_blank_chars=True, extra_attrs=['size'])
            lines = defaultdict(list)
            for word in words:
                chars = [c for c in word['chars'] if c['upright'] and not (c['text'].isspace() and c['size'] < 6)]
                if not chars:
                    continue
                column = int(word['x0'] >= page.width / 2) if index == expected - 2 else 0
                key = (column, round(chars[0]['matrix'][5], 1), round(chars[0]['size'], 2))
                lines[key].extend(chars)
            words = []
            for chars in lines.values():
                chars.sort(key=lambda c: c['x0'])
                words.append({'x0': min(c['x0'] for c in chars), 'x1': max(c['x1'] for c in chars), 'top': min(c['top'] for c in chars), 'chars': chars})
            column_right = {}
            for word in words:
                if index == expected - 1 and word['top'] >= 464:
                    continue
                column = int(word['x0'] >= page.width / 2) if index == expected - 2 else 0
                column_right[column] = max(column_right.get(column, 0), word['x1'])
            words.sort(key=lambda word: (round(word['top'], 1), word['x0']))
            for ordinal, word in enumerate(words):
                if index == expected - 1 and word['top'] >= 464:
                    continue  # Exclude before creating synthetic persisted content.
                chars = [c for c in word['chars'] if c['upright']]
                if not chars or all(c['text'].isspace() for c in chars):
                    continue
                size = chars[0]['size']
                if size < 6 or size > 96:
                    raise ValueError('unsupported_source_size')
                spans = []
                for char in chars:
                    role, text = font_role(char['fontname']), sanitize_character(char)
                    if spans and spans[-1]['fontRole'] == role:
                        spans[-1]['text'] += text
                    else:
                        spans.append({'text': text, 'fontRole': role})
                identifier = f'p{index + 1}-w{ordinal}'
                line_height = round(size * 1.5, 3)
                tracking = source_tracking(chars)
                if not -.5 <= tracking <= 1:
                    raise ValueError('unsupported_source_tracking')
                block = {'id': f'b-{identifier}', 'style': {'fontSize': round(size, 3), 'lineHeight': line_height, 'letterSpacing': tracking, 'indent': 0, 'firstLineIndent': 0, 'spaceBefore': 0, 'spaceAfter': 0}, 'sentences': [{'id': f's-{identifier}', 'spans': spans}]}
                # Preserve the PDF baseline at the substitute font's declared em.
                top = page.height - chars[0]['matrix'][5] - size * 1.13
                x = max(0, word['x0'])
                column = int(x >= page.width / 2) if index == expected - 2 else 0
                # Glyph bounds are not paragraph allocations. Use the observed
                # source column edge; do not shrink fonts to a glyph-only box.
                width = min(page.width - x, column_right[column] - x + 2)
                box = {'x': x / page.width, 'y': max(0, top) / page.height, 'width': width / page.width, 'height': min(page.height - max(0, top), line_height) / page.height}
                group = cover if index == 0 else hymns if index == expected - 2 else back if index == expected - 1 else body
                group.append(block)
                component = 'cover' if group is cover else 'hymns' if group is hymns else 'summary' if group is back else 'body'
                layout['slots'].append({'id': f'slot-{identifier}', 'componentId': component, 'blockId': block['id'], 'box': box, 'fragments': [{'sentenceId': f's-{identifier}', 'start': 0, 'end': sum(len(s['text']) for s in spans)}]})
    if min(map(len, [cover, body, hymns, back])) < 5:
        raise ValueError('incomplete_source_regions')
    item = lambda name, blocks: {'id': name, 'blocks': blocks}
    # All source text is represented; semantic extraction belongs to Task 6.
    components = [
        {'id': 'cover', 'type': 'cover', 'cover': {'welcome': cover[:1], 'worship': [item('worship', cover[1:2])], 'work': [item('work', cover[2:3])], 'wordQuestions': [item('word', cover[3:4])], 'weeklyVerses': cover[4:]}},
        {'id': 'body', 'type': 'bodySection', 'bodySection': {'kind': 'sermon', 'title': body[0], 'blocks': body[1:]}},
        {'id': 'hymns', 'type': 'hymnLyrics', 'hymnLyrics': {'hymns': [{'id': 'hymn', 'title': hymns[0], 'sections': [{'id': 'verse', 'kind': 'verse', 'lines': hymns[1:]}]}]}},
        {'id': 'summary', 'type': 'backSummary', 'items': [item('summary-item', back)]},
        {'id': 'announcements', 'type': 'announcements', 'items': []},
        {'id': 'prayers', 'type': 'victoriesAndPrayers', 'items': []},
    ]
    document = {'issueId': '00000000-0000-4000-8000-000000000001', 'series': 'general', 'contentLocale': 'zh-Hant', 'schemaVersion': '1', 'templateVersion': 'v1', 'sourceAssetChecksum': hashlib.sha256(source.read_bytes()).hexdigest(), 'sourcePageCount': expected, 'pages': pages, 'components': components, 'layoutManifest': {'templateVersion': 'v1', 'rendererVersion': 'v1', 'rendererArtifactSha256': '0' * 64, 'assets': font_assets, 'pages': layouts}}
    corpus = {'document': document, 'canonicalMetadata': {'title': '測' * 12, 'subtitle': '測' * 15, 'date': '2026-09-20', 'issueNumber': issue}}
    output.mkdir(parents=True, exist_ok=True)
    (output / f'{issue}-typography.json').write_text(json.dumps(corpus, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'issue': issue, 'pages': expected, 'blocks': sum(map(len, [cover, body, hymns, back]))}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('issue', type=int, choices=[1739, 1740])
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    generate(args.source, args.issue, args.output)
