from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

def get_db():
    conn = sqlite3.connect("../momo_sms.db")
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/stats")
def database_return():
    db = get_db()
    cursor = db.cursor()

    result = {
        "airtime": [],
        "bundles": [],
        "cashpower": [],
        "codeholders": [],
        "deposit": [],
        "failedtransactions": [],
        "incomingmoney": [],
        "nontransaction": [],
        "payments": [],
        "reversedtransactions": [],
        "thirdparty": [],
        "transfer": [],
        "withdraw": []
    }

    for key in result:
        cursor.execute("SELECT amount AS AMOUNT, fee AS Fee, timestamp AS date FROM transactions WHERE category=?", (key,))
        rows = cursor.fetchall()
        result[key] = [dict(row) for row in rows]

    db.close()
    return {"data": result}
