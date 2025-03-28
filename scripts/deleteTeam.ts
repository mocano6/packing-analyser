import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Usuwanie zespołów U13 i U14
  const deleteU13 = await prisma.team.deleteMany({
    where: {
      name: "U13"
    }
  });

  const deleteU14 = await prisma.team.deleteMany({
    where: {
      name: "U14"
    }
  });

  console.log('Usunięto zespoły:', { deleteU13, deleteU14 });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Błąd podczas usuwania zespołów:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 