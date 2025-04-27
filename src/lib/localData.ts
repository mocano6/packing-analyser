/**
 * LocalDataManager - system backupu danych w localStorage
 * 
 * Klasa służy do przechowywania danych lokalnie, gdy Firebase
 * zwraca błędy uprawnień. Pozwala na zapis i odczyt danych jako
 * warstwa zapasowa, gdy główna baza danych jest niedostępna.
 */
export class LocalDataManager {
  private prefix: string = 'packing_app_';
  
  constructor(prefix?: string) {
    if (prefix) {
      this.prefix = prefix;
    }
  }
  
  /**
   * Zapisuje dane do localStorage
   * @param collection Nazwa kolekcji
   * @param id ID dokumentu
   * @param data Dane do zapisania
   */
  saveData(collection: string, id: string, data: any): void {
    try {
      const key = `${this.prefix}${collection}_${id}`;
      const dataToSave = {
        ...data,
        _localId: id,
        _collection: collection,
        _updatedAt: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(dataToSave));
      this.updateCollectionIndex(collection, id);
      console.log(`✅ Dane zapisane lokalnie: ${collection}/${id}`);
    } catch (error) {
      console.error(`❌ Błąd podczas zapisywania danych lokalnie (${collection}/${id}):`, error);
    }
  }
  
  /**
   * Pobiera dane z localStorage
   * @param collection Nazwa kolekcji
   * @param id ID dokumentu
   * @returns Dane dokumentu lub null jeśli nie znaleziono
   */
  getData(collection: string, id: string): any {
    try {
      const key = `${this.prefix}${collection}_${id}`;
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Błąd podczas pobierania danych lokalnych (${collection}/${id}):`, error);
      return null;
    }
  }
  
  /**
   * Usuwa dane z localStorage
   * @param collection Nazwa kolekcji
   * @param id ID dokumentu
   */
  deleteData(collection: string, id: string): void {
    try {
      const key = `${this.prefix}${collection}_${id}`;
      localStorage.removeItem(key);
      this.removeFromCollectionIndex(collection, id);
      console.log(`✅ Dane usunięte lokalnie: ${collection}/${id}`);
    } catch (error) {
      console.error(`❌ Błąd podczas usuwania danych lokalnych (${collection}/${id}):`, error);
    }
  }
  
  /**
   * Pobiera wszystkie dokumenty z kolekcji
   * @param collection Nazwa kolekcji
   * @returns Tablica dokumentów z kolekcji
   */
  getCollection(collection: string): any[] {
    try {
      // Pobierz indeks kolekcji
      const index = this.getCollectionIndex(collection);
      
      // Pobierz dokumenty na podstawie indeksu
      const documents = index.map(id => this.getData(collection, id))
        .filter(doc => doc !== null);
      
      return documents;
    } catch (error) {
      console.error(`❌ Błąd podczas pobierania kolekcji lokalnych danych (${collection}):`, error);
      return [];
    }
  }
  
  /**
   * Aktualizuje indeks kolekcji - dodaje nowe ID dokumentu
   */
  private updateCollectionIndex(collection: string, id: string): void {
    const indexKey = `${this.prefix}${collection}_index`;
    try {
      // Pobierz obecny indeks
      const indexData = localStorage.getItem(indexKey);
      let index: string[] = indexData ? JSON.parse(indexData) : [];
      
      // Dodaj nowe ID, jeśli nie istnieje
      if (!index.includes(id)) {
        index.push(id);
        localStorage.setItem(indexKey, JSON.stringify(index));
      }
    } catch (error) {
      console.error(`❌ Błąd podczas aktualizacji indeksu kolekcji (${collection}):`, error);
    }
  }
  
  /**
   * Usuwa ID dokumentu z indeksu kolekcji
   */
  private removeFromCollectionIndex(collection: string, id: string): void {
    const indexKey = `${this.prefix}${collection}_index`;
    try {
      // Pobierz obecny indeks
      const indexData = localStorage.getItem(indexKey);
      if (!indexData) return;
      
      let index: string[] = JSON.parse(indexData);
      index = index.filter(itemId => itemId !== id);
      localStorage.setItem(indexKey, JSON.stringify(index));
    } catch (error) {
      console.error(`❌ Błąd podczas usuwania z indeksu kolekcji (${collection}):`, error);
    }
  }
  
  /**
   * Pobiera indeks kolekcji
   * @returns Tablica ID dokumentów w kolekcji
   */
  private getCollectionIndex(collection: string): string[] {
    const indexKey = `${this.prefix}${collection}_index`;
    try {
      const indexData = localStorage.getItem(indexKey);
      return indexData ? JSON.parse(indexData) : [];
    } catch (error) {
      console.error(`❌ Błąd podczas pobierania indeksu kolekcji (${collection}):`, error);
      return [];
    }
  }
  
  /**
   * Wyświetla diagnostykę lokalnych danych
   */
  diagnostics(): void {
    console.log('📊 Diagnostyka lokalnych danych:');
    
    // Znajdź wszystkie klucze z prefixem aplikacji
    const allKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(this.prefix));
    
    // Znajdź wszystkie indeksy kolekcji
    const collectionIndices = allKeys
      .filter(key => key.endsWith('_index'));
    
    // Wyświetl statystyki dla każdej kolekcji
    for (const indexKey of collectionIndices) {
      const collection = indexKey.replace(this.prefix, '').replace('_index', '');
      const index = this.getCollectionIndex(collection);
      console.log(`- Kolekcja ${collection}: ${index.length} dokumentów`);
    }
    
    console.log(`Łącznie znaleziono ${allKeys.length} kluczy i ${collectionIndices.length} kolekcji`);
  }
  
  /**
   * Eksportuje wszystkie lokalne dane do pliku JSON
   * @returns string z danymi w formacie JSON
   */
  exportData(): string {
    try {
      const data: Record<string, any> = {};
      
      // Znajdź wszystkie klucze z prefixem aplikacji
      const allKeys = Object.keys(localStorage)
        .filter(key => key.startsWith(this.prefix));
      
      // Pobierz dane dla każdego klucza
      for (const key of allKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          data[key] = JSON.parse(value);
        }
      }
      
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('❌ Błąd podczas eksportu lokalnych danych:', error);
      return '{}';
    }
  }
  
  /**
   * Importuje dane z pliku JSON do localStorage
   * @param jsonData string z danymi w formacie JSON
   */
  importData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      
      // Zapisz każdy klucz do localStorage
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith(this.prefix)) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      }
      
      console.log('✅ Dane zostały zaimportowane');
    } catch (error) {
      console.error('❌ Błąd podczas importu lokalnych danych:', error);
    }
  }
  
  /**
   * Czyści wszystkie lokalne dane
   */
  clearAll(): void {
    try {
      // Znajdź wszystkie klucze z prefixem aplikacji
      const allKeys = Object.keys(localStorage)
        .filter(key => key.startsWith(this.prefix));
      
      // Usuń każdy klucz
      for (const key of allKeys) {
        localStorage.removeItem(key);
      }
      
      console.log(`✅ Usunięto ${allKeys.length} kluczy lokalnych`);
    } catch (error) {
      console.error('❌ Błąd podczas czyszczenia lokalnych danych:', error);
    }
  }
}

// Eksport instancji
export const localData = new LocalDataManager();
export default localData; 