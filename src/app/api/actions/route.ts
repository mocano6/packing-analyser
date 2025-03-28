import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { Action } from "@/types";

// GET - Pobieranie akcji dla określonego meczu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    let actions;
    if (matchId) {
      // Pobierz akcje dla określonego meczu
      actions = await prisma.action.findMany({
        where: {
          matchId: matchId
        },
        orderBy: {
          minute: 'asc'
        },
        include: {
          sender: true,
          receiver: true,
          match: true
        }
      });
    } else {
      // Pobierz wszystkie akcje
      actions = await prisma.action.findMany({
        orderBy: {
          minute: 'asc'
        },
        include: {
          sender: true,
          receiver: true,
          match: true
        }
      });
    }

    return NextResponse.json(actions);
  } catch (error) {
    console.error("Error fetching actions:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas pobierania akcji: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// POST - Tworzenie nowej akcji
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sprawdź, czy podano podstawowe dane akcji
    if (!body.senderId || !body.receiverId || body.zone === undefined || !body.matchId) {
      return NextResponse.json(
        { error: "Brak wymaganych danych akcji (senderId, receiverId, zone, matchId)" },
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

    // Sprawdź, czy nadawca i odbiorca istnieją
    const sender = await prisma.player.findUnique({
      where: { id: body.senderId }
    });

    const receiver = await prisma.player.findUnique({
      where: { id: body.receiverId }
    });

    if (!sender || !receiver) {
      return NextResponse.json(
        { error: "Nadawca lub odbiorca nie istnieje" },
        { status: 404 }
      );
    }

    // Utwórz akcję używając standardowej operacji Prisma
    const action = await prisma.action.create({
      data: {
        id: body.id || crypto.randomUUID(),
        minute: body.minute,
        senderId: body.senderId,
        senderName: body.senderName,
        senderNumber: body.senderNumber,
        senderClickValue: body.senderClickValue,
        receiverId: body.receiverId,
        receiverName: body.receiverName,
        receiverNumber: body.receiverNumber,
        receiverClickValue: body.receiverClickValue,
        zone: body.zone,
        basePoints: body.basePoints,
        multiplier: body.multiplier,
        totalPoints: body.totalPoints,
        actionType: body.actionType,
        packingPoints: body.packingPoints,
        xTValue: body.xTValue,
        isP3: body.isP3,
        isShot: body.isShot,
        isGoal: body.isGoal,
        isPenaltyAreaEntry: body.isPenaltyAreaEntry || false,
        matchId: body.matchId,
      }
    });

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    console.error("Error creating action:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas tworzenia akcji: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// DELETE - Usuwanie akcji
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('id');

    if (!actionId) {
      return NextResponse.json(
        { error: "Brak identyfikatora akcji (id)" },
        { status: 400 }
      );
    }

    // Usuń akcję używając standardowej operacji Prisma
    await prisma.action.delete({
      where: {
        id: actionId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting action:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas usuwania akcji: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 