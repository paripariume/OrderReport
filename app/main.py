# FastAPI起動とルーティング
"""
app/main.py

- APIは /api 配下
- UIは / 配下
"""

import os
import time
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from app.logging_config import setup_logging
from app.routes import api_router

from app.schemas import OrderRequestV2
from app.pdf import build_order_pdf_bytes
from app.db import get_conn


def _fetch_supplier_names(codes: set[str]) -> dict[str, str]:
  if not codes:
    return {}

  params = {}
  placeholders = []
  for idx, code in enumerate(sorted(codes)):
    key = f"code{idx}"
    placeholders.append(f":{key}")
    params[key] = code

  sql = f"""
    SELECT 仕入先コード, 仕入先名
      FROM 仕入先マスタV
     WHERE 仕入先コード IN ({", ".join(placeholders)})
  """

  with get_conn() as conn:
    with conn.cursor() as cur:
      cur.execute(sql, params)
      return {row[0]: (row[1] or "") for row in cur.fetchall()}


setup_logging()
logger = logging.getLogger(__name__)

load_dotenv()
logger.info("ORACLE_USER exists? %s", "ORACLE_USER" in os.environ)


app = FastAPI(title="Order PDF API")

# APIはrouterに集約
app.include_router(api_router, prefix="/api")

# 静的ファイル
PROJECT_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = PROJECT_DIR / "static"
if not STATIC_DIR.exists():
  raise RuntimeError(f"Static directory does not exist: {STATIC_DIR}")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/api/health")
def health():
  return {"ok": True}


@app.post("/api/orders/pdf_v2")
def create_order_pdf_v2(req: OrderRequestV2):

  start_all = time.perf_counter()
  logger.info("PDF(v2) generation started")

  header = req.header.model_dump()
  missing_supplier_codes = {
    it.supplier_code for it in req.items
    if (it.supplier_code not in (None, "")) and not (it.supplier_name and it.supplier_name.strip())
  }
  supplier_name_map: dict[str, str] = {}
  if missing_supplier_codes:
    try:
      supplier_name_map = _fetch_supplier_names(missing_supplier_codes)
    except Exception as exc:  # pragma: no cover - defensive
      logger.warning("Supplier name lookup failed: %s", exc)

  pdf_header = {
    "order_date": header.get("order_date"),
    "delivery_date": header.get("delivery_date"),
 #   "nyuka_shidai": header.get("nyuka_shidai"),
 #   "drafter_name": header.get("drafter_name"),
    "customer_cd": header.get("customer_cd") or header.get("tcode"),
    "customer_name": header.get("customer_name"),
    "tantou_cd": header.get("tantou_cd"),
    "tantou_name": header.get("tantou_name"),
    "shipto_cd": header.get("shipto_cd") or header.get("jcode"),
    "shipto_name": header.get("shipto_name"),
    "order_no": header.get("order_no"),
  }

  pdf_items = []
  for it in req.items:
    qty = it.qty
    sales_unit_price = it.price
    sales_amount = it.sales_amount
    if sales_amount is None and sales_unit_price is not None:
      sales_amount = sales_unit_price * qty

    buy_amount = it.purchase_amount
    if buy_amount is None and it.purchase_price is not None:
      buy_amount = it.purchase_price * qty

    supplier_name = it.supplier_name or supplier_name_map.get(it.supplier_code or "", "")

    pdf_items.append({
      "item_name": it.name,
      "qty": qty,
      "sales_unit_price": sales_unit_price,
      "sales_amount": sales_amount,
      "spec": it.spec,
      "unit_name": it.unit_name,
      "irisu_name": it.irisu_name,
      "buy_unit_price": it.purchase_price,
      "buy_amount": buy_amount,
      "item_cd": it.scode,
      "supplier_cd": it.supplier_code,
      "supplier_name": supplier_name,
      "delivery_place_cd": it.delivery_place_cd,
      "delivery_place_name": it.delivery_place_name,
      "line_note": it.line_note,
    })

  start_pdf = time.perf_counter()
  pdf_bytes = build_order_pdf_bytes(header=pdf_header, items=pdf_items)
  pdf_time = time.perf_counter() - start_pdf
  logger.info("PDF(v2) build finished: %.3f sec", pdf_time)

  total_time = time.perf_counter() - start_all
  logger.info("PDF(v2) generation completed: %.3f sec", total_time)

  filename = f"order_{req.header.order_date}.pdf"
  headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
  return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="ui")
