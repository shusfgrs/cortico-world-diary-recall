@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  cortico-world-diary-recall / 发布向导
echo ============================================
echo.
echo [1/2] npm login（按提示在浏览器里登录/输入验证码）
call npm login
if errorlevel 1 goto fail
echo.
echo [2/2] npm publish（发布 0.1.0 到 npm）
call npm publish
if errorlevel 1 goto fail
echo.
echo 发布完成。验证：npm view cortico-world-diary-recall version
echo 接着去 Pal-AI-Lab/cortico-extensions 开一个 [sync] issue，让市场立刻收录。
pause
exit /b 0

:fail
echo.
echo 失败了：把上面的报错整段发给我，我帮你看。
pause
exit /b 1
