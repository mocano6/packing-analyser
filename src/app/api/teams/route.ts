import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Pobieranie wszystkich drużyn
export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Nie udało się pobrać drużyn" },
      { status: 500 }
    );
  }
}

// POST - Tworzenie nowej drużyny
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const team = await prisma.team.create({
      data: {
        name: body.name,
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Nie udało się utworzyć drużyny" },
      { status: 500 }
    );
  }
}
