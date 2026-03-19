const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GoodsReceiptItem = sequelize.define('GoodsReceiptItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  goodsReceiptId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  productName: { type: DataTypes.STRING, allowNull: true },
  productSku: { type: DataTypes.STRING, allowNull: true },
  expectedQty: { type: DataTypes.INTEGER, defaultValue: 0 },
  receivedQty: { type: DataTypes.INTEGER, defaultValue: 0 },
  qualityStatus: { type: DataTypes.STRING, allowNull: true }, // GOOD, DAMAGED
}, {
  tableName: 'goods_receipt_items',
  timestamps: true,
  underscored: true,
});

module.exports = GoodsReceiptItem;
