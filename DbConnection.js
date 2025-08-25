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
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
};

// Create a connection pool
const pool = new Pool(dbConfig);

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

// Database query helper function
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('⚡ Query executed', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
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