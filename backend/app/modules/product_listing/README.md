# Product Listing Module

**Status**: NOT IMPLEMENTED (Planned for M3)

## Overview
Enables sellers to create, manage, and list products in the TECHNOVA marketplace. Handles product catalog, inventory management, and product discoverability.

## Responsibilities
- Product creation and editing
- Inventory/stock management
- Product categorization and tagging
- Product images and media management
- Search and filtering
- Product reviews and ratings
- Product variations (size, color, etc.)
- Bulk product operations
- Product analytics and insights

## Planned API Endpoints
```
# Products
GET    /api/v1/products                   - List all products (public)
GET    /api/v1/products/{id}              - Get product details
POST   /api/v1/sellers/products           - Create product (seller)
PUT    /api/v1/sellers/products/{id}      - Update product (seller)
DELETE /api/v1/sellers/products/{id}      - Delete product (seller)
PATCH  /api/v1/sellers/products/{id}/status - Change status
GET    /api/v1/sellers/products           - List my products (seller)
GET    /api/v1/sellers/products/{id}/analytics - Product analytics

# Product Images
POST   /api/v1/sellers/products/{id}/images - Upload product image
DELETE /api/v1/sellers/products/{id}/images/{img_id} - Delete image

# Inventory
PATCH  /api/v1/sellers/products/{id}/inventory - Update stock
GET    /api/v1/sellers/products/low-stock - Get low stock items (seller)
```

## Database
**Primary**: PostgreSQL

### Tables
- `products` - Product listings
- `product_images` (future) - Product media
- `product_variants` (future) - Size, color, etc.
- `product_inventory` (future) - Stock tracking per warehouse
- `product_categories` (future) - Category hierarchy

### Enums
- `ProductStatus`: DRAFT, PUBLISHED, ARCHIVED, DELETED

## External Integrations
- **Object Storage** (S3) - Product images and documents
- **Search Service** (Elasticsearch/future) - Full-text search
- **Recommendation Engine** (future) - Similar products

## Dependencies
- SQLAlchemy ORM
- Boto3 for S3 integration
- PIL/Pillow for image processing (future)

## Key Features
- Multi-image product support
- Product variants (coming soon)
- Inventory tracking
- Auto-archival of low-selling products (future)
- Integration with buyer discovery module

## Future Enhancements
- Product variants management
- Batch import/export (CSV)
- Product attributes and specifications
- Digital product support (PDFs, software)
- Pricing rules and discounts
- Multi-warehouse inventory
- Suppliers and dropshipping integration
- AI-powered product description generation
