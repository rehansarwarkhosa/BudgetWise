import api from './axios.js';

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);
export const deleteAllData = () => api.delete('/settings/all-data');
export const sendTestEmail = () => api.post('/settings/test-email');
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
export const createBudget = (data) => api.post('/budgets', data);
export const updateBudget = (id, data) => api.put(`/budgets/${id}`, data);
export const addFundsToBudget = (id, data) => api.post(`/budgets/${id}/add-funds`, data);
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
export const getTrails = (page, search, filter, date) => api.get('/trails', { params: { page, limit: 20, ...(search ? { search } : {}), ...(filter && filter !== 'all' ? { filter } : {}), ...(date ? { date } : {}) } });
export const createTrail = (data) => api.post('/trails', data);
export const updateTrail = (id, data) => api.put(`/trails/${id}`, data);
export const deleteTrail = (id) => api.delete(`/trails/${id}`);
export const deleteAllTrails = () => api.delete('/trails');
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
export const checkWorkOrderReminders = () => api.get('/workorders/check-reminders');

// Price Items
export const getPriceItems = (params) => api.get('/price-items', { params });
export const createPriceItem = (data) => api.post('/price-items', data);
export const updatePriceItem = (id, data) => api.put(`/price-items/${id}`, data);
export const deletePriceItem = (id) => api.delete(`/price-items/${id}`);
export const getPriceEntries = (id) => api.get(`/price-items/${id}/prices`);
export const addPriceEntry = (id, data) => api.post(`/price-items/${id}/prices`, data);
export const updatePriceEntry = (priceId, data) => api.put(`/price-items/prices/${priceId}`, data);
export const deletePriceEntry = (priceId) => api.delete(`/price-items/prices/${priceId}`);

// Audit Logs
export const getAuditLogs = (page = 1) => api.get(`/audit-logs?page=${page}&limit=50`);
export const clearAuditLogs = () => api.delete('/audit-logs');
