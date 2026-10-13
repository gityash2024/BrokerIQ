#!/usr/bin/env python3
"""
BrokerIQ Inventory Data Fixer
Re-parses the `notes` field to recover missing fields and syncs JSON→DB.
"""
import json, re, sys

# --- Load JSON data ---
with open('all_117_apple_vision_items.json') as f:
    json_items = json.load(f)

print(f"Loaded {len(json_items)} items from JSON")

# --- Patterns ---
PHONE_RE = re.compile(r'(?<!\d)([6-9]\d{9})(?!\d)')
RENT_RE = re.compile(r'@\s*(\d{1,3})\s*[Kk]', re.I)
RENT_FULL_RE = re.compile(r'(\d{2,6})\s*/?\s*(?:mo|month|pm)', re.I)
BHK_RE = re.compile(r'(\d)\s*[Bb][Hh]?[Kk]', re.I)
RK_RE = re.compile(r'(\d)\s*[Rr][Kk]', re.I)
FLOOR_RE = re.compile(r'\b(GF|FF|SF|TF|3RD|4TH|5TH|GROUND|FIRST|SECOND|THIRD|FOURTH|FIFTH)\b', re.I)
FURNISH_RE = re.compile(r'\b(SFD|FFD|UFD|SEMI|FULLY|UNFURNISHED)\b', re.I)
BROKERAGE_RE = re.compile(r'(\d{1,2})\s*[Dd](?:ays?)?', re.I)
FAMILY_RE = re.compile(r'\b(FLY|FAMILY|FAM)\b', re.I)
SALE_RE = re.compile(r'\b(SALE|SELL)\b', re.I)

FLOOR_MAP = {
    'GF': 'Ground', 'GROUND': 'Ground',
    'FF': '1st', 'FIRST': '1st',
    'SF': '2nd', 'SECOND': '2nd',
    'TF': '3rd', 'THIRD': '3rd', '3RD': '3rd',
    '4TH': '4th', 'FOURTH': '4th',
    '5TH': '5th', 'FIFTH': '5th',
}
FURNISH_MAP = {
    'SFD': 'SEMI_FURNISHED', 'SEMI': 'SEMI_FURNISHED',
    'FFD': 'FULLY_FURNISHED', 'FULLY': 'FULLY_FURNISHED',
    'UFD': 'UNFURNISHED', 'UNFURNISHED': 'UNFURNISHED',
}

def parse_notes(item):
    """Extract missing fields from the notes string."""
    notes = item.get('notes', '') or ''
    updates = {}

    # --- ownerPhone ---
    if not item.get('ownerPhone') or item['ownerPhone'].strip() in ['', '--', '—', 'No phone']:
        phones = PHONE_RE.findall(notes)
        if phones:
            updates['ownerPhone'] = phones[0]

    # --- houseNo ---
    if not item.get('houseNo') or item['houseNo'].strip() in ['', '--', '—']:
        # Try to get house number from start of notes (e.g., "1167 - ...")
        m = re.match(r'^(\d{1,5}[A-Za-z]?)\s*[-–—\s]', notes)
        if m:
            updates['houseNo'] = m.group(1)

    # --- rent ---
    if not item.get('rent'):
        m = RENT_RE.search(notes)
        if m:
            updates['rent'] = int(m.group(1)) * 1000
        else:
            m = RENT_FULL_RE.search(notes)
            if m:
                val = int(m.group(1))
                if val > 1000:
                    updates['rent'] = val

    # --- bhk ---
    if not item.get('bhk'):
        m = BHK_RE.search(notes)
        if m:
            val = int(m.group(1))
            if 1 <= val <= 6:
                updates['bhk'] = val
        else:
            m = RK_RE.search(notes)
            if m:
                updates['bhk'] = 1  # 1RK = 1

    # --- floor ---
    if not item.get('floor'):
        m = FLOOR_RE.search(notes)
        if m:
            updates['floor'] = FLOOR_MAP.get(m.group(1).upper(), m.group(1))

    # --- furnishing ---
    if not item.get('furnishing') or item['furnishing'] == 'UNFURNISHED':
        m = FURNISH_RE.search(notes)
        if m:
            updates['furnishing'] = FURNISH_MAP.get(m.group(1).upper(), 'SEMI_FURNISHED')

    # --- brokerage ---
    if not item.get('brokerage'):
        m = BROKERAGE_RE.search(notes)
        if m:
            updates['brokerage'] = f"{m.group(1)} days"

    # --- tenantPreference ---
    if not item.get('tenantPreference'):
        if FAMILY_RE.search(notes):
            updates['tenantPreference'] = 'Family only'

    # --- purpose ---
    if not item.get('purpose') or item['purpose'] == 'RENT':
        if SALE_RE.search(notes):
            updates['purpose'] = 'SALE'

    return updates

# --- Process all items ---
total_updates = 0
field_counts = {}
sql_statements = []

for item in json_items:
    updates = parse_notes(item)
    if updates:
        total_updates += 1
        for field in updates:
            field_counts[field] = field_counts.get(field, 0) + 1

        # Generate SQL update for items that have a unique houseNo + sector combo
        house = item.get('houseNo', '--')
        sector = item.get('sector', '')
        page = item.get('pageNo', '')

        set_parts = []
        for k, v in updates.items():
            if isinstance(v, int):
                set_parts.append(f'"{k}" = {v}')
            else:
                escaped = str(v).replace("'", "''")
                set_parts.append(f'"{k}" = \'{escaped}\'')

        if set_parts:
            # Use pageNo + sector + houseNo for matching when houseNo is valid
            escaped_house = house.replace("'", "''")
            escaped_sector = sector.replace("'", "''")
            where = f"sector = '{escaped_sector}'"
            if house and house not in ['--', '—', '']:
                where += f" AND \"houseNo\" = '{escaped_house}'"
            if page:
                where += f" AND \"pageNo\" = {page}"

            sql = f"UPDATE \"InventoryItem\" SET {', '.join(set_parts)} WHERE {where};"
            sql_statements.append(sql)

print(f"\nTotal items with recoverable data: {total_updates}")
print("Fields recovered:")
for field, count in sorted(field_counts.items(), key=lambda x: -x[1]):
    print(f"  {field}: {count}")

# Write SQL file
with open('scripts/fix_inventory.sql', 'w') as f:
    f.write("-- BrokerIQ Inventory Data Fix\n")
    f.write(f"-- Total updates: {len(sql_statements)}\n\n")
    f.write("BEGIN;\n\n")
    for sql in sql_statements:
        f.write(sql + "\n")
    f.write("\nCOMMIT;\n")

print(f"\nGenerated {len(sql_statements)} SQL update statements -> scripts/fix_inventory.sql")

# --- Check for missing entries (JSON has but DB doesn't) ---
# Group by sector
json_by_sector = {}
for item in json_items:
    s = item.get('sector', '')
    json_by_sector.setdefault(s, []).append(item)

print("\n--- Sector counts (JSON) ---")
for s in sorted(json_by_sector.keys()):
    print(f"  {s}: {len(json_by_sector[s])}")

# --- Generate INSERT statements for missing Sector 43 entries ---
# DB has 118, JSON has 124 = 6 missing
# We need to find which specific entries from JSON are not in DB
# Best approach: export all houseNo from DB sector 43, compare with JSON
print("\n--- Missing entries analysis ---")
print("Sector 43: JSON=124, DB=118 → 6 missing (need to INSERT)")
print("Sector 47: JSON=26, DB=39 → 13 extra in DB (likely manual adds, keep them)")
