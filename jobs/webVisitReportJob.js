/**
 * Weekly Web Visit Report Job
 *
 * Sends a weekly report to admin with:
 * - Total visits & unique visitors
 * - Top countries & cities
 * - Device breakdown
 * - Daily traffic chart
 * - Top pages & referrers
 * - Week-over-week comparison
 */

const WebVisit = require('../models/WebVisit');
const sendEmail = require('../utils/sendEmail');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bananatalkmain@gmail.com';

/**
 * Format number with commas
 */
const fmt = (n) => (n || 0).toLocaleString();

/**
 * Calculate percentage change
 */
const pctChange = (current, previous) => {
  if (!previous) return current > 0 ? '+100%' : '0%';
  const change = ((current - previous) / previous * 100).toFixed(1);
  return change > 0 ? `+${change}%` : `${change}%`;
};

/**
 * Get country flag emoji from country name
 */
const getFlag = (country) => {
  const flags = {
    'United States': '🇺🇸', 'South Korea': '🇰🇷', 'Japan': '🇯🇵', 'China': '🇨🇳',
    'Taiwan': '🇹🇼', 'Spain': '🇪🇸', 'France': '🇫🇷', 'Germany': '🇩🇪',
    'Brazil': '🇧🇷', 'Italy': '🇮🇹', 'Russia': '🇷🇺', 'Saudi Arabia': '🇸🇦',
    'India': '🇮🇳', 'Vietnam': '🇻🇳', 'Thailand': '🇹🇭', 'Turkey': '🇹🇷',
    'Türkiye': '🇹🇷', 'Indonesia': '🇮🇩', 'Philippines': '🇵🇭', 'Mexico': '🇲🇽',
    'Argentina': '🇦🇷', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'United Kingdom': '🇬🇧',
    'Colombia': '🇨🇴', 'Peru': '🇵🇪', 'Chile': '🇨🇱', 'Egypt': '🇪🇬',
    'Nigeria': '🇳🇬', 'South Africa': '🇿🇦', 'Kenya': '🇰🇪', 'Pakistan': '🇵🇰',
    'Bangladesh': '🇧🇩', 'Malaysia': '🇲🇾', 'Singapore': '🇸🇬', 'Hong Kong': '🇭🇰',
    'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Poland': '🇵🇱', 'Ukraine': '🇺🇦',
    'Romania': '🇷🇴', 'Czech Republic': '🇨🇿', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
    'Morocco': '🇲🇦', 'Iraq': '🇮🇶', 'Algeria': '🇩🇿', 'Uzbekistan': '🇺🇿',
  };
  return flags[country] || '🌍';
};

/**
 * Build the HTML email for the weekly report
 */
const buildReportEmail = (stats) => {
  const visitChange = pctChange(stats.thisWeek.totalVisits, stats.lastWeek.totalVisits);
  const uniqueChange = pctChange(stats.thisWeek.uniqueVisitors, stats.lastWeek.uniqueVisitors);
  const visitChangeColor = stats.thisWeek.totalVisits >= stats.lastWeek.totalVisits ? '#10B981' : '#EF4444';
  const uniqueChangeColor = stats.thisWeek.uniqueVisitors >= stats.lastWeek.uniqueVisitors ? '#10B981' : '#EF4444';

  // Daily chart (simple bar chart via HTML)
  const maxDailyVisits = Math.max(...stats.dailyBreakdown.map(d => d.visits), 1);
  const dailyRows = stats.dailyBreakdown.map(day => {
    const barWidth = Math.max(5, Math.round((day.visits / maxDailyVisits) * 100));
    const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Seoul' });
    return `
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#64748B;white-space:nowrap;">${dateLabel}</td>
        <td style="padding:6px 8px;width:100%;">
          <div style="background:#E0F2FE;border-radius:4px;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#0EA5E9,#14B8A6);height:24px;width:${barWidth}%;border-radius:4px;display:flex;align-items:center;padding-left:8px;">
              <span style="color:white;font-size:11px;font-weight:600;">${day.visits}</span>
            </div>
          </div>
        </td>
        <td style="padding:6px 12px;font-size:12px;color:#94A3B8;white-space:nowrap;">${day.uniqueVisitors} unique</td>
      </tr>`;
  }).join('');

  // Countries table
  const countryRows = stats.topCountries.map((c, i) => `
    <tr style="border-bottom:1px solid #F1F5F9;">
      <td style="padding:8px 12px;font-size:13px;color:#94A3B8;">${i + 1}</td>
      <td style="padding:8px 12px;font-size:14px;">${getFlag(c.country)} ${c.country}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600;color:#0F172A;">${fmt(c.visits)}</td>
      <td style="padding:8px 12px;text-align:right;color:#64748B;font-size:13px;">${fmt(c.uniqueVisitors)}</td>
    </tr>`).join('');

  // Cities table
  const cityRows = stats.topCities.slice(0, 10).map((c, i) => `
    <tr style="border-bottom:1px solid #F1F5F9;">
      <td style="padding:6px 12px;font-size:13px;color:#94A3B8;">${i + 1}</td>
      <td style="padding:6px 12px;font-size:13px;">${c.city}, ${c.country}</td>
      <td style="padding:6px 12px;text-align:right;font-weight:600;color:#0F172A;">${fmt(c.visits)}</td>
    </tr>`).join('');

  // Device breakdown
  const deviceIcons = { desktop: '💻', mobile: '📱', tablet: '📟', unknown: '❓' };
  const totalDeviceVisits = stats.deviceBreakdown.reduce((sum, d) => sum + d.count, 0) || 1;
  const deviceRows = stats.deviceBreakdown.map(d => {
    const pct = Math.round((d.count / totalDeviceVisits) * 100);
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:20px;">${deviceIcons[d.device] || '❓'}</span>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span style="font-size:13px;font-weight:500;text-transform:capitalize;">${d.device}</span>
            <span style="font-size:13px;color:#64748B;">${fmt(d.count)} (${pct}%)</span>
          </div>
          <div style="background:#E2E8F0;border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:${d.device === 'mobile' ? '#14B8A6' : d.device === 'desktop' ? '#0EA5E9' : '#8B5CF6'};height:100%;width:${pct}%;border-radius:4px;"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  // Top pages
  const pageRows = stats.topPages.map(p => `
    <tr style="border-bottom:1px solid #F1F5F9;">
      <td style="padding:6px 12px;font-size:13px;color:#0EA5E9;font-family:monospace;">${p.page}</td>
      <td style="padding:6px 12px;text-align:right;font-weight:600;color:#0F172A;">${fmt(p.visits)}</td>
    </tr>`).join('');

  // Top referrers
  const referrerRows = stats.topReferrers.length > 0
    ? stats.topReferrers.map(r => `
      <tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:6px 12px;font-size:13px;color:#64748B;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${r.referrer}</td>
        <td style="padding:6px 12px;text-align:right;font-weight:600;color:#0F172A;">${fmt(r.visits)}</td>
      </tr>`).join('')
    : '<tr><td style="padding:12px;color:#94A3B8;font-size:13px;">No referrer data</td></tr>';

  // Browsers
  const browserRows = stats.topBrowsers.map(b => `
    <span style="display:inline-block;padding:4px 12px;background:#F1F5F9;border-radius:20px;font-size:12px;margin:2px 4px 2px 0;color:#475569;">${b._id}: ${fmt(b.count)}</span>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);border-radius:16px 16px 0 0;padding:32px 24px;text-align:center;">
      <h1 style="color:white;margin:0 0 4px;font-size:22px;">📊 Bananatalk Weekly Traffic Report</h1>
      <p style="color:#94A3B8;margin:0;font-size:14px;">${stats.period.from} — ${stats.period.to} (KST)</p>
    </div>

    <div style="background:white;border-radius:0 0 16px 16px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
      <!-- Key Metrics -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:16px;background:#F0FDF4;border-radius:12px;text-align:center;width:25%;">
            <div style="font-size:28px;font-weight:800;color:#0F172A;">${fmt(stats.thisWeek.totalVisits)}</div>
            <div style="font-size:12px;color:#64748B;margin-top:2px;">Total Visits</div>
            <div style="font-size:12px;font-weight:600;color:${visitChangeColor};margin-top:4px;">${visitChange} vs last week</div>
          </td>
          <td style="width:12px;"></td>
          <td style="padding:16px;background:#EFF6FF;border-radius:12px;text-align:center;width:25%;">
            <div style="font-size:28px;font-weight:800;color:#0F172A;">${fmt(stats.thisWeek.uniqueVisitors)}</div>
            <div style="font-size:12px;color:#64748B;margin-top:2px;">Unique Visitors</div>
            <div style="font-size:12px;font-weight:600;color:${uniqueChangeColor};margin-top:4px;">${uniqueChange} vs last week</div>
          </td>
          <td style="width:12px;"></td>
          <td style="padding:16px;background:#FFF7ED;border-radius:12px;text-align:center;width:25%;">
            <div style="font-size:28px;font-weight:800;color:#0F172A;">${fmt(stats.thisWeek.newVisitors)}</div>
            <div style="font-size:12px;color:#64748B;margin-top:2px;">New Visitors</div>
          </td>
        </tr>
      </table>

      <!-- Daily Traffic -->
      <h2 style="font-size:16px;color:#0F172A;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #F1F5F9;">📈 Daily Traffic</h2>
      <table style="width:100%;border-collapse:collapse;">${dailyRows}</table>

      <!-- Top Countries -->
      <h2 style="font-size:16px;color:#0F172A;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #F1F5F9;">🌍 Top Countries</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#F8FAFC;">
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94A3B8;text-transform:uppercase;">#</th>
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94A3B8;text-transform:uppercase;">Country</th>
          <th style="padding:6px 12px;text-align:right;font-size:11px;color:#94A3B8;text-transform:uppercase;">Visits</th>
          <th style="padding:6px 12px;text-align:right;font-size:11px;color:#94A3B8;text-transform:uppercase;">Unique</th>
        </tr>
        ${countryRows}
      </table>

      <!-- Top Cities -->
      <h2 style="font-size:16px;color:#0F172A;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #F1F5F9;">🏙️ Top Cities</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#F8FAFC;">
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94A3B8;">#</th>
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94A3B8;">City</th>
          <th style="padding:6px 12px;text-align:right;font-size:11px;color:#94A3B8;">Visits</th>
        </tr>
        ${cityRows}
      </table>

      <!-- Device Breakdown -->
      <h2 style="font-size:16px;color:#0F172A;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #F1F5F9;">📱 Devices</h2>
      ${deviceRows}

      <!-- Top Pages -->
      <h2 style="font-size:16px;color:#0F172A;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #F1F5F9;">📄 Top Pages</h2>
      <table style="width:100%;border-collapse:collapse;">
        ${pageRows}
      </table>

      <!-- Referrers -->
      <h2 style="font-size:16px;color:#0F172A;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #F1F5F9;">🔗 Top Referrers</h2>
      <table style="width:100%;border-collapse:collapse;">
        ${referrerRows}
      </table>

      <!-- Browsers -->
      <h2 style="font-size:16px;color:#0F172A;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #F1F5F9;">🌐 Browsers</h2>
      <div style="padding:4px 0;">${browserRows}</div>

      <!-- Footer -->
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;text-align:center;">
        <p style="color:#94A3B8;font-size:12px;margin:0;">Bananatalk Analytics • Auto-generated weekly report</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Run the weekly web visit report
 */
const runWebVisitReport = async () => {
  console.log('\n📊 Starting weekly web visit report...');

  try {
    const stats = await WebVisit.getWeeklyStats();

    console.log(`📈 Weekly stats: ${stats.thisWeek.totalVisits} visits, ${stats.thisWeek.uniqueVisitors} unique from ${stats.topCountries.length} countries`);

    if (stats.thisWeek.totalVisits === 0) {
      console.log('ℹ️ No visits this week, skipping email.');
      return true;
    }

    const html = buildReportEmail(stats);

    await sendEmail({
      email: ADMIN_EMAIL,
      subject: `📊 Bananatalk Weekly Traffic: ${fmt(stats.thisWeek.totalVisits)} visits from ${stats.topCountries.length} countries (${stats.period.from} — ${stats.period.to})`,
      html,
      message: `Weekly traffic report: ${stats.thisWeek.totalVisits} visits, ${stats.thisWeek.uniqueVisitors} unique visitors from ${stats.topCountries.length} countries.`
    });

    console.log(`✅ Weekly web visit report sent to ${ADMIN_EMAIL}`);
    return true;
  } catch (error) {
    console.error('❌ Web visit report job failed:', error);
    return false;
  }
};

module.exports = { runWebVisitReport };
