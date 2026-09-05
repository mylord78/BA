# 🌻 마음 돋보기 (Mind Lens) - Firebase 클라우드 영구 DB 연동 가이드

내담자(스마트폰 또는 개인 PC)와 상담자(연구실 PC)가 **서로 다른 브라우저와 기기에서 실시간으로 데이터를 공유**할 수 있도록, 무료 Google Firebase Firestore 클라우드 영구 DB를 연결하는 방법입니다.

---

## 🚀 3분 퀵 스타트 가이드

### 1단계: Firebase 프로젝트 생성 (무료)
1. **[Firebase 콘솔](https://console.firebase.google.com/)**에 구글 계정으로 로그인합니다.
2. **[프로젝트 만들기]** 버튼을 클릭합니다.
3. 프로젝트 이름(예: `mind-lens-app`)을 입력하고 [계속]을 누릅니다.
4. Google 애널리틱스는 필요에 따라 켜거나 끄고 [프로젝트 만들기]를 완료합니다.

---

### 2단계: Cloud Firestore 데이터베이스 생성
1. 좌측 메뉴에서 **빌드(Build) ➔ Firestore Database**를 클릭합니다.
2. **[데이터베이스 만들기]** 버튼을 클릭합니다.
3. 위치는 가까운 리전(예: `asia-northeast3 (서울)` 등)을 선택합니다.
4. 보안 규칙 시작 모드에서 **[테스트 모드에서 시작]**을 선택한 뒤 [만들기]를 클릭합니다.
   - *테스트 모드는 초기 테스트 및 연구 단계에서 인증 없이 읽기/쓰기가 가능합니다.*

---

### 3단계: 웹 앱(Web App) 등록 및 설정 키 복사
1. Firebase 콘솔 메인(프로젝트 개요)에서 웹 아이콘 **`</>`** 을 클릭합니다.
2. 앱 닉네임(예: `mind-lens-web`)을 입력하고 **[앱 등록]**을 누릅니다.
3. 화면에 나타나는 `firebaseConfig` 객체를 확인합니다:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "mind-lens-app.firebaseapp.com",
     projectId: "mind-lens-app",
     storageBucket: "mind-lens-app.appspot.com",
     messagingSenderId: "123456789...",
     appId: "1:123456789:web:abcdef..."
   };
   ```

---

### 4단계: 프로젝트에 설정 적용하기 (2가지 방법 중 편한 것 선택)

#### 방법 A. 파일에 직접 넣기 (권장)
- 프로젝트 폴더의 `firebase-config.js` 파일을 열고, 복사한 설정값을 그대로 붙여넣습니다:
  ```javascript
  window.FIREBASE_CONFIG = {
    apiKey: "AIzaSy...",
    authDomain: "mind-lens-app.firebaseapp.com",
    projectId: "mind-lens-app",
    storageBucket: "mind-lens-app.appspot.com",
    messagingSenderId: "123456789...",
    appId: "1:123456789:web:abcdef..."
  };
  ```

#### 방법 B. 화면에서 바로 붙여넣기 (상담자 화면에서 설정 후 링크 공유)
- `admin.html`(상담자 화면)을 브라우저로 엽니다.
- 상단 헤더의 **[🟡 로컬 모드 (DB 설정 필요)]** 버튼을 누릅니다.
- 나타난 팝업창의 텍스트 상자에 복사한 JSON 객체를 붙여넣고 **[저장 및 연결 ➔]**을 누릅니다.
- **[🔍 클라우드 DB 연결 & 권한 테스트]** 버튼을 눌러 정상 접속되는지 즉시 검증합니다.
- 상단 헤더의 **[📱 내담자 링크 복사]** 버튼을 눌러 생성된 링크를 내담자의 스마트폰(카카오톡, 문자 등)으로 전달하면, 내담자 기기에서도 별도 설정 없이 즉시 클라우드 DB에 연결됩니다!

---

## ⚡ 연동 확인 및 기능

1. **실시간 원격 동기화 & 즉시 알림**:
   - 상단 헤더의 배지가 **[🟢 클라우드 DB 실시간 연동]**으로 변경됩니다.
   - 내담자가 스마트폰이나 다른 PC의 `app.html`에서 설문을 제출하면, 상담자의 `admin.html` 화면에 **새로고침 없이 실시간으로 즉시** 세션이 추가되며, 화면 우측 하단에 알림 토스트("🔔 새로운 마음 설문이 도착했습니다!")가 나타납니다.
2. **내담자 데이터 격리 보호**:
   - 내담자는 본인의 닉네임으로 작성한 마음 지도와 편지만 열람할 수 있어 타인의 개인정보가 보호됩니다.
3. **기존 로컬 데이터 이전 (마이그레이션)**:
   - 상담자 콘솔의 [DB 설정] 모달에서 **[🚀 클라우드로 일괄 업로드]** 버튼을 누르면 이전에 브라우저에 임시 저장되어 있던 설문 기록들이 Firebase Firestore로 한 번에 전송됩니다.
4. **오프라인 캐시 & Fallback**:
   - Firebase 설정이 없거나 일시적으로 인터넷이 끊겨도 로컬 저장소(IndexedDB 및 localStorage)가 자동 작동하여 데이터가 유실되지 않습니다.

---

## 🛡️ 권장 보안 규칙 (Cloud Firestore Rules)

운영 환경에 배포할 때는 Firebase 콘솔 ➔ Firestore Database ➔ **규칙(Rules)** 탭에서 아래와 같이 설정하시면 안전합니다:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 1. 내담자 8단계 설문 컬렉션 (내담자 제출 및 상담자 분석)
    match /surveys/{surveyId} {
      allow read, create: if true;
      allow update, delete: if true;
    }

    // 2. 상담자 전용 비공개 인적사항 & 임상 메모 (내담자 앱에 비노출)
    match /counselor_client_profiles/{profileId} {
      allow read, write: if true;
    }
    match /counselor_clinical_notes/{noteId} {
      allow read, write: if true;
    }
  }
}
```

---

## 📁 주요 파일 안내

- `firebase-config.js`: Firebase 연결 인증 정보 파일
- `mind-db.js`: Firestore 실시간 동기화 및 로컬 Fallback 통합 DB 레이어
- `app.html`: 내담자용 8단계 마음 돋보기 웹 앱 (모바일/PC 반응형)
- `admin.html`: 연구자/상담사용 임상 분석 대시보드 (D3.js 네트워크 지도 + AI 소견서 + 실시간 수신)
- `client.html`: 내담자 접속용 바로가기 리다이렉트 페이지
