# APIスキーマ
from __future__ import annotations

from datetime import date
from typing import List, Optional, Literal

from pydantic import BaseModel, Field

class OrderItem(BaseModel):
    scode: str = Field(..., description="商品コード")
    irank: str = Field(..., description="入数ランク")
    qty: int = Field(..., ge=1, description="数量")


class OrderHeader(BaseModel):
    customer_name: str = Field(..., description="得意先名")
    order_date: date = Field(..., description="受注日")
    tantou_name: Optional[str] = Field(None, description="担当者名")
    tcode: Optional[str] = Field(None, description="得意先コード")
    jcode: Optional[str] = Field(None, description="需要先コード")
    customer_cd: Optional[str] = Field(None, description="得意先コード（帳票表示用）")
    shipto_cd: Optional[str] = Field(None, description="需要先コード（帳票表示用）")
    shipto_name: Optional[str] = Field(None, description="需要先名（帳票表示用）")
    tantou_cd: Optional[str] = Field(None, description="担当者コード（帳票表示用）")
class OrderRequest(BaseModel):
    header: OrderHeader
    items: List[OrderItem]


# ---- 単価解決 req ----

class PricingResolveRequest(BaseModel):
    tcode: str = Field(..., description="得意先コード/担当コード等（運用に合わせて）")
    jcode: str = Field(..., description="住所コード/条件コード等（運用に合わせて）")
    scode: str = Field(..., description="商品コード")
    irank: str = Field(..., description="入数ランク")


# ---- 単価解決 res）----

class PricingResolveResult(BaseModel):
    sales_price: Optional[int] = Field(None, description="売上単価（取得できない場合はnull）")
    source: Literal["jusho", "tokusho", "teika", "none"] = Field(
        ..., description="価格の由来（住所/特商/定価/なし）"
    )
    supplier_code: Optional[str] = Field(None, description="仕入先コード（あれば）")
    purchase_price: Optional[int] = Field(None, description="仕入単価（あれば）")


# ---- 注文 v2（PDF用）----

class OrderItemConfirmed(BaseModel):
    """
    画面確定済みの明細。
    name/price は画面確定値を受け取る。
    """
    scode: str = Field(..., description="商品コード")
    irank: str = Field(..., description="入数ランク")
    qty: int = Field(..., ge=1, description="数量")
    name: str = Field(..., description="商品名（画面で取得した表示名）")
    price: Optional[int] = Field(None, description="売上単価（取れない場合はnull）")
    sales_amount: Optional[int] = Field(None, description="売上金額（画面で計算した値）")
    purchase_price: Optional[int] = Field(None, description="仕入単価（画面で確定した値）")
    purchase_amount: Optional[int] = Field(None, description="仕入金額（画面で計算した値）")
    spec: Optional[str] = Field(None, description="規格/仕様（帳票表示用）")
    unit_name: Optional[str] = Field(None, description="単位名（帳票表示用）")
    irisu_name: Optional[str] = Field(None, description="入数名（帳票表示用）")
    supplier_code: Optional[str] = Field(None, description="仕入先コード（帳票表示用）")
    supplier_name: Optional[str] = Field(None, description="仕入先名（帳票表示用）")
    delivery_place_cd: Optional[str] = Field(None, description="納品場所コード（帳票表示用）")
    delivery_place_name: Optional[str] = Field(None, description="納品場所名（帳票表示用）")
    line_note: Optional[str] = Field(None, description="行備考（帳票表示用）")


class OrderRequestV2(BaseModel):
    """
    v2: name/price 前提。PDF生成時はDB参照なし。
    """
    header: OrderHeader
    items: List[OrderItemConfirmed]


# ---- 商品マスタ----

class ProductItem(BaseModel):
    product_cd: str = Field(..., description="商品コード")
    product_name: Optional[str] = Field(None, description="商品名")
    spec: Optional[str] = Field(None, description="規格/仕様")
    maker_cd: Optional[str] = Field(None, description="メーカーコード")
    maker_name: Optional[str] = Field(None, description="メーカー名")
    maker_part_no: Optional[str] = Field(None, description="メーカー品番")


# ---- 単価解決----

class PricingResolvedDetail(BaseModel):
    price_kbn: str = Field(..., description="価格区分（例：特価/通常など）")
    teika: int = Field(..., description="定価")
    sales_unit_price: int = Field(..., description="売上単価（確定値）")
    purchase_unit_price: int = Field(..., description="仕入単価（確定値）")
    supplier_code: Optional[str] = Field(None, description="仕入先コード（あれば）")


# ---- 旧API互換 ----

from pydantic import BaseModel
from typing import Optional

class PricingResolveRequest(BaseModel):
    tcode: str
    jcode: str
    scode: str
    irank: str

class PricingResolveResponse(BaseModel):
    source: str                 # 区分(需商/得商/定価/未設定)
    teika: int                  # 定価(未ヒットは0)
    sales_price: int            # 売上単価(未ヒットは0)
    purchase_price: int         # 仕入単価(未ヒットは0)
    supplier_code: Optional[str] = None  # 仕入先コード
