import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Pobieranie konkretnej drużyny z zawodnikami
export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const team = await prisma.team.findUnique({
      where: {
        id: params.teamId,
      },
      include: {
        players: true, // Załącz dane zawodników
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Drużyna nie została znaleziona" },
        { status: 404 }
      );
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Nie udało się pobrać danych drużyny" },
      { status: 500 }
    );
  }
}

// PUT - Aktualizacja danych drużyny
export async function PUT(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const body = await request.json();

    const team = await prisma.team.update({
      where: {
        id: params.teamId,
      },
      data: {
        name: body.name,
      },
    });

    return NextResponse.json({ team });
  } catch (error) {
    console.error("Error updating team:", error);
    return NextResponse.json(
      { error: "Nie udało się zaktualizować danych drużyny" },
      { status: 500 }
    );
  }
}

// DELETE - Usuwanie drużyny (wraz ze wszystkimi zawodnikami)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    // Najpierw usuń wszystkich zawodników drużyny
    await prisma.player.deleteMany({
      where: {
        teamId: params.teamId,
      },
    });

    // Następnie usuń drużynę
    await prisma.team.delete({
      where: {
        id: params.teamId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Nie udało się usunąć drużyny" },
      { status: 500 }
    );
  }
}
