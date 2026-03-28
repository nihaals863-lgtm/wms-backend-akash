require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const routes = require('./routes');
const superadminController = require('./controllers/superadminController');
const purchaseOrderController = require('./controllers/purchaseOrderController');
const goodsReceiptController = require('./controllers/goodsReceiptController');
const orderController = require('./controllers/orderController');
const inventoryController = require('./controllers/inventoryController');
const { authenticate, requireSuperAdmin, requireRole, requireAdmin, requireStaff, requireClient } = require('./middlewares/auth');
const dashboardController = require('./controllers/dashboardController');
const reportController = require('./controllers/reportController');
const analyticsController = require('./controllers/analyticsController');
const cronService = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sales orders - register FIRST so DELETE /api/orders/sales/:id never 404s
const soRoles = ['super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'picker', 'packer', 'viewer'];
const soWriteRoles = ['super_admin', 'company_admin'];
app.get('/api/orders/sales', authenticate, requireRole(...soRoles), orderController.list);
app.post('/api/orders/sales', authenticate, requireRole(...soWriteRoles), orderController.create);
app.get('/api/orders/sales/:id', authenticate, requireRole(...soRoles), orderController.getById);
app.put('/api/orders/sales/:id', authenticate, requireRole(...soWriteRoles), orderController.update);
app.delete('/api/orders/sales/:id', authenticate, requireRole(...soWriteRoles), orderController.remove);

// Dashboard - single route /api/dashboard/:type so stats + charts dono chalenge
const dashboardRoles = ['super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer', 'picker', 'packer'];
app.get('/api/dashboard/:type', authenticate, requireRole(...dashboardRoles), (req, res, next) => {
  const type = (req.params.type || '').toLowerCase();
  if (type === 'stats') return dashboardController.stats(req, res, next);
  if (type === 'charts') return dashboardController.charts(req, res, next);
  res.status(404).json({ success: false, message: 'Not found. Use /api/dashboard/stats or /api/dashboard/charts' });
});
app.get('/api/reports', authenticate, requireRole(...dashboardRoles), reportController.list);
app.get('/api/reports/:id', authenticate, requireRole(...dashboardRoles), reportController.getById);
app.get('/api/reports/:id/download', authenticate, requireRole(...dashboardRoles), reportController.download);
app.post('/api/reports', authenticate, requireRole(...dashboardRoles), reportController.create);
app.put('/api/reports/:id', authenticate, requireRole(...dashboardRoles), reportController.update);
app.delete('/api/reports/:id', authenticate, requireRole(...dashboardRoles), reportController.remove);

// AI / Predictions
const predictionController = require('./controllers/predictionController');
app.get('/api/predictions', authenticate, requireRole(...dashboardRoles), predictionController.list);

// Analytics
app.post('/api/analytics/pricing-calculate', authenticate, requireRole(...dashboardRoles), analyticsController.pricingCalculate);
app.get('/api/analytics/margins', authenticate, requireRole(...dashboardRoles), analyticsController.marginsReport);

// Super admin APIs - register first so they always work
app.get('/api/superadmin/stats', authenticate, requireSuperAdmin, superadminController.stats);
app.get('/api/superadmin/reports', authenticate, requireSuperAdmin, superadminController.reports);

// Purchase orders - explicit routes so 404 doesn't happen
const poRoles = ['super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'viewer'];
const poWriteRoles = ['super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager'];
app.get('/api/purchase-orders', authenticate, requireClient, purchaseOrderController.list);
app.get('/api/purchase-orders/:id', authenticate, requireClient, purchaseOrderController.getById);
app.post('/api/purchase-orders', authenticate, requireStaff, purchaseOrderController.create);
app.put('/api/purchase-orders/:id', authenticate, requireStaff, purchaseOrderController.update);
app.delete('/api/purchase-orders/:id', authenticate, requireAdmin, purchaseOrderController.remove);
app.post('/api/purchase-orders/:id/approve', authenticate, requireAdmin, purchaseOrderController.approve);

// Goods receiving - explicit routes
app.get('/api/goods-receiving', authenticate, requireClient, goodsReceiptController.list);
app.get('/api/goods-receiving/:id', authenticate, requireClient, goodsReceiptController.getById);
app.post('/api/goods-receiving', authenticate, requireStaff, goodsReceiptController.create);
app.put('/api/goods-receiving/:id/receive', authenticate, requireStaff, goodsReceiptController.updateReceived);
app.put('/api/goods-receiving/:id/asn', authenticate, requireStaff, goodsReceiptController.updateAsnItems);
app.post('/api/goods-receiving/:id/finalize', authenticate, requireStaff, goodsReceiptController.finalizeReceiving);
app.delete('/api/goods-receiving/:id', authenticate, requireAdmin, goodsReceiptController.remove);

// Inventory products - explicit DELETE so /api/inventory/products/:id never 404s
const invProductRoles = ['super_admin', 'company_admin', 'inventory_manager'];
app.delete('/api/inventory/products/:id', authenticate, requireRole(...invProductRoles), inventoryController.removeProduct);

// POST /api/products/:id/alternative-skus (same handler as inventory, so client can call either path)
app.post('/api/products/:id/alternative-skus', authenticate, requireRole(...invProductRoles), inventoryController.addAlternativeSku);

const returnRoutes = require('./routes/returnRoutes');
app.use('/api/returns', returnRoutes);

app.use(routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});



async function start() {
  try {
    await sequelize.authenticate();
    const dialect = sequelize.getDialect();
    if (dialect === 'sqlite') {
      const storage = sequelize.config.storage || path.join(__dirname, 'warehouse_wms.sqlite');
      const fullPath = path.isAbsolute(storage) ? storage : path.resolve(process.cwd(), storage);
      console.log('---');
      console.log('Database name: warehouse_wms');
      console.log('SQLite file:', fullPath);
      console.log('(Data yahi save hoga - IDs 1, 2, 3...)');
      console.log('---');
    } else {
      console.log('---');
      console.log('Database name:', sequelize.config.database);
      console.log('MySQL host:', sequelize.config.host || 'localhost');
      console.log('---');
    }
    // SQLite: allow alter (drop/recreate tables) by disabling FK checks during sync
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF');
      const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup'");
      const queryInterface = sequelize.getQueryInterface();
      for (const t of tables) {
        try {
          await queryInterface.dropTable(t.name);
          console.log('Dropped leftover backup table:', t.name);
        } catch (e) {
          // ignore
        }
      }
    }
    await sequelize.sync({ alter: dialect === 'sqlite' });
    
    // MySQL: manual column fixes if alter is skipped
    if (dialect === 'mysql') {
       const manualCols = [
         { t: 'inventory_adjustments', c: 'batch_id', type: 'INT' },
         { t: 'inventory_adjustments', c: 'client_id', type: 'INT' },
         { t: 'inventory_adjustments', c: 'location_id', type: 'INT' },
         { t: 'inventory_adjustments', c: 'best_before_date', type: 'DATE' },
         { t: 'inventory_adjustments', c: 'created_by', type: 'INT' },
         { t: 'inventory_logs', c: 'batch_id', type: 'INT' },
         { t: 'inventory_logs', c: 'client_id', type: 'INT' },
         { t: 'inventory_logs', c: 'location_id', type: 'INT' },
         { t: 'inventory_logs', c: 'best_before_date', type: 'DATE' },
         { t: 'inventory_logs', c: 'user_id', type: 'INT' },
         { t: 'inventory_logs', c: 'reason', type: 'VARCHAR(255)' },
         { t: 'product_stocks', c: 'batch_id', type: 'INT' },
         { t: 'product_stocks', c: 'client_id', type: 'INT' },
         { t: 'product_stocks', c: 'location_id', type: 'INT' },
         { t: 'product_stocks', c: 'batch_number', type: 'VARCHAR(255)' },
         { t: 'product_stocks', c: 'reason', type: 'VARCHAR(255)' },
         { t: 'product_stocks', c: 'best_before_date', type: 'DATE' },
         { t: 'product_stocks', c: 'user_id', type: 'INT' },
         { t: 'categories', c: 'company_id', type: 'INT' },
         { t: 'products', c: 'color', type: 'VARCHAR(255)' },
         { t: 'products', c: 'product_type', type: 'VARCHAR(255)' },
         { t: 'products', c: 'unit_of_measure', type: 'VARCHAR(255)' },
         { t: 'products', c: 'price', type: 'DECIMAL(12,2) DEFAULT 0' },
         { t: 'products', c: 'cost_price', type: 'DECIMAL(12,2)' },
         { t: 'products', c: 'vat_rate', type: 'DECIMAL(5,2)' },
         { t: 'products', c: 'vat_code', type: 'VARCHAR(100)' },
         { t: 'products', c: 'customs_tariff', type: 'VARCHAR(255)' },
         { t: 'products', c: 'marketplace_skus', type: 'LONGTEXT' },
         { t: 'products', c: 'heat_sensitive', type: 'VARCHAR(50)' },
         { t: 'products', c: 'perishable', type: 'VARCHAR(50)' },
         { t: 'products', c: 'require_batch_tracking', type: 'VARCHAR(50)' },
         { t: 'products', c: 'shelf_life_days', type: 'INT' },
         { t: 'products', c: 'length', type: 'DECIMAL(10,2)' },
         { t: 'products', c: 'width', type: 'DECIMAL(10,2)' },
         { t: 'products', c: 'height', type: 'DECIMAL(10,2)' },
         { t: 'products', c: 'dimension_unit', type: 'VARCHAR(20)' },
         { t: 'products', c: 'weight', type: 'DECIMAL(10,3)' },
         { t: 'products', c: 'weight_unit', type: 'VARCHAR(20)' },
         { t: 'products', c: 'reorder_level', type: 'INT DEFAULT 0' },
         { t: 'products', c: 'reorder_qty', type: 'INT' },
         { t: 'products', c: 'max_stock', type: 'INT' },
         { t: 'products', c: 'status', type: "VARCHAR(50) DEFAULT 'ACTIVE'" },
         { t: 'products', c: 'images', type: 'LONGTEXT' },
         { t: 'products', c: 'supplier_id', type: 'INT' },
         { t: 'products', c: 'pack_size', type: 'INT DEFAULT 1' },
         { t: 'products', c: 'alternative_skus', type: 'LONGTEXT' },
         { t: 'products', c: 'supplier_products', type: 'LONGTEXT' },
         { t: 'products', c: 'price_lists', type: 'LONGTEXT' },
         { t: 'products', c: 'cartons', type: 'LONGTEXT' },
         { t: 'products', c: 'best_before_date_warning_period_days', type: 'INT DEFAULT 0' },
         { t: 'locations', c: 'aisle', type: 'VARCHAR(255)' },
         { t: 'locations', c: 'rack', type: 'VARCHAR(255)' },
         { t: 'locations', c: 'shelf', type: 'VARCHAR(255)' },
         { t: 'locations', c: 'bin', type: 'VARCHAR(255)' },
         { t: 'locations', c: 'location_type', type: 'VARCHAR(255)' },
         { t: 'locations', c: 'pick_sequence', type: 'INT' },
         { t: 'locations', c: 'max_weight', type: 'DECIMAL(10,2)' },
         { t: 'locations', c: 'heat_sensitive', type: 'VARCHAR(100)' },
         { t: 'zones', c: 'zone_type', type: 'VARCHAR(255)' },
         { t: 'warehouses', c: 'warehouse_type', type: 'VARCHAR(255)' },
         { t: 'warehouses', c: 'address', type: 'TEXT' },
         { t: 'warehouses', c: 'phone', type: 'VARCHAR(100)' },
         { t: 'warehouses', c: 'capacity', type: 'INT' },
         { t: 'warehouses', c: 'status', type: "VARCHAR(50) DEFAULT 'ACTIVE'" },
       ];
       for (const col of manualCols) {
         try { 
           await sequelize.query(`ALTER TABLE ${col.t} ADD COLUMN ${col.c} ${col.type} NULL`); 
           console.log(`[DB] Column ${col.t}.${col.c} added successfully`);
         } catch (err) {
           if (!err.message.includes('Duplicate column')) {
             console.warn(`[DB] Column ${col.t}.${col.c} potentially exists or error: ${err.message.slice(0, 60)}`);
           }
         }
       }
    }
    console.log('Database synced. (MySQL Manual fixes applied)');
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON');
    }
    console.log('Database synced. IDs are now integers (1, 2, 3...).');

    // Initialize Cron AFTER database sync is complete
    cronService.init();

    app.listen(PORT, () => {
      console.log(`WMS Backend running at http://localhost:${PORT}`);
      console.log('Auth: POST /auth/login | GET /auth/me (Bearer token)');
      console.log('Super Admin: /api/superadmin/companies');
      console.log('Company: /api/company/profile');
      console.log('Users: /api/users');
      console.log('Warehouses: /api/warehouses');
      console.log('Inventory: /api/inventory/products, /api/inventory/categories, /api/inventory/stock');
      console.log('Orders: /api/orders/sales, /api/orders/customers');
      console.log('Suppliers: /api/suppliers | Bundles: /api/bundles');
      console.log('Picking: /api/picking');
      console.log('Packing: /api/packing');
      console.log('Shipments: /api/shipments');
      console.log('Purchase orders: /api/purchase-orders');
      console.log('Goods receiving: /api/goods-receiving');
    });
  } catch (err) {
    console.error('Unable to start server:', err);
    const isConnectionRefused = err?.code === 'ECONNREFUSED' || err?.parent?.code === 'ECONNREFUSED' || err?.name === 'SequelizeConnectionRefusedError';
    if (isConnectionRefused && (process.env.DB_DIALECT || 'sqlite') === 'mysql') {
      console.error('\n--- MySQL connection refused ---');
      console.error('Either: 1) Start MySQL (XAMPP/WAMP/MySQL service), or');
      console.error('        2) Use SQLite: in .env set DB_DIALECT=sqlite (or remove DB_DIALECT) and restart.\n');
    }
    process.exit(1);
  }
}

// Retrying server start to pick up new routes
start();
