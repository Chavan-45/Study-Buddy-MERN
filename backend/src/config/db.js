import mongoose from 'mongoose';

/**
 * Safely normalizes Mongo URI by percent-encoding credentials if raw special characters exist
 */
export function normalizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  const prefix = uri.startsWith('mongodb+srv://')
    ? 'mongodb+srv://'
    : uri.startsWith('mongodb://')
    ? 'mongodb://'
    : null;

  if (!prefix) return uri;

  const rest = uri.slice(prefix.length);
  const lastAtIndex = rest.lastIndexOf('@');
  if (lastAtIndex === -1) return uri;

  const userInfo = rest.slice(0, lastAtIndex);
  let hostAndDb = rest.slice(lastAtIndex + 1);
  const colonIndex = userInfo.indexOf(':');
  if (colonIndex === -1) return uri;

  let username = userInfo.slice(0, colonIndex);
  let password = userInfo.slice(colonIndex + 1);

  // Decode first to prevent double-encoding, then re-encode special characters
  try {
    username = decodeURIComponent(username);
  } catch {}
  try {
    password = decodeURIComponent(password);
  } catch {}

  // Ensure explicit database name 'study_buddy_roulette' if omitted or empty
  const slashIndex = hostAndDb.indexOf('/');
  if (slashIndex === -1) {
    hostAndDb = `${hostAndDb}/study_buddy_roulette`;
  } else {
    const afterSlash = hostAndDb.slice(slashIndex + 1);
    const qIndex = afterSlash.indexOf('?');
    const dbName = qIndex === -1 ? afterSlash : afterSlash.slice(0, qIndex);
    const queryPart = qIndex === -1 ? '' : afterSlash.slice(qIndex);
    if (!dbName || dbName === 'test') {
      hostAndDb = `${hostAndDb.slice(0, slashIndex)}/study_buddy_roulette${queryPart}`;
    }
  }

  return `${prefix}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostAndDb}`;
}

/**
 * Connect to MongoDB Atlas via Mongoose
 */
export async function connectDB() {
  const rawUri = process.env.MONGO_URI;

  if (!rawUri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  const mongoUri = normalizeMongoUri(rawUri);

  try {
    const conn = await mongoose.connect(mongoUri, {
      dbName: 'study_buddy_roulette', // Explicitly targets study_buddy_roulette database
      autoIndex: true, // Build indexes in development
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if Atlas is unreachable
    });

    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host} (Database: ${conn.connection.name})`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Atlas Connection Error: ${error.message}`);
    throw error;
  }
}

/**
 * Check active MongoDB connection status
 * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export function getDBStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const stateCode = mongoose.connection.readyState;
  return {
    stateCode,
    status: states[stateCode] || 'unknown',
    isConnected: stateCode === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
}

// Mongoose Connection Event Listeners
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB connection disconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime connection error:', err);
});
