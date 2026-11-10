#!/usr/bin/env python3
"""Render the four BrokerIQ A4 manuals from bilingual copy and release-matched captures."""
import argparse
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/production/manuals'
W, H = A4
MARGIN = 44
CONTENT = W - 2 * MARGIN
INK = '#171739'
INDIGO = '#4237BD'
SLATE = '#4C5571'
LAVENDER = '#F0EFFA'
ORANGE = '#F88842'
WHITE = '#FFFFFF'


def copy(text, language):
    return text[language]


def paragraph(canvas, value, x, top, width, size, color=INK, bold=False):
    style = ParagraphStyle(
        'guide', fontName='GuideBold' if bold else 'Guide', fontSize=size,
        leading=size * 1.43, textColor=colors.HexColor(color), shaping=True,
    )
    content = Paragraph(escape(value), style)
    _, height = content.wrap(width, H)
    content.drawOn(canvas, x, top - height)
    return top - height


def picture(canvas, image, x, top, width, height, markers=()):
    asset = ImageReader(str(image))
    actual_w, actual_h = asset.getSize()
    scale = min(width / actual_w, height / actual_h)
    fitted_w, fitted_h = actual_w * scale, actual_h * scale
    left = x + (width - fitted_w) / 2
    canvas.drawImage(asset, left, top - fitted_h, fitted_w, fitted_h, mask='auto')
    for marker in markers:
        mx, my, step = marker['x'], marker['y'], marker['step']
        if not (0 <= mx <= 1 and 0 <= my <= 1 and isinstance(step, int) and 1 <= step <= 9):
            raise ValueError('Invalid screenshot annotation')
        cx, cy = left + fitted_w * mx, top - fitted_h * my
        canvas.setFillColor(colors.HexColor(INDIGO))
        canvas.setStrokeColor(colors.HexColor(WHITE))
        canvas.circle(cx, cy, 9, fill=1, stroke=1)
        paragraph(canvas, str(step), cx - 3, cy + 6, 12, 8, WHITE, True)
    return top - fitted_h


def asset_for(capture_manifest, role, chapter, commit):
    item = capture_manifest.get(f'{role}/{chapter}')
    if not item:
        return None
    path = Path(item['path'])
    if item['commit'] != commit or item.get('privateDataMasked') is not True:
        raise ValueError(f'Capture identity or privacy review mismatch for {role}/{chapter}')
    if hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        raise ValueError(f'Capture checksum mismatch for {role}/{chapter}')
    return path, item


def footer(canvas, page, build):
    canvas.setStrokeColor(colors.HexColor('#DAD9EA'))
    canvas.line(MARGIN, 43, W - MARGIN, 43)
    paragraph(canvas, f'BrokerIQ  /  Build {build}', MARGIN, 36, 300, 9, SLATE)
    paragraph(canvas, f'{page:02d}', W - 63, 36, 30, 9, INDIGO, True)


def make_guide(data, language, release, captures, output, draft):
    title = copy(data['title'], language)
    role = data['role']
    commit = release['portals']['commit']
    build = release['android']['versionCode']
    version = release['android']['version']
    preview = 'STAGING GUIDE PREVIEW' if language == 'en' else 'स्टेजिंग गाइड का पूर्वावलोकन'
    edition = preview if draft else ('USER GUIDE' if language == 'en' else 'उपयोगकर्ता गाइड')
    canvas = Canvas(str(output), pagesize=A4, pageCompression=1)
    canvas.setTitle(f'BrokerIQ | {title}')
    canvas.setAuthor('BrokerIQ')
    canvas.setFillColor(colors.HexColor(INK))
    canvas.rect(0, 220, W, H - 220, fill=1, stroke=0)
    picture(canvas, ROOT / 'apps/mobile/assets/icon.png', MARGIN, H - 52, 62, 62)
    paragraph(canvas, 'BrokerIQ', MARGIN + 76, H - 57, 310, 22, WHITE, True)
    paragraph(canvas, edition, MARGIN + 78, H - 91, 370, 11, '#D7D3F8', True)
    canvas.setFillColor(colors.HexColor(ORANGE))
    canvas.rect(MARGIN, H - 180, 47, 4, fill=1, stroke=0)
    y = paragraph(canvas, title, MARGIN, H - 206, CONTENT, 38, WHITE, True)
    y = paragraph(canvas, copy(data['subtitle'], language), MARGIN, y - 19, CONTENT, 19, '#D7D3F8')
    paragraph(canvas, f'v{version}   /   Android {build}   /   {commit[:12]}', MARGIN, y - 35, CONTENT, 13, WHITE, True)
    if draft:
        note = 'Preview copy for workflow review. Release-matched screenshots and installed-device acceptance are tracked separately.'
        if language == 'hi':
            note = 'कार्यप्रवाह की समीक्षा के लिए पूर्वावलोकन। रिलीज़ से मेल खाते screenshots और फ़ोन पर सत्यापन अलग से दर्ज होंगे।'
        paragraph(canvas, note, MARGIN, 180, CONTENT, 13, SLATE)
    footer(canvas, 1, build)
    canvas.showPage()

    contents = 'Contents' if language == 'en' else 'विषय-सूची'
    paragraph(canvas, contents, MARGIN, H - 64, CONTENT, 32, INK, True)
    y = H - 144
    contents_items = list(data['chapters'])
    if role == 'broker':
        contents_items.append({'id': 'android-reference', 'title': {'en': 'Android screenshot reference', 'hi': 'Android स्क्रीनशॉट संदर्भ'}})
    for index, chapter in enumerate(contents_items, 1):
        canvas.setFillColor(colors.HexColor(LAVENDER))
        canvas.roundRect(MARGIN, y - 43, CONTENT, 41, 10, fill=1, stroke=0)
        paragraph(canvas, f'{index:02d}', MARGIN + 14, y - 11, 31, 12, INDIGO, True)
        paragraph(canvas, copy(chapter['title'], language), MARGIN + 49, y - 10, CONTENT - 99, 13, INK, True)
        paragraph(canvas, str(index + 2), W - MARGIN - 30, y - 11, 20, 12, INDIGO, True)
        canvas.linkRect('', chapter['id'], (MARGIN, y - 43, W - MARGIN, y - 2), relative=0, thickness=0)
        y -= 52
    footer(canvas, 2, build)
    canvas.showPage()

    for index, chapter in enumerate(data['chapters'], 1):
        canvas.bookmarkPage(chapter['id'])
        canvas.addOutlineEntry(copy(chapter['title'], language), chapter['id'])
        paragraph(canvas, f'{index:02d}   /   {edition}', MARGIN, H - 48, CONTENT, 10, INDIGO, True)
        y = paragraph(canvas, copy(chapter['title'], language), MARGIN, H - 78, CONTENT, 27, INK, True)
        y = paragraph(canvas, copy(chapter['summary'], language), MARGIN, y - 12, CONTENT, 13, SLATE) - 15
        shot = asset_for(captures, role, chapter['id'], commit)
        if shot:
            image, metadata = shot
            y = picture(canvas, image, MARGIN, y, CONTENT, 236, metadata.get('markers', ()))
            label = f"{metadata['surface']}  /  Build {build}  /  {metadata['capturedAtIst']}"
            y = paragraph(canvas, label, MARGIN, y - 6, CONTENT, 8, SLATE) - 16
        elif not draft:
            raise ValueError(f'Missing reviewed screenshot for {role}/{chapter["id"]}')
        for number, step in enumerate(chapter['steps'], 1):
            canvas.setFillColor(colors.HexColor(INDIGO))
            canvas.circle(MARGIN + 11, y - 10, 10, fill=1, stroke=0)
            paragraph(canvas, str(number), MARGIN + 8, y - 4, 13, 8, WHITE, True)
            y = paragraph(canvas, copy(step, language), MARGIN + 34, y, CONTENT - 34, 12, INK) - 13
        tip = copy(chapter['tip'], language)
        tip_style = ParagraphStyle('tip', fontName='Guide', fontSize=11, leading=16, textColor=colors.HexColor(INDIGO), shaping=True)
        tip_box = Paragraph(escape(tip), tip_style)
        _, tip_height = tip_box.wrap(CONTENT - 28, H)
        y -= 4
        if y - tip_height - 30 < 63:
            raise ValueError(f'Page overflow for {role}/{language}/{chapter["id"]}')
        canvas.setFillColor(colors.HexColor(LAVENDER))
        canvas.roundRect(MARGIN, y - tip_height - 24, CONTENT, tip_height + 24, 10, fill=1, stroke=0)
        tip_box.drawOn(canvas, MARGIN + 14, y - tip_height - 12)
        footer(canvas, index + 2, build)
        canvas.showPage()
    if role == 'broker':
        canvas.bookmarkPage('android-reference')
        title = 'Android screenshot reference' if language == 'en' else 'Android स्क्रीनशॉट संदर्भ'
        canvas.addOutlineEntry(title, 'android-reference')
        y = paragraph(canvas, title, MARGIN, H - 64, CONTENT, 27, INK, True)
        android_screens = [('access', 'Today’s Focus'), ('inventory', 'Inventory'), ('leads', 'Leads')]
        reviewed = [asset_for(captures, role, f'android/{key}', commit) for key, _ in android_screens]
        if any(reviewed) and not all(reviewed):
            raise ValueError('The Android reference requires all three reviewed screenshots')
        if all(reviewed):
            note = 'Captured on an isolated Android emulator from this edition’s source, using a QA build.'
            if language == 'hi':
                note = 'ये स्क्रीनशॉट इसी संस्करण के सोर्स से बने QA build में, अलग Android emulator पर लिए गए हैं।'
        else:
            note = ('These archived Android captures show the build noted below each screen. '
                    'Follow the steps in this edition for the current interface.')
            if language == 'hi':
                note = 'ये Android स्क्रीनशॉट पुराने builds से हैं। हर स्क्रीन के नीचे उसका build है। वर्तमान इंटरफ़ेस के लिए इस गाइड के निर्देश पढ़ें।'
        y = paragraph(canvas, note, MARGIN, y - 13, CONTENT, 12, SLATE) - 22
        product = ROOT / 'apps/web/public/product'
        if all(reviewed):
            screens = [(shot[0], f'{label} / Build {build} UI') for (_, label), shot in zip(android_screens, reviewed)]
        else:
            screens = [
                (product / 'android-workspace-build23-public.png', 'Today’s Focus / Build 23'),
                (product / 'android-inventory-build24-public.png', 'Inventory / Build 24'),
                (product / 'android-capture-build24.png', 'Scanner & import / Build 24'),
            ]
        for index, (image, caption) in enumerate(screens):
            width = (CONTENT - 24) / 3
            left = MARGIN + index * (width + 12)
            bottom = picture(canvas, image, left, y, width, 365)
            paragraph(canvas, caption, left, bottom - 8, width, 10, SLATE)
        footer(canvas, len(data['chapters']) + 3, build)
        canvas.showPage()
    canvas.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--release', required=True, type=Path)
    parser.add_argument('--captures', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--draft', action='store_true')
    args = parser.parse_args()
    release = json.loads(args.release.read_text())
    if release['portals']['commit'] != release['android']['commit']:
        raise ValueError('Release commit does not match Android artifact')
    captures = json.loads(args.captures.read_text()) if args.captures else {}
    fonts = ROOT / 'apps/api/assets/fonts'
    pdfmetrics.registerFont(TTFont('Guide', str(fonts / 'BrokerIQSans-Regular.ttf')))
    pdfmetrics.registerFont(TTFont('GuideBold', str(fonts / 'BrokerIQSans-Bold.ttf')))
    args.output.mkdir(parents=True, exist_ok=True)
    for role in ('broker', 'super-admin'):
        data = json.loads((SOURCE / f'{role}.json').read_text())
        for language in ('en', 'hi'):
            suffix = '-preview' if args.draft else ''
            destination = args.output / f'BrokerIQ-{role}-{language}{suffix}.pdf'
            make_guide(data, language, release, captures, destination, args.draft)
            print(destination)


if __name__ == '__main__':
    main()
