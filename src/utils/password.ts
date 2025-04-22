/**
 * Narzędzia do bezpiecznego haszowania i weryfikacji haseł
 * Wykorzystuje Web Crypto API dostępne w nowoczesnych przeglądarkach
 */

// Konwersja stringa do ArrayBuffer
const stringToBuffer = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

// Konwersja ArrayBuffer do stringa w formacie base64
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

// Konwersja stringa base64 do ArrayBuffer
const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Generowanie losowej soli
const generateSalt = (): ArrayBuffer => {
  return crypto.getRandomValues(new Uint8Array(16)).buffer;
};

/**
 * Haszuje hasło z użyciem PBKDF2
 * @param password - Hasło do zahaszowania
 * @returns Obiekt zawierający zahaszowane hasło i sól
 */
export const hashPassword = async (password: string): Promise<{ hash: string; salt: string }> => {
  try {
    // Generuj losową sól
    const salt = generateSalt();
    
    // Importuj hasło jako klucz
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      stringToBuffer(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Utwórz klucz pochodny z użyciem PBKDF2
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Wyeksportuj klucz jako surowe dane
    const keyBuffer = await crypto.subtle.exportKey('raw', derivedKey);
    
    // Konwersja do base64 dla przechowywania
    const hashBase64 = bufferToBase64(keyBuffer);
    const saltBase64 = bufferToBase64(salt);
    
    return {
      hash: hashBase64,
      salt: saltBase64
    };
  } catch (error) {
    console.error('Błąd podczas haszowania hasła:', error);
    throw new Error('Nie udało się zahaszować hasła');
  }
};

/**
 * Porównuje wprowadzone hasło z zapisanym haszem
 * @param password - Wprowadzone hasło
 * @param storedHash - Zapisany hasz
 * @param storedSalt - Zapisana sól
 * @returns Czy hasło jest prawidłowe
 */
export const compareHash = async (
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> => {
  try {
    // Konwersja soli z base64
    const salt = base64ToBuffer(storedSalt);
    
    // Importuj hasło jako klucz
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      stringToBuffer(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Utwórz klucz pochodny z użyciem PBKDF2 i tej samej soli
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Wyeksportuj klucz jako surowe dane
    const keyBuffer = await crypto.subtle.exportKey('raw', derivedKey);
    
    // Konwersja do base64 dla porównania
    const compareHash = bufferToBase64(keyBuffer);
    
    // Porównaj z zapisanym haszem
    return compareHash === storedHash;
  } catch (error) {
    console.error('Błąd podczas porównywania hasła:', error);
    return false;
  }
}; 