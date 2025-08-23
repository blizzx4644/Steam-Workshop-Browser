@echo off
cd /d steam-workshop-browser
if not exist "node_modules" (
    echo Installation des dependances...
    npm install
)
echo Lancement de Steam Workshop Browser...
npm start
pause
