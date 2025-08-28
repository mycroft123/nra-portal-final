const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'your_username',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
  
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 300000, // Close idle clients after 5 minutes (300 seconds)
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection could not be established
  acquireTimeoutMillis: 10000, // Time to wait for connection from pool
  createTimeoutMillis: 10000, // Time to wait for new connection creation
  destroyTimeoutMillis: 5000, // Time to wait for connection destruction
  reapIntervalMillis: 1000, // How often to check for idle connections
  createRetryIntervalMillis: 200, // Time between connection creation retries
};

// Create a connection pool
const pool = new Pool(dbConfig);

// Add connection pool event listeners for better monitoring
pool.on('connect', (client) => {
  console.log('🔗 New client connected to database');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client:', err);
});

pool.on('remove', (client) => {
  console.log('🗑️ Client removed from pool');
});

// Database connection function
async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database successfully');
    
    // Test the connection
    const result = await client.query('SELECT NOW()');
    console.log('📅 Database time:', result.rows[0].now);
    
    client.release(); // Release the client back to the pool
    return pool;
  } catch (error) {
    console.error('❌ Error connecting to PostgreSQL:', error.message);
    throw error;
  }
}

// Graceful shutdown function
async function closeDB() {
  try {
    await pool.end();
    console.log('🔒 Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error.message);
  }
}

// Database query helper function with retry logic
async function query(text, params, retries = 3) {
  const start = Date.now();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('⚡ Query executed', { text, duration, rows: result.rowCount, attempt });
      return result;
    } catch (error) {
      console.error(`❌ Query error (attempt ${attempt}/${retries}):`, error.message);
      
      // Check if it's a connection-related error that we should retry
      const isConnectionError = error.message.includes('Connection terminated') ||
                               error.message.includes('connection timeout') ||
                               error.message.includes('ECONNRESET') ||
                               error.message.includes('ENOTFOUND') ||
                               error.code === 'ECONNRESET' ||
                               error.code === 'ENOTFOUND';
      
      if (isConnectionError && attempt < retries) {
        console.log(`🔄 Retrying query in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000)); // Exponential backoff
        continue;
      }
      
      throw error;
    }
  }
}

// Initialize database connection
connectDB().catch(error => {
  console.error('Failed to connect to database:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

// Export for use in other modules
module.exports = { pool, query, connectDB, closeDB };