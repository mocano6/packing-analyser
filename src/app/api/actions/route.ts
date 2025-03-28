import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { Action } from "@/types";

// GET - Pobieranie akcji dla określonego meczu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    // Definiujemy select z właściwymi polami
    const selectFields = {
      id: true,
      minute: true,
      senderId: true,
      sender: true,
      senderName: true,
      senderNumber: true,
      senderClickValue: true,
      receiverId: true,
      receiver: true,
      receiverName: true,
      receiverNumber: true,
      receiverClickValue: true,
      senderZone: true,
      receiverZone: true,
      packingPoints: true,
      actionType: true,
      xTValue: true,
      isP3: true,
      isShot: true,
      isGoal: true,
      isPenaltyAreaEntry: true,
      matchId: true,
      match: true,
      createdAt: true,
      updatedAt: true
    };

    let actions;
    if (matchId) {
      // Pobierz akcje dla określonego meczu
      actions = await prisma.actionsPacking.findMany({
        where: {
          matchId: matchId
        },
        orderBy: {
          minute: 'asc'
        },
        select: selectFields
      });
    } else {
      // Pobierz wszystkie akcje
      actions = await prisma.actionsPacking.findMany({
        orderBy: {
          minute: 'asc'
        },
        select: selectFields
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
    
    // Logujemy dane akcji do konsoli
    console.log("POST /api/actions - Dane akcji:", {
      id: body.id,
      actionType: body.actionType,
      senderZone: body.senderZone,
      receiverZone: body.receiverZone
    });
    
    // Sprawdź, czy podano podstawowe dane akcji
    if (!body.senderId || !body.receiverId || !body.matchId) {
      return NextResponse.json(
        { error: "Brak wymaganych danych akcji (senderId, receiverId, matchId)" },
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
    const action = await prisma.actionsPacking.create({
      data: {
        id: body.id || crypto.randomUUID(),
        minute: body.minute,
        sender: { connect: { id: body.senderId } },
        senderName: body.senderName,
        senderNumber: body.senderNumber,
        senderClickValue: body.senderClickValue,
        receiver: { connect: { id: body.receiverId } },
        receiverName: body.receiverName,
        receiverNumber: body.receiverNumber,
        receiverClickValue: body.receiverClickValue,
        // @ts-ignore - Te pola istnieją w schemacie bazy danych, ale nie zostały poprawnie wygenerowane w typach
        senderZone: body.senderZone,
        // @ts-ignore - Te pola istnieją w schemacie bazy danych, ale nie zostały poprawnie wygenerowane w typach
        // Dla dryblingu receiverZone jest taka sama jak senderZone
        receiverZone: body.receiverZone,
        actionType: body.actionType,
        packingPoints: body.packingPoints,
        xTValue: body.xTValue,
        isP3: body.isP3,
        isShot: body.isShot,
        isGoal: body.isGoal,
        isPenaltyAreaEntry: body.isPenaltyAreaEntry || false,
        match: { connect: { id: body.matchId } },
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
    await prisma.actionsPacking.delete({
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