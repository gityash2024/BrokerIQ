#!/usr/bin/env python3
"""Append reviewed Build 61 instructions without relabelling archived screenshots."""
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
TEXT = {
    'en': [
        ('Build 61 - workflow update', 'Updated instructions, 13 November 2026. The earlier chapters retain their original screenshot dates and build labels.'),
        ('Property and profile photographs', 'Open Inventory, choose an authorized property and find Property photographs. Select Add property photo, choose an image and wait for the saved result. Open it to check the image. The record supports up to 50 photos. If another person changed it, reload before saving again. Agents work within their own or assigned records; administrators retain their permitted firm scope. Change your account photo through Edit Profile; the account photo and property photos are separate.'),
        ('Share a property with a lead', 'Open Prepare property message and choose Client Sharing Pitch. Search for the CRM lead and select WhatsApp, Email or SMS. Select Include property photo links to include saved photos. Open the internal Inbox, review the draft and its links, then send only when ready. These are image links, not an automatic attachment on every channel. Add new photographs to the property first so they remain available for future prospects. A missing integration must be configured before sending.'),
        ('Landing preferences and guides', 'The landing header includes Language and Toggle theme on desktop and narrow mobile screens. Choose Hindi or English and a light or dark theme. Your saved preference remains after reload. Use User guides for all four manuals. Download the APK through the Android card and check its build, timestamp and SHA-256 before upgrading the existing app.'),
        ('AI and provider status', 'OpenRouter requests are restricted to free models and zero-price endpoints. A busy or incompatible provider falls through the configured fallback chain; it must not silently use paid credits. Photo extraction requires an approved model and explicit source review. ZIP photo proposals remain separate from message captions. Never treat an unavailable provider, partial answer or unapproved quality test as completed extraction. Gmail production scope approval and physical-device acceptance have separate verification states.'),
    ],
    'hi': [
        ('Build 61 - नए निर्देश', 'अद्यतन: 13 नवंबर 2026। पहले अध्यायों में स्क्रीनशॉट की मूल तारीख और build labels सुरक्षित रखे गए हैं।'),
        ('प्रॉपर्टी और प्रोफ़ाइल की तस्वीरें', 'Inventory में अधिकृत प्रॉपर्टी खोलें। Property photographs में Add property photo चुनें, तस्वीर चुनें और सेव होने दें। तस्वीर खोलकर जाँचें। एक रिकॉर्ड में अधिकतम 50 तस्वीरें हैं। किसी अन्य व्यक्ति ने रिकॉर्ड बदला हो तो दोबारा लोड करके सेव करें। Agent अपनी या assigned प्रॉपर्टी पर और Admin अपनी अधिकृत firm में काम करता है। खाते की तस्वीर Edit Profile से बदलें; वह प्रॉपर्टी की तस्वीरों से अलग है।'),
        ('लीड को प्रॉपर्टी भेजें', 'Prepare property message खोलकर Client Sharing Pitch चुनें। CRM lead खोजें और WhatsApp, Email या SMS चुनें। सेव तस्वीरों के लिए Include property photo links चुनें। Internal Inbox खोलकर ड्राफ़्ट और लिंक जाँचें, फिर भेजें। ये तस्वीरों के लिंक हैं; हर channel पर अपने आप image attachment नहीं बनता। नई तस्वीर पहले प्रॉपर्टी में जोड़ें ताकि आगे दूसरे prospects के लिए भी रहे। Integration उपलब्ध न हो तो भेजने से पहले उसे configure करें।'),
        ('Landing की पसंद और गाइड', 'Desktop और छोटे mobile screen पर landing header में Language और Toggle theme उपलब्ध हैं। Hindi या English और light या dark theme चुनें। Reload के बाद भी आपकी पसंद रहती है। User guides में चारों manuals मिलेंगे। Android card से APK डाउनलोड करें और मौजूदा ऐप अपडेट करने से पहले build, timestamp और SHA-256 जाँचें।'),
        ('AI और provider की स्थिति', 'OpenRouter requests केवल free models और शून्य कीमत वाले endpoints पर जाती हैं। Provider busy या incompatible हो तो configured fallback इस्तेमाल होता है; paid credits अपने आप खर्च नहीं होने चाहिए। Photo extraction के लिए approved model और मूल स्रोत की समीक्षा ज़रूरी है। ZIP की photo proposals caption से अलग रहती हैं। Provider unavailable, अधूरा जवाब या अधूरी quality जाँच को सफल extraction न मानें। Gmail production scope approval और physical-device acceptance की अलग verification स्थिति है।'),
    ],
}

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
    c.drawString(44, 26, 'BrokerIQ / Build 61 update / 13 Nov 2026')
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
            writer.append(PdfReader(io.BytesIO(make_page(language))), outline_item='Build 61 workflow update')
            writer.add_metadata({'/Title': f'BrokerIQ {role} guide - {language} - Build 61 update'})
            writer.write(args.output / name)
            report.append({'file': name, 'originalPages': len(base.pages), 'pages': len(writer.pages), 'supplementBuild': 61})
    print(json.dumps(report))

if __name__ == '__main__':
    main()
