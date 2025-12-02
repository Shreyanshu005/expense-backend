const { PrismaClient } = require('@prisma/client');

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Store in global in development to prevent hot-reloading issues
if (process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
