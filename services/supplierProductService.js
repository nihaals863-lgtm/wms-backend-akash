const { SupplierProduct, Supplier, Product } = require('../models');
const { Op } = require('sequelize');

async function list(reqUser, query = {}) {
  const where = { companyId: reqUser.companyId };
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.productId) where.productId = query.productId;
  
  return await SupplierProduct.findAll({
    where,
    include: [
      { model: Supplier, attributes: ['id', 'name'] },
      { model: Product, attributes: ['id', 'name', 'sku'] },
    ],
    order: [['createdAt', 'DESC']],
  });
}

async function bulkUpload(mappings, reqUser) {
  const results = { created: 0, updated: 0, errors: [] };
  
  for (const row of mappings) {
    try {
      // row: { supplierSku, sku, packSize, costPrice, supplierProductName, supplierCode }
      const supplier = await Supplier.findOne({ 
        where: { 
          companyId: reqUser.companyId, 
          [Op.or]: [
            { id: row.supplierId || 0 }, 
            { name: row.supplierName || '' },
            { code: row.supplierCode || '' }
          ] 
        } 
      });
      const product = await Product.findOne({ where: { companyId: reqUser.companyId, sku: row.sku } });
      
      if (!supplier || !product) {
        results.errors.push(`Row skip: Supplier/Product not found (${row.supplierName}/${row.sku})`);
        continue;
      }
      
      const [entry, created] = await SupplierProduct.findOrCreate({
        where: { 
          companyId: reqUser.companyId, 
          supplierId: supplier.id, 
          productId: product.id 
        },
        defaults: {
          supplierSku: row.supplierSku,
          supplierProductName: row.supplierProductName || product.name,
          packSize: Number(row.packSize) || 1,
          costPrice: Number(row.costPrice) || 0
        }
      });
      
      if (!created) {
        await entry.update({
          supplierSku: row.supplierSku || entry.supplierSku,
          supplierProductName: row.supplierProductName || entry.supplierProductName,
          packSize: Number(row.packSize) || entry.packSize,
          costPrice: Number(row.costPrice) || entry.costPrice
        });
        results.updated++;
      } else {
        results.created++;
      }
    } catch (err) {
      results.errors.push(`Error processing ${row.sku}: ${err.message}`);
    }
  }
  return results;
}

async function remove(id, reqUser) {
  const entry = await SupplierProduct.findByPk(id);
  if (!entry || (reqUser.role !== 'super_admin' && entry.companyId !== reqUser.companyId)) {
    throw new Error('Mapping not found');
  }
  await entry.destroy();
  return { deleted: true };
}

module.exports = { list, bulkUpload, remove };
