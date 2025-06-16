#!/usr/bin/env sh
GREEN='\033[0;32m'
NC='\033[0m'
if ! python3 --version > /dev/null 2>&1; then
    echo -e "${GREEN}Installing Python3...${NC}"
    sudo apt-get install python3
fi
if ! pip3 --version > /dev/null 2>&1; then
    echo -e "${GREEN}Installing pip3...${NC}"
    sudo apt-get install python3-pip
fi
if ! mysql --version > /dev/null 2>&1; then
    echo -e "${GREEN}Installing MySQL server...${NC}"
    sudo apt-get install mysql-server
    echo -e "${GREEN}Installing MySQL client libraries...${NC}"
    pip install mysqlclient
    pip install mysql-connector-python
fi
echo -e "${GREEN}Starting MySQL server...${NC}"
sudo service mysql start
echo -e "${GREEN}Loading environment variables...${NC}"
echo -e "${GREEN}Setting up the database...${NC}"
echo -e "${GREEN}Please wait...${NC}"
for i in {1..10}; do
    echo -ne "${GREEN}#${NC}"
    sleep 0.5
done
echo
mysql -u root < prepare.sql
echo -e "${GREEN}Database is ready${NC}"