"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adminSeed_1 = require("./adminSeed");
const recipeSeed_1 = require("./recipeSeed");
const activitySeed_1 = require("./activitySeed");
const partnerSeed_1 = require("./partnerSeed");
const careSeed_1 = require("./careSeed");
const subscriptionSeed_1 = require("./subscriptionSeed");
const prisma_client_options_1 = require("../../src/prisma/prisma-client-options");
const prisma = new client_1.PrismaClient((0, prisma_client_options_1.createPrismaClientOptions)());
async function main() {
    console.log('Seeding database...');
    await (0, adminSeed_1.seedAdmin)(prisma);
    await (0, recipeSeed_1.seedRecipes)(prisma);
    await (0, activitySeed_1.seedActivities)(prisma);
    await (0, partnerSeed_1.seedPartnerRewards)(prisma);
    await (0, careSeed_1.seedCareModules)(prisma);
    await (0, subscriptionSeed_1.seedSubscriptionPlans)(prisma);
    console.log('Database seeding completed!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=index.js.map