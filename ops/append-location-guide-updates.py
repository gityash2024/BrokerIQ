#!/usr/bin/env python3
"""Append reviewed Build 62 instructions without relabelling archived screenshots."""
import argparse
import io
import json
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
W, H = A4
TEXT = {'en': [('Build 62 - location and source review',
         'Updated instructions, 14 November 2026. Earlier screenshots retain their original capture dates and build labels.'),
        ('During an active shift',
         'BrokerIQ requests a location checkpoint about every ten minutes. Background permission and a visible tracking '
         'notification are required on Android. Manual pause, punch-out and logout stop tracking. Battery restrictions, GPS or '
         'network loss can delay delivery; a screen refresh cannot create a missing fix.'),
        ('Review team location history',
         'Broker Admin: open Team & Agents, then Time Logging and choose the permitted member and IST date. Super Admin: choose '
         'the firm or all firms, then explicitly select a member. Web history refreshes automatically; mobile history also '
         'reloads when reopened or brought to the foreground. Check the original capture time and accuracy. An old point is '
         'recorded history, not a new live location.'),
        ('Review AI property proposals',
         'Read every proposed property against its original message or photo. A client requirement and an available property are '
         'different record types. Premium, book value, a per-area rate and the total sale price are different quotes. Missing '
         'units or uncertain amounts require review. A long post can take longer to process; an interrupted partial '
         'extraction must not be treated as complete.'),
        ('Free AI and safe upgrades',
         'OpenRouter calls use free models and zero-price endpoints. Availability and model quality are separate checks; a '
         'rate-limited provider follows the configured fallback. Review drafts before conversion, publication or sending a '
         'message. Upgrade the existing app through the landing download; check Build 62, version, time and checksum. Keep app '
         'data. The physical-device and SMS reply checks are separate acceptance steps.')],
 'hi': [('Build 62 - location और source review',
         'अद्यतन: 14 नवंबर 2026। पुराने screenshots की मूल capture dates और build labels सुरक्षित हैं।'),
        ('Active shift के दौरान',
         'BrokerIQ लगभग हर दस मिनट में location checkpoint माँगता है। Android पर background permission और दिखाई देने वाली '
         'tracking notification ज़रूरी हैं। Manual pause, punch-out और logout से tracking रुकती है। Battery restriction, GPS या '
         'network की समस्या से delivery देर से हो सकती है; screen refresh से नया GPS fix नहीं बनता।'),
        ('Team की location history देखें',
         'Broker Admin: Team & Agents में Time Logging खोलकर अधिकृत member और IST date चुनें। Super Admin: firm या all firms '
         'चुनकर member स्वयं select करें। Web history अपने आप refresh होती है; mobile पर screen खोलने और app foreground में आने '
         'पर भी दोबारा load होती है। मूल capture time और accuracy देखें। पुराना point recorded history है, नई live location '
         'नहीं।'),
        ('AI की property proposals जाँचें',
         'हर proposal को मूल message या photo से मिलाएँ। Client requirement और उपलब्ध property अलग प्रकार के records हैं। '
         'Premium, book value, per-area rate और total sale price अलग quotes हैं। Unit या amount अस्पष्ट हो तो review करें। लंबी '
         'post में कई सीमित requests लग सकती हैं; बीच में रुका extraction पूरा नहीं माना जाता।'),
        ('Free AI और सुरक्षित app update',
         'OpenRouter calls केवल free models और शून्य कीमत वाले endpoints पर जाती हैं। Provider availability और model quality अलग '
         'जाँची जाती हैं। Rate limit पर configured fallback चलता है। Conversion, publication या message भेजने से पहले draft '
         'जाँचें। Landing से मौजूदा app upgrade करें; Build 62, version, time और checksum मिलाएँ। App data रखें। Physical-device '
         'और SMS reply की acceptance जाँच अलग है।')]}

def make_page(language):
    stream = io.BytesIO()
    c = Canvas(stream, pagesize=A4)
    c.setFillColor(colors.HexColor('#4237BD'))
    c.rect(0, H - 12, W, 12, fill=1, stroke=0)
    y = H - 52
    for index, (title, body) in enumerate(TEXT[language]):
        for value, size, bold in [(title, 23 if index == 0 else 13, True), (body, 10.5, False)]:
            style = ParagraphStyle('update', fontName='GuideBold' if bold else 'Guide', fontSize=size,
                                   leading=size * 1.42, shaping=True, textColor=colors.HexColor('#171739' if bold else '#4C5571'))
            p = Paragraph(escape(value), style)
            _, height = p.wrap(W - 88, H)
            if y - height < 48:
                raise ValueError('Guide supplement overflows')
            p.drawOn(c, 44, y - height)
            y -= height + (8 if bold else 17)
    c.setFont('Guide', 8)
    c.drawString(44, 26, 'BrokerIQ / Build 62 update / 14 Nov 2026')
    c.save()
    return stream.getvalue()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-dir', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    for name, filename in [('Guide', 'BrokerIQSans-Regular.ttf'), ('GuideBold', 'BrokerIQSans-Bold.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(ROOT / 'apps/api/assets/fonts' / filename)))
    args.output.mkdir(parents=True, exist_ok=True)
    report = []
    for role in ['broker', 'super-admin']:
        for language in ['en', 'hi']:
            name = f'BrokerIQ-{role}-{language}.pdf'
            base = PdfReader(args.base_dir / name)
            writer = PdfWriter()
            writer.append(base)
            writer.append(PdfReader(io.BytesIO(make_page(language))), outline_item='Build 62 workflow update')
            writer.add_metadata({'/Title': f'BrokerIQ {role} guide - {language} - Build 62 update'})
            writer.write(args.output / name)
            report.append({'file': name, 'originalPages': len(base.pages), 'pages': len(writer.pages), 'supplementBuild': 62})
    print(json.dumps(report))

if __name__ == '__main__':
    main()
