#!/bin/bash

# Kolory do komunikatów
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}== Wdrażanie reguł Firebase - v1.0 ==${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Użyj lokalnego firebase-tools (devDependency) przez npx, jeśli globalny `firebase` nie istnieje.
FIREBASE_CMD="firebase"
if ! command -v firebase > /dev/null 2>&1; then
  FIREBASE_CMD="npx --yes firebase-tools"
fi

# Sprawdź, czy mamy zalogowanie do Firebase
echo -e "${BLUE}Sprawdzanie statusu logowania Firebase...${NC}"
if ! $FIREBASE_CMD projects:list > /dev/null 2>&1; then
  echo -e "${YELLOW}Nie wykryto logowania. Loguję...${NC}"
  $FIREBASE_CMD login
else
  echo -e "${GREEN}Zalogowano pomyślnie.${NC}"
fi

# Sprawdź, czy projekt jest poprawnie skonfigurowany
echo -e "${BLUE}Sprawdzanie konfiguracji projektu...${NC}"
PROJECT_ID=$(cat .firebaserc | grep "default" | cut -d '"' -f 4)
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Nie znaleziono identyfikatora projektu w pliku .firebaserc${NC}"
  exit 1
else
  echo -e "${GREEN}Identyfikator projektu: $PROJECT_ID${NC}"
fi

# Podgląd reguł przed wdrożeniem
echo ""
echo -e "${YELLOW}Podgląd reguł Firestore przed wdrożeniem:${NC}"
echo "-------------------------------------"
cat firestore.rules
echo "-------------------------------------"
echo ""

# Podgląd reguł Storage przed wdrożeniem
echo -e "${YELLOW}Podgląd reguł Storage przed wdrożeniem:${NC}"
echo "-------------------------------------"
cat storage.rules
echo "-------------------------------------"
echo ""

# Poproś o potwierdzenie
read -p "Czy chcesz kontynuować wdrażanie? (t/n): " choice
case "$choice" in 
  t|T ) echo -e "${GREEN}Kontynuuję wdrażanie...${NC}";;
  * ) echo -e "${RED}Wdrażanie anulowane przez użytkownika.${NC}"; exit 0;;
esac

# Wdrożenie reguł Firestore
echo ""
echo -e "${BLUE}Wdrażanie reguł Firestore...${NC}"
$FIREBASE_CMD deploy --only firestore:rules

# Sprawdź status wdrożenia
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Reguły Firestore wdrożone pomyślnie!${NC}"
else
  echo -e "${RED}❌ Wdrażanie reguł Firestore nie powiodło się.${NC}"
fi

# Wdrożenie reguł Storage
echo ""
echo -e "${BLUE}Wdrażanie reguł Storage...${NC}"
$FIREBASE_CMD deploy --only storage

# Sprawdź status wdrożenia
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Reguły Storage wdrożone pomyślnie!${NC}"
else
  echo -e "${RED}❌ Wdrażanie reguł Storage nie powiodło się.${NC}"
fi

echo ""
echo -e "${GREEN}Zakończono wdrażanie reguł!${NC}"
echo -e "${YELLOW}Pamiętaj, że reguły bez uwierzytelniania powinny być używane TYLKO dla aplikacji wewnętrznych.${NC}"
echo -e "${YELLOW}Dla aplikacji publicznych zaleca się implementację poprawnego uwierzytelniania.${NC}" 