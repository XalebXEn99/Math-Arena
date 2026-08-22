const fs = require('fs');

const reportData = process.env.REPORT_DATA;
if (!reportData) {
  console.error('No report data provided');
  process.exit(1);
}

const newReport = JSON.parse(decodeURIComponent(reportData));

let reports = [];
if (fs.existsSync('reports.json')) {
  const content = fs.readFileSync('reports.json', 'utf8');
  reports = JSON.parse(content);
}

reports.push(newReport);
fs.writeFileSync('reports.json', JSON.stringify(reports, null, 2));

console.log(`Report added. Total reports: ${reports.length}`);
