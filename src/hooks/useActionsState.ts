"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Action, Zone } from "@/types";
import { db } from "@/lib/firebase";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, where, orderBy, writeBatch
} from "firebase/firestore";

export function useActionsState(currentMatchId: string | null) {
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedActionType, setSelectedActionType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Pobierz akcje dla danego meczu
  useEffect(() => {
    const fetchActions = async () => {
      if (!currentMatchId) {
        setActions([]);
        return;
      }

      try {
        setIsLoading(true);
        const actionsCollection = collection(db, "actions_packing");
        const q = query(
          actionsCollection, 
          where("matchId", "==", currentMatchId),
          orderBy("minute", "asc"),
          orderBy("second", "asc")
        );
        
        const actionsSnapshot = await getDocs(q);
        
        if (!actionsSnapshot.empty) {
          const actionsList = actionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Action[];
          
          console.log('Akcje pobrane z Firebase:', actionsList);
          setActions(actionsList);
        } else {
          console.log('Brak akcji dla tego meczu w Firebase');
          setActions([]);
          
          // Sprawdź dane w localStorage jako fallback
          if (typeof window !== "undefined") {
            try {
              const savedActions = localStorage.getItem(`actions_${currentMatchId}`);
              if (savedActions) {
                const localActions = JSON.parse(savedActions) as Action[];
                setActions(localActions);
                
                // Opcjonalnie zapisz akcje z localStorage do Firebase
                console.log('Zapisuję akcje z localStorage do Firebase...');
                const batch = writeBatch(db);
                
                localActions.forEach(action => {
                  const actionRef = doc(collection(db, "actions_packing"));
                  batch.set(actionRef, {
                    matchId: action.matchId,
                    teamId: action.teamId,
                    playerId: action.playerId,
                    minute: action.minute,
                    second: action.second,
                    fromZone: action.fromZone,
                    toZone: action.toZone,
                    actionType: action.actionType,
                    success: action.success
                  });
                });
                
                await batch.commit();
                console.log('Akcje z localStorage zapisane do Firebase');
              }
            } catch (error) {
              console.error("Błąd odczytu akcji z localStorage:", error);
            }
          }
        }
      } catch (error) {
        console.error('Błąd pobierania akcji z Firebase:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActions();
  }, [currentMatchId]);

  // Backup do localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && currentMatchId && actions.length > 0) {
      try {
        localStorage.setItem(`actions_${currentMatchId}`, JSON.stringify(actions));
      } catch (error) {
        console.error("Błąd zapisu akcji do localStorage:", error);
      }
    }
  }, [actions, currentMatchId]);

  // Reset wybranej strefy gdy zmienia się mecz
  useEffect(() => {
    setSelectedZone(null);
    setSelectedActionType(null);
  }, [currentMatchId]);

  // Akcje przefiltrowane dla bieżącego meczu
  const filteredActions = useMemo(() => {
    if (!currentMatchId) return [];
    return actions.filter(action => action.matchId === currentMatchId);
  }, [actions, currentMatchId]);

  // Funkcja dodawania akcji
  const addAction = useCallback(async (newAction: Omit<Action, "id">) => {
    try {
      setIsLoading(true);
      
      // Dodanie akcji do Firebase
      const actionRef = await addDoc(collection(db, "actions_packing"), newAction);
      
      // Aktualizacja lokalnego stanu
      const actionWithId: Action = {
        id: actionRef.id,
        ...newAction,
      };
      
      setActions(prev => [...prev, actionWithId]);
      console.log('Nowa akcja dodana do Firebase');
      return actionWithId;
    } catch (error) {
      console.error('Błąd dodawania akcji:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Funkcja usuwania akcji
  const deleteAction = useCallback(async (actionId: string) => {
    try {
      setIsLoading(true);
      
      // Usunięcie akcji z Firebase
      await deleteDoc(doc(db, "actions_packing", actionId));
      
      // Aktualizacja lokalnego stanu
      setActions(prev => prev.filter(action => action.id !== actionId));
      console.log('Akcja usunięta z Firebase');
      return true;
    } catch (error) {
      console.error('Błąd usuwania akcji:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Funkcja aktualizacji akcji
  const updateAction = useCallback(async (actionId: string, actionData: Partial<Action>) => {
    try {
      setIsLoading(true);
      
      // Aktualizacja akcji w Firebase
      const actionRef = doc(db, "actions_packing", actionId);
      await updateDoc(actionRef, actionData);
      
      // Aktualizacja lokalnego stanu
      setActions(prev => 
        prev.map(action => 
          action.id === actionId 
            ? { ...action, ...actionData } 
            : action
        )
      );
      
      console.log('Akcja zaktualizowana w Firebase');
      return true;
    } catch (error) {
      console.error('Błąd aktualizacji akcji:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Funkcja obsługująca zmianę wybranej strefy
  const handleZoneSelect = useCallback((zone: Zone | null) => {
    setSelectedZone(zone);
  }, []);

  // Funkcja obsługująca zmianę typu akcji
  const handleActionTypeSelect = useCallback((actionType: string | null) => {
    setSelectedActionType(actionType);
  }, []);

  // Funkcja usuwania wszystkich akcji dla meczu
  const handleDeleteAllActions = useCallback(async () => {
    if (!currentMatchId) return false;
    
    if (window.confirm("Czy na pewno chcesz usunąć wszystkie akcje dla tego meczu?")) {
      try {
        setIsLoading(true);
        
        // Znajdź wszystkie akcje do usunięcia
        const actionsToDelete = actions.filter(action => action.matchId === currentMatchId);
        
        // Utwórz batch do usuwania wielu dokumentów
        const batch = writeBatch(db);
        
        // Dodaj operacje usuwania do batcha
        actionsToDelete.forEach(action => {
          const actionRef = doc(db, "actions_packing", action.id);
          batch.delete(actionRef);
        });
        
        // Wykonaj batch
        await batch.commit();
        
        // Zaktualizuj lokalny stan
        setActions(prev => prev.filter(action => action.matchId !== currentMatchId));
        console.log('Wszystkie akcje dla meczu usunięte z Firebase');
        return true;
      } catch (error) {
        console.error('Błąd usuwania wszystkich akcji:', error);
        return false;
      } finally {
        setIsLoading(false);
      }
    }
    return false;
  }, [currentMatchId, actions]);

  return {
    actions: filteredActions,
    selectedZone,
    selectedActionType,
    isLoading,
    addAction,
    deleteAction,
    updateAction,
    handleDeleteAllActions,
    handleZoneSelect,
    handleActionTypeSelect,
    setSelectedZone,
    setSelectedActionType,
  };
} 