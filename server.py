# -*- coding: utf-8 -*-
"""Static site + live DB API. Run: python server.py

Serves the project files and provides GET /api/land with real data
from the PostgreSQL (Neon) database configured in db/db_config.json.
"""
import json
import os
import sys
import threading
import webbrowser
from datetime import date, datetime
from decimal import Decimal
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import psycopg

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, 'db', 'db_config.json')
PORT = int(os.environ.get('PORT', '8000'))

FIELDS = [
    ('id', 'id'),
    ('source', 'source'),
    ('source_url', 'sourceUrl'),
    ('date_published', 'datePublished'),
    ('region', 'region'),
    ('district', 'district'),
    ('locality', 'locality'),
    ('address', 'address'),
    ('price', 'price'),
    ('price_per_unit', 'pricePerUnit'),
    ('area', 'area'),
    ('area_unit', 'areaUnit'),
    ('category_land', 'categoryLand'),
    ('vri', 'vri'),
    ('cadastral_number', 'cadastralNumber'),
    ('has_gas', 'hasGas'),
    ('has_electricity', 'hasElectricity'),
    ('has_water', 'hasWater'),
    ('has_house', 'hasHouse'),
    ('description', 'description'),
    ('contact_name', 'contactName'),
]


def serialize(v):
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    return v


def load_db_config():
    with open(CONFIG, encoding='utf-8') as f:
        lines = [ln for ln in f.read().splitlines() if not ln.lstrip().startswith('//')]
    return json.loads('\n'.join(lines))


def load_plots():
    cfg = load_db_config()
    cols = ', '.join(db_col for db_col, _ in FIELDS)
    with psycopg.connect(
        host=cfg['host'],
        port=cfg.get('port', 5432),
        dbname=cfg['database'],
        user=cfg['user'],
        password=cfg['password'],
        sslmode=cfg.get('sslmode', 'require'),
    ) as conn:
        cur = conn.execute('SELECT %s FROM land_plots ORDER BY id' % cols)
        rows = cur.fetchall()
    return [
        {js_key: serialize(v) for (_, js_key), v in zip(FIELDS, row)}
        for row in rows
    ]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def do_GET(self):
        if self.path.split('?')[0] == '/api/land':
            try:
                data = load_plots()
            except Exception:
                body = b'{"error":"db"}'
                self.send_response(503)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            body = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        sys.stdout.write('[%s] %s\n' % (self.address_string(), fmt % args))


if __name__ == '__main__':
    url = 'http://127.0.0.1:%d/land/report/quarterly/index.html' % PORT
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    print('Запущено: %s' % url)
    print('Данные обновляются из БД каждые ~15 секунд. Ctrl+C — остановить.')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()