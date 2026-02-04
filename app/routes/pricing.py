# 単価マスタ参照API
import time
import logging
from fastapi import APIRouter

from app.db import get_conn
from app.schemas import PricingResolveRequest, PricingResolveResponse
from app.pricing import decide_pricing

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/pricing/resolve", response_model=PricingResolveResponse)
def pricing_resolve(req: PricingResolveRequest):
  """
  入力画面から1明細ずつ呼ぶ
  単価決定
  優先: 需商→得商→定価 / 条件: 売上か仕入のどちらか / なし: 0円(未設定)
  """
  start = time.perf_counter()

  with get_conn() as conn:
    with conn.cursor() as cur:
      pr = decide_pricing(
        cur,
        tcode=req.tcode,
        jcode=req.jcode,
        scode=req.scode,
        irank=req.irank,
      )

  elapsed = time.perf_counter() - start
  logger.info(
    "pricing.resolve: %.3f sec t=%s j=%s s=%s r=%s src=%s sales=%s buy=%s teika=%s",
    elapsed, req.tcode, req.jcode, req.scode, req.irank, pr.source, pr.sales_price, pr.purchase_price, pr.teika
  )

  return PricingResolveResponse(
    source=pr.source,
    teika=pr.teika,
    sales_price=pr.sales_price,
    purchase_price=pr.purchase_price,
    supplier_code=pr.supplier_code,
  )
