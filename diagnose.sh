#!/bin/bash

# Text colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}   MadTrips Social Graph Diagnosis Tool   ${NC}"
echo -e "${BLUE}==========================================${NC}"
echo

# Check if node and npm are installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Install chalk if not already installed
if ! npm list chalk | grep -q chalk; then
    echo -e "${BLUE}Installing required dependencies...${NC}"
    npm install chalk --no-save
fi

# Run the node diagnostic script
echo -e "${BLUE}Running diagnostic script...${NC}"
echo
node scripts/diagnose-socialgraph.js

echo
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}   Browser-based diagnosis available at:   ${NC}"
echo -e "${GREEN}   http://localhost:3000/diagnosis        ${NC}"
echo -e "${BLUE}==========================================${NC}"

# Ask if user wants to open the diagnosis page in browser
echo
read -p "Would you like to open the diagnosis page in your browser? (y/n): " choice
if [[ "$choice" =~ ^[Yy]$ ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000/diagnosis"
    elif command -v open &> /dev/null; then
        open "http://localhost:3000/diagnosis"
    else
        echo -e "${RED}Could not open browser automatically. Please open this URL manually:${NC}"
        echo -e "${GREEN}http://localhost:3000/diagnosis${NC}"
    fi
fi

echo
echo -e "${BLUE}Do you want to force an update of the social graph?${NC}"
read -p "This will fetch new data from Nostr (y/n): " update_choice
if [[ "$update_choice" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Updating social graph...${NC}"
    if command -v curl &> /dev/null; then
        response=$(curl -s "http://localhost:3000/api/socialgraph?update=true")
        echo "Response: $response"
    else
        echo -e "${RED}curl is not installed. Please visit this URL to update:${NC}"
        echo -e "${GREEN}http://localhost:3000/api/socialgraph?update=true${NC}"
    fi
fi

echo
echo -e "${GREEN}Diagnosis complete!${NC}" 