# -*- coding: utf-8 -*-
"""Управление подключением к БД без ручных правок JSON.

Важно: в любой момент активна ОДНА база (db/db_config.json). Одновременно две
БД не используются — чтобы работать с другой базой, добавьте её профиль и
переключитесь на него; активной всегда будет только одна.

Команды:
  python tools\\\\db_admin.py list                          список сохранённых профилей
  python tools\\\\db_admin.py show                          активная БД + число строк по всем профилям
  python tools\\\\db_admin.py add <имя> <хост> <порт> <бд> <пользователь> <пароль> [sslmode]
                                                         сохранить профиль для ЛЮБОЙ PostgreSQL
  python tools\\\\db_admin.py rm <имя>                      удалить профиль (активный нельзя)
  python tools\\\\db_admin.py switch <имя>                  сделать профиль активной БД
  python tools\\\\db_admin.py import <из> [в]               скопировать ВСЕ строки из <из> в активную
                                                         (или в <в>); таблица в целевой БД
                                                         пересоздаётся и заполняется заново
"""
import getopt
import io
import json
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import psycopg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PROFILES_PATH = os.path.join(ROOT, 'db', 'profiles.json')
CONFIG_PATH = os.path.join(ROOT, 'db', 'db_config.json')

FIELDS = [
    'source', 'source_url', 'date_published', 'region', 'district', 'locality', 'address',
    'price', 'price_per_unit', 'area', 'area_unit',
    'category_land', 'vri', 'cadastral_number',
    'has_gas', 'has_electricity', 'has_water', 'has_house',
    'description', 'contact_name', 'parsed_at',
]


def load_json(path):
    with open(path, encoding='utf-8') as f:
        lines = [ln for ln in f.read().splitlines() if not ln.lstrip().startswith('//')]
    return json.loads('\n'.join(lines))


def profiles():
    return load_json(PROFILES_PATH)


def active():
    return load_json(CONFIG_PATH)


def connect(cfg):
    return psycopg.connect(
        host=cfg['host'], port=cfg.get('port', 5432), dbname=cfg['database'],
        user=cfg['user'], password=cfg.get('password', ''),
        sslmode=cfg.get('sslmode', 'require'),
    )


def write_json(path, data):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def show():
    act = active()
    print('Активная БД (db/db_config.json): %s@%s:%s/%s (sslmode=%s)' % (
        act.get('user'), act.get('host'), act.get('port', 5432),
        act.get('database'), act.get('sslmode')))
    for name, cfg in profiles().items():
        try:
            with connect(cfg) as conn:
                tbl = conn.execute("SELECT to_regclass('land_plots')").fetchone()[0]
                cnt = conn.execute('SELECT count(*) FROM land_plots').fetchone()[0] if tbl else 0
        except Exception as e:
            cnt = 'ошибка: %s' % e
        star = '*' if cfg == act else ' '
        print('  %s %-6s %s rows=%s' % (star, name, cfg['database'], cnt))
    print('* — активная БД')


def recreate_table(dc, sc):
    cur = sc.execute(
        "SELECT column_name, data_type, is_nullable, column_default, "
        "numeric_precision, numeric_scale "
        "FROM information_schema.columns WHERE table_name='land_plots' "
        "ORDER BY ordinal_position")

    def col_sql(name, dt, nullable, default, nprec, nscale):
        if name == 'id':
            return 'id SERIAL PRIMARY KEY'
        typ = dt
        if dt == 'numeric' and nprec:
            typ = 'numeric(%s,%s)' % (nprec, nscale)
        if dt == 'timestamp without time zone':
            typ = 'timestamp'
        parts = [name, typ]
        if nullable == 'NO':
            parts.append('NOT NULL')
        return ' '.join(parts)

    cols = cur.fetchall()
    create_sql = 'CREATE TABLE land_plots (%s)' % ', '.join(col_sql(*c) for c in cols)
    dc.execute('DROP TABLE IF EXISTS land_plots CASCADE')
    dc.execute(create_sql)


def copy_rows(src_name, dst_name):
    src = profiles()[src_name]
    dst = profiles()[dst_name] if dst_name else active()
    print('ВНИМАНИЕ: таблица land_plots в БД %s будет ПЕРЕСОЗДАНА и заполнена '
          'данными из %s (существующие строки будут удалены).' % (dst.get('database'), src_name))
    ans = input('Продолжить? yes/no: ').strip().lower()
    if ans not in ('y', 'yes', 'да', 'д'):
        print('Отменено.')
        return
    cols = ', '.join(FIELDS)
    rows = None
    with connect(src) as sc:
        with connect(dst) as dc:
            recreate_table(dc, sc)
            rows = sc.execute('SELECT %s FROM land_plots ORDER BY id' % cols).fetchall()
    if not rows:
        print('В БД %s нет строк для копирования. Завершено.' % src_name)
        return
    sql = 'INSERT INTO land_plots (%s) VALUES (%s)' % (cols, ','.join(['%s'] * len(FIELDS)))
    with connect(dst) as dc:
        dc.executemany(sql, rows)
        cnt = dc.execute('SELECT count(*) FROM land_plots').fetchone()[0]
    print('Скопировано %d строк из %s в %s (таблица пересоздана и заполнена).' % (
        len(rows), src_name, dst.get('database')))


def add_profile(args):
    if len(args) < 7:
        print('Использование: python tools\\\\db_admin.py add <имя> <хост> <порт> '
              '<бд> <пользователь> <пароль> [sslmode]')
        return
    name = args[0]
    host = args[1]
    port = int(args[2])
    database = args[3]
    user = args[4]
    password = args[5]
    sslmode = args[6] if len(args) > 6 else 'require'
    prof = profiles()
    prof[name] = {'host': host, 'port': port, 'database': database, 'user': user,
                  'password': password, 'sslmode': sslmode}
    write_json(PROFILES_PATH, prof)
    print('Профиль "%s" сохранён в db/profiles.json.' % name)
    print('Включить: python tools\\\\db_admin.py switch %s' % name)


def rm_profile(name):
    prof = profiles()
    if name not in prof:
        print('Профиль "%s" не найден. Доступны: %s' % (name, ', '.join(prof)))
        return
    act = active()
    if prof[name] == act:
        print('Нельзя удалить профиль "%s": именно он сейчас активен. '
              'Сначала переключитесь: python tools\\\\db_admin.py switch local' % name)
        return
    del prof[name]
    write_json(PROFILES_PATH, prof)
    print('Профиль "%s" удалён из db/profiles.json.' % name)


def switch_to(name):
    prof = profiles()
    if name not in prof:
        print('Профиль "%s" не найден. Доступны: %s' % (name, ', '.join(prof)))
        sys.exit(1)
    write_json(CONFIG_PATH, prof[name])
    print('Активной БД выбрана %s: %s@%s/%s' % (
        name, prof[name]['user'], prof[name]['host'], prof[name]['database']))
    print('Сервер переподключится сам (конфиг читается при каждом запросе /api/land).')


def main():
    args = sys.argv[1:]
    if not args or args[0] == 'list':
        for name in profiles():
            print(name)
        return
    cmd = args[0]
    rest = args[1:]
    if cmd == 'show':
        show()
    elif cmd == 'switch':
        switch_to(rest[0] if rest else '')
    elif cmd == 'add':
        add_profile(rest)
    elif cmd == 'rm':
        rm_profile(rest[0] if rest else '')
    elif cmd == 'import':
        copy_rows(rest[0], rest[1] if len(rest) > 1 else None)
    else:
        print(__doc__)


if __name__ == '__main__':
    main()