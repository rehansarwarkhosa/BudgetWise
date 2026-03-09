import { Router } from 'express';
import PriceItem from '../models/PriceItem.js';
import PriceEntry from '../models/PriceEntry.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

const router = Router();

// Get all price items with latest price, entry count, and full history
router.get('/', async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (category) filter.category = category;

    const items = await PriceItem.find(filter).sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(items.map(async (item) => {
      const priceHistory = await PriceEntry.find({ priceItemId: item._id }).sort({ date: -1 }).lean();
      return {
        ...item,
        latestPrice: priceHistory[0] || null,
        priceEntryCount: priceHistory.length,
        priceHistory,
      };
    }));

    success(res, enriched);
  } catch (err) { next(err); }
});

// Create a price item (with optional initial price entry)
router.post('/', async (req, res, next) => {
  try {
    const { name, category, price, store } = req.body;
    if (!name) return error(res, 'Name is required');

    const item = await PriceItem.create({ name, category });

    if (price != null) {
      await PriceEntry.create({
        priceItemId: item._id,
        amount: price,
        store: store || '',
      });
    }

    await AuditLog.create({
      action: 'CREATE', entity: 'PriceItem', entityId: item._id,
      details: `Created price item "${name}"${price != null ? ` with initial price ${price}` : ''}`,
    });

    success(res, item, 201);
  } catch (err) { next(err); }
});

// Update a price entry
router.put('/prices/:priceId', async (req, res, next) => {
  try {
    const { amount, store } = req.body;
    const entry = await PriceEntry.findById(req.params.priceId);
    if (!entry) return error(res, 'Price entry not found', 404);

    const changes = [];
    if (amount != null) { changes.push(`amount ${entry.amount} → ${amount}`); entry.amount = amount; }
    if (store != null) { changes.push(`store "${entry.store}" → "${store}"`); entry.store = store; }
    await entry.save();

    await AuditLog.create({
      action: 'UPDATE', entity: 'PriceEntry', entityId: entry._id,
      details: `Updated price entry: ${changes.join(', ')}`,
    });

    success(res, entry);
  } catch (err) { next(err); }
});

// Delete a price entry
router.delete('/prices/:priceId', async (req, res, next) => {
  try {
    const entry = await PriceEntry.findByIdAndDelete(req.params.priceId);
    if (!entry) return error(res, 'Price entry not found', 404);

    await AuditLog.create({
      action: 'DELETE', entity: 'PriceEntry', entityId: entry._id,
      details: `Deleted price entry (amount: ${entry.amount}, store: "${entry.store}")`,
    });

    success(res, { message: 'Price entry deleted' });
  } catch (err) { next(err); }
});

// Update a price item
router.put('/:id', async (req, res, next) => {
  try {
    const { name, category } = req.body;
    const item = await PriceItem.findById(req.params.id);
    if (!item) return error(res, 'Price item not found', 404);

    const changes = [];
    if (name != null) { changes.push(`name "${item.name}" → "${name}"`); item.name = name; }
    if (category != null) { changes.push(`category "${item.category}" → "${category}"`); item.category = category; }
    await item.save();

    await AuditLog.create({
      action: 'UPDATE', entity: 'PriceItem', entityId: item._id,
      details: `Updated price item: ${changes.join(', ')}`,
    });

    success(res, item);
  } catch (err) { next(err); }
});

// Delete a price item and all its price entries
router.delete('/:id', async (req, res, next) => {
  try {
    const item = await PriceItem.findByIdAndDelete(req.params.id);
    if (!item) return error(res, 'Price item not found', 404);

    await PriceEntry.deleteMany({ priceItemId: item._id });

    await AuditLog.create({
      action: 'DELETE', entity: 'PriceItem', entityId: item._id,
      details: `Deleted price item "${item.name}" and all its price entries`,
    });

    success(res, { message: 'Price item deleted' });
  } catch (err) { next(err); }
});

// Get all price entries for an item
router.get('/:id/prices', async (req, res, next) => {
  try {
    const item = await PriceItem.findById(req.params.id);
    if (!item) return error(res, 'Price item not found', 404);

    const entries = await PriceEntry.find({ priceItemId: req.params.id }).sort({ date: -1 });
    success(res, entries);
  } catch (err) { next(err); }
});

// Add a new price entry for an item
router.post('/:id/prices', async (req, res, next) => {
  try {
    const { amount, store } = req.body;
    if (amount == null) return error(res, 'Amount is required');

    const item = await PriceItem.findById(req.params.id);
    if (!item) return error(res, 'Price item not found', 404);

    const entry = await PriceEntry.create({
      priceItemId: item._id,
      amount,
      store: store || '',
    });

    await AuditLog.create({
      action: 'CREATE', entity: 'PriceEntry', entityId: entry._id,
      details: `Added price entry for "${item.name}" — amount: ${amount}${store ? `, store: "${store}"` : ''}`,
    });

    success(res, entry, 201);
  } catch (err) { next(err); }
});

export default router;
