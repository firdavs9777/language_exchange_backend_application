/**
 * AI-driven study plan generation.
 *
 * Takes the user's current progress + target score + exam date and
 * returns a weekly-milestone roadmap plus a day-by-day lesson schedule.
 * Falls back to a deterministic local plan when OPENAI_API_KEY is unset
 * so dev/staging still produces a usable plan.
 */

const aiProviderService = require('./aiProviderService');

const MIN_DAYS_AHEAD = 1;
const MAX_WEEKS = 26;        // hard cap on the milestone array
const LESSONS_PER_WEEK = 5;  // schedule weekdays only by default

/**
 * @param {Object} opts
 * @param {Object} opts.exam          ExamType doc (name, scoringType, maxScore)
 * @param {Number} opts.targetScore
 * @param {Date}   opts.targetExamDate
 * @param {Object} [opts.progress]    UserExamProgress doc, may be null
 * @returns {Promise<{milestones:Object[], dailyLessons:Object[]}>}
 */
async function generateStudyPlan({
  exam,
  targetScore,
  targetExamDate,
  progress,
}) {
  const daysAhead = Math.max(
    MIN_DAYS_AHEAD,
    Math.ceil((new Date(targetExamDate) - Date.now()) / (24 * 60 * 60 * 1000))
  );
  const weeksUntilExam = Math.min(MAX_WEEKS, Math.ceil(daysAhead / 7));

  const weakAreas = _weakAreasFrom(progress);

  // Always build daily lessons locally — keeps the AI cost bounded to
  // just the milestone generation. Day count = number of weekdays
  // between now and the exam date, capped at weeksUntilExam * 5.
  const dailyLessons = _buildDailyLessons({
    weeksUntilExam,
    targetExamDate,
    weakAreas,
    sections: exam?.sections || ['reading', 'writing'],
  });

  if (!process.env.OPENAI_API_KEY) {
    return {
      milestones: _stubMilestones({ weeksUntilExam, weakAreas, exam, targetScore }),
      dailyLessons,
    };
  }

  const prompt = _buildPrompt({
    exam,
    targetScore,
    weeksUntilExam,
    weakAreas,
  });

  try {
    const response = await aiProviderService.chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      feature: 'examStudyPlan',
      temperature: 0.6,
      json: true,
    });
    const parsed = JSON.parse(response.content);
    const milestones = Array.isArray(parsed.milestones)
      ? parsed.milestones.slice(0, weeksUntilExam).map((m, idx) => ({
          week: Number(m.week) || idx + 1,
          focus: String(m.focus || `Week ${idx + 1}`),
          tasks: Array.isArray(m.tasks) ? m.tasks.map(String) : [],
          estimatedHours: Number(m.estimatedHours) || 8,
        }))
      : _stubMilestones({ weeksUntilExam, weakAreas, exam, targetScore });
    return { milestones, dailyLessons };
  } catch (err) {
    // AI failure → fall back to the stub so the endpoint never 500s
    // because of a flaky model response. Surface a console warning.
    console.warn('[examStudyPlanService] AI plan failed, using stub:', err.message);
    return {
      milestones: _stubMilestones({ weeksUntilExam, weakAreas, exam, targetScore }),
      dailyLessons,
    };
  }
}

function _weakAreasFrom(progress) {
  if (!progress?.sectionScores) return [];
  const out = [];
  for (const [key, score] of Object.entries(progress.sectionScores)) {
    if (!score) continue;
    // Treat "<70 with at least 1 attempt" as a weak area; untouched
    // sections also flag so the plan emphasizes them.
    if (score.attempted === 0 || (score.score != null && score.score < 70)) {
      out.push(key);
    }
  }
  return out;
}

function _buildPrompt({ exam, targetScore, weeksUntilExam, weakAreas }) {
  const examName = exam?.name || 'language exam';
  const focusList = weakAreas.length > 0 ? weakAreas.join(', ') : 'all sections';
  return `Create a ${weeksUntilExam}-week study plan for someone preparing for the ${examName} and targeting a score of ${targetScore}.

Focus areas (weak or untouched sections): ${focusList}.

Respond ONLY with JSON in this exact shape:
{
  "milestones": [
    {
      "week": <integer>,
      "focus": "<short focus headline>",
      "tasks": ["<task 1>", "<task 2>", "<task 3>"],
      "estimatedHours": <integer 4-12>
    }
  ]
}

Produce exactly ${weeksUntilExam} milestones, one per week, building from foundations to test simulation.`;
}

function _stubMilestones({ weeksUntilExam, weakAreas, exam, targetScore }) {
  const out = [];
  const sections = weakAreas.length > 0
    ? weakAreas
    : (exam?.sections || ['reading', 'writing']);
  for (let i = 0; i < weeksUntilExam; i++) {
    const section = sections[i % sections.length];
    const week = i + 1;
    let focus;
    if (i === 0) {
      focus = `Diagnose current ${section} level`;
    } else if (i === weeksUntilExam - 1) {
      focus = `Final mock + review (target ${targetScore})`;
    } else {
      focus = `Build ${section} fundamentals`;
    }
    out.push({
      week,
      focus,
      tasks: [
        `Complete 5 ${section} practice questions`,
        `Review mistakes and write notes`,
        i % 2 === 0 ? 'Read 2 short articles in the target language' : 'Practice timed answers',
      ],
      estimatedHours: 8,
    });
  }
  return out;
}

function _buildDailyLessons({ weeksUntilExam, targetExamDate, weakAreas, sections }) {
  const totalLessons = Math.min(
    weeksUntilExam * LESSONS_PER_WEEK,
    Math.ceil(
      (new Date(targetExamDate) - Date.now()) / (24 * 60 * 60 * 1000)
    )
  );
  const focusList = weakAreas.length > 0 ? weakAreas : sections;
  if (focusList.length === 0) focusList.push('reading');

  const lessons = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < totalLessons; i++) {
    cursor.setDate(cursor.getDate() + 1);
    // Skip weekends — LESSONS_PER_WEEK = 5 implies weekday cadence.
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      i--;
      continue;
    }
    if (cursor >= targetExamDate) break;
    const section = focusList[i % focusList.length];
    lessons.push({
      date: new Date(cursor),
      section,
      topic: `Practice ${section}`,
      estimatedMinutes: 45,
    });
  }
  return lessons;
}

module.exports = {
  generateStudyPlan,
};
