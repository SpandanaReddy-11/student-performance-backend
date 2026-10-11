// Tiny JSON-file database (no external DB needed). Swap for MongoDB/MySQL later if you like.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const FILE = path.join(__dirname, 'data', 'db.json');

const db = {
  users: [],
  students: [],
  newId: () => crypto.randomUUID(),
  save() {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ users: this.users, students: this.students }, null, 2));
  },
};

if (fs.existsSync(FILE)) {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  db.users = saved.users || [];
  db.students = saved.students || [];
}

// Seed a default admin (teacher) account on first run
if (!db.users.some((u) => u.role === 'admin')) {
  db.users.push({
    id: db.newId(),
    name: 'Admin',
    email: process.env.ADMIN_EMAIL || 'admin@school.com',
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10),
    role: 'admin',
    studentId: null,
  });
  db.save();
  console.log('Seeded admin account -> admin@school.com / admin123 (change it!)');
}

module.exports = db;
