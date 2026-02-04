# 得意先マスタ検索API
from fastapi import APIRouter, Query
from app.db import get_conn

#router = APIRouter(tags=["customers"])
router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("/search")
def search_customers(q: str = Query("", description="得意先名の部分一致")):
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

    return {"items": [{"tcode": r[0], "customer_name": r[1]} for r in rows]}


@router.get("/{tcode}")
def get_customer(tcode: int):
    sql = """
    SELECT 得意先名
    FROM 得意先マスタV
    WHERE 得意先コード = :tcode
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"tcode": tcode})
            row = cur.fetchone()

    return {"tcode": tcode, "customer_name": row[0] if row else None}
