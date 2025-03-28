import { PrismaClient } from '@prisma/client';
import { TEAMS } from '../src/constants/teams';

const prisma = new PrismaClient();

async function main() {
  console.log('Rozpoczynam seed bazy danych...');

  // Dodawanie zespołów
  console.log('Dodawanie zespołów...');
  for (const team of TEAMS) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {},
      create: {
        name: team.name,
      },
    });
  }

  console.log('Seed zakończony pomyślnie!');
}

main()
  .catch((e) => {
    console.error('Błąd podczas seedowania:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 