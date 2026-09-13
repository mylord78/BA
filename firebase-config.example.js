// ==========================================
// 마음 돋보기 (Mind Lens) - Firebase 클라우드 DB 설정 템플릿
// ==========================================
// 사용 방법:
// 1. 이 파일을 복사하여 'firebase-config.js' 파일을 생성합니다.
// 2. Firebase 콘솔 (https://console.firebase.google.com)에서
//    프로젝트 생성 -> Cloud Firestore 생성 -> 웹 앱(</>) 추가 후
//    발급된 설정값(apiKey, projectId 등)을 아래에 입력하세요.
//
// * 보안 안내: 'firebase-config.js'는 .gitignore에 등록되어 GitHub에 커밋되지 않습니다.
// * TIP: 이 파일을 직접 생성/수정하지 않더라도,
//        'admin.html' 또는 'app.html' 화면 상단의
//        [⚙️ 클라우드 DB 설정] 버튼을 눌러 브라우저에서 바로 입력/저장할 수도 있습니다!

window.FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
