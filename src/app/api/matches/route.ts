import { prisma } from "@/app/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Wymagane dla trybu "export"
export const dynamic = "force-dynamic";

// GET - Pobieranie wszystkich meczów lub meczów dla określonego zespołu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    let matches;
    if (teamId) {
      // Pobierz mecze dla określonego zespołu
      matches = await prisma.match.findMany({
        where: {
          teamId: teamId
        },
        include: {
          team: true,
          playerMinutes: {
            include: {
              player: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });
    } else {
      // Pobierz wszystkie mecze
      matches = await prisma.match.findMany({
        include: {
          team: true,
          playerMinutes: {
            include: {
              player: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });
    }

    // Przekształć dane do formatu oczekiwanego przez klienta
    const formattedMatches = matches.map(match => ({
      matchId: match.id,
      team: match.teamId,
      opponent: match.opponent,
      isHome: match.isHome,
      competition: match.competition,
      date: match.date.toISOString().split('T')[0], // Format YYYY-MM-DD
      time: match.time,
      playerMinutes: match.playerMinutes.map(pm => ({
        playerId: pm.playerId,
        startMinute: pm.startMinute,
        endMinute: pm.endMinute
      }))
    }));

    return NextResponse.json(formattedMatches);
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas pobierania meczów: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// POST - Tworzenie nowego meczu lub aktualizacja istniejącego
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sprawdź, czy podano teamId
    if (!body.team) {
      return NextResponse.json(
        { error: "Brak identyfikatora zespołu (team)" },
        { status: 400 }
      );
    }

    // Sprawdź, czy zespół istnieje
    const team = await prisma.team.findUnique({
      where: { id: body.team }
    });

    if (!team) {
      return NextResponse.json(
        { error: "Podany zespół nie istnieje" },
        { status: 404 }
      );
    }

    // Format daty
    const dateObj = new Date(body.date);
    
    // Sprawdź, czy mamy matchId - jeśli tak, to aktualizujemy istniejący mecz
    if (body.matchId) {
      // Sprawdź, czy mecz istnieje
      const existingMatch = await prisma.match.findUnique({
        where: { id: body.matchId }
      });

      if (!existingMatch) {
        return NextResponse.json(
          { error: "Podany mecz nie istnieje" },
          { status: 404 }
        );
      }

      // Aktualizuj mecz
      const updatedMatch = await prisma.match.update({
        where: { id: body.matchId },
        data: {
          teamId: body.team,
          opponent: body.opponent,
          isHome: body.isHome,
          competition: body.competition,
          date: dateObj,
          time: body.time || null
        },
        include: {
          team: true,
          playerMinutes: {
            include: {
              player: true
            }
          }
        }
      });

      // Przekształć dane do formatu oczekiwanego przez klienta
      const formattedUpdatedMatch = {
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

      return NextResponse.json(formattedUpdatedMatch);
    } else {
      // Utwórz nowy mecz
      const newMatch = await prisma.match.create({
        data: {
          teamId: body.team,
          opponent: body.opponent,
          isHome: body.isHome,
          competition: body.competition,
          date: dateObj,
          time: body.time || null
        },
        include: {
          team: true,
          playerMinutes: true
        }
      });

      // Przekształć dane do formatu oczekiwanego przez klienta
      const formattedNewMatch = {
        matchId: newMatch.id,
        team: newMatch.teamId,
        opponent: newMatch.opponent,
        isHome: newMatch.isHome,
        competition: newMatch.competition,
        date: newMatch.date.toISOString().split('T')[0], // Format YYYY-MM-DD
        time: newMatch.time,
        playerMinutes: []
      };

      return NextResponse.json(formattedNewMatch, { status: 201 });
    }
  } catch (error) {
    console.error("Error creating or updating match:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas zapisywania meczu: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// PUT - Aktualizacja istniejącego meczu
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sprawdź, czy podano matchId
    if (!body.matchId) {
      return NextResponse.json(
        { error: "Brak identyfikatora meczu (matchId)" },
        { status: 400 }
      );
    }

    // Sprawdź, czy podano teamId
    if (!body.team) {
      return NextResponse.json(
        { error: "Brak identyfikatora zespołu (team)" },
        { status: 400 }
      );
    }

    // Sprawdź, czy mecz istnieje
    const existingMatch = await prisma.match.findUnique({
      where: { id: body.matchId }
    });

    if (!existingMatch) {
      return NextResponse.json(
        { error: "Podany mecz nie istnieje" },
        { status: 404 }
      );
    }

    // Sprawdź, czy zespół istnieje
    const team = await prisma.team.findUnique({
      where: { id: body.team }
    });

    if (!team) {
      return NextResponse.json(
        { error: "Podany zespół nie istnieje" },
        { status: 404 }
      );
    }

    // Format daty
    const dateObj = new Date(body.date);
    
    // Aktualizuj mecz
    const updatedMatch = await prisma.match.update({
      where: { id: body.matchId },
      data: {
        teamId: body.team,
        opponent: body.opponent,
        isHome: body.isHome,
        competition: body.competition,
        date: dateObj,
        time: body.time || null
      },
      include: {
        team: true,
        playerMinutes: {
          include: {
            player: true
          }
        }
      }
    });

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
    console.error("Error updating match:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas aktualizacji meczu: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// DELETE - Usuwanie meczu
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('id');

    if (!matchId) {
      return NextResponse.json(
        { error: "Brak identyfikatora meczu (id)" },
        { status: 400 }
      );
    }

    // Sprawdź, czy mecz istnieje
    const match = await prisma.match.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      return NextResponse.json(
        { error: "Podany mecz nie istnieje" },
        { status: 404 }
      );
    }

    // Usuń wszystkie minuty gry zawodników związane z meczem
    await prisma.playerMinutes.deleteMany({
      where: { matchId }
    });

    // Usuń mecz
    await prisma.match.delete({
      where: { id: matchId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting match:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas usuwania meczu: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 