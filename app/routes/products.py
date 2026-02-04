# 商品マスタ取得API
from fastapi import APIRouter, Query
from app.db import get_conn

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/search")
def search_products(
    maker_cd: str = Query("", max_length=50),
    maker_name: str = Query("", max_length=200),
    maker_part_no: str = Query("", max_length=200),
    product_name: str = Query("", max_length=200),
    spec: str = Query("", max_length=200),
    limit: int = Query(200, ge=1, le=2000),
):
    """
    商品検索（部分一致）
    戻り値キーは英語に統一:
      product_cd, product_name, spec, maker_cd, maker_name, maker_part_no
    """
    where = []
    params = {}

    # VIEWの日本語列に合わせる
    if maker_cd:
        where.append("P.メーカコード = :maker_cd")
        params["maker_cd"] = maker_cd

    if maker_name:
        where.append("M.社内用メーカ名 LIKE :maker_name")
        params["maker_name"] = f"%{maker_name}%"

    if maker_part_no:
        where.append("P.メーカ品番 LIKE :maker_part_no")
        params["maker_part_no"] = f"%{maker_part_no}%"

    if product_name:
        where.append("P.商品名 LIKE :product_name")
        params["product_name"] = f"%{product_name}%"

    if spec:
        where.append("P.規格 LIKE :spec")
        params["spec"] = f"%{spec}%"

    where_sql = " AND ".join(where) if where else "1=1"

    params["limit"] = int(limit)

    sql = f"""
            SELECT *
            FROM (
                SELECT
                    P.商品コード   AS product_cd,
                    P.商品名       AS product_name,
                    P.規格         AS spec,
                    P.メーカコード AS maker_cd,
                    M.社内用メーカ名     AS maker_name,
                    P.メーカ品番   AS maker_part_no
                FROM 商品マスタV P
                LEFT JOIN メーカマスタV M
                    ON M.メーカコード = P.メーカコード
                WHERE {where_sql}
                ORDER BY P.商品コード
            )
            WHERE ROWNUM <= :limit
            """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            cols = [d[0].lower() for d in cur.description]  # aliasをlower化
            return [dict(zip(cols, r)) for r in rows]

# 単位取得
@router.get("/units")
def get_units(product_cd: str = Query(..., max_length=50)):
    sql = """
    SELECT 単位.単位名 AS unit_name
          ,入数.入数名 AS irisu_name
          ,入数.入数ランク AS irisu_rank
      FROM 商品入数マスタV 入数
      LEFT JOIN 単位マスタV 単位 ON (入数.単位コード = 単位.単位コード)
     WHERE 商品コード = :product_cd
     ORDER BY 入数.順序
    """
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, {"product_cd": product_cd})
        rows = cur.fetchall()

    return [
        {
            "unit_name": r[0] or "",
            "irisu_name": r[1] or "",
            "irisu_rank": r[2] if r[2] is not None else "",
        }
        for r in rows
    ]


@router.get("/{scode}")
def get_product(scode: str):
    """
    商品コードから商品情報を返す（キーは英語）
    未ヒットは200でNoneを返す
    """
    sql = """
    SELECT
        M_商品.メーカコード,
        M_メカ.社内用メーカ名,
        M_商品.商品名,
        M_商品.メーカ品番,
        M_商品.規格,
        M_商品.仕入先コード,
        M_仕入.仕入先名
      FROM 商品マスタV M_商品
      LEFT JOIN メーカマスタV M_メカ
        ON M_商品.メーカコード = M_メカ.メーカコード
      LEFT JOIN 仕入先マスタV M_仕入
        ON M_商品.仕入先コード = M_仕入.仕入先コード
     WHERE M_商品.商品コード = :scode
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"scode": scode})
            row = cur.fetchone()

    if not row:
        return {
            "product_cd": scode,
            "maker_cd": None,
            "maker_name": None,
            "product_name": None,
            "maker_part_no": None,
            "spec": None,
            "supplier_code": None,
            "supplier_name": None,
        }

    return {
        "product_cd": scode,
        "maker_cd": row[0],
        "maker_name": row[1],
        "product_name": row[2],
        "maker_part_no": row[3],
        "spec": row[4],
        "supplier_code": row[5],
        "supplier_name": row[6],
    }

