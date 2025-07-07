import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@plagiarismdetector.com' },
    update: {},
    create: {
      email: 'admin@plagiarismdetector.com',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'ADMINISTRATOR'
    }
  });

  // Create instructor user
  const instructorPassword = await bcrypt.hash('instructor123', 10);
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@example.com' },
    update: {},
    create: {
      email: 'instructor@example.com',
      password: instructorPassword,
      firstName: 'John',
      lastName: 'Instructor',
      role: 'INSTRUCTOR'
    }
  });

  // Create student user
  const studentPassword = await bcrypt.hash('student123', 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      password: studentPassword,
      firstName: 'Jane',
      lastName: 'Student',
      role: 'STUDENT'
    }
  });

  // Create system settings
  const settings = [
    { key: 'MIN_SIMILARITY_THRESHOLD', value: '0.1' },
    { key: 'DEFAULT_NGRAM_SIZE', value: '3' },
    { key: 'MAX_FILE_SIZE', value: '10485760' },
    { key: 'SUPPORTED_FILE_TYPES', value: 'pdf,doc,docx,txt' },
    { key: 'SYSTEM_VERSION', value: '1.0.0' }
  ];

  for (const setting of settings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting
    });
  }

  console.log('✅ Database seeding completed!');
  console.log('👤 Admin user:', admin.email);
  console.log('👨‍🏫 Instructor user:', instructor.email);
  console.log('👩‍🎓 Student user:', student.email);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
