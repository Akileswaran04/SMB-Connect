from typing import List, Optional


from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import require_roles, get_db
from app.core.exceptions import ValidationException
from app.modules.admin.dependencies import get_admin_service
from app.modules.admin.schemas import (
    VerificationResponse, VerificationDecision, AuditLogResponse, SellerDecision, UserUpdate,
    ProductModeration, ReportResolution, CategoryIn,
)
from app.modules.admin.service import AdminService
from app.modules.platform.service import PlatformSettingsService

router = APIRouter()

admin_only = require_roles("admin")


@router.get("/dashboard")
async def dashboard(_=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    return await service.dashboard()


# ── Users ──

@router.get("/users")
async def list_users(
    role: Optional[str] = Query(None), q: Optional[str] = Query(None, max_length=100),
    limit: int = Query(100, ge=1, le=500),
    _=Depends(admin_only), service: AdminService = Depends(get_admin_service),
):
    return await service.list_users(role, q, limit)


@router.patch("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate, admin=Depends(admin_only),
                      service: AdminService = Depends(get_admin_service)):
    """Verify, suspend, activate or change a user's role."""
    return await service.update_user(admin, user_id, data.model_dump())


# ── Sellers & verification ──

@router.get("/sellers")
async def list_sellers(status_filter: Optional[str] = Query(None, alias="status"),
                       _=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    return await service.list_sellers(status_filter)


@router.get("/sellers/{seller_id}")
async def get_seller(seller_id: int, _=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    return await service.get_seller(seller_id)


@router.patch("/sellers/{seller_id}/verification")
async def decide_seller(seller_id: int, data: SellerDecision, admin=Depends(admin_only),
                        service: AdminService = Depends(get_admin_service)):
    """APPROVE / REJECT / REQUEST INFORMATION."""
    return await service.decide_seller(admin, seller_id, data.decision, data.note)


@router.get("/verifications", response_model=List[VerificationResponse])
async def list_verifications(
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _=Depends(admin_only),
    service: AdminService = Depends(get_admin_service),
):
    return await service.list_verifications(status=status, limit=limit, offset=offset)


@router.patch("/verifications/{verification_id}")
async def review_verification(
    verification_id: int,
    data: VerificationDecision,
    admin_user=Depends(admin_only),
    service: AdminService = Depends(get_admin_service),
):
    return await service.review_verification(admin_user.id, verification_id, data)


# ── Products, reports, categories ──

@router.get("/products")
async def list_products(status_filter: Optional[str] = Query(None, alias="status"), reported: bool = Query(False),
                        q: Optional[str] = Query(None, max_length=100),
                        _=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    return await service.list_products(status_filter, reported, q)


@router.patch("/products/{product_id}")
async def moderate_product(product_id: int, data: ProductModeration, admin=Depends(admin_only),
                           service: AdminService = Depends(get_admin_service)):
    return await service.moderate_product(admin, product_id, data.status, data.note)


@router.get("/reports")
async def list_reports(status_filter: Optional[str] = Query("open", alias="status"),
                       _=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    return await service.list_reports(status_filter or None)


@router.patch("/reports/{report_id}")
async def resolve_report(report_id: int, data: ReportResolution, admin=Depends(admin_only),
                         service: AdminService = Depends(get_admin_service)):
    return await service.resolve_report(admin, report_id, data.status, data.note, data.remove_product)


@router.get("/categories")
async def list_categories(_=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    return await service.list_categories()


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(data: CategoryIn, admin=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    if not data.name:
        raise ValidationException("A category name is required")
    return await service.save_category(admin, None, {k: v for k, v in data.model_dump().items() if v is not None})


@router.patch("/categories/{category_id}")
async def update_category(category_id: int, data: CategoryIn, admin=Depends(admin_only),
                          service: AdminService = Depends(get_admin_service)):
    return await service.save_category(admin, category_id, data.model_dump())


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, admin=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    await service.delete_category(admin, category_id)


# ── Orders, analytics, settings, settlements, audit ──

@router.get("/orders/{order_id}")
async def inspect_order(order_id: int, admin=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    """Buyer, seller, items, payment, shipment, tracking, chat and disputes in one view."""
    return await service.inspect_order(admin, order_id)


@router.get("/analytics")
async def analytics(days: int = Query(30, ge=1, le=365), _=Depends(admin_only),
                    service: AdminService = Depends(get_admin_service)):
    return await service.analytics(days)


@router.get("/settings")
async def get_settings(_=Depends(admin_only), db=Depends(get_db)):
    return await PlatformSettingsService(db).get_all()


@router.put("/settings")
async def update_settings(changes: dict, admin=Depends(admin_only), db=Depends(get_db),
                          service: AdminService = Depends(get_admin_service)):
    result = await PlatformSettingsService(db).update(changes)
    service._audit(admin.id, "settings.update", "platform_settings", None, str(changes))
    return result


@router.post("/settlements/run")
async def run_settlements(admin=Depends(admin_only), service: AdminService = Depends(get_admin_service)):
    return await service.run_settlements(admin)


@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    _=Depends(admin_only),
    service: AdminService = Depends(get_admin_service),
):
    return await service.list_audit_logs(limit=limit)
