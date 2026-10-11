const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authenticate } = require('../middleware/auth');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, studentId: u.studentId });
const validEmail = (e) => /^\S+@\S+\.\S+$/.test(e || '');

// Students create their own login. The teacher must have added the student (with the same email) first.
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !validEmail(email) || !password || password.length < 6)
    return res.status(400).json({ message: 'Enter your name, a valid email and a password of at least 6 characters' });

  const mail = email.toLowerCase();
  const student = db.students.find((s) => s.email.toLowerCase() === mail);
  if (!student)
    return res.status(404).json({ message: 'No student record uses this email. Ask your teacher to add you first.' });
  if (db.users.some((u) => u.email.toLowerCase() === mail))
    return res.status(409).json({ message: 'An account with this email already exists. Log in instead.' });

  const user = {
    id: db.newId(),
    name,
    email: mail,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'student',
    studentId: student.id,
  };
  db.users.push(user);
  db.save();
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash))
    return res.status(401).json({ message: 'Email or password is incorrect' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'Account not found' });
  res.json(publicUser(user));
});

module.exports = router;
