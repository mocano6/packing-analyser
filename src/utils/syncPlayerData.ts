import { getDB } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, updateDoc, query, where } from "firebase/firestore";
import { Player, Action, TeamInfo, PlayerMinutes } from "@/types";
import { getPlayerFullName } from '@/utils/playerUtils';

/**
 * Funkcja synchronizująca dane akcji z zawodnikami
 * Przypisuje akcje do zawodników (jako actionsSent i actionsReceived)
 * oraz zapisuje informacje o minutach i pozycjach zawodników w meczach
 */
export const syncPlayerData = async (): Promise<boolean> => {
  try {
    console.log("Rozpoczynam synchronizację danych zawodników...");
    
    // 1. Pobierz wszystkich zawodników
    const playersCollection = collection(getDB(), "players");
    const playersSnapshot = await getDocs(playersCollection);
    
    if (playersSnapshot.empty) {
      console.log("Brak zawodników do synchronizacji");
      return true;
    }
    
    const players = playersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Player[];
    
    console.log(`Pobrano ${players.length} zawodników do synchronizacji`);
    
    // 2. Pobierz wszystkie mecze
    const matchesCollection = collection(getDB(), "matches");
    const matchesSnapshot = await getDocs(matchesCollection);
    
    if (matchesSnapshot.empty) {
      console.log("Brak meczów do synchronizacji");
      return true;
    }
    
    const matches = matchesSnapshot.docs.map(doc => ({
      matchId: doc.id,
      ...doc.data()
    })) as TeamInfo[];
    
    console.log(`Pobrano ${matches.length} meczów do synchronizacji`);
    
    // 3. Przygotuj dane dla każdego zawodnika
    for (const player of players) {
      // Zainicjuj nowe struktury danych dla zawodnika
      const playerUpdates: Partial<Player> = {
        actionsSent: {},
        actionsReceived: {},
        matchesInfo: {}
      };
      
      // Przejdź przez wszystkie mecze
      for (const match of matches) {
        const matchId = match.matchId;
        
        if (!matchId) {
          console.warn("Napotkano mecz bez matchId, pomijam...");
          continue;
        }
        
        // A. Dodaj informacje o minutach i pozycji z PlayerMinutes
        if (match.playerMinutes && match.playerMinutes.length > 0) {
          const playerMinute = match.playerMinutes.find(pm => pm.playerId === player.id);
          
          if (playerMinute) {
            if (!playerUpdates.matchesInfo) {
              playerUpdates.matchesInfo = {};
            }
            
            playerUpdates.matchesInfo[matchId] = {
              startMinute: playerMinute.startMinute,
              endMinute: playerMinute.endMinute,
              position: playerMinute.position || player.position || "CB"
            };
          }
        }
        
        // B. Zbierz akcje z meczu
        if (match.actions_packing && match.actions_packing.length > 0) {
          // Akcje, gdzie zawodnik jest nadawcą (senderId)
          const actionsSent = match.actions_packing.filter(action => action.senderId === player.id);
          
          if (actionsSent.length > 0) {
            if (!playerUpdates.actionsSent) {
              playerUpdates.actionsSent = {};
            }
            
            playerUpdates.actionsSent[matchId] = actionsSent;
          }
          
          // Akcje, gdzie zawodnik jest odbiorcą (receiverId)
          const actionsReceived = match.actions_packing.filter(action => action.receiverId === player.id);
          
          if (actionsReceived.length > 0) {
            if (!playerUpdates.actionsReceived) {
              playerUpdates.actionsReceived = {};
            }
            
            playerUpdates.actionsReceived[matchId] = actionsReceived;
          }
        }
      }
      
      // 4. Zaktualizuj zawodnika w Firebase, tylko jeśli są jakieś zmiany
      const hasActionsToSync = 
        Object.keys(playerUpdates.actionsSent || {}).length > 0 || 
        Object.keys(playerUpdates.actionsReceived || {}).length > 0 ||
        Object.keys(playerUpdates.matchesInfo || {}).length > 0;
      
      if (hasActionsToSync) {
        const playerRef = doc(getDB(), "players", player.id);
        await updateDoc(playerRef, playerUpdates);
        console.log(`✅ Zaktualizowano dane zawodnika ${getPlayerFullName(player)} (${player.id})`);
      } else {
        console.log(`ℹ️ Brak nowych danych do synchronizacji dla zawodnika ${getPlayerFullName(player)} (${player.id})`);
      }
    }
    
    console.log("✅ Synchronizacja danych zawodników zakończona pomyślnie");
    return true;
  } catch (error) {
    console.error("❌ Błąd podczas synchronizacji danych zawodników:", error);
    return false;
  }
};

/**
 * Funkcja aktualizująca dane zawodnika po dodaniu nowej akcji
 * Ta funkcja jest lżejszą wersją syncPlayerData, operującą tylko na jednej akcji
 */
export const updatePlayerWithAction = async (
  action: Action,
  matchInfo: TeamInfo | null
): Promise<boolean> => {
  if (!matchInfo || !matchInfo.matchId) {
    console.error("Brak informacji o meczu, nie można zaktualizować zawodnika");
    return false;
  }
  
  try {
    const matchId = matchInfo.matchId;
    
    // 1. Aktualizuj dane nadawcy (senderId)
    if (action.senderId) {
      const senderRef = doc(getDB(), "players", action.senderId);
      const senderDoc = await getDoc(senderRef);
      
      if (senderDoc.exists()) {
        const senderData = senderDoc.data() as Player;
        
        // Inicjalizacja struktury, jeśli nie istnieje
        const actionsSent = senderData.actionsSent || {};
        
        // Dodanie/aktualizacja akcji dla konkretnego meczu
        if (!actionsSent[matchId]) {
          actionsSent[matchId] = [];
        }
        
        // Sprawdź, czy akcja już istnieje (unikaj duplikatów)
        const actionExists = actionsSent[matchId].some(existingAction => existingAction.id === action.id);
        
        if (!actionExists) {
          actionsSent[matchId].push(action);
          
          // Aktualizuj dane zawodnika
          await updateDoc(senderRef, { actionsSent });
          console.log(`✅ Zaktualizowano akcje nadawcy ${getPlayerFullName(senderData)} (${action.senderId})`);
        }
      }
    }
    
    // 2. Aktualizuj dane odbiorcy (receiverId), jeśli istnieje
    if (action.receiverId) {
      const receiverRef = doc(getDB(), "players", action.receiverId);
      const receiverDoc = await getDoc(receiverRef);
      
      if (receiverDoc.exists()) {
        const receiverData = receiverDoc.data() as Player;
        
        // Inicjalizacja struktury, jeśli nie istnieje
        const actionsReceived = receiverData.actionsReceived || {};
        
        // Dodanie/aktualizacja akcji dla konkretnego meczu
        if (!actionsReceived[matchId]) {
          actionsReceived[matchId] = [];
        }
        
        // Sprawdź, czy akcja już istnieje (unikaj duplikatów)
        const actionExists = actionsReceived[matchId].some(existingAction => existingAction.id === action.id);
        
        if (!actionExists) {
          actionsReceived[matchId].push(action);
          
          // Aktualizuj dane zawodnika
          await updateDoc(receiverRef, { actionsReceived });
          console.log(`✅ Zaktualizowano akcje odbiorcy ${getPlayerFullName(receiverData)} (${action.receiverId})`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("❌ Błąd podczas aktualizacji danych zawodnika:", error);
    return false;
  }
};

/**
 * NOWA FUNKCJA: Usuwa akcję z danych zawodników
 * Ta funkcja usuwa określoną akcję z actionsSent i actionsReceived zawodników
 */
export const removePlayerAction = async (
  actionId: string,
  matchId: string,
  senderId?: string,
  receiverId?: string
): Promise<boolean> => {
  if (!matchId || !actionId) {
    console.error("Brak wymaganych parametrów do usunięcia akcji z danych zawodnika");
    return false;
  }
  
  try {
    // 1. Usuń akcję z danych nadawcy (senderId)
    if (senderId) {
      const senderRef = doc(getDB(), "players", senderId);
      const senderDoc = await getDoc(senderRef);
      
      if (senderDoc.exists()) {
        const senderData = senderDoc.data() as Player;
        
        if (senderData.actionsSent && senderData.actionsSent[matchId]) {
          // Filtruj akcje, aby usunąć tę o podanym ID
          const updatedActionsSent = senderData.actionsSent[matchId].filter(
            action => action.id !== actionId
          );
          
          // Zaktualizuj dane
          const updatedSenderActions = { ...senderData.actionsSent };
          updatedSenderActions[matchId] = updatedActionsSent;
          
          await updateDoc(senderRef, { actionsSent: updatedSenderActions });
          console.log(`✅ Usunięto akcję z danych nadawcy (${senderId})`);
        }
      }
    }
    
    // 2. Usuń akcję z danych odbiorcy (receiverId)
    if (receiverId) {
      const receiverRef = doc(getDB(), "players", receiverId);
      const receiverDoc = await getDoc(receiverRef);
      
      if (receiverDoc.exists()) {
        const receiverData = receiverDoc.data() as Player;
        
        if (receiverData.actionsReceived && receiverData.actionsReceived[matchId]) {
          // Filtruj akcje, aby usunąć tę o podanym ID
          const updatedActionsReceived = receiverData.actionsReceived[matchId].filter(
            action => action.id !== actionId
          );
          
          // Zaktualizuj dane
          const updatedReceiverActions = { ...receiverData.actionsReceived };
          updatedReceiverActions[matchId] = updatedActionsReceived;
          
          await updateDoc(receiverRef, { actionsReceived: updatedReceiverActions });
          console.log(`✅ Usunięto akcję z danych odbiorcy (${receiverId})`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("❌ Błąd podczas usuwania akcji z danych zawodnika:", error);
    return false;
  }
};

/**
 * Funkcja aktualizująca dane zawodnika po zmianie informacji o minutach
 */
export const updatePlayerWithMinutes = async (
  playerMinutes: PlayerMinutes[],
  matchId: string
): Promise<boolean> => {
  if (!matchId || !playerMinutes || playerMinutes.length === 0) {
    console.error("Brak wymaganych parametrów do aktualizacji minut zawodników");
    return false;
  }
  
  try {
    // Dla każdego zawodnika z podanymi minutami
    for (const playerMinute of playerMinutes) {
      const playerRef = doc(getDB(), "players", playerMinute.playerId);
      const playerDoc = await getDoc(playerRef);
      
      if (playerDoc.exists()) {
        const playerData = playerDoc.data() as Player;
        
        // Inicjalizacja struktury, jeśli nie istnieje
        const matchesInfo = playerData.matchesInfo || {};
        
        // Aktualizuj informacje o meczu
        matchesInfo[matchId] = {
          startMinute: playerMinute.startMinute,
          endMinute: playerMinute.endMinute,
          position: playerMinute.position || playerData.position || "CB"
        };
        
        // Zaktualizuj dane zawodnika
        await updateDoc(playerRef, { matchesInfo });
        console.log(`✅ Zaktualizowano minuty zawodnika ${getPlayerFullName(playerData)} (${playerMinute.playerId})`);
      }
    }
    
    return true;
  } catch (error) {
    console.error("❌ Błąd podczas aktualizacji minut zawodników:", error);
    return false;
  }
}; 