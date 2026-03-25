import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import AiResponse from '../models/AiResponse.js';
import { success, error } from '../utils/response.js';

const router = Router();

const getClient = () => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
};

const checkAI = async () => {
  const settings = await Settings.findOne();
  if (!settings?.aiEnabled) return 'AI features are disabled in settings';
  if (!process.env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY not configured';
  return null;
};

// ─── Budget Insights ───
router.post('/budget-insights', async (req, res, next) => {
  try {
    const err = await checkAI();
    if (err) return error(res, err);

    const { budgets, expenses, incomeTotal, period } = req.body;
    if (!budgets?.length) return error(res, 'No budget data to analyze');

    const budgetLines = budgets.map(b => {
      const spent = b.allocatedAmount - b.remainingAmount;
      const pct = b.allocatedAmount > 0 ? Math.round((spent / b.allocatedAmount) * 100) : 0;
      return `- ${b.name} (${b.category}): allocated PKR ${b.allocatedAmount}, spent PKR ${spent} (${pct}%), remaining PKR ${b.remainingAmount}`;
    }).join('\n');

    const expenseLines = (expenses || []).map(e =>
      `- PKR ${e.amount}: ${e.description} (${new Date(e.date).toLocaleDateString('en-US', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short' })})`
    ).join('\n');

    const prompt = `You are a personal budget advisor. Analyze this monthly budget data and give actionable insights. Currency is PKR (Pakistani Rupee). Timezone is Asia/Karachi.

Period: ${period || 'Current month'}
Total Income: PKR ${incomeTotal || 'N/A'}

Budgets:
${budgetLines}

${expenseLines ? `Recent Expenses:\n${expenseLines}` : ''}

Provide a well-structured analysis with these sections:

SPENDING ALERTS
List any budgets nearing or over limit with percentage used.

PATTERNS
Categories where spending seems high/low relative to allocation.

SUGGESTIONS
2-3 specific, actionable tips to optimize spending.

Keep it under 250 words. Be direct and practical. Use plain text, no markdown formatting like ** or ##. Use simple dashes for bullet points.`;

    const client = getClient();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const insights = message.content[0].text;

    // Save to AI responses
    await AiResponse.create({
      source: 'budget',
      title: `Budget Insights - ${period || 'Current month'}`,
      content: insights,
    });

    await AuditLog.create({
      action: 'AI_INSIGHTS', entity: 'Budget',
      details: `AI analyzed ${budgets.length} budgets, ${(expenses || []).length} expenses (${message.usage.input_tokens}+${message.usage.output_tokens} tokens)`,
    });

    success(res, { insights });
  } catch (err) {
    await AuditLog.create({ action: 'AI_ERROR', entity: 'Budget', details: `AI budget insights failed: ${err.message}` });
    next(err);
  }
});

// ─── Routine Insights ───
router.post('/routine-insights', async (req, res, next) => {
  try {
    const err = await checkAI();
    if (err) return error(res, err);

    const { routines } = req.body;
    if (!routines?.length) return error(res, 'No routine data to analyze');

    const routineLines = routines.map(r => {
      const status = r.isDoneForToday ? 'Done today' : r.isActiveToday === false ? 'Scheduled' : 'Pending';
      return `- ${r.name}: ${status}, ${r.completedEntries}/${r.targetEntries} entries (${r.progress}%), today ${r.todayCompleteCount}/${r.maxDailyEntries} daily${r.dueDate ? `, due ${r.dueDate}` : ''}${r.reminderDays?.length ? `, days: ${r.reminderDays.join(',')}` : ''}`;
    }).join('\n');

    const prompt = `You are a personal productivity advisor. Analyze this routine/habit tracking data and give actionable insights. Timezone is Asia/Karachi.

Routines (excluding expired):
${routineLines}

Provide a well-structured analysis with these sections:

PROGRESS OVERVIEW
Summarize overall routine completion and highlight strong/weak areas.

CONSISTENCY PATTERNS
Identify which routines are being maintained well and which need attention.

RECOMMENDATIONS
2-3 specific tips to improve routine adherence and productivity.

Keep it under 250 words. Be direct and practical. Use plain text, no markdown formatting like ** or ##. Use simple dashes for bullet points.`;

    const client = getClient();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const insights = message.content[0].text;

    await AiResponse.create({
      source: 'routines',
      title: 'Routine Insights',
      content: insights,
    });

    await AuditLog.create({
      action: 'AI_INSIGHTS', entity: 'Routine',
      details: `AI analyzed ${routines.length} routines (${message.usage.input_tokens}+${message.usage.output_tokens} tokens)`,
    });

    success(res, { insights });
  } catch (err) {
    await AuditLog.create({ action: 'AI_ERROR', entity: 'Routine', details: `AI routine insights failed: ${err.message}` });
    next(err);
  }
});

// ─── Notes Smart Search ───
router.post('/notes-search', async (req, res, next) => {
  try {
    const err = await checkAI();
    if (err) return error(res, err);

    const { query, notes } = req.body;
    if (!query?.trim()) return error(res, 'Search query is required');
    if (!notes?.length) return error(res, 'No notes to search');

    const notesText = notes.map((n, i) => {
      const plainText = (n.content || '').replace(/<[^>]*>/g, '').trim();
      return `[ID:${n._id}] Title: "${n.title}" | Topic: ${n.topicName || 'N/A'} > ${n.subTopicName || 'N/A'} | Content: ${plainText.substring(0, 300)}${plainText.length > 300 ? '...' : ''}`;
    }).join('\n\n');

    const client = getClient();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a smart search assistant. The user is searching their personal notes. Find the most relevant notes for their query, even if they use different wording than the actual note content.

User query: "${query}"

Notes:
${notesText}

Respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{"results": [{"id": "note_id_here", "reason": "brief reason why this matches"}], "summary": "one-line summary of what you found"}

Return up to 10 most relevant results. If nothing matches, return empty results array.`,
      }],
    });

    let parsed;
    try {
      const text = message.content[0].text.trim();
      const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { results: [], summary: 'Could not parse AI response' };
    }

    // Save to AI responses
    await AiResponse.create({
      source: 'notes',
      title: `Notes Search: "${query}"`,
      content: `Search: "${query}"\n\nFound ${parsed.results?.length || 0} matches.\n${parsed.summary || ''}`,
      query,
    });

    await AuditLog.create({
      action: 'AI_SEARCH', entity: 'Note',
      details: `AI smart search for "${query}" across ${notes.length} notes, found ${parsed.results?.length || 0} matches (${message.usage.input_tokens}+${message.usage.output_tokens} tokens)`,
    });

    success(res, parsed);
  } catch (err) {
    await AuditLog.create({ action: 'AI_ERROR', entity: 'Note', details: `AI notes search failed: ${err.message}` });
    next(err);
  }
});

export default router;
