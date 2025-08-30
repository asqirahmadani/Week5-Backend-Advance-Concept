@echo off
setlocal

echo Stopping any existing PM2 processes...
call pm2 stop all >nul 2>&1
call pm2 delete all >nul 2>&1

echo Starting services...

@REM echo Starting Quickbite Gateway...
@REM call pm2 start ecosystem.config.js --only quickbite-gateway
@REM timeout /t 2 /nobreak >nul

echo Starting User Service...
call pm2 start ecosystem.config.js --only user-service
timeout /t 2 /nobreak >nul

echo Starting Restaurant Service...
call pm2 start ecosystem.config.js --only restaurant-service
timeout /t 2 /nobreak >nul

echo Starting Order Service...
call pm2 start ecosystem.config.js --only order-service
timeout /t 2 /nobreak >nul

echo Starting Payment Service...
call pm2 start ecosystem.config.js --only payment-service
timeout /t 2 /nobreak >nul

echo Starting Delivery Service...
call pm2 start ecosystem.config.js --only delivery-service
timeout /t 2 /nobreak >nul

echo Starting Review Service...
call pm2 start ecosystem.config.js --only review-service
timeout /t 2 /nobreak >nul

echo Starting Notification Service...
call pm2 start ecosystem.config.js --only notification-service
timeout /t 2 /nobreak >nul

echo All services started!
echo Showing status...
call pm2 list

pause