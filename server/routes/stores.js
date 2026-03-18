import { Router } from 'express';
import Store from '../models/Store.js';
import PriceEntry from '../models/PriceEntry.js';
import PriceItem from '../models/PriceItem.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// Get all stores with their products (tree view data)
router.get('/', async (req, res, next) => {
  try {
    const stores = await Store.find().sort({ name: 1 }).lean();

    const enriched = await Promise.all(stores.map(async (store) => {
      // Find all price entries for this store
      const entries = await PriceEntry.find({ store: store.name }).sort({ date: -1 }).lean();

      // Group by priceItemId, keep latest per item
      const itemMap = {};
      for (const entry of entries) {
        const key = entry.priceItemId.toString();
        if (!itemMap[key]) {
          itemMap[key] = entry;
        }
      }

      // Fetch item names
      const itemIds = Object.keys(itemMap);
      const items = await PriceItem.find({ _id: { $in: itemIds } }).lean();
      const itemNameMap = {};
      items.forEach(i => { itemNameMap[i._id.toString()] = i; });

      const products = Object.entries(itemMap).map(([id, entry]) => ({
        priceItemId: id,
        name: itemNameMap[id]?.name || 'Unknown',
        category: itemNameMap[id]?.category || 'General',
        latestPrice: entry.amount,
        date: entry.date,
      })).sort((a, b) => a.name.localeCompare(b.name));

      return { ...store, products, productCount: products.length };
    }));

    success(res, enriched);
  } catch (err) { next(err); }
});

// Create a store
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return error(res, 'Store name is required');

    const existing = await Store.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
    if (existing) return error(res, 'Store already exists');

    const store = await Store.create({ name: name.trim() });

    await AuditLog.create({
      action: 'CREATE', entity: 'Store', entityId: store._id,
      details: `Created store "${name.trim()}"`,
    });

    success(res, store, 201);
  } catch (err) { next(err); }
});

// Update a store name
router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const store = await Store.findById(req.params.id);
    if (!store) return error(res, 'Store not found', 404);

    const oldName = store.name;
    store.name = name.trim();
    await store.save();

    // Update all price entries with the old store name
    await PriceEntry.updateMany({ store: oldName }, { store: name.trim() });

    await AuditLog.create({
      action: 'UPDATE', entity: 'Store', entityId: store._id,
      details: `Renamed store "${oldName}" → "${name.trim()}"`,
    });

    success(res, store);
  } catch (err) { next(err); }
});

// Delete a store
router.delete('/:id', async (req, res, next) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return error(res, 'Store not found', 404);

    // Clear store name from price entries
    await PriceEntry.updateMany({ store: store.name }, { store: '' });

    await AuditLog.create({
      action: 'DELETE', entity: 'Store', entityId: store._id,
      details: `Deleted store "${store.name}"`,
    });

    success(res, { message: 'Store deleted' });
  } catch (err) { next(err); }
});

export default router;
