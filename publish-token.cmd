@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
set "LOG=%~dp0publish.log"
if not exist ".npmrc" goto noauth
findstr /C:"_authToken" ".npmrc" >nul 2>&1
if errorlevel 1 goto noauth
echo [%date% %time%] 使用 .npmrc 里的 token 发布 > "%LOG%"
echo 正在发布 cortico-world-diary-recall ...
call npm publish >>"%LOG%" 2>&1
if errorlevel 1 goto fail
echo.
echo 发布完成！验证：npm view cortico-world-diary-recall version
echo 日志：%LOG%
pause
exit /b 0

:noauth
echo.
echo 没有找到带 _authToken 的 .npmrc。
echo 1. 浏览器打开 https://www.npmjs.com/settings/你的用户名/tokens
echo 2. 生成一个 Automation（或 All packages / Read and write）Token
echo 3. 在本目录新建 .npmrc，写一行：
echo    //registry.npmjs.org/:_authToken=你的token
echo 4. 再双击本脚本
pause
exit /b 1

:fail
echo.
echo 发布失败，日志最后 30 行：
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 30"
pause
exit /b 1