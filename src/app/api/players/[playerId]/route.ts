import { prisma } from "@/app/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Wymagane dla trybu "export"
export const dynamic = "force-dynamic";

// GET - Pobieranie konkretnego zawodnika
export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
      include: {
        teams: true,
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Zawodnik nie został znaleziony" },
        { status: 404 }
      );
    }

    // Przekształć dane do formatu oczekiwanego przez klienta
    const formattedPlayer = {
      id: player.id,
      name: player.name,
      number: player.number,
      position: player.position || "",
      birthYear: player.birthYear || undefined,
      imageUrl: player.imageUrl || undefined,
      teams: player.teams.map(team => team.id),
    };

    return NextResponse.json(formattedPlayer);
  } catch (error) {
    console.error("Error fetching player:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas pobierania zawodnika: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// PUT - Aktualizowanie istniejącego zawodnika
export async function PUT(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;
    const body = await request.json();

    // Sprawdź, czy zawodnik istnieje
    const existingPlayer = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!existingPlayer) {
      return NextResponse.json(
        { error: "Zawodnik nie został znaleziony" },
        { status: 404 }
      );
    }

    // Sprawdź, czy podano teamIds i czy są poprawne
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
          in: body.teams,
        },
      },
    });

    if (teams.length !== body.teams.length) {
      return NextResponse.json(
        { error: "Jeden lub więcej zespołów nie istnieje" },
        { status: 404 }
      );
    }

    // Aktualizuj zawodnika i jego powiązania z zespołami
    const updatedPlayer = await prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        name: body.name,
        number: body.number,
        position: body.position,
        birthYear: body.birthYear,
        imageUrl: body.imageUrl,
        teams: {
          // Najpierw rozłączamy wszystkie powiązania
          set: [],
          // Następnie dodajemy nowe powiązania
          connect: body.teams.map((teamId: string) => ({ id: teamId })),
        },
      },
      include: {
        teams: true,
      },
    });

    // Przekształć dane do formatu oczekiwanego przez klienta
    const formattedPlayer = {
      id: updatedPlayer.id,
      name: updatedPlayer.name,
      number: updatedPlayer.number,
      position: updatedPlayer.position || "",
      birthYear: updatedPlayer.birthYear || undefined,
      imageUrl: updatedPlayer.imageUrl || undefined,
      teams: updatedPlayer.teams.map(team => team.id),
    };

    return NextResponse.json(formattedPlayer);
  } catch (error) {
    console.error("Error updating player:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas aktualizacji zawodnika: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// DELETE - Usuwanie zawodnika
export async function DELETE(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;

    // Sprawdź, czy zawodnik istnieje
    const existingPlayer = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!existingPlayer) {
      return NextResponse.json(
        { error: "Zawodnik nie został znaleziony" },
        { status: 404 }
      );
    }

    // Usuń zawodnika
    await prisma.player.delete({
      where: {
        id: playerId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting player:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas usuwania zawodnika: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 