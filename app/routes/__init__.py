# APIルータ集約
from fastapi import APIRouter
from .customers import router as customers_router
from .shipto import router as shipto_router
from .makers import router as makers_router
from .products import router as products_router
from .pricing import router as pricing_router

api_router = APIRouter()
api_router.include_router(customers_router)
api_router.include_router(shipto_router)
api_router.include_router(makers_router)
api_router.include_router(products_router)
api_router.include_router(pricing_router)
