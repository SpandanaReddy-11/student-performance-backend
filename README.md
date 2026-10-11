# Student Performance Analysis - Backend

REST API built with Node.js, Express and JWT authentication.

## Run
```
npm install
npm start
```
The API runs on http://localhost:5000

## Default teacher login
admin@school.com / admin123

## Structure
- server.js - app entry point
- db.js - JSON file database and admin seed
- middleware/auth.js - JWT sign, verify and role check
- routes/auth.js - register, login, me
- routes/students.js - students, marks, attendance, analytics
- utils/analytics.js - averages, grades, attendance percentage, status

## Main endpoints
POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
GET/POST /api/students, GET/PUT/DELETE /api/students/:id, GET /api/students/me
POST /api/students/:id/marks, POST /api/students/:id/attendance
POST /api/students/attendance/bulk, GET /api/students/analytics/summary

The frontend is in a separate repository and calls this API.