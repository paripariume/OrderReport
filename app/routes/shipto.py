# 需要先名取得API
from fastapi import APIRouter, Query
from app.db import get_conn

router = APIRouter(prefix="/shipto", tags=["shipto"])

@router.get("/search")
def search_shipto(q: str = Query("", description="需要先名の部分一致")):
    q = (q or "").strip()
    if not q:
        return {"items": []}

    sql = """
    SELECT 得意先コード, 得意先名
      FROM 得意先マスタV
     WHERE UTL_I18N.TRANSLITERATE(得意先名, 'hwkatakana_fwkatakana') LIKE UTL_I18N.TRANSLITERATE(:kw, 'hwkatakana_fwkatakana')
     ORDER BY 得意先コード
     FETCH FIRST 100 ROWS ONLY
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"kw": f"%{q}%"})
            rows = cur.fetchall()

    return {
        "items": [{"jcode": r[0], "shipto_name": r[1]} for r in rows]
    }


@router.get("/{jcode}")
def get_shipto(jcode: str):
    
    sql = """
    SELECT 得意先名 AS 需要先名
    FROM 得意先マスタV
    WHERE 得意先コード = :jcode
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"jcode": jcode})
            row = cur.fetchone()

    return {"jcode": jcode, "shipto_name": row[0] if row else None}

