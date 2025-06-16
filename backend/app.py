from fastapi import FastAPI, Query
from pydantic import BaseModel
from typing import List, Optional
import sqlite3

DB = 'momo_sms.db'

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

class Transaction(BaseModel):
    tx_id: str
    amount: int
    fee: int
    balance: Optional[int]
    category: str
    counterparty: Optional[str]
    timestamp: str
    raw_text: str

app = FastAPI()

@app.get('/api/transactions', response_model=List[Transaction])
def list_transactions(
    category: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    min_amount: Optional[int] = Query(None),
    max_amount: Optional[int] = Query(None)
):
    db = get_db()
    sql = "SELECT * FROM transactions WHERE 1=1"
    params = []
    if category:
        sql += " AND category = ?"; params.append(category)
    if date_from:
        sql += " AND timestamp >= ?"; params.append(date_from)
    if date_to:
        sql += " AND timestamp <= ?"; params.append(date_to)
    if min_amount is not None:
        sql += " AND amount >= ?"; params.append(min_amount)
    if max_amount is not None:
        sql += " AND amount <= ?"; params.append(max_amount)
    rows = db.execute(sql, params).fetchall()
    db.close()
    return [Transaction(**dict(r)) for r in rows]

@app.get('/api/stats')
def stats():
    db = get_db()
    by_cat = db.execute(
        "SELECT category, SUM(amount) AS total FROM transactions GROUP BY category"
    ).fetchall()
    monthly = db.execute(
        "SELECT SUBSTR(timestamp,1,7) AS month, SUM(amount) AS total FROM transactions GROUP BY month"
    ).fetchall()
    db.close()
    return {
        "by_category": {r["category"]: r["total"] for r in by_cat},
        "monthly":     {r["month"]:   r["total"] for r in monthly}
    }
