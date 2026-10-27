@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
echo ============================================
echo  cortico-world-diary-recall 发布（终端登录，不弹浏览器）
echo ============================================
echo  1) 按提示输入 npm 用户名、密码
echo  2) 如果开了 2FA，会要一次 6 位验证码
echo  3) npm publish 时若再要验证码，照输即可
echo.
call npm login --auth-type=legacy
if errorlevel 1 goto fail
echo.
echo === npm publish ===
call npm publish
if errorlevel 1 goto fail
echo.
echo 发布完成。验证：npm view cortico-world-diary-recall version
pause
exit /b 0

:fail
echo.
echo 失败了：把窗口里的报错整段发我。
pause
exit /b 1