# メーカマスタ検索API
from fastapi import APIRouter, Query
from app.db import get_conn

#router = APIRouter(tags=["makers"])
router = APIRouter(prefix="/makers", tags=["makers"])

@router.get("/search")
def search_makers(q: str = Query("", description="メーカ名(社内用メーカ名)の部分一致")):
    q = (q or "").strip()
    if not q:
        return {"items": []}

    sql = """
    SELECT メーカコード, 社内用メーカ名
      FROM メーカマスタV
     WHERE UTL_I18N.TRANSLITERATE(社内用メーカ名, 'hwkatakana_fwkatakana') LIKE UTL_I18N.TRANSLITERATE(:kw, 'hwkatakana_fwkatakana')
     ORDER BY メーカコード
     FETCH FIRST 100 ROWS ONLY
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"kw": f"%{q}%"})
            rows = cur.fetchall()

    return {"items": [{"maker_cd": r[0], "maker_name": r[1]} for r in rows]}


@router.get("/{maker_cd}")
def get_maker(maker_cd: str):
    """
    メーカコードから社内用メーカ名を返す。
    未ヒットは200でNoneを返す。
    """
    sql = """
    SELECT 社内用メーカ名
    FROM メーカマスタV
    WHERE メーカコード = :maker_cd
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"maker_cd": maker_cd})
            row = cur.fetchone()

    return {"maker_cd": maker_cd, "maker_name": row[0] if row else None}
