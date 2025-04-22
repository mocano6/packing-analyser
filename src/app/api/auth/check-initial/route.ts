import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// API do sprawdzania, czy to pierwsze logowanie
export async function GET() {
  try {
    // Sprawdź, czy dokument z hasłem istnieje
    const settingsRef = doc(db, "settings", "password");
    const settingsDoc = await getDoc(settingsRef);
    
    return NextResponse.json({
      isInitial: !settingsDoc.exists(),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Błąd podczas sprawdzania statusu hasła:", error);
    
    return NextResponse.json(
      {
        error: "Wystąpił błąd podczas sprawdzania statusu hasła",
        isInitial: true, // Zakładamy, że to pierwsze logowanie w przypadku błędu
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
} 