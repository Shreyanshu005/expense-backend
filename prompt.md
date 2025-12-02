Create a complete production-ready backend for a Splitwise-like expense tracking app.

Tech stack:
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JWT authentication
- MVC architecture

Features:
1. User Authentication
   - Register, Login, Logout
   - JWT-based auth
   - /auth/me endpoint

2. Groups
   - Create group
   - Generate invite code
   - Join group using invite code
   - Get all groups for a user
   - Get group details

3. Expenses
   - Add expense (description, amount, category, paidBy, splitBetween[], splitType = equal/exact/percentage)
   - Get all expenses in a group
   - CRUD expense

4. Splits
   - Automatically store splits for each user in ExpenseSplit table

5. Balances
   - Calculate who owes whom in each group
   - Implement optimal debt minimization algorithm (minCashFlow)

6. Settlements
   - Record settlement payments
   - Method: UPI / Cash
   - Get settlements

7. Database Schema (use these tables):
   - User
   - Group
   - GroupMember
   - Expense
   - ExpenseSplit
   - Settlement

What to generate:
- Complete folder structure (controllers, services, routes, middleware, utils)
- Full Prisma schema
- All models
- All controllers (Auth, Groups, Expenses, Splits, Settlements)
- All services with business logic
- All routes
- JWT middleware
- Validation for request bodies
- Debt calculation algorithm code
- Example .env file
- Seed script
- Full server.js

Output everything cleanly and fully working.
