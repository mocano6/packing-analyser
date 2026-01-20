"use client";

import React, { useState, useRef, useEffect } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import styles from "./VideoUploadInput.module.css";

interface VideoUploadInputProps {
  matchId?: string;
  currentVideoPath?: string;
  currentVideoUrl?: string;
  onUploadComplete: (storagePath: string, storageUrl: string) => void;
  onRemove: () => void;
}

const VideoUploadInput: React.FC<VideoUploadInputProps> = ({
  matchId,
  currentVideoPath,
  currentVideoUrl,
  onUploadComplete,
  onRemove,
}) => {
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sprawdź czy storage jest dostępne przy montowaniu komponentu
  useEffect(() => {
    if (!storage) {
      console.error("⚠️ Firebase Storage nie jest zainicjalizowane!");
    } else {
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Sprawdź czy storage jest dostępne
    if (!storage) {
      console.error("Firebase Storage nie jest zainicjalizowane");
      setError("Błąd: Firebase Storage nie jest dostępne. Odśwież stronę i spróbuj ponownie.");
      return;
    }

    // Sprawdź rozmiar pliku (max 10GB)
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB w bajtach
    if (file.size > maxSize) {
      setError("Plik jest zbyt duży. Maksymalny rozmiar to 10GB.");
      return;
    }

    // Sprawdź typ pliku
    if (!file.type.startsWith('video/')) {
      setError("Wybierz plik wideo (MP4, WebM, itp.)");
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Usuń poprzednie wideo jeśli istnieje
      if (currentVideoPath && storage) {
        try {
          const oldVideoRef = ref(storage, currentVideoPath);
          await deleteObject(oldVideoRef);
        } catch (deleteError: any) {
          // Ignoruj błąd jeśli plik nie istnieje
          if (deleteError?.code !== 'storage/object-not-found') {
            console.warn("Nie udało się usunąć starego wideo:", deleteError);
          }
        }
      }

      // Utwórz ścieżkę w Storage
      const matchIdForPath = matchId || `temp_${Date.now()}`;
      const fileExtension = file.name.split('.').pop() || 'mp4';
      const fileName = `video_${Date.now()}.${fileExtension}`;
      const storagePath = `matches/${matchIdForPath}/${fileName}`;

      const storageRef = ref(storage, storagePath);

      // Rozpocznij upload z metadanymi
      const metadata = {
        contentType: file.type,
        customMetadata: {
          originalFileName: file.name,
          uploadedAt: new Date().toISOString()
        }
      };

      // Rozpocznij upload
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (uploadError: any) => {
          console.error("Błąd podczas uploadu:", uploadError);
          console.error("Szczegóły błędu:", {
            code: uploadError?.code,
            message: uploadError?.message,
            serverResponse: uploadError?.serverResponse
          });
          
          // Bardziej szczegółowe komunikaty błędów
          let errorMessage = "Nie udało się wgrać wideo. ";
          
          if (uploadError?.code === 'storage/unauthorized') {
            errorMessage += "Brak uprawnień do zapisu w Firebase Storage. Sprawdź reguły bezpieczeństwa.";
          } else if (uploadError?.code === 'storage/canceled') {
            errorMessage += "Upload został anulowany.";
          } else if (uploadError?.code === 'storage/retry-limit-exceeded') {
            errorMessage += "Przekroczono limit ponownych prób. To może być problem z CORS. Sprawdź plik CORS_SETUP.md w katalogu projektu.";
          } else if (uploadError?.code === 'storage/unknown') {
            errorMessage += "Wystąpił nieznany błąd. Sprawdź połączenie z internetem i konfigurację CORS.";
          } else if (uploadError?.message?.includes('CORS') || uploadError?.message?.includes('cors') || 
                     uploadError?.serverResponse?.includes('CORS') || uploadError?.serverResponse?.includes('cors')) {
            errorMessage += "Problem z CORS. Skonfiguruj CORS dla Firebase Storage zgodnie z instrukcjami w pliku CORS_SETUP.md.";
          } else if (uploadError?.message) {
            errorMessage += uploadError.message;
          } else {
            errorMessage += "Spróbuj ponownie. Jeśli problem się powtarza, sprawdź konfigurację CORS (zobacz CORS_SETUP.md).";
          }
          
          setError(errorMessage);
          setIsUploading(false);
          setUploadProgress(0);
        },
        async () => {
          // Upload zakończony pomyślnie
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            onUploadComplete(storagePath, downloadURL);
            setIsUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          } catch (urlError: any) {
            console.error("Błąd podczas pobierania URL:", urlError);
            let errorMessage = "Nie udało się pobrać URL wideo. ";
            if (urlError?.message) {
              errorMessage += urlError.message;
            }
            setError(errorMessage);
            setIsUploading(false);
            setUploadProgress(0);
          }
        }
      );
    } catch (err: any) {
      console.error("Błąd podczas przygotowania uploadu:", err);
      let errorMessage = "Wystąpił błąd podczas przygotowania uploadu. ";
      if (err?.message) {
        errorMessage += err.message;
      } else {
        errorMessage += "Spróbuj ponownie.";
      }
      setError(errorMessage);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemove = async () => {
    if (!currentVideoPath || !storage) {
      onRemove();
      return;
    }

    if (window.confirm("Czy na pewno chcesz usunąć wideo?")) {
      try {
        const videoRef = ref(storage, currentVideoPath);
        await deleteObject(videoRef);
        onRemove();
      } catch (error: any) {
        console.error("Błąd podczas usuwania wideo:", error);
        let errorMessage = "Nie udało się usunąć wideo z serwera.";
        if (error?.code === 'storage/object-not-found') {
          errorMessage = "Wideo nie zostało znalezione w Storage (może już zostało usunięte).";
        } else if (error?.message) {
          errorMessage += " " + error.message;
        }
        alert(errorMessage);
      }
    }
  };

  return (
    <div className={styles.uploadContainer}>
      {currentVideoUrl ? (
        <div className={styles.videoInfo}>
          <div className={styles.videoStatus}>
            <span className={styles.checkmark}>✓</span>
            <span>Wideo wgrane</span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className={styles.removeButton}
          >
            Usuń wideo
          </button>
        </div>
      ) : (
        <div className={styles.uploadArea}>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            disabled={isUploading}
            className={styles.fileInput}
            id="videoUpload"
          />
          <label htmlFor="videoUpload" className={styles.uploadLabel}>
            {isUploading ? (
              <>
                <span className={styles.uploadIcon}>⏳</span>
                <span>Wgrywanie... {Math.round(uploadProgress)}%</span>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <span className={styles.uploadIcon}>📹</span>
                <span>Wybierz plik wideo (MP4, WebM, max 10GB)</span>
              </>
            )}
          </label>
        </div>
      )}
      {error && (
        <div className={styles.errorMessage}>
          <strong>Błąd:</strong> {error}
          <br />
          <small style={{ marginTop: '8px', display: 'block' }}>
            {error.includes('CORS') || error.includes('cors') ? (
              <>
                <strong>⚠️ Wymagana konfiguracja CORS!</strong>
                <br />
                Zobacz plik <code>QUICK_CORS_FIX.md</code> w katalogu projektu.
                <br />
                Lub przejdź do: Google Cloud Console → Storage → Buckets → Configuration → CORS
              </>
            ) : (
              <>Sprawdź konsolę przeglądarki (F12) dla szczegółów błędu.</>
            )}
          </small>
        </div>
      )}
    </div>
  );
};

export default VideoUploadInput;

