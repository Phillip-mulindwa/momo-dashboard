import re
import sqlite3
import xml.etree.ElementTree as ET

# Connect to SQLite database (will create it if not exists)
conn = sqlite3.connect('momo_sms.db')
cur = conn.cursor()

# Create transactions table
cur.execute('''
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_id TEXT,
    amount INTEGER,
    fee INTEGER,
    balance INTEGER,
    category TEXT,
    counterparty TEXT,
    timestamp TEXT,
    raw TEXT
)
''')

# Load and parse XML
tree = ET.parse('../data/mtn_sms.xml')
root = tree.getroot()

# Helper function to extract data with regex
def extract(pattern, text, cast=int):
    match = re.search(pattern, text)
    if match:
        value = match.group(1).replace(',', '')
        return cast(value) if cast else value
    return None

# Categorize messages based on keywords
def categorize(body):
    body = body.lower()
    if "received" in body:
        return "incoming"
    elif "payment of" in body:
        return "payment"
    elif "withdrawn" in body:
        return "withdrawal"
    elif "bank deposit" in body:
        return "deposit"
    elif "cash power" in body:
        return "cash_power"
    elif "bundle" in body:
        return "internet_bundle"
    else:
        return None

# Parse each SMS
with open('../logs/unprocessed.log', 'w') as log:
    for sms in root.findall('sms'):
        body = sms.attrib['body']
        category = categorize(body)

        if not category:
            log.write(body + "\n")
            continue

        tx_id     = extract(r'TxId[:\s]*([0-9]+)', body, str)
        amount    = extract(r'([0-9,]+) RWF', body)
        fee       = extract(r'Fee.*?([0-9,]+) RWF', body)
        balance   = extract(r'new balance[:\s]*([0-9,]+)', body)
        timestamp = extract(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', body, str)
        recipient = extract(r'to\s+([A-Za-z\s]+)', body, str)

        cur.execute('''
            INSERT INTO transactions
            (tx_id, amount, fee, balance, category, counterparty, timestamp, raw)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (tx_id, amount, fee, balance, category, recipient, timestamp, body))

conn.commit()
conn.close()
print("✅ Parsed and inserted successfully.")
