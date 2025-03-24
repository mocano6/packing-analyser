import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Pobieranie danych konkretnego zawodnika
export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const player = await prisma.player.findUnique({
      where: {
        id: params.playerId,
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Zawodnik nie został znaleziony" },
        { status: 404 }
      );
    }

    return NextResponse.json({ player });
  } catch (error) {
    console.error("Error fetching player:", error);
    return NextResponse.json(
      { error: "Nie udało się pobrać danych zawodnika" },
      { status: 500 }
    );
  }
}

// PUT - Aktualizacja danych zawodnika
export async function PUT(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const body = await request.json();

    const player = await prisma.player.update({
      where: {
        id: params.playerId,
      },
      data: {
        name: body.name,
        number: body.number,
        position: body.position,
        imageUrl: body.imageUrl,
        birthYear: body.birthYear,
      },
    });

    return NextResponse.json({ player });
  } catch (error) {
    console.error("Error updating player:", error);
    return NextResponse.json(
      { error: "Nie udało się zaktualizować danych zawodnika" },
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
    await prisma.player.delete({
      where: {
        id: params.playerId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting player:", error);
    return NextResponse.json(
      { error: "Nie udało się usunąć zawodnika" },
      { status: 500 }
    );
  }
}
