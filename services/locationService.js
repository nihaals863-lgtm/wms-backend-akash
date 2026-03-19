const { Location, Zone, Warehouse } = require('../models');
const { Op } = require('sequelize');

function normalizeRole(role) {
  return (role || '').toString().toLowerCase().replace(/-/g, '_').trim();
}

async function list(reqUser, query = {}) {
  const where = {};
  if (query.zoneId) where.zoneId = query.zoneId;
  if (query.warehouseId) {
    const zoneIds = await Zone.findAll({ where: { warehouseId: query.warehouseId }, attributes: ['id'] });
    where.zoneId = { [Op.in]: zoneIds.map(z => z.id) };
  }
  const role = normalizeRole(reqUser.role);
  // super_admin: no company/warehouse filter -> show all locations
  if (role !== 'super_admin') {
    if (role === 'company_admin' && reqUser.companyId) {
      const whIds = await Warehouse.findAll({ where: { companyId: reqUser.companyId }, attributes: ['id'] });
      const whIdList = whIds.map(w => w.id);
      if (whIdList.length > 0) {
        const zoneRows = await Zone.findAll({ where: { warehouseId: { [Op.in]: whIdList } }, attributes: ['id'] });
        const zoneIdList = zoneRows.map(z => z.id);
        where.zoneId = zoneIdList.length > 0 ? { [Op.in]: zoneIdList } : { [Op.in]: [] };
      } else {
        where.zoneId = { [Op.in]: [] };
      }
    } else if (reqUser.warehouseId) {
      const zoneIds = await Zone.findAll({ where: { warehouseId: reqUser.warehouseId }, attributes: ['id'] });
      where.zoneId = { [Op.in]: zoneIds.map(z => z.id) };
    }
  }
  const locations = await Location.findAll({
    where,
    order: [['createdAt', 'DESC']],
    include: [{ association: 'Zone', include: [{ association: 'Warehouse', attributes: ['id', 'name', 'code'] }] }],
  });
  return locations.map(loc => (loc.get ? loc.get({ plain: true }) : loc));
}

async function getById(id, reqUser) {
  const loc = await Location.findByPk(id, {
    include: [{ association: 'Zone', include: ['Warehouse'] }],
  });
  if (!loc) throw new Error('Location not found');
  return loc;
}

async function create(data, reqUser) {
  if (!data.zoneId) throw new Error('zoneId required');
  return Location.create({
    zoneId: data.zoneId,
    name: data.name,
    code: data.code || null,
    aisle: data.aisle || null,
    rack: data.rack || null,
    shelf: data.shelf || null,
    bin: data.bin || null,
    locationType: data.locationType || null,
    pickSequence: data.pickSequence != null ? Number(data.pickSequence) : null,
    maxWeight: data.maxWeight != null ? Number(data.maxWeight) : null,
    heatSensitive: data.heatSensitive || null,
  });
}

async function update(id, data, reqUser) {
  const loc = await Location.findByPk(id);
  if (!loc) throw new Error('Location not found');
  await loc.update({
    name: data.name ?? loc.name,
    code: data.code !== undefined ? data.code : loc.code,
    aisle: data.aisle !== undefined ? data.aisle : loc.aisle,
    rack: data.rack !== undefined ? data.rack : loc.rack,
    shelf: data.shelf !== undefined ? data.shelf : loc.shelf,
    bin: data.bin !== undefined ? data.bin : loc.bin,
    locationType: data.locationType !== undefined ? data.locationType : loc.locationType,
    pickSequence: data.pickSequence !== undefined ? (data.pickSequence != null ? Number(data.pickSequence) : null) : loc.pickSequence,
    maxWeight: data.maxWeight !== undefined ? (data.maxWeight != null ? Number(data.maxWeight) : null) : loc.maxWeight,
    heatSensitive: data.heatSensitive !== undefined ? data.heatSensitive : loc.heatSensitive,
  });
  return loc;
}

async function remove(id, reqUser) {
  const loc = await Location.findByPk(id);
  if (!loc) throw new Error('Location not found');
  await loc.destroy();
  return { message: 'Location deleted' };
}

module.exports = { list, getById, create, update, remove };
