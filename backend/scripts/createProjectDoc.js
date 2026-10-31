import fs from 'fs';
import path from 'path';

const projectDocText = `CampusHub Academic & Campus Collaboration System Overview

1. Project Description:
CampusHub is an integrated college collaboration platform built for students, faculty, and administrators. The platform centralizes academic resources, peer collaboration, placement drives, campus events, and administrative workflows into a unified digital portal.

2. Notes Hub Module:
The Notes Hub allows verified faculty and administrators to publish syllabus-aligned lecture materials, previous year question papers, and study guides for students. Materials are organized by department (such as CSE, ECE, MECH, CIVIL, IT), academic year (1st to 4th year), semester (Semesters 1 through 8), and subject course codes. Students can view, search, filter, and download verified notes.

3. Placement & Training Cell (PAT):
CampusHub features a placement management portal where the college placement officer broadcasts placement drives, job openings, and internship opportunities. Listings specify company name, job role, package CTC or salary, application deadlines, selection procedures, eligible departments, and minimum CGPA criteria. Students can track open drives and apply directly.

4. Events and Extracurricular Hub:
The Events module allows departments, college clubs, and student societies to organize technical symposiums, hackathons, cultural festivals, workshops, and guest lectures. Students can register for events, obtain registration confirmations, and receive updates.

5. AI Campus Assistant (RAG Chatbot):
CampusHub includes an AI Assistant powered by Google Gemini and Retrieval-Augmented Generation (RAG). The assistant provides instant answers regarding available notes, academic resources, open placement drives, eligibility criteria, and campus policies. The assistant strictly respects student privacy and only accesses approved public knowledge base materials.

6. Campus Policies and Guidelines:
- Academic Integrity: Notes shared must be original or appropriately credited lecture materials.
- Placement Eligibility: Students must maintain minimum CGPA requirements with no active standing backlogs unless explicitly permitted by the recruiting company.
- Code of Conduct: Campus communication and discussion must remain respectful, professional, and compliant with campus regulations.`;

// Build a clean, valid PDF 1.4 binary buffer
function generateSimplePdf(text) {
  const lines = text.split('\n');
  let streamContent = 'BT\n/F1 10 Tf\n20 TL\n50 740 Td\n';

  for (const line of lines) {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    if (escaped.trim().length === 0) {
      streamContent += 'T*\n';
    } else {
      streamContent += `(${escaped}) '\n`;
    }
  }
  streamContent += 'ET\n';

  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  );
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}endstream\nendobj\n`);
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );

  let output = '%PDF-1.4\n';
  const xref = [0];

  for (let i = 0; i < objects.length; i++) {
    xref.push(Buffer.byteLength(output, 'utf-8'));
    output += objects[i];
  }

  const xrefStart = Buffer.byteLength(output, 'utf-8');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    output += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(output, 'utf-8');
}

const kbDir = path.join(process.cwd(), 'knowledge-base');
if (!fs.existsSync(kbDir)) {
  fs.mkdirSync(kbDir, { recursive: true });
}

const targetPath = path.join(kbDir, 'project-document.pdf');
const pdfBuffer = generateSimplePdf(projectDocText);
fs.writeFileSync(targetPath, pdfBuffer);

console.log(`Generated project-document.pdf at: ${targetPath} (${pdfBuffer.length} bytes)`);
