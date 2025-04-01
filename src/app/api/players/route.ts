import { prisma } from "@/app/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Pobieranie wszystkich zawodników lub zawodników z określonego zespołu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    let players;
    if (teamId) {
      // Pobierz zawodników z określonego zespołu
      players = await prisma.player.findMany({
        where: {
          teams: {
            some: {
              id: teamId
            }
          }
        },
        include: {
          teams: true
        },
        orderBy: {
          name: 'asc'
        }
      });
    } else {
      // Pobierz wszystkich zawodników
      players = await prisma.player.findMany({
        include: {
          teams: true
        },
        orderBy: {
          name: 'asc'
        }
      });
    }

    // Przekształć dane do formatu oczekiwanego przez klienta
    const formattedPlayers = players.map(player => ({
      id: player.id,
      name: player.name,
      number: player.number,
      position: player.position || "",
      birthYear: player.birthYear || undefined,
      imageUrl: player.imageUrl || undefined,
      teams: player.teams.map(team => team.id)
    }));

    return NextResponse.json(formattedPlayers);
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas pobierania zawodników: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// POST - Tworzenie nowego zawodnika
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sprawdź, czy podano teamIds
    if (!body.teams || !Array.isArray(body.teams) || body.teams.length === 0) {
      return NextResponse.json(
        { error: "Brak identyfikatorów zespołów (teams)" },
        { status: 400 }
      );
    }

    // Sprawdź, czy zespoły istnieją
    const teams = await prisma.team.findMany({
      where: {
        id: {
          in: body.teams
        }
      }
    });

    if (teams.length !== body.teams.length) {
      return NextResponse.json(
        { error: "Jeden lub więcej zespołów nie istnieje" },
        { status: 404 }
      );
    }

    // Utwórz zawodnika i przypisz go do zespołów
    const player = await prisma.player.create({
      data: {
        name: body.name,
        number: body.number,
        position: body.position,
        birthYear: body.birthYear,
        imageUrl: body.imageUrl,
        teams: {
          connect: body.teams.map((teamId: string) => ({ id: teamId }))
        }
      },
      include: {
        teams: true
      }
    });

    // Przekształć dane do formatu oczekiwanego przez klienta
    const formattedPlayer = {
      id: player.id,
      name: player.name,
      number: player.number,
      position: player.position || "",
      birthYear: player.birthYear || undefined,
      imageUrl: player.imageUrl || undefined,
      teams: player.teams.map(team => team.id)
    };

    return NextResponse.json(formattedPlayer, { status: 201 });
  } catch (error) {
    console.error("Error creating player:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas tworzenia zawodnika: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 