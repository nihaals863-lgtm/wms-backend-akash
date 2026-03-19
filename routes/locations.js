const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate, requireRole } = require('../middlewares/auth');

router.use(authenticate);
router.get('/', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'picker', 'packer', 'viewer'), locationController.list);
router.get('/:id', requireRole('super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'), locationController.getById);
router.post('/', requireRole('super_admin', 'company_admin'), locationController.create);
router.put('/:id', requireRole('super_admin', 'company_admin'), locationController.update);
router.delete('/:id', requireRole('super_admin', 'company_admin'), locationController.remove);

module.exports = router;
