// Nowe typy dla zmigrowanej struktury danych

export interface NewPlayer {
  id: string;
  firstName: string;
  lastName: string;
  name?: string; // Zachowane dla kompatybilności wstecznej
  birthYear?: number;
  imageUrl?: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMembership {
  playerId: string;
  number: number;
  joinDate: Date;
  status: 'active' | 'inactive' | 'suspended';
  notes?: string;
  contractUntil?: Date;
}

export interface PlayerWithMembership extends NewPlayer {
  // Dane z membership (dla aktualnego zespołu)
  number: number;
  membershipStatus: 'active' | 'inactive' | 'suspended';
  joinDate: Date;
  notes?: string;
} 