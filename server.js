require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const AppError = require('./src/utils/appError');
const globalErrorHandler = require('./src/middleware/error');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Test route
app.get('/', (req, res) => {
  res.send('Expense Tracker API is running!');
});

// API Routes
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/groups', require('./src/routes/group.routes'));
app.use('/api/expenses', require('./src/routes/expense.routes'));
app.use('/api/balances', require('./src/routes/balance.routes'));
app.use('/api/settlements', require('./src/routes/settlement.routes'));

// 404 handler - must be after all other routes
app.use((req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
});

// Global error handler - must be after all other middleware and routes
app.use(globalErrorHandler);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});


// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});
