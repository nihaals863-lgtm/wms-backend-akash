const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { authenticate, requireRole } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer'), purchaseOrderController.list);
router.get('/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer'), purchaseOrderController.getById);
router.post('/', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), purchaseOrderController.create);
router.put('/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), purchaseOrderController.update);
router.delete('/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), purchaseOrderController.remove);
router.post('/:id/approve', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), purchaseOrderController.approve);

module.exports = router;
