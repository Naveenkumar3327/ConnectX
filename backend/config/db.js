import mongoose from 'mongoose';
import dns from 'dns';

const connectDB = async () => {
  try {
    // Force Node.js to use Google DNS for hostnames including dns.lookup (which resolves socket connections)
    try {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
      
      const originalLookup = dns.lookup;
      dns.lookup = function (hostname, options, callback) {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        
        dns.resolve4(hostname, (err, addresses) => {
          if (err || !addresses || addresses.length === 0) {
            // Fallback to original system getaddrinfo resolver
            return originalLookup(hostname, options, callback);
          }
          callback(null, addresses[0], 4);
        });
      };
    } catch (dnsErr) {
      console.warn('Warning: Could not configure custom DNS resolver:', dnsErr.message);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/connectx');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
