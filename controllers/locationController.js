const locationService = require('../services/locationService');

async function list(req, res, next) {
  try {
    const locations = await locationService.list(req.user, req.query);
    res.json({ success: true, data: locations });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const location = await locationService.getById(req.params.id, req.user);
    res.json({ success: true, data: location });
  } catch (err) {
    if (err.message === 'Location not found') return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const location = await locationService.create(req.body, req.user);
    res.status(201).json({ success: true, data: location });
  } catch (err) {
    if (err.message?.includes('zoneId')) return res.status(400).json({ success: false, message: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const location = await locationService.update(req.params.id, req.body, req.user);
    res.json({ success: true, data: location });
  } catch (err) {
    if (err.message === 'Location not found') return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await locationService.remove(req.params.id, req.user);
    res.json({ success: true, message: 'Location deleted' });
  } catch (err) {
    if (err.message === 'Location not found') return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
