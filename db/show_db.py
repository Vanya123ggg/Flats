# -*- coding: utf-8 -*-
"""
Показ базы данных в браузере: все таблицы и их содержимое.
Запуск:  python db/show_db.py [путь_к_конфигу.json]
По умолчанию конфиг — db/db_config.json.
Пример для базы друга на Neon:
    python db/show_db.py db/db_config.neon.json
Или дважды кликни по db/show-db-neon.cmd
"""

import json
import os
import sys
import threading
import webbrowser
from datetime import date, datetime
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, HTTPServer

import psycopg

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'db_config.json')
PORT = 8123

cfg = json.load(open(CONFIG, encoding='utf-8'))
conn = psycopg.connect(
    host=cfg['host'], port=cfg.get('port', 5432),
    dbname=cfg['database'], user=cfg['user'], password=cfg['password'],
    sslmode=cfg.get('sslmode', 'require'),
)


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def val(v):
    if v is None:
        return '<td class="null">&mdash;</td>'
    if isinstance(v, bool):
        return '<td class="bool">' + ('да' if v else 'нет') + '</td>'
    if isinstance(v, (date, datetime, Decimal)):
        return '<td class="num">' + esc(str(v)) + '</td>'
    return '<td>' + esc(v) + '</td>'


def table_html(name):
    cur = conn.execute('SELECT * FROM "%s" ORDER BY id' % name)
    cols = [d.name for d in cur.description]
    rows = cur.fetchall()
    head = ''.join('<th>' + esc(c) + '</th>' for c in cols)
    body = ''.join('<tr>' + ''.join(val(x) for x in r) + '</tr>' for r in rows)
    return ('<section class="tbl"><h2>' + esc(name) +
            ' <span class="count">' + str(len(rows)) +
            (' запись' if len(rows) % 10 == 1 and len(rows) % 100 != 11 else
             ' записей' if len(rows) % 10 in (2, 3, 4) and not (len(rows) % 100 in (12, 13, 14)) else
             ' записей') + '</span></h2>'
            '<table><thead><tr>' + head + '</tr></thead><tbody>' +
            (body if body else '<tr><td class="null">пусто</td></tr>') +
            '</tbody></table></section>')


page = ('''<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Просмотр базы данных</title>
<style>
  body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: #f3f5f7; color: #1f2937; }
  header { background: #111827; color: #fff; padding: 16px 28px; }
  header h1 { margin: 0 0 4px; font-size: 20px; }
  header p { margin: 0; color: #cbd5e1; font-size: 13px; }
  main { padding: 20px 28px; }
  .tbl { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; overflow-x: auto; }
  h2 { margin: 0 0 10px; font-size: 16px; }
  .count { color: #6b7280; font-weight: 400; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; white-space: nowrap; }
  .null { color: #9ca3af; }
  .bool { color: #065f46; }
  .num { color: #0f172a; }
</style></head><body>
<header><h1>Просмотр базы данных</h1>
<p>Хост: ''' + esc(cfg['host']) + ' &middot; База: ' + esc(cfg['database']) +
' &middot; Пользователь: ' + esc(cfg['user']) + '</p></header>'
'<main>' + ''.join(table_html(t) for t in
                    [r[0] for r in conn.execute(
                        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name").fetchall()])
+ '</main></body></html>')


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(page.encode('utf-8'))

    def log_message(self, fmt, *args):
        pass


server = HTTPServer(('127.0.0.1', PORT), Handler)
url = 'http://127.0.0.1:%d' % PORT
threading.Timer(0.5, lambda: webbrowser.open(url)).start()
print('Открыто: ' + url + '  (закрой окно или нажми Ctrl+C, чтобы остановить)')
server.serve_forever()