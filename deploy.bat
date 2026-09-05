@echo off
chcp 65001 > nul
echo ====================================================
echo 🌻 마음 돋보기 (Mind Lens) - Firebase Hosting 자동 배포기
echo ====================================================
echo.
echo [1단계] Firebase 구글 계정 로그인을 진행합니다...
echo (브라우저가 열리면 Firebase 프로젝트를 생성한 구글 계정으로 로그인해 주세요)
echo.
call npx firebase-tools login
echo.
echo [2단계] Firebase Hosting(ba-app-3bf12)으로 배포를 시작합니다...
echo.
call npx firebase-tools deploy --only hosting
echo.
echo ====================================================
echo 🎉 배포가 성공적으로 완료되었습니다!
echo.
echo 📱 내담자 접속 주소: https://ba-app-3bf12.web.app
echo 🎓 상담자 콘솔 주소: https://ba-app-3bf12.web.app/admin
echo ====================================================
echo.
pause
