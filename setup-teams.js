const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Zespoły z src/constants/teams.ts
const TEAMS = {
  REZERWY: {
    id: "89039437-62a7-4eda-b67d-70a4fb24e4ea",
    name: "Rezerwy"
  },
  U19: {
    id: "1595da8a-a9d6-463d-a49d-5e2c41ff36be",
    name: "U19"
  },
  U17: {
    id: "58f3862c-75d5-4fa7-a18d-0c8e3b00402a",
    name: "U17"
  },
  U16: {
    id: "06141fa4-80bc-404e-8fcb-63ef2d0a7815",
    name: "U16"
  },
  U15: {
    id: "0ebf0d57-4f2c-4c12-937f-635feb2af332",
    name: "U15"
  }
};

async function setupDatabase() {
  try {
    console.log('Czyszczenie bazy danych...');
    
    // Usuń wszystkie istniejące dane - kolejność jest ważna ze względu na relacje
    await prisma.actionsPacking.deleteMany({});
    await prisma.playerMinutes.deleteMany({});
    await prisma.match.deleteMany({});
    await prisma.player.deleteMany({});
    await prisma.team.deleteMany({});
    
    console.log('Baza danych została wyczyszczona');
    
    console.log('Dodawanie zespołów...');
    
    // Dodaj zespoły z const TEAMS
    for (const teamKey in TEAMS) {
      const team = TEAMS[teamKey];
      try {
        const createdTeam = await prisma.team.create({
          data: {
            id: team.id,
            name: team.name
          }
        });
        console.log(`Dodano zespół: ${team.name} (ID: ${team.id})`);
      } catch (error) {
        // Obsługujemy sytuację, gdy zespół już istnieje (naruszenie unique)
        if (error.code === 'P2002') {
          console.log(`Zespół ${team.name} już istnieje.`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('Zespoły zostały dodane pomyślnie!');
    
  } catch (error) {
    console.error('Błąd podczas konfiguracji bazy danych:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase(); 