const { Location, Zone, Warehouse } = require('../models');
const { Op } = require('sequelize');

function normalizeRole(role) {
  return (role || '').toString().toLowerCase().replace(/-/g, '_').trim();
}

/**
 * Formats location name according to Aisle + Rack + Shelf + Bin without dashes
 */
function formatLocationName(data) {
  const parts = [data.aisle, data.rack, data.shelf, data.bin];
  const formatted = parts
    .filter(p => p != null && p !== '')
    .map(p => p.toString().replace(/-/g, ''))
    .join('');
  
  if (formatted) return formatted;
  return data.name ? data.name.replace(/-/g, '') : null;
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
  
  const formattedName = formatLocationName(data);
  
  return Location.create({
    zoneId: data.zoneId,
    name: formattedName || data.name,
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

  const formattedName = formatLocationName(data);

  await loc.update({
    name: formattedName || data.name || loc.name,
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

async function bulkCreate(locationsData, reqUser) {
  const results = [];
  const errors = [];
  const namesInBatch = new Set(); // Track duplicates within the CSV itself

  const getValue = (row, keys = []) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
    }
    return null;
  };

  const normalizeLocationType = (value) => {
    if (!value) return 'PICK';
    const t = String(value).trim().toUpperCase();
    return ['PICK', 'BULK', 'QUARANTINE', 'STAGING'].includes(t) ? t : 'PICK';
  };
  
  // Use a transaction for bulk insert
  const transaction = await Location.sequelize.transaction();
  
  try {
    for (const [index, item] of locationsData.entries()) {
      try {
        const zoneIdRaw = getValue(item, ['zoneId', 'zoneid', 'zone_id', 'ZoneId', 'Zone ID', 'ZoneID', '\uFEFFzoneId']);
        const zoneId = zoneIdRaw != null ? Number(zoneIdRaw) : null;
        if (!zoneId || Number.isNaN(zoneId)) throw new Error(`Row ${index + 1}: zoneId is required`);

        const normalized = {
          zoneId,
          name: getValue(item, ['name', 'Name']),
          code: getValue(item, ['code', 'Code']),
          aisle: getValue(item, ['aisle', 'Aisle']),
          rack: getValue(item, ['rack', 'Rack']),
          shelf: getValue(item, ['shelf', 'Shelf']),
          bin: getValue(item, ['bin', 'Bin']),
          locationType: normalizeLocationType(getValue(item, ['locationType', 'location_type', 'Location Type', 'Type'])),
          pickSequence: getValue(item, ['pickSequence', 'pick_sequence', 'Pick Sequence']),
          maxWeight: getValue(item, ['maxWeight', 'max_weight', 'Max Weight']),
          heatSensitive: getValue(item, ['heatSensitive', 'heat_sensitive', 'Heat Sensitive']),
        };
        
        const name = formatLocationName(normalized) || normalized.name;
        if (!name) throw new Error(`Row ${index + 1}: Location name could not be generated`);

        // Check for duplicates within the uploaded batch
        const batchKey = `${zoneId}-${name}`;
        if (namesInBatch.has(batchKey)) {
          throw new Error(`Row ${index + 1}: Duplicate location name "${name}" in this CSV for zoneId ${zoneId}`);
        }
        namesInBatch.add(batchKey);

        // Check for duplicates in the database
        const existingInDb = await Location.findOne({ where: { name, zoneId } });
        if (existingInDb) {
          throw new Error(`Row ${index + 1}: Duplicate location name "${name}" already exists in the database for this zone`);
        }

        const loc = await Location.create({
          zoneId,
          name: name,
          code: normalized.code || null,
          aisle: normalized.aisle || null,
          rack: normalized.rack || null,
          shelf: normalized.shelf || null,
          bin: normalized.bin || null,
          locationType: normalized.locationType,
          pickSequence: normalized.pickSequence != null ? Number(normalized.pickSequence) : null,
          maxWeight: normalized.maxWeight != null ? Number(normalized.maxWeight) : null,
          heatSensitive: normalized.heatSensitive || null,
        }, { transaction });
        
        results.push(loc);
      } catch (err) {
        errors.push(err.message);
      }
    }
    
    if (errors.length > 0) {
      // If any error exists, we rollback everything or just return errors?
      // Business logic usually prefers all or nothing for bulk imports to ensure consistency.
      await transaction.rollback();
      throw new Error(errors.join('; '));
    }
    
    await transaction.commit();
    return results;
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch (e) { /* already rolled back */ }
    }
    throw err;
  }
}


async function migrateExistingLocations() {
    const locations = await Location.findAll();
    for (const loc of locations) {
        const newName = formatLocationName({
            aisle: loc.aisle,
            rack: loc.rack,
            shelf: loc.shelf,
            bin: loc.bin,
            name: loc.name
        });
        if (newName && newName !== loc.name) {
            await loc.update({ name: newName });
        }
    }
}

module.exports = { list, getById, create, update, remove, bulkCreate, migrateExistingLocations };

