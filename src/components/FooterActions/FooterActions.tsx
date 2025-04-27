import React from 'react';
import styles from './FooterActions.module.css';
import { toast } from 'react-hot-toast';
import SecureStorage from '@/utils/secureStorage';

interface FooterActionsProps {
  onToggleConsole: () => void;
  onToggleSettings: () => void;
}

const FooterActions: React.FC<FooterActionsProps> = ({ 
  onToggleConsole,
  onToggleSettings
}) => {
  const handleClearLocalData = () => {
    if (window.confirm('Czy na pewno chcesz usunąć wszystkie dane lokalne? Ta operacja jest nieodwracalna i może spowodować utratę niezapisanych danych.')) {
      SecureStorage.clearAll();
      toast.success('Dane lokalne zostały wyczyszczone');
    }
  };

  return (
    <div className={styles.footerActions}>
      <button
        className={styles.footerButton}
        onClick={onToggleConsole}
        title="Toggle Console"
      >
        <span className={styles.iconWrapper}>
          <span className="material-icons-outlined">terminal</span>
        </span>
      </button>
      <button 
        className={styles.footerButton}
        onClick={onToggleSettings}
        title="Settings"
      >
        <span className={styles.iconWrapper}>
          <span className="material-icons-outlined">settings</span>
        </span>
      </button>
      <button 
        className={styles.footerButton}
        onClick={handleClearLocalData}
        title="Wyczyść dane lokalne"
      >
        <span className={styles.iconWrapper}>
          <span className="material-icons-outlined">delete_sweep</span>
        </span>
      </button>
    </div>
  );
};

export default FooterActions; 