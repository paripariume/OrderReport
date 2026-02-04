# 単価決定SQL
from dataclasses import dataclass
from typing import Optional

SQL_PRICE_PICK = """
SELECT
  NVL(x.単価設定区分, '未設定') AS 単価設定区分,
  NVL(x.定価, 0)               AS 定価,
  NVL(x.売上単価, 0)           AS 売上単価,
  x.仕入先コード,
  NVL(x.仕入単価, 0)           AS 仕入単価
FROM dual
LEFT JOIN (
  SELECT 単価設定区分, 定価, 売上単価, 仕入先コード, 仕入単価
  FROM (
    /* 需商 */
    SELECT
      CAST('需商' AS VARCHAR2(10)) AS 単価設定区分,
      CAST(NULL  AS NUMBER)        AS 定価,
      ju.売上単価                  AS 売上単価,
      CAST(js.仕入先コード AS VARCHAR2(20)) AS 仕入先コード,
      js.仕入単価                  AS 仕入単価,
      1 AS prio
    FROM dual
    OUTER APPLY (
      SELECT 売上単価
      FROM 需要先商品売上単価マスタV
      WHERE 得意先コード = :tcode
        AND 需要先コード = :jcode
        AND 商品コード   = :scode
        AND 入数ランク   = :irank
    ) ju
    OUTER APPLY (
      SELECT 仕入先コード, 仕入単価
      FROM 需要先商品仕入単価マスタV
      WHERE 得意先コード = :tcode
        AND 需要先コード = :jcode
        AND 商品コード   = :scode
        AND 入数ランク   = :irank
    ) js
    WHERE ju.売上単価 IS NOT NULL OR js.仕入単価 IS NOT NULL

    UNION ALL

    /* 得商 */
    SELECT
      CAST('得商' AS VARCHAR2(10)) AS 単価設定区分,
      CAST(NULL  AS NUMBER)        AS 定価,
      tu.売上単価                  AS 売上単価,
      CAST(ts.仕入先コード AS VARCHAR2(20)) AS 仕入先コード,
      ts.仕入単価                  AS 仕入単価,
      2 AS prio
    FROM dual
    OUTER APPLY (
      SELECT 売上単価
      FROM 得意先商品売上単価マスタV
      WHERE 得意先コード = :tcode
        AND 商品コード   = :scode
        AND 入数ランク   = :irank
    ) tu
    OUTER APPLY (
      SELECT 仕入先コード, 仕入単価
      FROM 得意先商品仕入単価マスタV
      WHERE 得意先コード = :tcode
        AND 商品コード   = :scode
        AND 入数ランク   = :irank
    ) ts
    WHERE tu.売上単価 IS NOT NULL OR ts.仕入単価 IS NOT NULL

    UNION ALL

    /* 定価 */
    SELECT
      CAST('定価' AS VARCHAR2(10)) AS 単価設定区分,
      CAST(s.定価 AS NUMBER)       AS 定価,
      s.売上単価                   AS 売上単価,
      CAST(NULL AS VARCHAR2(20))   AS 仕入先コード,
      s.仕入単価                   AS 仕入単価,
      3 AS prio
    FROM 商品単価マスタV s
    WHERE s.商品コード = :scode
      AND s.入数ランク = :irank
      AND (s.定価 IS NOT NULL OR s.売上単価 IS NOT NULL OR s.仕入単価 IS NOT NULL)
  )
  ORDER BY prio
  FETCH FIRST 1 ROW ONLY
) x ON 1 = 1
"""



@dataclass(frozen=True)
class PricingResult:
  source: str
  teika: int
  sales_price: int
  purchase_price: int
  supplier_code: Optional[str]


def _to_int(v) -> int:
  if v is None:
    return 0
  try:
    return int(v)
  except Exception:
    try:
      return int(float(v))
    except Exception:
      return 0


  #需商 → 得商 → 定価
def decide_pricing(cur, *, tcode: str, jcode: str, scode: str, irank: str) -> PricingResult:

  cur.execute(
    SQL_PRICE_PICK,
    tcode=tcode,
    jcode=jcode,
    scode=scode,
    irank=irank,
  )
  row = cur.fetchone()
  if not row:
    return PricingResult(source="未設定", teika=0, sales_price=0, purchase_price=0, supplier_code=None)

  # 列順: 区分, 定価, 売上単価, 仕入先コード, 仕入単価
  source = row[0] or "未設定"
  teika = _to_int(row[1])
  sales = _to_int(row[2])
  supplier = row[3]
  purchase = _to_int(row[4])

  return PricingResult(
    source=source,
    teika=teika,
    sales_price=sales,
    purchase_price=purchase,
    supplier_code=supplier,
  )
