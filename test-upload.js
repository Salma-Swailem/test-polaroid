require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  const prisma = new PrismaClient();

  try {
    console.log('Testing database connection...');

    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Check if we can query users
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users in database`);

    // Check if we can query photos
    const photoCount = await prisma.photo.count();
    console.log(`✅ Found ${photoCount} photos in database`);

    // Check environment variables
    console.log('\nEnvironment variables:');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
    console.log('PORT:', process.env.PORT || '3000 (default)');

  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
