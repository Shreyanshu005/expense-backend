const http = require('http');
const app = require('./app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get port from environment and store in Express.
const port = process.env.PORT || 3000;
app.set('port', port);

// Create HTTP server.
const server = http.createServer(app);

// Test database connection and start server
async function startServer() {
  try {
    // Test the database connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Start the server
    server.listen(port, () => {
      console.log(`🚀 Server running on port ${port} in ${process.env.NODE_ENV} mode`);
      console.log(`📄 API Documentation: http://localhost:${port}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
}

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Start the server
startServer();

// Handle process termination
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
