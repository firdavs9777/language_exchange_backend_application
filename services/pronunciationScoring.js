const PRONUNCIATION_WRONG_THRESHOLD = 0.6;

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  const n = normalize(s);
  return n.length ? n.split(' ') : [];
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[a.length];
}

function computeCharDiff(target, spoken) {
  const m = target.length, n = spoken.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = target[i - 1] === spoken[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const out = new Array(m);
  let i = m, j = n;
  while (i > 0) {
    if (j > 0 && target[i - 1] === spoken[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      out[i - 1] = { char: target[i - 1], match: true };
      i--; j--;
    } else if (j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      out[i - 1] = { char: target[i - 1], match: false };
      i--; j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      out[i - 1] = { char: target[i - 1], match: false };
      i--;
    } else {
      j--;
    }
  }
  return out;
}

function alignWords(targetWords, transcriptWords) {
  const m = targetWords.length, n = transcriptWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = targetWords[i - 1] === transcriptWords[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + cost, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  const out = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = targetWords[i - 1] === transcriptWords[j - 1] ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + cost) {
        out.unshift({ targetIdx: i - 1, transcriptIdx: j - 1 });
        i--; j--; continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      out.unshift({ targetIdx: i - 1, transcriptIdx: -1 });
      i--; continue;
    }
    out.unshift({ targetIdx: -1, transcriptIdx: j - 1 });
    j--;
  }
  return out;
}

function score(transcript, target) {
  const targetWords = tokens(target);
  const transcriptWords = tokens(transcript);
  const transcriptNorm = transcriptWords.join(' ');

  const alignment = alignWords(targetWords, transcriptWords);
  const wordScores = [];

  for (const pair of alignment) {
    if (pair.targetIdx === -1) continue;
    const targetW = targetWords[pair.targetIdx];

    if (pair.transcriptIdx === -1) {
      wordScores.push({ word: targetW, status: 'missing', charDiff: null });
      continue;
    }

    const spokenW = transcriptWords[pair.transcriptIdx];
    if (targetW === spokenW) {
      wordScores.push({ word: targetW, status: 'ok', charDiff: null });
      continue;
    }

    const dist = editDistance(targetW, spokenW);
    const ratio = 1 - dist / Math.max(targetW.length, spokenW.length);

    if (ratio >= PRONUNCIATION_WRONG_THRESHOLD) {
      wordScores.push({
        word: targetW,
        status: 'wrong',
        charDiff: computeCharDiff(targetW, spokenW),
      });
    } else {
      wordScores.push({ word: targetW, status: 'missing', charDiff: null });
    }
  }

  const verdict = { ok: 1.0, wrong: 0.5, missing: 0.0 };
  let weightedSum = 0, totalWeight = 0;
  for (const w of wordScores) {
    const weight = Math.max(1, Math.ceil(w.word.length / 4));
    weightedSum += weight * verdict[w.status];
    totalWeight += weight;
  }
  const overallScore = totalWeight > 0 ? Math.round((100 * weightedSum) / totalWeight) : 0;

  return { overallScore, wordScores, transcript: transcriptNorm };
}

module.exports = { score, PRONUNCIATION_WRONG_THRESHOLD };
