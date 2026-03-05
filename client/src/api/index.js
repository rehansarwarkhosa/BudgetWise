import api from './axios.js';

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);
export const deleteAllData = () => api.delete('/settings/all-data');
export const exportAllData = () => api.get('/settings/export');
export const importAllData = (data) => api.post('/settings/import', data);
export const getBudgetCategories = () => api.get('/settings/budget-categories');
export const addBudgetCategory = (data) => api.post('/settings/budget-categories', data);
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

// Trails
export const getTrails = (page) => api.get(`/trails?page=${page}&limit=20`);
export const createTrail = (data) => api.post('/trails', data);
export const deleteTrail = (id) => api.delete(`/trails/${id}`);
export const deleteAllTrails = () => api.delete('/trails');

// Audit Logs
export const getAuditLogs = (page = 1) => api.get(`/audit-logs?page=${page}&limit=50`);
export const clearAuditLogs = () => api.delete('/audit-logs');
