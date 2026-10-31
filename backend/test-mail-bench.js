import './config/env.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100
});

console.time('sendWithServiceGmail');
await transporter.sendMail({
  from: `"CampusHub" <${process.env.EMAIL_USER}>`,
  to: 'chriskarthi02maguire@gmail.com',
  subject: 'Benchmark Test',
  text: 'OTP 123456'
});
console.timeEnd('sendWithServiceGmail');

console.time('secondSendWithPool');
await transporter.sendMail({
  from: `"CampusHub" <${process.env.EMAIL_USER}>`,
  to: 'chriskarthi02maguire@gmail.com',
  subject: 'Benchmark Test 2',
  text: 'OTP 654321'
});
console.timeEnd('secondSendWithPool');

process.exit(0);

