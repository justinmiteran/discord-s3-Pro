import dotenv from 'dotenv';
import path from 'path';

// CRITICAL: Load environment variables BEFORE any other module imports the logger
dotenv.config({ path: path.join(process.cwd(), '.env') });
