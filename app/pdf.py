# PDF生成
from __future__ import annotations

from io import BytesIO
import json
import os
from datetime import date, datetime
from typing import Any, Optional

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from pypdf import PdfReader, PdfWriter, PageObject  # pip install pypdf


# ---- 設定 ----
_FONT_REGISTERED = False
_FONT_NAME = "IPAexGothic"

DEFAULT_TEMPLATE_ID = "default"

LayoutDict = dict[str, Any]
_LAYOUT_CACHE: dict[str, tuple[float, LayoutDict]] = {}

# 文字サイズ
FONT_SIZE_HEADER = 8
FONT_SIZE_MAIN = 8
FONT_SIZE_SMALL = 6

DEFAULT_HEADER_FONT_SIZES: dict[str, float] = {
    "order_date": FONT_SIZE_HEADER,
    "tantou": FONT_SIZE_HEADER,
    "customer_cd": FONT_SIZE_SMALL,
    "customer_name": FONT_SIZE_SMALL,
    "shipto_cd": FONT_SIZE_SMALL,
    "shipto_name": FONT_SIZE_SMALL,
}

DEFAULT_ITEM_FONT_SIZES: dict[str, float] = {
    "item_name": FONT_SIZE_SMALL,
    "spec": FONT_SIZE_SMALL,
    "item_cd": FONT_SIZE_SMALL,
    "qty": FONT_SIZE_MAIN,
    "unit_name": FONT_SIZE_SMALL,
    "irisu_name": FONT_SIZE_SMALL,
    "sales_unit": FONT_SIZE_MAIN,
    "sales_amount": FONT_SIZE_MAIN,
    "buy_unit": FONT_SIZE_MAIN,
    "buy_amount": FONT_SIZE_MAIN,
    "supplier_cd": FONT_SIZE_SMALL,
    "supplier_name": FONT_SIZE_SMALL,
    "delivery_place_name": FONT_SIZE_SMALL,
    "line_note": FONT_SIZE_SMALL,
}

# ---- フォント ----
def ensure_japanese_font() -> None:
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return

    # プロジェクトルート（appの1つ上）
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    font_path = os.path.join(project_root, "assets", "fonts", "IPAexGothic.ttf")

    if not os.path.exists(font_path):
        raise FileNotFoundError(
            f"Japanese font not found: {font_path}\n"
            "Place IPAexGothic.ttf under assets/fonts/."
        )

    pdfmetrics.registerFont(TTFont(_FONT_NAME, font_path))
    _FONT_REGISTERED = True


# ---- ユーティリティ ----
def _project_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _templates_dir() -> str:
    return os.path.join(_project_root(), "assets", "templates")


def _layouts_dir() -> str:
    return os.path.join(_project_root(), "assets", "layouts")


def _template_pdf_path(template_pdf_name: str) -> str:
    return os.path.join(_templates_dir(), template_pdf_name)


def _layout_config_path(template_id: str) -> str:
    """Return layout path, preferring .json but falling back to .jsonc."""
    base = os.path.join(_layouts_dir(), template_id)
    for ext in (".json", ".jsonc"):
        candidate = base + ext
        if os.path.exists(candidate):
            return candidate
    return base + ".json"


def _strip_jsonc_comments(text: str) -> str:
    """Remove // and /* */ comments without touching quoted strings."""
    out: list[str] = []
    i = 0
    in_string = False
    string_quote = ""
    escape = False

    while i < len(text):
        ch = text[i]

        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == string_quote:
                in_string = False
            i += 1
            continue

        if ch in ("'", '"'):
            in_string = True
            string_quote = ch
            out.append(ch)
            i += 1
            continue

        if ch == "/" and i + 1 < len(text):
            nxt = text[i + 1]
            if nxt == "/":
                i += 2
                while i < len(text) and text[i] not in ("\n", "\r"):
                    i += 1
                continue
            if nxt == "*":
                i += 2
                while i + 1 < len(text) and not (text[i] == "*" and text[i + 1] == "/"):
                    i += 1
                i += 2
                continue

        out.append(ch)
        i += 1

    return "".join(out)


def _load_jsonc(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as fp:
        text = fp.read()
    return json.loads(_strip_jsonc_comments(text))


def _mm_to_pt(value: Any, *, default: float = 0.0) -> float:
    if value is None:
        return default
    return float(value) * mm


def _convert_field_configs(raw: dict[str, Any], section: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for key, value in raw.items():
        font_size = None
        position = value
        if isinstance(value, dict):
            position = value.get("pos") or value.get("position")
            font_size = value.get("font_size")

        if not isinstance(position, (list, tuple)) or len(position) != 2:
            raise ValueError(f"{section}.{key} must provide pos=[x_mm, y_mm]")

        if font_size is not None:
            try:
                font_size = float(font_size)
            except Exception as exc:  # pragma: no cover - defensive
                raise ValueError(f"{section}.{key}.font_size must be numeric") from exc

        out[key] = {
            "pos": (_mm_to_pt(position[0]), _mm_to_pt(position[1])),
            "font_size": font_size,
        }
    return out


def _resolve_font_size(
    cfg: dict[str, Any],
    key: str,
    default_map: dict[str, float],
    fallback: float,
) -> float:
    if cfg.get("font_size") is not None:
        return float(cfg["font_size"])
    return float(default_map.get(key, fallback))


def _normalize_layout(config: dict[str, Any]) -> LayoutDict:
    template_pdf_name = config.get("template_pdf_name")
    if not template_pdf_name:
        raise ValueError("template_pdf_name is required in layout config")

    header_raw = config.get("header") or {}
    item_fields_raw = config.get("item_fields") or {}
    items_per_page = int(config.get("items_per_page") or 0)
    if items_per_page <= 0:
        raise ValueError("items_per_page must be a positive integer")

    block_top_y_mm = config.get("block_top_y_mm")
    block_pitch_mm = config.get("block_pitch_mm")
    item_name_max_width_mm = config.get("item_name_max_width_mm")
    if block_top_y_mm is None or block_pitch_mm is None or item_name_max_width_mm is None:
        raise ValueError("block_top_y_mm, block_pitch_mm, item_name_max_width_mm are required")

    layout: LayoutDict = {
        "template_pdf_path": _template_pdf_path(template_pdf_name),
        "offset_x": _mm_to_pt(config.get("offset_x_mm", 0)),
        "offset_y": _mm_to_pt(config.get("offset_y_mm", 0)),
        "header": _convert_field_configs(header_raw, "header"),
        "items_per_page": items_per_page,
        "block_top_y": _mm_to_pt(block_top_y_mm),
        "block_pitch": _mm_to_pt(block_pitch_mm),
        "item_fields": _convert_field_configs(item_fields_raw, "item_fields"),
        "item_name_max_width": _mm_to_pt(item_name_max_width_mm),
    }
    return layout


def _load_layout(template_id: str) -> LayoutDict:
    normalized_id = template_id or DEFAULT_TEMPLATE_ID
    config_path = _layout_config_path(normalized_id)
    if not os.path.exists(config_path):
        raise FileNotFoundError(
            f"Layout config not found for template '{normalized_id}': {config_path}"
        )

    current_mtime = os.path.getmtime(config_path)
    cached = _LAYOUT_CACHE.get(normalized_id)
    if cached and cached[0] == current_mtime:
        return cached[1]

    config = _load_jsonc(config_path)
    layout = _normalize_layout(config)
    _LAYOUT_CACHE[normalized_id] = (current_mtime, layout)
    return layout


def _pos(layout: LayoutDict, x: float, y: float) -> tuple[float, float]:
    """全体オフセット込み座標"""
    return x + float(layout["offset_x"]), y + float(layout["offset_y"])


def _safe_str(v: Any) -> str:
    return "" if v is None else str(v)


def _to_int(v: Any) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(v)
    except Exception:
        try:
            return int(float(v))
        except Exception:
            return None


def _fmt_int_or_raw(v: Any) -> str:
    iv = _to_int(v)
    if iv is None:
        return _safe_str(v)
    return f"{iv:,}"


def _fmt_ymd(v: Any) -> str:
    if v is None or v == "":
        return ""
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y/%m/%d")

    s = _safe_str(v).strip()
    for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%Y.%m.%d", "%Y%m%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y/%m/%d")
        except Exception:
            pass
    return s


def clip_text_to_width(text: str, font_name: str, font_size: float, max_width_pt: float) -> str:
    """等幅でないため、幅で切る。"""
    if not text:
        return ""

    if pdfmetrics.stringWidth(text, font_name, font_size) <= max_width_pt:
        return text

    suffix = "…"
    max_width_pt2 = max_width_pt - pdfmetrics.stringWidth(suffix, font_name, font_size)
    if max_width_pt2 <= 0:
        return ""

    out = ""
    for ch in text:
        if pdfmetrics.stringWidth(out + ch, font_name, font_size) > max_width_pt2:
            break
        out += ch
    return out + suffix


# ---- 描画（ヘッダ）----
def _draw_header(layout: LayoutDict, c: canvas.Canvas, header: dict[str, Any]) -> None:
    fields = layout["header"]

    def draw_field(key: str, text: str, default_font: float) -> None:
        cfg = fields[key]
        font_size = _resolve_font_size(cfg, key, DEFAULT_HEADER_FONT_SIZES, default_font)
        c.setFont(_FONT_NAME, font_size)
        x0, y0 = cfg["pos"]
        x, y = _pos(layout, float(x0), float(y0))
        c.drawString(x, y, text)

    draw_field("order_date", _fmt_ymd(header.get("order_date", "")), FONT_SIZE_HEADER)
    draw_field("tantou", _safe_str(header.get("tantou_name", "")), FONT_SIZE_HEADER)
    draw_field("customer_cd", _safe_str(header.get("customer_cd", "")), FONT_SIZE_SMALL)
    draw_field("customer_name", _safe_str(header.get("customer_name", "")), FONT_SIZE_SMALL)
    draw_field("shipto_cd", _safe_str(header.get("shipto_cd", "")), FONT_SIZE_SMALL)
    draw_field("shipto_name", _safe_str(header.get("shipto_name", "")), FONT_SIZE_SMALL)


# ---- 描画（明細）----
def _draw_item_block(layout: LayoutDict, c: canvas.Canvas, block_top_y: float, it: dict[str, Any]) -> None:
    fields = layout["item_fields"]

    def _field_cfg(key: str) -> dict[str, Any]:
        return fields[key]

    def _xy(cfg: dict[str, Any]) -> tuple[float, float]:
        x, rel_y = cfg["pos"]
        return _pos(layout, float(x), float(block_top_y) - float(rel_y))

    def _field_font_size(key: str, default_font: float) -> float:
        return _resolve_font_size(_field_cfg(key), key, DEFAULT_ITEM_FONT_SIZES, default_font)

    def _draw_with_font(key: str, text: str, font_size: float, *, align: str = "left") -> None:
        cfg = _field_cfg(key)
        x, y = _xy(cfg)
        c.setFont(_FONT_NAME, font_size)
        if align == "right":
            c.drawRightString(x, y, text)
        else:
            c.drawString(x, y, text)

    def _draw(key: str, text: str, *, align: str = "left", default_font: float = FONT_SIZE_MAIN) -> None:
        font_size = _field_font_size(key, default_font)
        _draw_with_font(key, text, font_size, align=align)

    # 商品名（幅で切る）
    name_font = _field_font_size("item_name", FONT_SIZE_SMALL)
    name = _safe_str(it.get("item_name", ""))
    name = clip_text_to_width(name, _FONT_NAME, name_font, float(layout["item_name_max_width"]))
    _draw_with_font("item_name", name, name_font)

    # 規格・商品CD
    _draw("spec", _safe_str(it.get("spec", "")), default_font=FONT_SIZE_SMALL)
    _draw("item_cd", _safe_str(it.get("item_cd", "")), default_font=FONT_SIZE_SMALL)

    # 数量（右寄せ）
    _draw("qty", _safe_str(it.get("qty", "")), align="right", default_font=FONT_SIZE_MAIN)

    # 単位名 / 入数名
    _draw("unit_name", _safe_str(it.get("unit_name", "")), align="right", default_font=FONT_SIZE_SMALL)
    _draw("irisu_name", _safe_str(it.get("irisu_name", "")), align="right", default_font=FONT_SIZE_SMALL)

    # 売単価・売上金額
    _draw("sales_unit", _fmt_int_or_raw(it.get("sales_unit_price", "")), align="right", default_font=FONT_SIZE_MAIN)
    _draw("sales_amount", _fmt_int_or_raw(it.get("sales_amount", "")), align="right", default_font=FONT_SIZE_MAIN)

    # 仕入単価・仕入金額
    _draw("buy_unit", _fmt_int_or_raw(it.get("buy_unit_price", "")), align="right", default_font=FONT_SIZE_MAIN)
    _draw("buy_amount", _fmt_int_or_raw(it.get("buy_amount", "")), align="right", default_font=FONT_SIZE_MAIN)

    # 仕入先 / 納品場所 / 行備考
    _draw("supplier_cd", _safe_str(it.get("supplier_cd", "")), default_font=FONT_SIZE_SMALL)
    _draw("supplier_name", _safe_str(it.get("supplier_name", "")), default_font=FONT_SIZE_SMALL)
    _draw("delivery_place_name", _safe_str(it.get("delivery_place_name", "")), default_font=FONT_SIZE_SMALL)
    _draw("line_note", _safe_str(it.get("line_note", "")), default_font=FONT_SIZE_SMALL)




# ---- オーバーレイPDF（文字のみ）----
def _make_overlay_pdf_bytes(layout: LayoutDict, header: dict[str, Any], items: list[dict[str, Any]]) -> bytes:
    ensure_japanese_font()

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    per_page = int(layout["items_per_page"])
    pages = (len(items) + per_page - 1) // per_page
    pages = max(pages, 1)

    block_top_y = float(layout["block_top_y"])
    pitch = float(layout["block_pitch"])

    for page_idx in range(pages):
        _draw_header(layout, c, header)

        start = page_idx * per_page
        chunk = items[start:start + per_page]

        for i, it in enumerate(chunk):
            _draw_item_block(layout, c, block_top_y - i * pitch, it)

        c.showPage()

    c.save()
    return buf.getvalue()


# ---- テンプレPDFに合成 ----
def _merge_with_template(template_pdf_path: str, overlay_pdf_bytes: bytes) -> bytes:
    tmpl = PdfReader(template_pdf_path)
    over = PdfReader(BytesIO(overlay_pdf_bytes))

    writer = PdfWriter()

    for i in range(len(over.pages)):
        template_page = tmpl.pages[i % len(tmpl.pages)]
        base = PageObject.create_blank_page(
            width=float(template_page.mediabox.width),
            height=float(template_page.mediabox.height),
        )
        base.merge_page(template_page)
        base.merge_page(over.pages[i])
        writer.add_page(base)

    out = BytesIO()
    writer.write(out)
    return out.getvalue()


# ---- 公開：PDFバイト列生成 ----
def build_order_pdf_bytes(
    header: dict,
    items: list[dict],
    *,
    template_id: str = DEFAULT_TEMPLATE_ID,
) -> bytes:
    """テンプレPDFに文字を重ねたPDF(bytes)を返す。"""

    layout = _load_layout(template_id)
    template_pdf_path = layout["template_pdf_path"]

    if not os.path.exists(template_pdf_path):
        raise FileNotFoundError(
            f"Template PDF not found: {template_pdf_path}\n"
            "Place template under assets/templates/."
        )

    overlay = _make_overlay_pdf_bytes(layout, header, items)
    return _merge_with_template(template_pdf_path, overlay)
