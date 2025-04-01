import { prisma } from "@/app/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Pobieranie wszystkich zespołów
export async function GET(request: NextRequest) {
  try {
    const teams = await prisma.team.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas pobierania zespołów: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// POST - Tworzenie nowego zespołu
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const team = await prisma.team.create({
      data: {
        name: body.name
      }
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: `Wystąpił błąd podczas tworzenia zespołu: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
