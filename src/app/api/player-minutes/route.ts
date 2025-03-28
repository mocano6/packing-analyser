import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { PlayerMinutes } from "@/types";

// POST - Zapisywanie/aktualizacja minut gry zawodników w meczu
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sprawdź, czy podano matchId i playerMinutes
    if (!body.matchId || !body.playerMinutes || !Array.isArray(body.playerMinutes)) {
      return NextResponse.json(
        { error: "Brak identyfikatora meczu (matchId) lub minut gry zawodników (playerMinutes)" },
        { status: 400 }
      );
    }

    // Sprawdź, czy mecz istnieje
    const match = await prisma.match.findUnique({
      where: { id: body.matchId }
    });

    if (!match) {
      return NextResponse.json(
        { error: "Podany mecz nie istnieje" },
        { status: 404 }
      );
    }

    // Usuń istniejące minuty gry dla tego meczu
    await prisma.playerMinutes.deleteMany({
      where: { matchId: body.matchId }
    });

    // Dodaj nowe minuty gry
    const playerMinutesPromises = body.playerMinutes.map((pm: PlayerMinutes) => 
      prisma.playerMinutes.create({
        data: {
          matchId: body.matchId,
          playerId: pm.playerId,
          startMinute: pm.startMinute,
          endMinute: pm.endMinute
        }
      })
    );

    const createdPlayerMinutes = await Promise.all(playerMinutesPromises);

    // Pobierz zaktualizowane dane o meczu wraz z minutami gry
    const updatedMatch = await prisma.match.findUnique({
      where: { id: body.matchId },
      include: {
        team: true,
        playerMinutes: {
          include: {
            player: true
          }
        }
      }
    });

    if (!updatedMatch) {
      return NextResponse.json(
        { error: "Nie udało się pobrać zaktualizowanego meczu" },
        { status: 500 }
      );
    }

    // Przekształć dane do formatu oczekiwanego przez klienta
    const formattedMatch = {
      matchId: updatedMatch.id,
      team: updatedMatch.teamId,
      opponent: updatedMatch.opponent,
      isHome: updatedMatch.isHome,
      competition: updatedMatch.competition,
      date: updatedMatch.date.toISOString().split('T')[0], // Format YYYY-MM-DD
      time: updatedMatch.time,
      playerMinutes: updatedMatch.playerMinutes.map(pm => ({
        playerId: pm.playerId,
        startMinute: pm.startMinute,
        endMinute: pm.endMinute
      }))
    };

    return NextResponse.json(formattedMatch);
  } catch (error) {
    console.error("Error saving player minutes:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas zapisywania minut gry: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// GET - Pobieranie minut gry zawodników dla określonego meczu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json(
        { error: "Brak identyfikatora meczu (matchId)" },
        { status: 400 }
      );
    }

    const playerMinutes = await prisma.playerMinutes.findMany({
      where: { matchId: matchId },
      include: {
        player: true
      },
      orderBy: {
        startMinute: 'asc'
      }
    });

    // Przekształć dane do formatu oczekiwanego przez klienta
    const formattedPlayerMinutes = playerMinutes.map(pm => ({
      playerId: pm.playerId,
      playerName: pm.player.name,
      playerNumber: pm.player.number,
      startMinute: pm.startMinute,
      endMinute: pm.endMinute
    }));

    return NextResponse.json(formattedPlayerMinutes);
  } catch (error) {
    console.error("Error fetching player minutes:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas pobierania minut gry: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 