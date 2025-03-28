import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const newTeam = await prisma.team.create({
    data: {
      name: "U13"
    }
  });

  console.log('Nowy zespół został dodany:', newTeam);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Błąd podczas dodawania zespołu:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 