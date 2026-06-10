import mongoose from 'mongoose';
import dns from 'dns';

const connectDB = async () => {
  try {
    // Force Node.js to use Google DNS to bypass local ISP resolver issues with MongoDB SRV records
    try {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
    } catch (dnsErr) {
      console.warn('Warning: Could not set custom DNS servers:', dnsErr.message);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/connectx');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
