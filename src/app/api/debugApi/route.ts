import { prisma } from "@/app/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Endpoint do testowania zapytań do bazy danych
export async function GET(request: NextRequest) {
  try {
    // Definiujemy poprawne pola bez starych kolumn
    const correctSelect = {
      id: true,
      minute: true,
      senderId: true,
      senderName: true,
      senderNumber: true,
      senderClickValue: true,
      receiverId: true,
      receiverName: true,
      receiverNumber: true,
      receiverClickValue: true,
      actionType: true, 
      packingPoints: true,
      xTValue: true,
      isP3: true,
      isShot: true,
      isGoal: true,
      isPenaltyAreaEntry: true,
      matchId: true,
      createdAt: true,
      updatedAt: true,
      startZone: true,
      endZone: true
    };

    // Wykonaj zapytanie z poprawnymi polami
    const actions = await prisma.actionsPacking.findMany({
      take: 5,
      select: correctSelect
    });

    // Zwróć informacje diagnostyczne
    return NextResponse.json({
      status: "success",
      message: "Zapytanie wykonane pomyślnie",
      debug: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        fields: Object.keys(correctSelect),
        actionCount: actions.length
      },
      data: actions.map(action => ({
        id: action.id,
        minute: action.minute,
        senderName: action.senderName,
        receiverName: action.receiverName,
        // Inne pola...
      }))
    });
  } catch (error) {
    console.error("Błąd podczas wykonywania zapytania:", error);
    
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Nieznany błąd",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 