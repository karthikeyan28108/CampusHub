import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import User from '../models/User.js';
import Event from '../models/Event.js';

async function seedPaidEvents() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected!');

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    throw new Error('Admin user not found');
  }

  const paidEvents = [
    {
      title: 'Full-Stack Web Development Masterclass & Certification',
      description: 'A comprehensive hands-on masterclass covering React 19, Node.js, Express, MongoDB Atlas, and deployment on Render & Vercel. Includes verified certification and networking lunch.',
      category: 'Workshop',
      organizer: 'Department of Information Technology & IEEE Student Branch',
      venue: 'Advanced Computing Center (Lab 4)',
      eventDate: new Date('2026-11-28T09:30:00Z'),
      startTime: '09:30 AM',
      endTime: '05:00 PM',
      registrationDeadline: new Date('2026-11-27T23:59:59Z'),
      maxParticipants: 80,
      isPaid: true,
      registrationFee: 299,
      rules: 'Bring your own laptop. Official IEEE completion certificate, lunch, and study kits provided.',
      contactInformation: 'workshop.ieee@anjaconline.org | +91 98765 43220',
      createdBy: admin._id,
      status: 'Active'
    },
    {
      title: 'National Drone & Robotics Championship 2026',
      description: 'Compete with top collegiate robotics teams across autonomous drone obstacle racing, line-follower bots, and RoboWars. Total cash prize pool ₹1,00,000!',
      category: 'Technical',
      organizer: 'Robotics & Embedded Systems Club',
      venue: 'Indoor Sports Complex & Drone Arena',
      eventDate: new Date('2026-12-05T10:00:00Z'),
      startTime: '10:00 AM',
      endTime: '06:00 PM',
      registrationDeadline: new Date('2026-12-03T20:00:00Z'),
      maxParticipants: 60,
      isPaid: true,
      registrationFee: 499,
      rules: 'Teams of 2 to 4 members. Fee covers hardware kit access, arena entry, and official jury evaluation.',
      contactInformation: 'robotics@anjaconline.org | +91 98765 43221',
      createdBy: admin._id,
      status: 'Active'
    }
  ];

  for (const pe of paidEvents) {
    const existing = await Event.findOne({ title: pe.title });
    if (existing) {
      await Event.updateOne({ _id: existing._id }, pe);
      console.log(`[Updated Paid Event] ${pe.title} (Fee: INR ${pe.registrationFee})`);
    } else {
      await Event.create(pe);
      console.log(`[Created Paid Event] ${pe.title} (Fee: INR ${pe.registrationFee})`);
    }
  }

  const allEventsCount = await Event.countDocuments();
  const paidCount = await Event.countDocuments({ isPaid: true });
  console.log(`\nTotal events now in DB: ${allEventsCount} (${paidCount} Paid)`);

  await mongoose.disconnect();
  console.log('Done.');
}

seedPaidEvents().catch((err) => {
  console.error('Error seeding paid events:', err);
  process.exit(1);
});
