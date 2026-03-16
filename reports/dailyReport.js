const { run, all, get, initDB } = require('../database/db');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');

function getTodayStats() {
  const date = new Date().toISOString().split('T')[0];

  const totalTrends = get(`SELECT COUNT(*) as count FROM trends WHERE collected_date = ?`, [date]);
  const hotTopics = all(`
    SELECT topic_name, (engagement_score + growth_rate) as hot_score, source, engagement_score, growth_rate, description
    FROM trends
    WHERE collected_date = ?
    ORDER BY hot_score DESC
    LIMIT 15
  `, [date]);
  const totalScripts = get(`SELECT COUNT(*) as count FROM scripts WHERE date(generated_at) = ?`, [date]);
  const scripts = all(`SELECT * FROM scripts WHERE date(generated_at) = ? ORDER BY id DESC`, [date]);

  const sources = all(`
    SELECT source, COUNT(*) as count, AVG(engagement_score + growth_rate) as avg_score
    FROM trends
    WHERE collected_date = ?
    GROUP BY source
  `, [date]);

  return {
    totalTrends: totalTrends?.count || 0,
    hotTopics,
    totalScripts: totalScripts?.count || 0,
    scripts,
    sources,
    date
  };
}

function generateExecutiveReport() {
  const stats = getTodayStats();
  const now = new Date();
  const reportDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const topTopics = stats.hotTopics.slice(0, 10).map((t, i) => {
    const score = Math.round(t.hot_score);
    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;"><b>${i + 1}.</b> ${t.topic_name}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;"><span style="background:#10b981;color:white;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">${score}</span></td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-transform:uppercase;font-size:12px;color:#6b7280;">${t.source}</td>
      </tr>`;
  }).join('');

  const sourcesSummary = stats.sources.map(s => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-transform:uppercase;font-weight:600;">${s.source}</td>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;">${s.count}</td>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;"><b>${Math.round(s.avg_score)}</b></td>
    </tr>`).join('');

  const scriptsSection = stats.scripts.map((s, i) => `
    <div style="margin-bottom:32px;page-break-inside:avoid;">
      <h3 style="color:#7c3aed;font-size:16px;margin-bottom:8px;border-bottom:2px solid #7c3aed;padding-bottom:8px;">
        📝 SCRIPT ${i + 1}: ${s.topic_name}
      </h3>
      <div style="background:#f9fafb;padding:16px;border-radius:8px;font-style:italic;line-height:1.8;">
        ${s.full_script}
      </div>
      <div style="margin-top:12px;font-size:13px;color:#6b7280;">
        <b>Hashtags:</b> ${s.hashtags}<br>
        <b>Duration:</b> ${s.duration || 30}s | <b>Source:</b> ${s.source_link || 'N/A'}
      </div>
    </div>`).join('');

  const recommendations = stats.hotTopics.slice(0, 3).map((t, i) => `<li style="margin-bottom:8px;"><b>Priority ${i + 1}:</b> ${t.topic_name}</li>`).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Daily Health Trends Executive Report - ${reportDate}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; line-height:1.6; padding: 40px; max-width:900px; margin:0 auto; }
    
    .header { text-align:center; border-bottom:3px solid #00d4ff; padding-bottom:24px; margin-bottom:32px; }
    .header h1 { font-size:28px; color:#00d4ff; margin-bottom:8px; letter-spacing:1px; }
    .header .subtitle { font-size:14px; color:#6b7280; }
    .header .date { font-size:16px; font-weight:600; color:#1f2937; margin-top:8px; }
    
    .section { margin-bottom:32px; }
    .section-title { font-size:18px; color:#00d4ff; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin-bottom:16px; font-weight:600; }
    
    .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
    .stat-box { background:linear-gradient(135deg,#00d4ff,#7c3aed); color:white; padding:20px; border-radius:12px;text-align:center; }
    .stat-box .value { font-size:32px;font-weight:700; }
    .stat-box .label { font-size:12px;opacity:0.9; }
    
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    th { background:#f3f4f6; padding:12px; text-align:left; font-size:12px; text-transform:uppercase; color:#6b7280; }
    
    .recommendations { background:#f0f9ff; padding:20px; border-radius:12px; border-left:4px solid #00d4ff; }
    .recommendations li { margin-bottom:8px; }
    
    .footer { margin-top:40px; padding-top:20px; border-top:1px solid #e5e7eb; text-align:center; font-size:12px; color:#9ca3af; }
    
    @media print {
      body { padding:20px; }
      .stat-box { -webkit-print-color-adjust:exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 DAILY HEALTH TRENDS EXECUTIVE REPORT</h1>
    <div class="subtitle">Health Trend Automation System v2.0</div>
    <div class="date">📅 ${reportDate} | ⏰ Generated: ${time}</div>
  </div>
  
  <div class="section">
    <div class="stats-grid">
      <div class="stat-box">
        <div class="value">${stats.totalTrends}</div>
        <div class="label">Total Trends</div>
      </div>
      <div class="stat-box">
        <div class="value">${stats.totalScripts}</div>
        <div class="label">Scripts Generated</div>
      </div>
      <div class="stat-box">
        <div class="value">${stats.hotTopics.length}</div>
        <div class="label">Hot Topics</div>
      </div>
      <div class="stat-box">
        <div class="value">${stats.sources.length}</div>
        <div class="label">Data Sources</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">🔥 TOP 10 HOT TRENDING TOPICS</div>
    <table>
      <thead>
        <tr>
          <th>Topic</th>
          <th style="width:100px;text-align:center;">Score</th>
          <th style="width:120px;text-align:center;">Source</th>
        </tr>
      </thead>
      <tbody>
        ${topTopics}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">📊 DATA SOURCES BREAKDOWN</div>
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th style="text-align:center;">Trends</th>
          <th style="text-align:center;">Avg Score</th>
        </tr>
      </thead>
      <tbody>
        ${sourcesSummary}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">✍️ GENERATED SCRIPTS (${stats.scripts.length})</div>
    ${scriptsSection || '<p style="color:#6b7280;font-style:italic;">No scripts generated yet</p>'}
  </div>
  
  <div class="section">
    <div class="section-title">🎯 RECOMMENDATIONS & NEXT STEPS</div>
    <div class="recommendations">
      <ul style="margin:0;padding-left:20px;">
        ${recommendations}
        <li style="margin-top:12px;"><b>Action:</b> Execute video production using top 3 trending topics</li>
        <li><b>Focus:</b> ${stats.hotTopics[0]?.topic_name || 'N/A'} (Highest engagement)</li>
      </ul>
    </div>
  </div>
  
  <div class="footer">
    <p>Report Generated By: <b>Health Trend Automation System</b></p>
    <p>Next Update: Tomorrow at 6:00 AM | Report ID: ${stats.date}-${Date.now()}</p>
    <p style="margin-top:8px;font-style:italic;">This is an automated executive report. For questions, contact the system administrator.</p>
  </div>
</body>
</html>`;
}

function exportReport() {
  const date = new Date().toISOString().split('T')[0];
  const content = generateExecutiveReport();

  const outputDir = path.join(__dirname, '..', 'reports', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, `report_${date}.html`);
  fs.writeFileSync(filePath, content, 'utf8');

  exportReportDocx();

  console.log(`\n✅ Executive Report exported to: ${filePath}\n`);
  return filePath;
}

async function exportReportDocx() {
  const date = new Date().toISOString().split('T')[0];
  const stats = getTodayStats();
  
  const outputDir = path.join(__dirname, '..', 'reports', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const topTopicsRows = stats.hotTopics.slice(0, 10).map((t, i) => new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}`, bold: true })] })],
        width: { size: 10, type: WidthType.PERCENTAGE }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: t.topic_name })] })],
        width: { size: 60, type: WidthType.PERCENTAGE }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: Math.round(t.hot_score).toString(), bold: true })] })],
        width: { size: 15, type: WidthType.PERCENTAGE }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: t.source })] })],
        width: { size: 15, type: WidthType.PERCENTAGE }
      })
    ]
  }));

  const children = [
    new Paragraph({
      text: "DAILY HEALTH TRENDS REPORT",
      heading: HeadingLevel.HEADING_1,
      alignment: 'center'
    }),
    new Paragraph({
      text: `Generated: ${new Date().toLocaleDateString('vi-VN')}`,
      alignment: 'center'
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      text: "STATISTICS",
      heading: HeadingLevel.HEADING_2
    }),
    new Paragraph({ text: `Total Trends: ${stats.totalTrends}` }),
    new Paragraph({ text: `Total Scripts: ${stats.totalScripts}` }),
    new Paragraph({ text: `Hot Topics: ${stats.hotTopics.length}` }),
    new Paragraph({ text: "" }),
    new Paragraph({
      text: "TOP 10 TRENDING TOPICS",
      heading: HeadingLevel.HEADING_2
    })
  ];

  children.push(new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })], shading: { fill: "E0E0E0" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Topic", bold: true })] })], shading: { fill: "E0E0E0" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Score", bold: true })] })], shading: { fill: "E0E0E0" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Source", bold: true })] })], shading: { fill: "E0E0E0" } })
        ]
      }),
      ...topTopicsRows
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  if (stats.scripts.length > 0) {
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({
      text: "GENERATED SCRIPTS",
      heading: HeadingLevel.HEADING_2
    }));
    
    stats.scripts.slice(0, 5).forEach((s, i) => {
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({
        text: `${i + 1}. ${s.topic_name}`,
        heading: HeadingLevel.HEADING_3
      }));
      children.push(new Paragraph({
        text: s.full_script?.substring(0, 500) + "...",
        spacing: { after: 200 }
      }));
    });
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  const docxPath = path.join(outputDir, `report_${date}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(docxPath, buffer);
  
  console.log(`✅ DOCX Report exported to: ${docxPath}`);
  return docxPath;
}

function exportReportMarkdown() {
  const date = new Date().toISOString().split('T')[0];
  const stats = getTodayStats();
  const now = new Date();
  const reportDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const topTopics = stats.hotTopics.slice(0, 10).map((t, i) => {
    const bar = '█'.repeat(Math.min(Math.round(t.hot_score) / 10, 15)).padEnd(15, '░');
    return `**${i + 1}. ${t.topic_name}**\n   📊 Score: **${Math.round(t.hot_score)}** | Source: ${t.source}\n   █${bar}█\n`;
  }).join('\n');

  const sourcesSummary = stats.sources.map(s => 
    `| **${s.source.toUpperCase()}** | ${s.count} | **${Math.round(s.avg_score)}** |`).join('\n');

  const scriptsSection = stats.scripts.map((s, i) => 
    `### 📝 SCRIPT ${i + 1}: ${s.topic_name}\n\n${s.full_script}\n\n**Hashtags:** ${s.hashtags}\n**Duration:** ${s.duration || 30}s\n`).join('\n---\n');

  const recommendations = stats.hotTopics.slice(0, 3).map((t, i) => 
    `${i + 1}. **${t.topic_name}**`).join('\n');

  const markdown = `# ═════════════════════════════════════════════════════════════════
#          📊 DAILY HEALTH TRENDS EXECUTIVE REPORT
# ═════════════════════════════════════════════════════════════════

**📅 Date:** ${reportDate}
**⏰ Generated:** ${time}
**🔄 System:** Health Trend Automation v2.0

═══════════════════════════════════════════════════════════════

## 📈 EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Total Trends Collected** | **${stats.totalTrends}** |
| **Scripts Generated** | **${stats.totalScripts}** |
| **Hot Topics** | **${stats.hotTopics.length}** |
| **Data Sources** | **${stats.sources.length}** |

═══════════════════════════════════════════════════════════════

## 🔥 TOP 10 HOT TRENDING TOPICS

${topTopics}

═══════════════════════════════════════════════════════════════

## 📊 DATA SOURCES

| Source | Trends | Avg Score |
|--------|--------|-----------|
${sourcesSummary}

═══════════════════════════════════════════════════════════════

## ✍️ GENERATED SCRIPTS (${stats.scripts.length})

${scriptsSection || '_No scripts generated yet_'}

═══════════════════════════════════════════════════════════════

## 🎯 RECOMMENDATIONS

### Priority Actions:
${recommendations}

### Content Strategy:
- **Primary:** ${stats.hotTopics[0]?.topic_name || 'N/A'}
- **Secondary:** ${stats.hotTopics[1]?.topic_name || 'N/A'}

═══════════════════════════════════════════════════════════════

## 📱 SYSTEM INFO

| Item | Details |
|------|---------|
| Report ID | ${stats.date}-${Date.now()} |
| Pipeline | ${stats.totalScripts > 0 ? 'Active (' + stats.totalScripts + ' jobs)' : 'Idle'} |

═══════════════════════════════════════════════════════════════

*Report Generated By: Health Trend Automation System*
*Next Update: Tomorrow at 6:00 AM*

═══════════════════════════════════════════════════════════════`;

  const outputDir = path.join(__dirname, '..', 'reports', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const mdPath = path.join(outputDir, `report_${date}.md`);
  fs.writeFileSync(mdPath, markdown, 'utf8');

  const htmlPath = path.join(outputDir, `report_${date}.html`);
  fs.writeFileSync(htmlPath, generateExecutiveReport(), 'utf8');

  console.log(`✅ Reports exported:`);
  console.log(`   - ${mdPath}`);
  console.log(`   - ${htmlPath}\n`);

  return { md: mdPath, html: htmlPath };
}

function generateDailyReport() {
  const date = new Date().toISOString().split('T')[0];
  const content = generateExecutiveReport();

  run(`
    INSERT OR REPLACE INTO daily_reports (report_date, total_trends, hot_topics, generated_scripts, report_content)
    VALUES (?, ?, ?, ?, ?)
  `, [date, getTodayStats().totalTrends, JSON.stringify(getTodayStats().hotTopics.map(t => t.topic_name)), getTodayStats().totalScripts, content]);

  console.log('💾 Daily report saved to database');
  return { date, content };
}

module.exports = {
  generateExecutiveReport,
  exportReport,
  exportReportDocx,
  exportReportMarkdown,
  generateDailyReport,
  getTodayStats
};
