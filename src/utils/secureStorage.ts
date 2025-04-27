/**
 * Moduł bezpiecznego przechowywania danych lokalnych
 * 
 * Zapewnia szyfrowane przechowywanie danych w localStorage z obsługą TTL (time-to-live)
 */

// Podstawowa struktura przechowywanego obiektu
interface StorageItem<T> {
  value: T;
  expiry: number | null; // null oznacza brak wygaśnięcia
  createdAt: number;
  lastAccess: number;
}

// Opcje przechowywania
interface StorageOptions {
  ttl?: number | null | undefined; // czas życia w milisekundach (domyślnie brak)
  encrypt?: boolean; // czy szyfrować dane (domyślnie true)
  prefix?: string; // prefiks kluczy (domyślnie 'secureApp_')
}

// Domyślne opcje
const DEFAULT_OPTIONS: StorageOptions = {
  ttl: null,
  encrypt: true,
  prefix: 'packingApp_'
};

// Klasa obsługująca bezpieczne przechowywanie
export class SecureStorage {
  private options: Required<StorageOptions>;
  private encryptionKey: string;

  constructor(options: StorageOptions = {}) {
    this.options = {
      ttl: options.ttl ?? DEFAULT_OPTIONS.ttl,
      encrypt: options.encrypt ?? DEFAULT_OPTIONS.encrypt,
      prefix: options.prefix ?? DEFAULT_OPTIONS.prefix
    } as Required<StorageOptions>;
    
    // Generowanie lub pobranie klucza szyfrowania
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  /**
   * Pobiera lub tworzy klucz szyfrowania
   */
  private getOrCreateEncryptionKey(): string {
    const ENCRYPTION_KEY = 'packingApp_encKey';
    let key = localStorage.getItem(ENCRYPTION_KEY);
    
    if (!key) {
      // Generowanie prostego klucza (w produkcji użylibyśmy CryptoAPI)
      key = Math.random().toString(36).substring(2, 15) + 
            Math.random().toString(36).substring(2, 15);
      localStorage.setItem(ENCRYPTION_KEY, key);
    }
    
    return key;
  }

  /**
   * Proste szyfrowanie (w produkcji użylibyśmy CryptoAPI)
   */
  private encrypt(data: string): string {
    if (!this.options.encrypt) return data;
    
    // Proste szyfrowanie XOR - w produkcji użylibyśmy CryptoAPI
    let result = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
      result += String.fromCharCode(charCode);
    }
    
    // Kodujemy do base64 aby uniknąć problemów z niedrukowanymi znakami
    return btoa(result);
  }

  /**
   * Proste deszyfrowanie (w produkcji użylibyśmy CryptoAPI)
   */
  private decrypt(data: string): string {
    if (!this.options.encrypt) return data;
    
    try {
      // Dekodujemy z base64
      const decoded = atob(data);
      
      // Deszyfrowanie XOR
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        result += String.fromCharCode(charCode);
      }
      
      return result;
    } catch (error) {
      console.error('Błąd deszyfrowania danych:', error);
      return '';
    }
  }

  /**
   * Tworzy pełny klucz z prefiksem
   */
  private getFullKey(key: string): string {
    return `${this.options.prefix}${key}`;
  }

  /**
   * Sprawdza czy element wygasł
   */
  private hasExpired(item: StorageItem<any>): boolean {
    return item.expiry !== null && Date.now() > item.expiry;
  }

  /**
   * Zapisuje dane w storage
   */
  public set<T>(key: string, value: T, options?: StorageOptions): void {
    try {
      const fullKey = this.getFullKey(key);
      const mergedOptions = { ...this.options, ...options };
      
      const item: StorageItem<T> = {
        value,
        expiry: mergedOptions.ttl ? Date.now() + mergedOptions.ttl : null,
        createdAt: Date.now(),
        lastAccess: Date.now()
      };
      
      const serialized = JSON.stringify(item);
      const encrypted = mergedOptions.encrypt ? this.encrypt(serialized) : serialized;
      
      localStorage.setItem(fullKey, encrypted);
    } catch (error) {
      console.error(`Błąd zapisywania danych dla klucza ${key}:`, error);
    }
  }

  /**
   * Pobiera dane ze storage
   */
  public get<T>(key: string): T | null {
    try {
      const fullKey = this.getFullKey(key);
      const encrypted = localStorage.getItem(fullKey);
      
      if (!encrypted) return null;
      
      const decrypted = this.options.encrypt ? this.decrypt(encrypted) : encrypted;
      const item: StorageItem<T> = JSON.parse(decrypted);
      
      // Sprawdź czy element wygasł
      if (this.hasExpired(item)) {
        this.remove(key);
        return null;
      }
      
      // Aktualizuj czas ostatniego dostępu
      item.lastAccess = Date.now();
      const updatedEncrypted = this.options.encrypt 
        ? this.encrypt(JSON.stringify(item)) 
        : JSON.stringify(item);
      
      localStorage.setItem(fullKey, updatedEncrypted);
      
      return item.value;
    } catch (error) {
      console.error(`Błąd odczytu danych dla klucza ${key}:`, error);
      return null;
    }
  }

  /**
   * Usuwa dane ze storage
   */
  public remove(key: string): void {
    try {
      const fullKey = this.getFullKey(key);
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.error(`Błąd usuwania danych dla klucza ${key}:`, error);
    }
  }

  /**
   * Sprawdza czy klucz istnieje i nie wygasł
   */
  public has(key: string): boolean {
    try {
      const fullKey = this.getFullKey(key);
      const encrypted = localStorage.getItem(fullKey);
      
      if (!encrypted) return false;
      
      const decrypted = this.options.encrypt ? this.decrypt(encrypted) : encrypted;
      const item: StorageItem<any> = JSON.parse(decrypted);
      
      return !this.hasExpired(item);
    } catch (error) {
      console.error(`Błąd sprawdzania istnienia klucza ${key}:`, error);
      return false;
    }
  }

  /**
   * Czyszczenie wszystkich danych z prefiksem aplikacji
   */
  public clear(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.options.prefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Błąd czyszczenia danych:', error);
    }
  }

  /**
   * Czyszczenie wygasłych elementów
   */
  public clearExpired(): number {
    let count = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith(this.options.prefix)) {
          const encrypted = localStorage.getItem(key);
          
          if (!encrypted) continue;
          
          const decrypted = this.options.encrypt ? this.decrypt(encrypted) : encrypted;
          
          try {
            const item: StorageItem<any> = JSON.parse(decrypted);
            
            if (this.hasExpired(item)) {
              localStorage.removeItem(key);
              count++;
            }
          } catch (parseError) {
            // Nieprawidłowy format - usuwamy
            localStorage.removeItem(key);
            count++;
          }
        }
      }
    } catch (error) {
      console.error('Błąd czyszczenia wygasłych elementów:', error);
    }
    
    return count;
  }

  /**
   * Usuwa wszystkie dane z lokalnego magazynu z prefixem aplikacji
   */
  clearAll = (): void => {
    const keysToRemove: string[] = [];
    
    // Znajdź wszystkie klucze zaczynające się od prefixu
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.options.prefix)) {
        keysToRemove.push(key);
      }
    }
    
    // Usuń wszystkie znalezione klucze
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SecureStorage] Usunięto ${keysToRemove.length} elementów`);
    }
  };
}

// Eksportuj domyślną instancję
export default new SecureStorage(); 