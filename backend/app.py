from flask import Flask, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/stats')
def stats():
    conn = sqlite3.connect('momo_sms.db')
    cur = conn.cursor()

    cur.execute("SELECT category, amount, fee, timestamp FROM transactions")
    rows = cur.fetchall()
    conn.close()

    categorized = {}

    for row in rows:
        category, amount, fee, timestamp = row
        if category is None:
            continue
        key = category.lower().replace(" ", "")
        entry = {
            "AMOUNT": amount if amount else 0,
            "Fee": fee if fee else 0,
            "date": timestamp
        }
        if key in categorized:
            categorized[key].append(entry)
        else:
            categorized[key] = [entry]

    return jsonify({
        "data": categorized
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
