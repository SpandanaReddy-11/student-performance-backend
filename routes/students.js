const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { withStats, summary } = require('../utils/analytics');

router.use(authenticate);
const adminOnly = requireRole('admin');

const STATUSES = ['present', 'absent', 'late'];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const findStudent = (id) => db.students.find((s) => s.id === id);
const today = () => new Date().toISOString().slice(0, 10);

function upsertAttendance(student, date, status) {
  const existing = student.attendance.find((a) => a.date === date);
  if (existing) existing.status = status;
  else student.attendance.push({ date, status });
  student.attendance.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- Teacher: list + analytics ----------
router.get('/', adminOnly, (req, res) => res.json(db.students.map(withStats)));
router.get('/analytics/summary', adminOnly, (req, res) => res.json(summary(db.students)));

// ---------- Student: own record ----------
router.get('/me', requireRole('student'), (req, res) => {
  const student = findStudent(req.user.studentId);
  if (!student) return res.status(404).json({ message: 'Student record not found' });
  res.json(withStats(student));
});

// ---------- Teacher: mark a whole class at once ----------
router.post('/attendance/bulk', adminOnly, (req, res) => {
  const { date, records } = req.body || {};
  if (!isDate(date) || !Array.isArray(records))
    return res.status(400).json({ message: 'Provide a date (YYYY-MM-DD) and a list of records' });
  let saved = 0;
  records.forEach(({ studentId, status }) => {
    const s = findStudent(studentId);
    if (s && STATUSES.includes(status)) {
      upsertAttendance(s, date, status);
      saved++;
    }
  });
  db.save();
  res.json({ saved });
});

// ---------- Teacher: create student (optionally with a login) ----------
router.post('/', adminOnly, (req, res) => {
  const { rollNo, name, email, className, phone, guardian, dob, password } = req.body || {};
  if (!rollNo || !name || !/^\S+@\S+\.\S+$/.test(email || ''))
    return res.status(400).json({ message: 'Roll number, name and a valid email are required' });
  if (db.students.some((s) => s.rollNo === String(rollNo)))
    return res.status(409).json({ message: 'This roll number already exists' });
  if (db.students.some((s) => s.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ message: 'A student with this email already exists' });
  if (password && password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const student = {
    id: db.newId(),
    rollNo: String(rollNo),
    name,
    email: email.toLowerCase(),
    className: className || '',
    phone: phone || '',
    guardian: guardian || '',
    dob: dob || '',
    marks: [],
    attendance: [],
    createdAt: new Date().toISOString(),
  };
  db.students.push(student);

  if (password) {
    db.users.push({
      id: db.newId(),
      name,
      email: student.email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'student',
      studentId: student.id,
    });
  }
  db.save();
  res.status(201).json(withStats(student));
});

// ---------- One student (teacher, or the student themself) ----------
router.get('/:id', (req, res) => {
  if (req.user.role !== 'admin' && req.user.studentId !== req.params.id)
    return res.status(403).json({ message: 'You can only view your own record' });
  const student = findStudent(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  res.json(withStats(student));
});

router.put('/:id', adminOnly, (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  ['name', 'className', 'phone', 'guardian', 'dob'].forEach((k) => {
    if (req.body[k] !== undefined) student[k] = req.body[k];
  });
  db.save();
  res.json(withStats(student));
});

router.delete('/:id', adminOnly, (req, res) => {
  if (!findStudent(req.params.id)) return res.status(404).json({ message: 'Student not found' });
  db.students = db.students.filter((s) => s.id !== req.params.id);
  db.users = db.users.filter((u) => u.studentId !== req.params.id);
  db.save();
  res.json({ message: 'Student deleted' });
});

// ---------- Marks ----------
router.post('/:id/marks', adminOnly, (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const { subject, exam, score, maxScore, date } = req.body || {};
  const sc = Number(score);
  const max = Number(maxScore);
  if (!subject || isNaN(sc) || isNaN(max) || max <= 0 || sc < 0 || sc > max)
    return res.status(400).json({ message: 'Enter a subject, a score, and a max score that is at least the score' });

  student.marks.push({
    id: db.newId(),
    subject: subject.trim(),
    exam: (exam || 'Exam').trim(),
    score: sc,
    maxScore: max,
    date: isDate(date) ? date : today(),
  });
  student.marks.sort((a, b) => a.date.localeCompare(b.date));
  db.save();
  res.status(201).json(withStats(student));
});

router.delete('/:id/marks/:markId', adminOnly, (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  student.marks = student.marks.filter((m) => m.id !== req.params.markId);
  db.save();
  res.json(withStats(student));
});

// ---------- Attendance ----------
router.post('/:id/attendance', adminOnly, (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const { date, status } = req.body || {};
  if (!isDate(date) || !STATUSES.includes(status))
    return res.status(400).json({ message: 'Provide a valid date and a status: present, absent or late' });
  upsertAttendance(student, date, status);
  db.save();
  res.status(201).json(withStats(student));
});

router.delete('/:id/attendance/:date', adminOnly, (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  student.attendance = student.attendance.filter((a) => a.date !== req.params.date);
  db.save();
  res.json(withStats(student));
});

module.exports = router;
