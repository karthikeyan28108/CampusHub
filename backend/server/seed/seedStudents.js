import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import Student from '../../models/Student.js';
import User from '../../models/User.js';

// Load environment variables
dotenv.config();

// Simple CSV parser
const parseCsv = (content) => {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index];
    });
    results.push(obj);
  }
  return results;
};

const seedStudents = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campushub';
    console.log(`[Seed] Connecting to MongoDB at: ${mongoUri}...`);
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    } catch (connError) {
      console.warn(`[Seed] Connection to primary MONGO_URI failed: ${connError.message}`);
      const fallbackUri = 'mongodb://127.0.0.1:27017/campushub';
      console.log(`[Seed] Attempting fallback to local MongoDB at: ${fallbackUri}`);
      await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 3000 });
    }
    console.log('[Seed] MongoDB connection established.');

    // Resolve CSV path
    const csvPath = path.join(process.cwd(), 'server', 'seed', 'data', 'students.csv');
    console.log(`[Seed] Reading CSV roster from: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Roster file not found at ${csvPath}`);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const students = parseCsv(fileContent);
    console.log(`[Seed] Found ${students.length} student records to process.`);

    for (const record of students) {
      const { rollNumber, fullName, email, initialPassword } = record;

      if (!rollNumber || !fullName || !email || !initialPassword) {
        console.warn(`[Seed] Skipping invalid record: ${JSON.stringify(record)}`);
        continue;
      }

      // Hash password with bcrypt cost factor 12
      const hash = await bcrypt.hash(initialPassword, 12);

      // 1. Idempotently update Student collection
      let dbStudent = await Student.findOne({ rollNumber });
      if (dbStudent) {
        dbStudent.fullName = fullName;
        dbStudent.email = email.toLowerCase();
        dbStudent.passwordHash = hash;
        dbStudent.updatedAt = new Date();
        await dbStudent.save();
        console.log(`[Seed] Updated Student record: ${rollNumber} (${fullName})`);
      } else {
        await Student.create({
          rollNumber,
          fullName,
          email: email.toLowerCase(),
          passwordHash: hash
        });
        console.log(`[Seed] Created Student record: ${rollNumber} (${fullName})`);
      }

      // 2. Idempotently update corresponding User collection (for app compatibility)
      let dbUser = await User.findOne({ email: email.toLowerCase() });
      if (dbUser) {
        dbUser.name = fullName;
        dbUser.registerNumber = rollNumber;
        dbUser.password = initialPassword; // pre-save hook handles hashing
        dbUser.role = 'student';
        dbUser.isActive = true;
        await dbUser.save();
        console.log(`[Seed] Updated User sync: ${email}`);
      } else {
        await User.create({
          name: fullName,
          email: email.toLowerCase(),
          password: initialPassword, // pre-save hook handles hashing
          role: 'student',
          registerNumber: rollNumber,
          department: 'CSE',
          year: 1,
          section: 'A',
          isActive: true
        });
        console.log(`[Seed] Created User sync: ${email}`);
      }
    }

    console.log('[Seed] Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error during seeding:', error.message);
    process.exit(1);
  }
};

seedStudents();
