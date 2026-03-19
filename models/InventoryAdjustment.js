const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const InventoryAdjustment = sequelize.define('InventoryAdjustment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  referenceNumber: { type: DataTypes.STRING, allowNull: true },
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  warehouseId: { type: DataTypes.INTEGER, allowNull: true },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['INCREASE', 'DECREASE']] },
  },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'PENDING',
    validate: { isIn: [['PENDING', 'COMPLETED']] },
  },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'inventory_adjustments',
  timestamps: true,
  underscored: true,
});

module.exports = InventoryAdjustment;
