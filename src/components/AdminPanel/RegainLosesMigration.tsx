"use client";

import React, { useState } from "react";

export default function RegainLosesMigration() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      regainUpdated: number;
      losesUpdated: number;
      matchesUpdated: number;
      errors: number;
    };
    errors?: string[];
  } | null>(null);

  const handleMigration = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch('/api/migrate-regain-loses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        message: 'Błąd podczas migracji',
        stats: {
          regainUpdated: 0,
          losesUpdated: 0,
          matchesUpdated: 0,
          errors: 1
        },
        errors: [error.message]
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{
      backgroundColor: "#f8f9fa",
      border: "1px solid #dee2e6",
      borderRadius: "8px",
      padding: "20px",
      marginTop: "20px"
    }}>
      <h3 style={{ marginTop: 0, marginBottom: "15px" }}>
        🔄 Migracja akcji Regain i Loses
      </h3>
      
      <p style={{ marginBottom: "20px", color: "#666" }}>
        Ten narzędzie uzupełnia brakujące wartości <code>oppositeXT</code>, <code>oppositeZone</code> i <code>isAttack</code> 
        w istniejących akcjach regain i loses. Skrypt można uruchomić wielokrotnie - nie zmienia akcji, które już mają wszystkie potrzebne wartości.
      </p>

      <div style={{ 
        backgroundColor: "#e7f3ff", 
        padding: "15px", 
        borderRadius: "4px", 
        marginBottom: "20px" 
      }}>
        <strong>💡 Co robi migracja:</strong>
        <ul style={{ marginTop: "10px", marginBottom: "0" }}>
          <li>Dla każdej akcji regain/loses oblicza strefę przeciwną (lustrzane odbicie)</li>
          <li>Oblicza wartość xT dla przeciwnej strefy</li>
          <li>Określa czy akcja jest w ataku (xT &lt; 0.02) czy w obronie</li>
          <li>Zapisuje te wartości w bazie danych</li>
        </ul>
      </div>

      <button
        onClick={handleMigration}
        disabled={isRunning}
        style={{
          padding: "12px 24px",
          backgroundColor: isRunning ? "#6c757d" : "#17a2b8",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: isRunning ? "not-allowed" : "pointer",
          fontSize: "16px",
          fontWeight: "bold",
          opacity: isRunning ? 0.6 : 1
        }}
      >
        {isRunning ? "⏳ Migracja w toku..." : "🚀 Uruchom migrację"}
      </button>

      {result && (
        <div style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: result.success ? "#d4edda" : "#f8d7da",
          border: `1px solid ${result.success ? "#c3e6cb" : "#f5c6cb"}`,
          borderRadius: "4px"
        }}>
          <h4 style={{ 
            marginTop: 0, 
            color: result.success ? "#155724" : "#721c24" 
          }}>
            {result.success ? "✅ Sukces" : "❌ Błąd"}
          </h4>
          
          <p style={{ 
            marginBottom: result.stats ? "10px" : "0",
            color: result.success ? "#155724" : "#721c24"
          }}>
            {result.message}
          </p>

          {result.stats && (
            <div style={{ marginTop: "15px" }}>
              <strong>Statystyki:</strong>
              <ul style={{ marginTop: "5px", marginBottom: "10px" }}>
                <li>Zaktualizowano akcji regain: <strong>{result.stats.regainUpdated}</strong></li>
                <li>Zaktualizowano akcji loses: <strong>{result.stats.losesUpdated}</strong></li>
                <li>Zaktualizowano meczów: <strong>{result.stats.matchesUpdated}</strong></li>
                {result.stats.errors > 0 && (
                  <li style={{ color: "#721c24" }}>
                    Błędy: <strong>{result.stats.errors}</strong>
                  </li>
                )}
              </ul>
            </div>
          )}

          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: "15px" }}>
              <strong style={{ color: "#721c24" }}>Błędy:</strong>
              <ul style={{ marginTop: "5px", marginBottom: "0" }}>
                {result.errors.map((error, index) => (
                  <li key={index} style={{ color: "#721c24", fontSize: "0.9em" }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
