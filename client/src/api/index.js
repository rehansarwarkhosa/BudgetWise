import api from './axios.js';

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);
export const deleteAllData = () => api.delete('/settings/all-data');
export const sendTestEmail = () => api.post('/settings/test-email');
export const sendTestPush = () => api.post('/settings/test-push');
export const exportAllData = () => api.get('/settings/export');
export const importAllData = (data) => api.post('/settings/import', data);
export const getBudgetCategories = () => api.get('/settings/budget-categories');
export const addBudgetCategory = (data) => api.post('/settings/budget-categories', data);
export const updateBudgetCategory = (id, data) => api.put(`/settings/budget-categories/${id}`, data);
export const deleteBudgetCategory = (id) => api.delete(`/settings/budget-categories/${id}`);

// Income
export const getIncomeSummary = () => api.get('/income/summary');
export const getIncomes = () => api.get('/income');
export const addIncome = (data) => api.post('/income', data);
export const deleteIncome = (id) => api.delete(`/income/${id}`);

// Budgets
export const getBudgets = () => api.get('/budgets');
export const getBudgetsByPeriod = (month, year) => api.get(`/budgets/period/${month}/${year}`);
export const getBudgetExportData = (month, year) => api.get(`/budgets/export-data/${month}/${year}`);
export const createBudget = (data) => api.post('/budgets', data);
export const updateBudget = (id, data) => api.put(`/budgets/${id}`, data);
export const addFundsToBudget = (id, data) => api.post(`/budgets/${id}/add-funds`, data);
export const deductFundsFromBudget = (id, data) => api.post(`/budgets/${id}/deduct-funds`, data);
export const deleteBudget = (id) => api.delete(`/budgets/${id}`);
export const getFundEntries = (budgetId) => api.get(`/budgets/${budgetId}/funds`);
export const deleteFundEntry = (id) => api.delete(`/budgets/funds/${id}`);
export const reorderBudget = (id, direction) => api.put(`/budgets/${id}/reorder`, { direction });

// Budget Templates
export const getBudgetTemplates = () => api.get('/budget-templates');
export const createBudgetTemplate = (data) => api.post('/budget-templates', data);
export const createTemplateFromBudgets = (data) => api.post('/budget-templates/from-budgets', data);
export const useBudgetTemplate = (id) => api.post(`/budget-templates/${id}/use`);
export const updateBudgetTemplate = (id, data) => api.put(`/budget-templates/${id}`, data);
export const deleteBudgetTemplate = (id) => api.delete(`/budget-templates/${id}`);

// Expenses
export const getExpenses = (budgetId) => api.get(`/expenses/budget/${budgetId}`);
export const addExpense = (data) => api.post('/expenses', data);
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);

// Routines
export const getRoutines = () => api.get('/routines');
export const getRoutine = (id) => api.get(`/routines/${id}`);
export const createRoutine = (data) => api.post('/routines', data);
export const updateRoutine = (id, data) => api.put(`/routines/${id}`, data);
export const deleteRoutine = (id) => api.delete(`/routines/${id}`);
export const getRoutineEntries = (id) => api.get(`/routines/${id}/entries`);
export const logRoutineEntry = (id, data) => api.post(`/routines/${id}/entries`, data);
export const deleteRoutineEntry = (entryId) => api.delete(`/routines/entries/${entryId}`);
export const batchLogRoutineEntries = (id, data) => api.post(`/routines/${id}/entries/batch`, data);
export const checkReminders = () => api.get('/routines/check-reminders');
export const autoIncompleteRoutines = () => api.post('/routines/auto-incomplete');
export const getRoutineNotes = (id) => api.get(`/routines/${id}/notes`);
export const addRoutineNote = (id, data) => api.post(`/routines/${id}/notes`, data);
export const updateRoutineNote = (noteId, data) => api.put(`/routines/notes/${noteId}`, data);
export const deleteRoutineNote = (noteId) => api.delete(`/routines/notes/${noteId}`);

// Savings
export const getSavings = () => api.get('/savings');
export const triggerRollover = (data) => api.post('/savings/rollover', data);

// Tags
export const getTags = () => api.get('/tags');
export const createTag = (data) => api.post('/tags', data);
export const updateTag = (id, data) => api.put(`/tags/${id}`, data);
export const deleteTag = (id) => api.delete(`/tags/${id}`);

// Topics
export const getTopics = () => api.get('/notes/topics');
export const createTopic = (data) => api.post('/notes/topics', data);
export const updateTopic = (id, data) => api.put(`/notes/topics/${id}`, data);
export const deleteTopic = (id) => api.delete(`/notes/topics/${id}`);

// SubTopics
export const getSubTopics = (topicId) => api.get(`/notes/topics/${topicId}/subtopics`);
export const createSubTopic = (topicId, data) => api.post(`/notes/topics/${topicId}/subtopics`, data);
export const updateSubTopic = (id, data) => api.put(`/notes/subtopics/${id}`, data);
export const deleteSubTopic = (id) => api.delete(`/notes/subtopics/${id}`);

// Notes
export const getNotes = (subTopicId) => api.get(`/notes/subtopics/${subTopicId}/notes`);
export const getNote = (id) => api.get(`/notes/note/${id}`);
export const createNote = (subTopicId, data) => api.post(`/notes/subtopics/${subTopicId}/notes`, data);
export const updateNote = (id, data) => api.put(`/notes/note/${id}`, data);
export const deleteNote = (id) => api.delete(`/notes/note/${id}`);
export const searchNotes = (params) => api.get('/notes/search', { params });
export const getRecentNotes = () => api.get('/notes/recent');
export const getNotesTree = () => api.get('/notes/tree');

// Trails
export const getTrails = (page, search, filter, date) => api.get('/trails', { params: { page, daysPerPage: 30, ...(search ? { search } : {}), ...(filter && filter !== 'all' ? { filter } : {}), ...(date ? { date } : {}) } });
export const createTrail = (data) => api.post('/trails', data);
export const updateTrail = (id, data) => api.put(`/trails/${id}`, data);
export const deleteTrail = (id) => api.delete(`/trails/${id}`);
export const deleteAllTrails = () => api.delete('/trails');
export const reorderTrails = (orderedIds) => api.post('/trails/reorder', { orderedIds });
export const getTrailNotes = (id) => api.get(`/trails/${id}/notes`);
export const addTrailNote = (id, data) => api.post(`/trails/${id}/notes`, data);
export const updateTrailNote = (noteId, data) => api.put(`/trails/notes/${noteId}`, data);
export const deleteTrailNote = (noteId) => api.delete(`/trails/notes/${noteId}`);

// Work Orders
export const getWorkOrders = (params) => api.get('/workorders', { params });
export const createWorkOrder = (data) => api.post('/workorders', data);
export const updateWorkOrder = (id, data) => api.put(`/workorders/${id}`, data);
export const moveWorkOrder = (id, status) => api.put(`/workorders/${id}/move`, { status });
export const deleteWorkOrder = (id) => api.delete(`/workorders/${id}`);
export const getWorkOrderNotes = (id) => api.get(`/workorders/${id}/notes`);
export const addWorkOrderNote = (id, data) => api.post(`/workorders/${id}/notes`, data);
export const updateWorkOrderNote = (noteId, data) => api.put(`/workorders/notes/${noteId}`, data);
export const deleteWorkOrderNote = (noteId) => api.delete(`/workorders/notes/${noteId}`);
export const logWorkOrderExpense = (id) => api.post(`/workorders/${id}/log-expense`);
export const bulkArchiveWorkOrders = () => api.post('/workorders/bulk-archive');
export const getArchivedWorkOrders = () => api.get('/workorders', { params: { status: 'archived' } });
export const checkWorkOrderReminders = () => api.get('/workorders/check-reminders');
export const duplicateWorkOrder = (id, count) => api.post(`/workorders/duplicate/${id}`, { count });
export const bulkMoveWorkOrders = (ids, status) => api.post('/workorders/bulk-move', { ids, status });

// Price Items
export const getPriceItems = (params) => api.get('/price-items', { params });
export const createPriceItem = (data) => api.post('/price-items', data);
export const updatePriceItem = (id, data) => api.put(`/price-items/${id}`, data);
export const deletePriceItem = (id) => api.delete(`/price-items/${id}`);
export const getPriceEntries = (id) => api.get(`/price-items/${id}/prices`);
export const addPriceEntry = (id, data) => api.post(`/price-items/${id}/prices`, data);
export const updatePriceEntry = (priceId, data) => api.put(`/price-items/prices/${priceId}`, data);
export const deletePriceEntry = (priceId) => api.delete(`/price-items/prices/${priceId}`);

// Stock
export const getStockItems = (params) => api.get('/stock', { params });
export const getStockItem = (id) => api.get(`/stock/${id}`);
export const createStockItem = (data) => api.post('/stock', data);
export const updateStockItem = (id, data) => api.put(`/stock/${id}`, data);
export const deleteStockItem = (id) => api.delete(`/stock/${id}`);
export const consumeStock = (id, data) => api.post(`/stock/${id}/consume`, data);
export const refillStock = (id, data) => api.post(`/stock/${id}/refill`, data);
export const getStockNotes = (id) => api.get(`/stock/${id}/notes`);
export const addStockNote = (id, data) => api.post(`/stock/${id}/notes`, data);
export const updateStockNote = (noteId, data) => api.put(`/stock/notes/${noteId}`, data);
export const deleteStockNote = (noteId) => api.delete(`/stock/notes/${noteId}`);

// Reminders
export const getReminders = (status, search) => api.get('/reminders', { params: { ...(status ? { status } : {}), ...(search ? { search } : {}) } });
export const createReminder = (data) => api.post('/reminders', data);
export const updateReminder = (id, data) => api.put(`/reminders/${id}`, data);
export const deleteReminder = (id) => api.delete(`/reminders/${id}`);
export const toggleReminder = (id) => api.put(`/reminders/${id}/toggle`);
export const getArchivedReminders = () => api.get('/reminders', { params: { status: 'archived' } });
export const bulkArchiveReminders = () => api.post('/reminders/bulk-archive');
export const getReminderNotes = (reminderId) => api.get(`/reminders/${reminderId}/notes`);
export const addReminderNote = (reminderId, data) => api.post(`/reminders/${reminderId}/notes`, data);
export const updateReminderNote = (noteId, data) => api.put(`/reminders/notes/${noteId}`, data);
export const deleteReminderNote = (noteId) => api.delete(`/reminders/notes/${noteId}`);

// Stores
export const getStores = () => api.get('/stores');
export const createStore = (data) => api.post('/stores', data);
export const updateStore = (id, data) => api.put(`/stores/${id}`, data);
export const deleteStore = (id) => api.delete(`/stores/${id}`);

// Event Folders
export const getEventFolders = () => api.get('/events/folders');
export const createEventFolder = (data) => api.post('/events/folders', data);
export const updateEventFolder = (id, data) => api.put(`/events/folders/${id}`, data);
export const deleteEventFolder = (id) => api.delete(`/events/folders/${id}`);

// Events
export const getEvents = (folderId) => api.get('/events', { params: folderId ? { folderId } : {} });
export const createEvent = (data) => api.post('/events', data);
export const updateEvent = (id, data) => api.put(`/events/${id}`, data);
export const deleteEvent = (id) => api.delete(`/events/${id}`);
export const getEventContainers = (eventId) => api.get(`/events/${eventId}/containers`);
export const createEventContainer = (eventId, data) => api.post(`/events/${eventId}/containers`, data);
export const updateEventContainer = (id, data) => api.put(`/events/containers/${id}`, data);
export const deleteEventContainer = (id) => api.delete(`/events/containers/${id}`);
export const getEventEntries = (containerId) => api.get(`/events/containers/${containerId}/entries`);
export const createEventEntry = (containerId, data) => api.post(`/events/containers/${containerId}/entries`, data);
export const updateEventEntry = (id, data) => api.put(`/events/entries/${id}`, data);
export const deleteEventEntry = (id) => api.delete(`/events/entries/${id}`);

// Event Transaction Types (via settings)
export const getEventTransactionTypes = () => api.get('/settings').then(r => ({ data: r.data.eventTransactionTypes || ['Given', 'Received'] }));

// AI
export const aiBudgetInsights = (data) => api.post('/ai/budget-insights', data);
export const aiRoutineInsights = (routines) => api.post('/ai/routine-insights', { routines });
export const aiNotesSearch = (query, notes) => api.post('/ai/notes-search', { query, notes });

// AI Responses
export const getAiResponses = () => api.get('/ai-responses');
export const deleteAiResponse = (id) => api.delete(`/ai-responses/${id}`);
export const deleteAllAiResponses = () => api.delete('/ai-responses');

// Audit Logs
export const getAuditLogs = (page = 1, { date, action } = {}) => api.get('/audit-logs', { params: { page, limit: 50, ...(date ? { date } : {}), ...(action ? { action } : {}) } });
export const clearAuditLogs = () => api.delete('/audit-logs');
