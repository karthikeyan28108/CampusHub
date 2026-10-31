import '../../config/env.js';
import mongoose from 'mongoose';
import Event from '../../models/Event.js';
import User from '../../models/User.js';

async function seedSampleEvents() {
  console.log('====================================================');
  console.log('   CampusHub Events Hub - Sample Events Seeder      ');
  console.log('====================================================\n');

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/campushub');
    console.log(' Connected to MongoDB.');

    // Find or create an admin/faculty user to associate as createdBy
    let organizerUser = await User.findOne({ role: { $in: ['admin', 'faculty'] } });
    if (!organizerUser) {
      organizerUser = await User.create({
        name: 'Campus Event Board',
        email: 'events@campushub.edu',
        password: 'password123',
        role: 'admin',
        department: 'Student Affairs',
        registerNumber: 'EVT_COORD_01'
      });
      console.log(' Created Event Coordinator Admin user.');
    } else {
      console.log(` Using existing organizer: ${organizerUser.name} (${organizerUser.role})`);
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const sampleEvents = [
      // 1. Technical Events
      {
        title: 'HackNova 2026: 24-Hour National Collegiate Hackathon',
        description: 'Join over 300 passionate developers, designers, and innovators in our flagship 24-hour overnight hackathon. Build cutting-edge solutions across AI/ML, Web3, FinTech, and Green Computing with mentorship from top industry engineers.',
        category: 'Technical',
        organizer: 'CampusHub Developer Student Club',
        venue: 'Central Innovation & Incubation Center, Hall A',
        eventDate: new Date(now + 6 * dayMs),
        startTime: '09:00 AM',
        endTime: '09:00 AM',
        registrationDeadline: new Date(now + 5 * dayMs),
        maxParticipants: 300,
        image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
        isPaid: false,
        registrationFee: 0,
        rules: 'Teams must comprise 2 to 4 members. Pre-written code is strictly prohibited. Free food, midnight snacks, and sponsor swag provided.',
        contactInformation: 'Dev Club Lead: devclub@campushub.edu | +91 98765 43210',
        status: 'Active',
        createdBy: organizerUser._id
      },
      {
        title: 'CodeSprint: Algorithmic Speed Challenge & Bug Bounty',
        description: 'Test your competitive programming prowess against the campus top coders. Solve algorithmic puzzles, optimize time complexity, and debug obfuscated code under extreme time constraints.',
        category: 'Technical',
        organizer: 'Department of Computer Science & Engineering',
        venue: 'Alan Turing Computing Lab, 3rd Floor',
        eventDate: new Date(now + 10 * dayMs),
        startTime: '02:00 PM',
        endTime: '05:30 PM',
        registrationDeadline: new Date(now + 9 * dayMs),
        maxParticipants: 120,
        image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
        isPaid: false,
        registrationFee: 0,
        rules: 'Individual participation only. Supported languages: C++, Java, Python. Standard competitive programming evaluation rules apply.',
        contactInformation: 'Dr. Ramesh Kumar: ramesh.cse@campushub.edu',
        status: 'Active',
        createdBy: organizerUser._id
      },
      {
        title: 'RoboClash: Autonomous & RC Combat Bot Arena',
        description: 'An adrenaline-fueled engineering showcase where student-built 15kg and 30kg combat robots battle in an armored polycarbonate arena. Prizes for best mechanical design, speed, and combat endurance.',
        category: 'Technical',
        organizer: 'Robotics & Automation Society (RAS)',
        venue: 'Mechanical Workshop Arena, Ground Floor',
        eventDate: new Date(now + 16 * dayMs),
        startTime: '10:00 AM',
        endTime: '06:00 PM',
        registrationDeadline: new Date(now + 14 * dayMs),
        maxParticipants: 80,
        image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
        isPaid: true,
        registrationFee: 250,
        rules: 'Robots must clear safety weight and radio frequency inspections before entry. Maximum team size: 5 members.',
        contactInformation: 'Robotics Secretary: ras@campushub.edu | +91 91234 56789',
        status: 'Active',
        createdBy: organizerUser._id
      },

      // 2. Cultural Events
      {
        title: 'AURA 2026: Annual Inter-College Cultural Gala & Band Battle',
        description: 'The biggest night of the semester! Experience electrifying band performances, celebrity guest appearances, western dance crews, and theatrical skits across an unforgettable evening under the stars.',
        category: 'Cultural',
        organizer: 'Student Cultural Council & Arts Forum',
        venue: 'Main Campus Open Air Amphitheatre',
        eventDate: new Date(now + 14 * dayMs),
        startTime: '05:30 PM',
        endTime: '10:30 PM',
        registrationDeadline: new Date(now + 13 * dayMs),
        maxParticipants: 1000,
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        isPaid: true,
        registrationFee: 150,
        rules: 'Valid college ID required at ticket gate. External food and glass containers strictly prohibited.',
        contactInformation: 'Cultural Secretary: aura2026@campushub.edu | +91 99887 76655',
        status: 'Active',
        createdBy: organizerUser._id
      },
      {
        title: 'Rhythm & Raag: Classical Indian Dance & Instrumental Solo',
        description: 'A serene celebration of classical heritage featuring Carnatic and Hindustani vocalists, sitar and tabla ensembles, and Bharatanatyam and Kathak solo performances by students and guest masters.',
        category: 'Cultural',
        organizer: 'Heritage Arts & Music Club',
        venue: 'Kaviguru Auditorium, Humanities Block',
        eventDate: new Date(now + 20 * dayMs),
        startTime: '03:00 PM',
        endTime: '07:30 PM',
        registrationDeadline: new Date(now + 19 * dayMs),
        maxParticipants: 350,
        image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
        isPaid: false,
        registrationFee: 0,
        rules: 'Participants must submit background audio track 2 hours prior to performance. Dress code: Traditional attire.',
        contactInformation: 'Music Society: music.club@campushub.edu',
        status: 'Active',
        createdBy: organizerUser._id
      },
      {
        title: 'ChitraKala: Street Art, Live Graffiti & Photo Gallery',
        description: 'An open campus creative festival where fine arts students and hobbyists transform courtyard walls into vibrant murals. Includes a digital photography exhibition and live caricatures.',
        category: 'Cultural',
        organizer: 'Fine Arts & Photography Society',
        venue: 'Central Quadrangle & Library Walkway',
        eventDate: new Date(now + 24 * dayMs),
        startTime: '10:00 AM',
        endTime: '05:00 PM',
        registrationDeadline: new Date(now + 23 * dayMs),
        maxParticipants: 150,
        image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
        isPaid: false,
        registrationFee: 0,
        rules: 'Eco-friendly spray paints and canvases will be provided. Photography submissions must be original work.',
        contactInformation: 'Arts Club: chitrakala@campushub.edu',
        status: 'Active',
        createdBy: organizerUser._id
      },

      // 3. Sports Events
      {
        title: 'Titan Cup 2026: Inter-Departmental 5v5 Futsal Tournament',
        description: 'High-octane fast-paced floodlight futsal championship. Cheer on your department as 16 teams battle through knockouts to lift the prestigious Titan Cup trophy.',
        category: 'Sports',
        organizer: 'Department of Physical Education & Sports',
        venue: 'University Floodlit Turf Complex',
        eventDate: new Date(now + 8 * dayMs),
        startTime: '04:30 PM',
        endTime: '09:30 PM',
        registrationDeadline: new Date(now + 7 * dayMs),
        maxParticipants: 160,
        image: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1200&q=80',
        isPaid: true,
        registrationFee: 300,
        rules: 'Team size: 5 players + 3 substitutes. Shin guards mandatory. Two 15-minute halves with rolling substitutions.',
        contactInformation: 'Sports Officer: sports@campushub.edu | +91 97890 12345',
        status: 'Active',
        createdBy: organizerUser._id
      },
      {
        title: 'Grandmaster Gambit: Open Blitz Chess Tournament',
        description: 'A 7-round Swiss system blitz chess tournament (3 minutes + 2 seconds increment). Test your tactical intuition against faculty and student grandmasters.',
        category: 'Sports',
        organizer: 'Campus Chess Club',
        venue: 'Indoor Sports Complex, Hall 2',
        eventDate: new Date(now + 12 * dayMs),
        startTime: '01:30 PM',
        endTime: '06:00 PM',
        registrationDeadline: new Date(now + 11 * dayMs),
        maxParticipants: 90,
        image: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=1200&q=80',
        isPaid: false,
        registrationFee: 0,
        rules: 'FIDE blitz rules apply. Digital chess clocks and boards provided. Arbiters decision is final.',
        contactInformation: 'Chess Club: chess@campushub.edu',
        status: 'Active',
        createdBy: organizerUser._id
      },
      {
        title: 'SmashPoint: Badminton Doubles Championship',
        description: 'Men, women, and mixed doubles badminton championship. Showcase your smashes, drop shots, and baseline stamina in a knockout tournament.',
        category: 'Sports',
        organizer: 'Badminton Association',
        venue: 'Indoor Badminton Arena (Courts 1-4)',
        eventDate: new Date(now + 18 * dayMs),
        startTime: '08:30 AM',
        endTime: '04:00 PM',
        registrationDeadline: new Date(now + 17 * dayMs),
        maxParticipants: 64,
        image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80',
        isPaid: true,
        registrationFee: 200,
        rules: 'Yonex feather shuttles provided. Non-marking shoes mandatory on synthetic courts.',
        contactInformation: 'Badminton Captain: badminton@campushub.edu',
        status: 'Active',
        createdBy: organizerUser._id
      },

      // 4. Workshops & Skill Development
      {
        title: 'Hands-on Full-Stack AI & GenAI Development Workshop',
        description: 'Build and deploy real-world Generative AI applications from scratch! Learn prompt engineering, function calling, vector embeddings with Google Gemini, and building full-stack web apps with React and Node.js.',
        category: 'Workshop',
        organizer: 'Centre for Artificial Intelligence & Data Science',
        venue: 'CS Seminar Hall A & Hands-on Virtual Lab',
        eventDate: new Date(now + 9 * dayMs),
        startTime: '10:00 AM',
        endTime: '04:30 PM',
        registrationDeadline: new Date(now + 8 * dayMs),
        maxParticipants: 200,
        image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80',
        isPaid: true,
        registrationFee: 199,
        rules: 'Bring your laptop with Node.js and VS Code installed. Certificate of completion and free API credits provided.',
        contactInformation: 'Prof. Ananya Sen: ai.centre@campushub.edu | +91 94567 89012',
        status: 'Active',
        createdBy: organizerUser._id
      },
      {
        title: 'CyberShield: Ethical Hacking, CTF & Penetration Testing',
        description: 'Learn real-world offensive security techniques! Explore web vulnerability assessments (OWASP Top 10), network traffic analysis with Wireshark, privilege escalation, and finish with a 2-hour live Capture The Flag (CTF) contest.',
        category: 'Workshop',
        organizer: 'Cyber Security Special Interest Group',
        venue: 'Network Security Laboratory, Room 402',
        eventDate: new Date(now + 21 * dayMs),
        startTime: '09:30 AM',
        endTime: '05:00 PM',
        registrationDeadline: new Date(now + 20 * dayMs),
        maxParticipants: 110,
        image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
        isPaid: true,
        registrationFee: 299,
        rules: 'Participants must agree to responsible disclosure ethics guidelines. Laptop with VirtualBox/VMware recommended.',
        contactInformation: 'Cyber Club: cybersecurity@campushub.edu',
        status: 'Active',
        createdBy: organizerUser._id
      },
      {
        title: 'Cloud DevOps Masterclass: Docker, Kubernetes & CI/CD Pipelines',
        description: 'A comprehensive crash course for career-ready software engineering. Containerize microservices with Docker, manage container pods with Kubernetes, and automate testing with GitHub Actions CI/CD pipelines.',
        category: 'Workshop',
        organizer: 'Cloud Computing Research Club',
        venue: 'Virtual Audio-Visual Hall & Streaming Portal',
        eventDate: new Date(now + 28 * dayMs),
        startTime: '11:00 AM',
        endTime: '03:30 PM',
        registrationDeadline: new Date(now + 27 * dayMs),
        maxParticipants: 250,
        image: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=1200&q=80',
        isPaid: false,
        registrationFee: 0,
        rules: 'Open to students of all departments and years. GitHub account required for cloud lab exercises.',
        contactInformation: 'Cloud Club: cloud.devops@campushub.edu',
        status: 'Active',
        createdBy: organizerUser._id
      }
    ];

    let insertedCount = 0;
    for (const evt of sampleEvents) {
      // Check if event with same title already exists
      const existing = await Event.findOne({ title: evt.title });
      if (!existing) {
        await Event.create(evt);
        console.log(` ✅ Inserted: [${evt.category}] "${evt.title}" (${evt.isPaid ? `₹${evt.registrationFee}` : 'Free'})`);
        insertedCount++;
      } else {
        // Update dates to stay upcoming
        existing.eventDate = evt.eventDate;
        existing.registrationDeadline = evt.registrationDeadline;
        existing.status = 'Active';
        await existing.save();
        console.log(` 🔄 Refreshed dates for: "${evt.title}"`);
      }
    }

    const totalActive = await Event.countDocuments({ status: 'Active' });
    console.log(`\n🎉 Seeding completed! Added ${insertedCount} new events.`);
    console.log(`📊 Total Active Events in CampusHub: ${totalActive}\n`);

  } catch (err) {
    console.error('❌ Error seeding events:', err);
  } finally {
    await mongoose.disconnect();
    console.log(' Disconnected from MongoDB.');
  }
}

seedSampleEvents();
