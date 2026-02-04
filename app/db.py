# DB接続
import os
import oracledb

oracledb.init_oracle_client(lib_dir=r"C:\oracle\instantclient_23_8")

def get_conn():
    user = os.environ["ORACLE_USER"]
    password = os.environ["ORACLE_PASSWORD"]
    dsn = os.environ["ORACLE_DSN"]

    return oracledb.connect(user=user, password=password, dsn=dsn)

# 疎通確認
def ping() -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1 from dual")
            return int(cur.fetchone()[0])
