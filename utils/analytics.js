const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const round = (n) => Math.round(n * 10) / 10;
const percent = (m) => (m.maxScore ? (m.score / m.maxScore) * 100 : 0);

function gradeOf(p) {
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  return 'F';
}

function statusOf(average, attendancePct) {
  if (average === null && attendancePct === null) return 'No data';
  if ((average !== null && average < 50) || (attendancePct !== null && attendancePct < 75)) return 'At risk';
  if ((average !== null && average < 60) || (attendancePct !== null && attendancePct < 85)) return 'Needs attention';
  return 'On track';
}

// Attach calculated performance + attendance numbers to a student record
function withStats(student) {
  const marks = student.marks || [];
  const attendance = student.attendance || [];

  const bySubject = {};
  marks.forEach((m) => (bySubject[m.subject] = bySubject[m.subject] || []).push(percent(m)));
  const subjects = Object.entries(bySubject).map(([subject, list]) => ({
    subject,
    average: round(avg(list)),
    exams: list.length,
  }));

  const average = marks.length ? round(avg(marks.map(percent))) : null;
  const present = attendance.filter((a) => a.status === 'present').length;
  const late = attendance.filter((a) => a.status === 'late').length;
  const absent = attendance.filter((a) => a.status === 'absent').length;
  const attendancePct = attendance.length ? round(((present + late) / attendance.length) * 100) : null;

  return {
    ...student,
    stats: {
      average,
      grade: average === null ? '-' : gradeOf(average),
      subjects,
      attendance: { total: attendance.length, present, late, absent, percentage: attendancePct },
      status: statusOf(average, attendancePct),
    },
  };
}

function summary(students) {
  const all = students.map(withStats);
  const scored = all.filter((s) => s.stats.average !== null);
  const withAtt = all.filter((s) => s.stats.attendance.percentage !== null);

  const gradeDistribution = { 'A+': 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
  scored.forEach((s) => gradeDistribution[s.stats.grade]++);

  const brief = (s) => ({
    id: s.id,
    name: s.name,
    rollNo: s.rollNo,
    average: s.stats.average,
    attendance: s.stats.attendance.percentage,
    status: s.stats.status,
  });

  return {
    total: all.length,
    averageScore: scored.length ? round(avg(scored.map((s) => s.stats.average))) : null,
    averageAttendance: withAtt.length ? round(avg(withAtt.map((s) => s.stats.attendance.percentage))) : null,
    atRiskCount: all.filter((s) => s.stats.status === 'At risk').length,
    gradeDistribution,
    topPerformers: [...scored].sort((a, b) => b.stats.average - a.stats.average).slice(0, 5).map(brief),
    needSupport: all
      .filter((s) => s.stats.status === 'At risk' || s.stats.status === 'Needs attention')
      .map(brief),
  };
}

module.exports = { withStats, summary };
