const { PrismaClient } = require('@prisma/client');
try {
  const p = new PrismaClient();
  console.log("Success with new PrismaClient()");
} catch(e) {
  console.error("Error with new PrismaClient():", e.message);
}
