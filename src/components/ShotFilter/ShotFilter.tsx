"use client";

import React from "react";
import styles from "./ShotFilter.module.css";

export interface ShotFilterProps {
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  shots: any[];
}

const ShotFilter: React.FC<ShotFilterProps> = ({
  selectedCategories,
  onCategoryToggle,
  shots,
}) => {
  // Definicje kategorii
  const categories = [
    // Kategoria akcji
    { key: 'open_play', label: 'Otwarta gra' },
    { key: 'sfg', label: 'SFG' },
    
    // Typ strzału
    { key: 'zablokowany', label: 'Zablokowany' },
    { key: 'celny', label: 'Celny' },
    { key: 'gol', label: 'Gol' },
    { key: 'niecelny', label: 'Niecelny' },
  ];

  // Policz strzały dla każdej kategorii
  const getCategoryCount = (categoryKey: string) => {
    switch (categoryKey) {
      // Kategoria akcji
      case 'open_play':
        return shots.filter(shot => 
          shot.actionType === 'open_play' || 
          shot.actionType === 'counter' || 
          shot.actionType === 'regain'
        ).length;
      case 'sfg':
        return shots.filter(shot => 
          shot.actionType === 'corner' || 
          shot.actionType === 'free_kick' || 
          shot.actionType === 'direct_free_kick' || 
          shot.actionType === 'penalty' || 
          shot.actionType === 'throw_in'
        ).length;
      
      // Typ strzału
      case 'zablokowany':
        return shots.filter(shot => shot.shotType === 'blocked').length;
      case 'celny':
        return shots.filter(shot => shot.shotType === 'on_target' && !shot.isGoal).length;
      case 'gol':
        return shots.filter(shot => shot.isGoal).length;
      case 'niecelny':
        return shots.filter(shot => shot.shotType === 'off_target').length;
      
      default:
        return 0;
    }
  };

  return (
    <div className={styles.filterContainer}>
      <h3 className={styles.filterTitle}>Filtr kategorii strzałów</h3>
      <div className={styles.categoriesGrid}>
        {categories.map((category) => {
          const isSelected = selectedCategories.includes(category.key);
          const count = getCategoryCount(category.key);
          
          return (
            <button
              key={category.key}
              className={`${styles.categoryButton} ${isSelected ? styles.selected : ''}`}
              onClick={() => onCategoryToggle(category.key)}
            >
              <span className={styles.categoryLabel}>{category.label}</span>
              <span className={styles.categoryCount}>({count})</span>
            </button>
          );
        })}
      </div>
      
      <div className={styles.filterActions}>
        <button
          className={styles.selectAllButton}
          onClick={() => {
            categories.forEach(cat => {
              if (!selectedCategories.includes(cat.key)) {
                onCategoryToggle(cat.key);
              }
            });
          }}
        >
          Zaznacz wszystkie
        </button>
        <button
          className={styles.deselectAllButton}
          onClick={() => {
            selectedCategories.forEach(cat => {
              onCategoryToggle(cat);
            });
          }}
        >
          Odznacz wszystkie
        </button>
      </div>
    </div>
  );
};

export default ShotFilter;
