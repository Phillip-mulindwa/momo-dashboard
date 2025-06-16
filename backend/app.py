from flask import Flask, jsonify
import sqlite3

app = Flask(__name__)

def query_stats():
    conn = sqlite3.connect('momo_sms.db')
    cur  = conn.cursor()
    cur.execute('''
      SELECT category, COUNT(*) 
      FROM transactions 
      GROUP BY category
    ''')
    rows = cur.fetchall()
    conn.close()
    return {r[0]: r[1] for r in rows}

@app.route('/stats')
def stats():
    return jsonify(query_stats())

if __name__ == '__main__':
    app.run(debug=True)
