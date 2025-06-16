import re
import sqlite3
import xml.etree.ElementTree as ET

# 1) Connect (or create) SQLite database
conn = sqlite3.connect('momo_sms.db')
cur  = conn.cursor()

# 2) Create table
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

# 3) Load and parse XML
tree = ET.parse('../data/mtn_sms.xml')
root = tree.getroot()

def extract(field, pattern, text, cast=int):
    m = re.search(pattern, text)
    return cast(m.group(1).replace(',', '')) if m else None

def categorize(body):
    # adjust these regexes to match your XML data
    if 'received' in body.lower():
        return 'incoming'
    if 'payment of' in body.lower():
        return 'payment'
    if 'bank deposit' in body.lower():
        return 'deposit'
    if 'withdrawn' in body.lower():
        return 'withdrawal'
    return None

with open('../logs/unprocessed.log', 'w') as log:
    for sms in root.findall('sms'):
        body = sms.get('body')
        cat  = categorize(body)
        if not cat:
            log.write(body + '\n')
            continue

        tx_id    = extract(body, r'TxId[:\s]+(\d+)')
        amount   = extract(body, r'(\d+)\s*RWF')
        fee      = extract(body, r'Fee.*?(\d+)\s*RWF')
        balance  = extract(body, r'new balance[:\s]+(\d+)')
        time     = extract(body, r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', cast=str)
        counter  = None
        # for payments/transfers, grab the name after "to "
        if cat in ('payment','withdrawal'):
            m = re.search(r'to\s+([\w\s]+?)(\s|\()', body)
            counter = m.group(1).strip() if m else None

        cur.execute('''
          INSERT INTO transactions
            (tx_id, amount, fee, balance, category, counterparty, timestamp, raw)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (tx_id, amount, fee, balance, cat, counter, time, body))

conn.commit()
conn.close()
print("Data loaded.")
