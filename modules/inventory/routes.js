const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/inventoryController');
const { authenticate, requireRole } = require('../../middlewares/auth');

router.use(authenticate);

// All roles can read products for scan screen
const readRoles = ['super_admin', 'company_admin', 'inventory_manager', 'warehouse_manager', 'picker', 'packer', 'viewer'];
const writeRoles = ['super_admin', 'company_admin', 'inventory_manager'];
// Scan roles — picker, packer, warehouse_manager can also do adjustments for quick scan
const scanRoles = ['super_admin', 'company_admin', 'inventory_manager', 'warehouse_manager', 'picker', 'packer'];

router.get('/products', requireRole(...readRoles), inventoryController.listProducts);
router.get('/products/:id', requireRole(...readRoles), inventoryController.getProduct);
router.post('/products', requireRole(...writeRoles), inventoryController.createProduct);
router.post('/products/bulk', requireRole(...writeRoles), inventoryController.bulkCreateProducts);
router.post('/products/:id/alternative-skus', requireRole(...writeRoles), inventoryController.addAlternativeSku);
router.put('/products/:id', requireRole(...writeRoles), inventoryController.updateProduct);
router.delete('/products/:id', requireRole(...writeRoles), inventoryController.removeProduct);

router.get('/categories', requireRole(...readRoles), inventoryController.listCategories);
router.post('/categories', requireRole(...writeRoles), inventoryController.createCategory);
router.put('/categories/:id', requireRole(...writeRoles), inventoryController.updateCategory);
router.delete('/categories/:id', requireRole(...writeRoles), inventoryController.removeCategory);

router.get('/stock', requireRole(...readRoles), inventoryController.listStock);
router.get('/stock/by-best-before-date', requireRole(...readRoles), inventoryController.listStockByBestBeforeDate);
router.get('/stock/by-location', requireRole(...readRoles), inventoryController.listStockByLocation);
router.post('/stock', requireRole(...writeRoles), inventoryController.createStock);
router.put('/stock/:id', requireRole(...writeRoles), inventoryController.updateStock);
router.delete('/stock/:id', requireRole(...writeRoles), inventoryController.removeStock);

// Quick Scan: picker, packer, warehouse_manager bhi adjustments kar sakte hain
router.get('/adjustments', requireRole(...readRoles), inventoryController.listAdjustments);
router.post('/adjustments', requireRole(...scanRoles), inventoryController.createAdjustment);

router.get('/cycle-counts', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer'), inventoryController.listCycleCounts);
router.post('/cycle-counts', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), inventoryController.createCycleCount);
router.post('/cycle-counts/:id/complete', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), inventoryController.completeCycleCount);

router.get('/batches', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer'), inventoryController.listBatches);
router.get('/batches/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer'), inventoryController.getBatch);
router.post('/batches', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), inventoryController.createBatch);
router.put('/batches/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), inventoryController.updateBatch);
router.delete('/batches/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), inventoryController.removeBatch);

router.get('/movements', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer'), inventoryController.listMovements);
router.get('/movements/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer'), inventoryController.getMovement);
router.post('/movements', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), inventoryController.createMovement);
router.put('/movements/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), inventoryController.updateMovement);
router.delete('/movements/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), inventoryController.removeMovement);

// New Inventory System
router.get('/', requireRole(...readRoles), inventoryController.listInventory);
router.get('/logs', requireRole(...readRoles), inventoryController.listInventoryLogs);
router.post('/stock-in', requireRole(...writeRoles), inventoryController.stockIn);
router.post('/stock-out', requireRole(...writeRoles), inventoryController.stockOut);
router.post('/transfer', requireRole(...writeRoles), inventoryController.transfer);

module.exports = router;
