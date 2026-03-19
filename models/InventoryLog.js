const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const InventoryLog = sequelize.define('InventoryLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  warehouseId: { type: DataTypes.INTEGER, allowNull: false },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['IN', 'OUT', 'TRANSFER']] },
  },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  referenceId: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'inventory_logs',
  timestamps: true,
  underscored: true,
});

module.exports = InventoryLog;
