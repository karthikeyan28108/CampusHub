import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configure DNS for MongoDB Atlas on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Gracefully fallback
}

import User from '../models/User.js';
import Student from '../models/Student.js';
import Event from '../models/Event.js';
import Placement from '../models/Placement.js';
import { initializeSingleAdmin } from '../services/adminInitService.js';

const studentData = [
  { name: 'Bharathi', email: '24ucs001@anjaconline.org', regNo: '24ucs001', password: 'Username@001!' },
  { name: 'Abinaya', email: '24ucs002@anjaconline.org', regNo: '24ucs002', password: 'username@002@' },
  { name: 'Gayathiri', email: '24ucs003@anjaconline.org', regNo: '24ucs003', password: 'username@003#' },
  { name: 'Gopiga', email: '24ucs004@anjaconline.org', regNo: '24ucs004', password: 'username@004$' },
  { name: 'Harini', email: '24ucs005@anjaconline.org', regNo: '24ucs005', password: 'username@005%' },
  { name: 'Kamala', email: '24ucs006@anjaconline.org', regNo: '24ucs006', password: 'username@006^' },
  { name: 'Kaviya', email: '24ucs007@anjaconline.org', regNo: '24ucs007', password: 'username@007&' },
  { name: 'Maheswari', email: '24ucs008@anjaconline.org', regNo: '24ucs008', password: 'username@008*' },
  { name: 'Malini', email: '24ucs009@anjaconline.org', regNo: '24ucs009', password: 'username@009(' },
  { name: 'Nandhini', email: '24ucs010@anjaconline.org', regNo: '24ucs010', password: 'username@010)' },
  { name: 'Pradeeba', email: '24ucs011@anjaconline.org', regNo: '24ucs011', password: 'username@011!' },
  { name: 'Dharshini', email: '24ucs012@anjaconline.org', regNo: '24ucs012', password: 'username@012@' },
  { name: 'Shanmu', email: '24ucs013@anjaconline.org', regNo: '24ucs013', password: 'username@013#' },
  { name: 'Swetha', email: '24ucs014@anjaconline.org', regNo: '24ucs014', password: 'username@014$' },
  { name: 'Varshini', email: '24ucs015@anjaconline.org', regNo: '24ucs015', password: 'username@015%' },
  { name: 'Vinodhini', email: '24ucs016@anjaconline.org', regNo: '24ucs016', password: 'username@016^' },
];

const sampleEvents = (adminId) => [
  {
    title: 'HackFest 2026 - National Collegiate Hackathon',
    description: 'Join the most exhilarating 24-hour hackathon of the semester! Build real-world solutions across AI, Web3, FinTech, and IoT. Cash prizes worth ₹50,000, direct internship interviews, and certificates for all participants.',
    category: 'Technical',
    organizer: 'Department of Computer Science & Engineering',
    venue: 'Campus Tech Park - Innovation Lab & Hall 1',
    eventDate: new Date('2026-11-20T09:00:00Z'),
    startTime: '09:00 AM',
    endTime: '06:00 PM',
    registrationDeadline: new Date('2026-11-18T23:59:59Z'),
    maxParticipants: 200,
    isPaid: false,
    registrationFee: 0,
    rules: 'Teams of 2 to 4 members. Bring your own laptops. All code must be authored during the hackathon.',
    contactInformation: 'hackfest@anjaconline.org | +91 98765 43210',
    createdBy: adminId,
    status: 'Active'
  },
  {
    title: 'Hands-on Workshop: Deep Learning & Generative AI',
    description: 'An intensive, practical workshop covering Transformer architectures, fine-tuning LLMs, Retrieval-Augmented Generation (RAG), and deploying generative AI agents on cloud platforms.',
    category: 'Workshop',
    organizer: 'AI & Robotics Research Cell',
    venue: 'CS Seminar Hall & Cloud Computing Lab',
    eventDate: new Date('2026-11-25T10:00:00Z'),
    startTime: '10:00 AM',
    endTime: '04:30 PM',
    registrationDeadline: new Date('2026-11-24T18:00:00Z'),
    maxParticipants: 120,
    isPaid: false,
    registrationFee: 0,
    rules: 'Basic Python knowledge recommended. Bring a laptop with Google Colab access.',
    contactInformation: 'aiworkshop@anjaconline.org | +91 98765 43211',
    createdBy: adminId,
    status: 'Active'
  },
  {
    title: 'CyberShield 2026: Capture The Flag (CTF) Competition',
    description: 'Test your offensive and defensive cybersecurity prowess across Web Exploitation, Reverse Engineering, Cryptography, Forensics, and Binary Exploitation. Exciting swag, trophies, and certifications.',
    category: 'Technical',
    organizer: 'Information Security & Ethical Hacking Society',
    venue: 'Systems & Network Lab (Block B)',
    eventDate: new Date('2026-12-02T10:30:00Z'),
    startTime: '10:30 AM',
    endTime: '05:00 PM',
    registrationDeadline: new Date('2026-12-01T20:00:00Z'),
    maxParticipants: 100,
    isPaid: false,
    registrationFee: 0,
    rules: 'Individual or duo participation. Flags submitted through the college CTF portal.',
    contactInformation: 'cybersec@anjaconline.org | +91 98765 43212',
    createdBy: adminId,
    status: 'Active'
  },
  {
    title: 'Kalanithi - Annual Inter-Collegiate Cultural Fiesta',
    description: 'The grandest cultural carnival celebrating music, dance, theatrical drama, fashion show, and fine arts. Featuring renowned guest artists, live celebrity music bands, and food trucks.',
    category: 'Cultural',
    organizer: 'Student Affairs & Cultural Council',
    venue: 'Open Air Amphitheatre & Main Auditorium',
    eventDate: new Date('2026-12-10T09:00:00Z'),
    startTime: '09:00 AM',
    endTime: '07:30 PM',
    registrationDeadline: new Date('2026-12-08T23:59:59Z'),
    maxParticipants: 500,
    isPaid: false,
    registrationFee: 0,
    rules: 'College ID is mandatory for campus entry. Strict discipline and code of conduct apply.',
    contactInformation: 'culturals@anjaconline.org | +91 98765 43213',
    createdBy: adminId,
    status: 'Active'
  },
  {
    title: 'Inter-Department Football & Basketball Championship',
    description: 'The ultimate inter-departmental athletic showdown! Cheer for your department as football and basketball squads battle for the prestigious Chancellor\'s Trophy.',
    category: 'Sports',
    organizer: 'Department of Physical Education & Sports Club',
    venue: 'Campus Central Sports Ground',
    eventDate: new Date('2026-12-15T08:00:00Z'),
    startTime: '08:00 AM',
    endTime: '05:30 PM',
    registrationDeadline: new Date('2026-12-12T18:00:00Z'),
    maxParticipants: 150,
    isPaid: false,
    registrationFee: 0,
    rules: 'Standard FIFA / FIBA tournament rules. Official sports jerseys and cleats mandatory.',
    contactInformation: 'sports@anjaconline.org | +91 98765 43214',
    createdBy: adminId,
    status: 'Active'
  }
];

const samplePlacements = (adminId) => [
  {
    companyName: 'Google',
    jobRole: 'Associate Software Engineer',
    salary: '₹22 - ₹28 LPA',
    location: 'Bengaluru / Hyderabad (Hybrid)',
    eligibility: 'B.E / B.Tech / M.Sc / MCA (CS / IT / ECE) with CGPA >= 8.0 and no active backlogs.',
    departments: ['Computer Science', 'Information Technology', 'General'],
    minimumCGPA: 8.0,
    backlogRequirement: false,
    deadline: new Date('2026-12-01T23:59:59Z'),
    requiredSkills: ['Data Structures & Algorithms', 'C++', 'Java', 'Python', 'System Design Basics'],
    selectionProcess: 'Online Coding Challenge -> 3 Technical Video Interviews -> Googleyness & Leadership Round',
    applicationLink: 'https://careers.google.com/students',
    description: 'Join Google\'s engineering team to design, test, deploy, and maintain software solutions that scale to billions of global users across Search, Cloud, YouTube, and Android.',
    createdBy: adminId,
    status: 'Open'
  },
  {
    companyName: 'Microsoft',
    jobRole: 'Software Development Engineer (SDE 1)',
    salary: '₹18 - ₹24 LPA',
    location: 'Bengaluru / Hyderabad / Noida',
    eligibility: 'B.Tech / B.E / B.Sc / MCA with CGPA >= 7.5. Open to CS, IT, and related tech branches.',
    departments: ['Computer Science', 'Information Technology', 'General'],
    minimumCGPA: 7.5,
    backlogRequirement: false,
    deadline: new Date('2026-12-05T23:59:59Z'),
    requiredSkills: ['C#', 'TypeScript', 'React', 'Cloud Computing (Azure)', 'Object-Oriented Design'],
    selectionProcess: 'Aptitude + Coding Assessment -> Technical Round 1 -> Technical Round 2 -> AA Director Interview',
    applicationLink: 'https://careers.microsoft.com',
    description: 'Empower every person and organization on the planet to achieve more. Build next-generation cloud infrastructure, enterprise productivity tools, and AI copilot services.',
    createdBy: adminId,
    status: 'Open'
  },
  {
    companyName: 'Zoho Corporation',
    jobRole: 'Software Developer / Product Engineer',
    salary: '₹8.5 - ₹12 LPA',
    location: 'Chennai / Tenkasi / Madurai',
    eligibility: 'Any Graduate (B.E / B.Tech / B.Sc / BCA) with passion for clean code. No minimum CGPA barrier.',
    departments: ['Computer Science', 'Information Technology', 'General'],
    minimumCGPA: 6.0,
    backlogRequirement: false,
    deadline: new Date('2026-12-10T23:59:59Z'),
    requiredSkills: ['Java', 'JavaScript', 'Problem Solving', 'Data Structures', 'Database Management'],
    selectionProcess: 'Round 1: Basic Programming -> Round 2: Advanced Coding -> Round 3: Tech HR -> Round 4: Cultural Fit',
    applicationLink: 'https://www.zoho.com/careers',
    description: 'Work with one of India\'s premier bootstrapped SaaS powerhouses. Build privacy-focused, mission-critical business software loved by over 100 million users worldwide.',
    createdBy: adminId,
    status: 'Open'
  },
  {
    companyName: 'Tata Consultancy Services (TCS Digital)',
    jobRole: 'Digital Systems Engineer',
    salary: '₹7.5 - ₹9.2 LPA',
    location: 'Chennai / Bengaluru / Pune / Kochi',
    eligibility: 'B.E / B.Tech / M.Sc / MCA graduates with CGPA >= 7.0 and max 1 active backlog allowed.',
    departments: ['Computer Science', 'Information Technology', 'General'],
    minimumCGPA: 7.0,
    backlogRequirement: true,
    deadline: new Date('2026-12-15T23:59:59Z'),
    requiredSkills: ['Python', 'Full Stack Web Development', 'Cloud Essentials', 'SQL', 'RESTful APIs'],
    selectionProcess: 'TCS National Qualifier Test (NQT) -> Digital Coding Assessment -> Combined Tech + HR Interview',
    applicationLink: 'https://www.tcs.com/careers',
    description: 'Accelerate digital transformation for Global 500 corporations. Drive digital agility using modern web frameworks, cloud microservices, and automated testing pipelines.',
    createdBy: adminId,
    status: 'Open'
  },
  {
    companyName: 'Infosys (Power Programmer)',
    jobRole: 'Specialist Programmer',
    salary: '₹9.5 - ₹11 LPA',
    location: 'Bengaluru / Hyderabad / Mysore / Chennai',
    eligibility: 'B.E / B.Tech / M.Sc / MCA in CS / IT / allied branches with CGPA >= 6.5.',
    departments: ['Computer Science', 'Information Technology', 'General'],
    minimumCGPA: 6.5,
    backlogRequirement: false,
    deadline: new Date('2026-12-20T23:59:59Z'),
    requiredSkills: ['Competitive Programming', 'Java / Python', 'Dynamic Programming', 'Algorithms', 'System Architecture'],
    selectionProcess: 'HackWithInfy / InfyTQ Online Coding Round -> Technical Deep-Dive Interview -> HR Onboarding',
    applicationLink: 'https://www.infosys.com/careers',
    description: 'An elite programming role for top coders. Work on high-impact algorithmic engineering, high-throughput microservices, and AI-driven enterprise platforms.',
    createdBy: adminId,
    status: 'Open'
  }
];

async function seed() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not set in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB Connected successfully!');

  // Ensure Admin exists
  await initializeSingleAdmin();
  const adminUser = await User.findOne({ email: 'admin@campushub.edu.com'.toLowerCase() });
  if (!adminUser) {
    throw new Error('Could not find or create admin account.');
  }
  console.log(`Admin ID: ${adminUser._id}`);

  // 1. Seed 16 Users & Students
  console.log('\n--- Seeding 16 Students from Image ---');
  const seededUsers = [];
  for (const s of studentData) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(s.password, salt);

    // Upsert Student collection
    await Student.findOneAndUpdate(
      { email: s.email.toLowerCase() },
      {
        rollNumber: s.regNo,
        fullName: s.name,
        email: s.email.toLowerCase(),
        passwordHash: passwordHash,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Upsert User collection
    let existingUser = await User.findOne({ email: s.email.toLowerCase() });
    if (existingUser) {
      existingUser.name = s.name;
      existingUser.password = s.password; // pre-save will hash
      existingUser.registerNumber = s.regNo;
      existingUser.department = 'Computer Science';
      existingUser.year = 1;
      existingUser.semester = 1;
      existingUser.section = 'A';
      existingUser.role = 'student';
      existingUser.isActive = true;
      await existingUser.save();
      seededUsers.push({ id: existingUser._id, name: s.name, email: s.email, regNo: s.regNo, password: s.password, status: 'Updated' });
    } else {
      const newUser = await User.create({
        name: s.name,
        email: s.email.toLowerCase(),
        password: s.password,
        registerNumber: s.regNo,
        department: 'Computer Science',
        year: 1,
        semester: 1,
        section: 'A',
        role: 'student',
        isActive: true
      });
      seededUsers.push({ id: newUser._id, name: s.name, email: s.email, regNo: s.regNo, password: s.password, status: 'Created' });
    }
    console.log(`[User] ${s.name} (${s.regNo}) -> ${s.email} [${s.password}]`);
  }

  // 2. Seed 5 Events
  console.log('\n--- Seeding Sample Events (Max 5) ---');
  const events = sampleEvents(adminUser._id);
  const seededEvents = [];
  for (const ev of events) {
    const existing = await Event.findOne({ title: ev.title });
    if (existing) {
      await Event.updateOne({ _id: existing._id }, ev);
      seededEvents.push({ id: existing._id, title: ev.title, category: ev.category, venue: ev.venue, status: 'Updated' });
      console.log(`[Event Updated] ${ev.title}`);
    } else {
      const created = await Event.create(ev);
      seededEvents.push({ id: created._id, title: ev.title, category: ev.category, venue: ev.venue, status: 'Created' });
      console.log(`[Event Created] ${ev.title}`);
    }
  }

  // 3. Seed 5 Placements
  console.log('\n--- Seeding Sample Placements (Max 5) ---');
  const placements = samplePlacements(adminUser._id);
  const seededPlacements = [];
  for (const pl of placements) {
    const existing = await Placement.findOne({ companyName: pl.companyName, jobRole: pl.jobRole });
    if (existing) {
      await Placement.updateOne({ _id: existing._id }, pl);
      seededPlacements.push({ id: existing._id, company: pl.companyName, role: pl.jobRole, package: pl.salary, status: 'Updated' });
      console.log(`[Placement Updated] ${pl.companyName} - ${pl.jobRole}`);
    } else {
      const created = await Placement.create(pl);
      seededPlacements.push({ id: created._id, company: pl.companyName, role: pl.jobRole, package: pl.salary, status: 'Created' });
      console.log(`[Placement Created] ${pl.companyName} - ${pl.jobRole}`);
    }
  }

  console.log('\n=== SEED SUMMARY ===');
  console.log(`Students processed: ${seededUsers.length}`);
  console.log(`Events processed: ${seededEvents.length}`);
  console.log(`Placements processed: ${seededPlacements.length}`);

  await mongoose.disconnect();
  console.log('MongoDB disconnected successfully.');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
