"use client";

import React, { useState } from 'react';
import styles from './OpponentLogoInput.module.css';

interface OpponentLogoInputProps {
  value?: string;
  onChange: (logoUrl: string) => void;
  onRemove: () => void;
}

const OpponentLogoInput: React.FC<OpponentLogoInputProps> = ({
  value,
  onChange,
  onRemove
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Funkcja kompresji obrazka
  const compressImage = (dataUrl: string, maxWidth: number = 200, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Oblicz nowe wymiary zachowując proporcje
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Narysuj obrazek na canvas z nowymi wymiarami
        ctx.drawImage(img, 0, 0, width, height);

        // Konwertuj do base64 z kompresją
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => {
        resolve(dataUrl); // Fallback do oryginalnego obrazka
      };
      
      img.src = dataUrl;
    });
  };

  // Obsługa schowka z kompresją
  const handleClipboardPaste = async () => {
    setIsLoading(true);
    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const reader = new FileReader();
            
            reader.onload = async (e) => {
              const result = e.target?.result as string;
              // Kompresuj obrazek
              const compressedResult = await compressImage(result);
              onChange(compressedResult);
              setIsLoading(false);
            };
            
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      
      alert('Nie znaleziono obrazka w schowku');
      setIsLoading(false);
    } catch (error) {
      alert('Błąd podczas wczytywania ze schowka. Upewnij się, że masz skopiowany obrazek.');
      setIsLoading(false);
    }
  };

  // Usuń logo
  const handleRemove = () => {
    onRemove();
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.clipboardSection}>
          <button
            type="button"
            onClick={handleClipboardPaste}
            disabled={isLoading}
            className={styles.clipboardButton}
          >
            {isLoading ? 'Wczytywanie...' : 'Wklej ze schowka'}
          </button>
          <small className={styles.helpText}>Skopiuj obrazek (Ctrl+C) i kliknij przycisk</small>
        </div>
      </div>

      {value && (
        <div className={styles.preview}>
          <img src={value} alt="Logo przeciwnika" className={styles.previewImage} />
          <button
            type="button"
            onClick={handleRemove}
            className={styles.removeButton}
            title="Usuń logo"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default OpponentLogoInput; 