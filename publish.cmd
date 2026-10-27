@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
set "LOG=%~dp0publish.log"
echo [%date% %time%] 开始发布 > "%LOG%"
echo ============================================
echo  cortico-world-diary-recall 发布向导
echo  日志：%LOG%
echo ============================================
echo.
echo [1/2] npm login ...
call npm login >>"%LOG%" 2>&1
if errorlevel 1 goto fail
echo [2/2] npm publish ...
call npm publish >>"%LOG%" 2>&1
if errorlevel 1 goto fail
echo.
echo 发布完成。验证：npm view cortico-world-diary-recall version
echo 完整日志：%LOG%
pause
exit /b 0

:fail
echo.
echo 失败了，日志最后 30 行：
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 30"
echo.
echo 把上面这段或 %LOG% 发给我。
pause
exit /b 1