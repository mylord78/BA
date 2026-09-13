// ==========================================
// 마음 돋보기 (Mind Lens) - 통합 데이터베이스 레이어 (v2.0)
// ==========================================
// Firebase Firestore 영구 클라우드 DB 연동 및
// 오프라인 로컬 저장소(IndexedDB & localStorage) 자동 백업/Fallback 지원
// URL 해시/쿼리 기반 클라이언트 초대 링크 자동 설정 지원

(function (window) {
  const DB_NAME = 'MindLensDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'surveys';
  const COLLECTION_NAME = 'surveys';
  // 상담자 전용 비공개 컬렉션 (내담자 앱에 절대 노출/접근되지 않음)
  const COLLECTION_PROFILES = 'counselor_client_profiles';
  const COLLECTION_NOTES = 'counselor_clinical_notes';
  const LOCAL_PROFILES_KEY = 'mind_counselor_client_profiles';
  const LOCAL_NOTES_KEY = 'mind_counselor_clinical_notes';

  let firestoreDb = null;
  let isFirestoreInitialized = false;

  // URL에서 인코딩된 설정 자동 감지 및 저장 (초대 링크 지원)
  function parseConfigFromUrl() {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
      
      let rawConfig = params.get('cfg') || params.get('config') || params.get('fb');
      
      if (!rawConfig && hash.includes('cfg=')) {
        const hashMatch = hash.match(/cfg=([^&]+)/);
        if (hashMatch) rawConfig = hashMatch[1];
      }

      if (rawConfig) {
        let jsonStr = '';
        try {
          jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(rawConfig))));
        } catch (e) {
          try {
            jsonStr = decodeURIComponent(rawConfig);
          } catch (e2) {
            jsonStr = rawConfig;
          }
        }
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.apiKey && parsed.projectId) {
          localStorage.setItem('mind_firebase_config', JSON.stringify(parsed));
          console.log('[MindDB] 초대 링크로부터 Firebase 설정을 감지하여 안전하게 저장했습니다.');
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[MindDB] URL 설정 파싱 실패:', e);
    }
    return null;
  }

  // 1. 설정 관리 (우선순위: URL -> firebase-config.js -> localStorage)
  function getEffectiveConfig() {
    // 1순위: URL 파라미터에서 추출한 설정
    const fromUrl = parseConfigFromUrl();
    if (fromUrl) return fromUrl;

    // 2순위: firebase-config.js 파일에 직접 입력된 설정 (전체 기기 공통 영구 연결에 최우선 권장)
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.projectId && !window.FIREBASE_CONFIG.apiKey.includes('YOUR_')) {
      return window.FIREBASE_CONFIG;
    }

    // 3순위: 브라우저 localStorage에 저장된 설정 (모달에서 직접 입력한 경우)
    try {
      const stored = localStorage.getItem('mind_firebase_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch (e) {}

    return null;
  }

  // 2. Firebase Firestore 초기화
  function initFirestore() {
    if (typeof firebase === 'undefined') {
      console.warn('[MindDB] Firebase SDK가 로드되지 않아 로컬 브라우저 저장소 모드로 작동합니다.');
      return false;
    }

    const config = getEffectiveConfig();
    if (!config) {
      console.info('[MindDB] Firebase 설정이 등록되지 않아 로컬 브라우저 저장소 모드로 작동합니다.');
      return false;
    }

    try {
      let app;
      if (!firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.app();
      }
      firestoreDb = firebase.firestore();
      isFirestoreInitialized = true;
      console.log('[MindDB] Firebase Firestore 클라우드 영구 DB가 성공적으로 연결되었습니다!');
      return true;
    } catch (err) {
      console.error('[MindDB] Firebase 초기화 중 오류 발생:', err);
      isFirestoreInitialized = false;
      return false;
    }
  }

  // 즉시 1차 초기화 시도
  initFirestore();

  // 3. 로컬 IndexedDB 드라이버 (Fallback & 캐시용)
  const LocalDB = {
    open: () => {
      return new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
              store.createIndex('nickname', 'nickname', { unique: false });
              store.createIndex('createdAt', 'createdAt', { unique: false });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    },

    getAll: async () => {
      const db = await LocalDB.open();
      if (!db) {
        try {
          const backup = localStorage.getItem('mind_surveys_backup');
          return backup ? JSON.parse(backup) : [];
        } catch (e) { return []; }
      }
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => {
            const res = req.result || [];
            if (res.length > 0) {
              resolve(res.sort((a, b) => b.id - a.id));
            } else {
              try {
                const backup = localStorage.getItem('mind_surveys_backup');
                resolve(backup ? JSON.parse(backup) : []);
              } catch (e) { resolve([]); }
            }
          };
          req.onerror = () => resolve([]);
        } catch (e) { resolve([]); }
      });
    },

    save: async (record) => {
      // localStorage 백업
      try {
        const existingStr = localStorage.getItem('mind_surveys_backup');
        const list = existingStr ? JSON.parse(existingStr) : [];
        const filtered = list.filter(item => item.id !== record.id);
        filtered.unshift(record);
        localStorage.setItem('mind_surveys_backup', JSON.stringify(filtered));
      } catch (e) {}

      // IndexedDB 저장
      const db = await LocalDB.open();
      if (db) {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(record);
        } catch (e) {}
      }
    },

    deleteRecord: async (id) => {
      try {
        const existingStr = localStorage.getItem('mind_surveys_backup');
        if (existingStr) {
          const list = JSON.parse(existingStr).filter(item => item.id !== id);
          localStorage.setItem('mind_surveys_backup', JSON.stringify(list));
        }
      } catch (e) {}

      const db = await LocalDB.open();
      if (db) {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.delete(id);
        } catch (e) {}
      }
    },

    clearAll: async () => {
      try { localStorage.removeItem('mind_surveys_backup'); } catch(e) {}
      const db = await LocalDB.open();
      if (db) {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.clear();
        } catch (e) {}
      }
    }
  };

  // 3-1. 상담자 전용 로컬 프로필 및 메모 스토리지 (Fallback)
  const LocalProfiles = {
    getAll: () => {
      try {
        const raw = localStorage.getItem(LOCAL_PROFILES_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    },
    save: (profile) => {
      try {
        const all = LocalProfiles.getAll();
        all[profile.nickname] = profile;
        localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(all));
      } catch (e) {}
    }
  };

  const LocalNotes = {
    getAll: () => {
      try {
        const raw = localStorage.getItem(LOCAL_NOTES_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    },
    save: (note) => {
      try {
        const all = LocalNotes.getAll();
        const idx = all.findIndex(n => n.id === note.id);
        if (idx >= 0) all[idx] = note;
        else all.unshift(note);
        localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(all));
      } catch (e) {}
    },
    delete: (id) => {
      try {
        const all = LocalNotes.getAll().filter(n => n.id !== id);
        localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(all));
      } catch (e) {}
    }
  };

  // 4. 통합 MindDB 공개 인터페이스
  const MindDB = {
    // 상태 및 설정 API
    isConfigured: () => !!getEffectiveConfig(),
    isFirebase: () => isFirestoreInitialized && firestoreDb !== null,
    getStatus: () => {
      if (isFirestoreInitialized && firestoreDb) {
        const cfg = getEffectiveConfig();
        return {
          mode: 'firestore',
          label: '클라우드 DB (Firestore) 연동 중',
          isCloud: true,
          projectId: cfg ? cfg.projectId : ''
        };
      }
      return {
        mode: 'local',
        label: '로컬 브라우저 저장소 모드 (DB 미연결)',
        isCloud: false,
        projectId: ''
      };
    },
    getConfig: () => getEffectiveConfig(),
    saveConfig: (configObj) => {
      try {
        localStorage.setItem('mind_firebase_config', JSON.stringify(configObj));
        const ok = initFirestore();
        return { success: ok };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    resetConfig: () => {
      localStorage.removeItem('mind_firebase_config');
      firestoreDb = null;
      isFirestoreInitialized = false;
      return true;
    },

    // Firestore 실제 읽기/쓰기 연결 테스트
    testConnection: async () => {
      if (!isFirestoreInitialized) {
        initFirestore();
      }
      if (!isFirestoreInitialized || !firestoreDb) {
        return { success: false, error: 'Firebase 초기화 실패: 설정값을 확인하세요.' };
      }
      try {
        // ping 테스트용 간단한 조회 (limit 1)
        await firestoreDb.collection(COLLECTION_NAME).limit(1).get();
        return { success: true, message: 'Firestore 클라우드 DB 연결 및 읽기 권한이 정상 확인되었습니다!' };
      } catch (err) {
        console.error('[MindDB] Firestore 연결 테스트 실패:', err);
        let errorMsg = err.message || '알 수 없는 오류';
        if (err.code === 'permission-denied') {
          errorMsg = '권한 거부 (permission-denied): Firebase 콘솔 -> Firestore Database -> 규칙(Rules) 탭에서 allow read, write: if true; 로 설정되어 있는지 확인하세요.';
        }
        return { success: false, error: errorMsg, code: err.code };
      }
    },

    // 내담자 전용 원클릭 접속 링크 생성 (스마트폰/원격 접속용)
    generateClientInviteUrl: () => {
      const cfg = getEffectiveConfig();
      const currentUrl = window.location.href.split('?')[0].split('#')[0];
      const clientBaseUrl = currentUrl.replace(/admin\.html$/, 'app.html');
      
      if (!cfg) {
        return clientBaseUrl;
      }

      try {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
        return `${clientBaseUrl}#cfg=${encodeURIComponent(encoded)}`;
      } catch (e) {
        return clientBaseUrl;
      }
    },

    // 전체 데이터 조회 (상담자용)
    getAll: async () => {
      if (!isFirestoreInitialized) {
        initFirestore();
      }

      if (isFirestoreInitialized && firestoreDb) {
        try {
          const snapshot = await firestoreDb.collection(COLLECTION_NAME).orderBy('id', 'desc').get();
          const list = [];
          snapshot.forEach(doc => {
            list.push(doc.data());
          });
          return list;
        } catch (err) {
          console.warn('[MindDB] Firestore 조회 실패, 로컬 데이터로 대체합니다:', err);
          return await LocalDB.getAll();
        }
      } else {
        return await LocalDB.getAll();
      }
    },

    // 실시간 구독 (내담자 등록 시 상담자 화면에 실시간 자동 반영)
    // filterNickname이 지정되면 해당 내담자의 설문만 필터링 (내담자 개인정보 보호)
    subscribe: (onUpdate, onError, filterNickname) => {
      if (!isFirestoreInitialized) {
        initFirestore();
      }

      if (isFirestoreInitialized && firestoreDb) {
        try {
          let query = firestoreDb.collection(COLLECTION_NAME).orderBy('id', 'desc');

          const unsubscribe = query.onSnapshot((snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              if (!filterNickname || data.nickname === filterNickname) {
                list.push(data);
              }
            });
            if (onUpdate) onUpdate(list);
          }, (err) => {
            console.error('[MindDB] 실시간 구독 오류:', err);
            if (onError) onError(err);
          });
          return unsubscribe;
        } catch (err) {
          console.warn('[MindDB] Firestore 구독 불가, 1회 조회로 대체합니다:', err);
        }
      }

      // 로컬 모드인 경우 1회 로드 후 빈 해제 함수 반환
      LocalDB.getAll().then(data => {
        const filtered = filterNickname ? data.filter(d => d.nickname === filterNickname) : data;
        if (onUpdate) onUpdate(filtered);
      });
      return () => {};
    },

    // 설문 저장 (내담자가 제출 시 호출)
    save: async (record) => {
      // 로컬에는 항상 캐시 백업 저장
      await LocalDB.save(record);

      if (!isFirestoreInitialized) {
        initFirestore();
      }

      if (isFirestoreInitialized && firestoreDb) {
        try {
          const docId = String(record.id || Date.now());
          await firestoreDb.collection(COLLECTION_NAME).doc(docId).set(record);
          console.log('[MindDB] 클라우드 DB(Firestore)에 안전하게 영구 저장되었습니다: ID', docId);
          return { success: true, mode: 'firestore', docId };
        } catch (err) {
          console.error('[MindDB] Firestore 저장 실패, 로컬에만 보관되었습니다:', err);
          return { success: false, mode: 'local_only', error: err.message };
        }
      }

      return { success: true, mode: 'local_only' };
    },

    // 단일 레코드 삭제
    deleteRecord: async (id) => {
      await LocalDB.deleteRecord(id);

      if (isFirestoreInitialized && firestoreDb) {
        try {
          await firestoreDb.collection(COLLECTION_NAME).doc(String(id)).delete();
          console.log('[MindDB] Firestore에서 삭제 완료: ID', id);
          return true;
        } catch (err) {
          console.error('[MindDB] Firestore 삭제 오류:', err);
          return false;
        }
      }
      return true;
    },

    // 전체 삭제 (관리자 전용)
    clearAll: async () => {
      await LocalDB.clearAll();

      if (isFirestoreInitialized && firestoreDb) {
        try {
          const snapshot = await firestoreDb.collection(COLLECTION_NAME).get();
          const batch = firestoreDb.batch();
          snapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log('[MindDB] Firestore 전체 컬렉션 비우기 완료');
          return true;
        } catch (err) {
          console.error('[MindDB] Firestore 전체 삭제 실패:', err);
          return false;
        }
      }
      return true;
    },

    // 기존 로컬 브라우저 데이터를 클라우드 DB로 마이그레이션(일괄 업로드)
    migrateLocalToFirebase: async () => {
      if (!isFirestoreInitialized && !initFirestore()) {
        throw new Error("Firebase 클라우드 DB가 연결되어 있지 않습니다. 설정을 먼저 완료해주세요.");
      }

      const localList = await LocalDB.getAll();
      if (!localList || localList.length === 0) {
        return { count: 0, message: "마이그레이션할 로컬 데이터가 없습니다." };
      }

      let count = 0;
      const batch = firestoreDb.batch();
      for (const item of localList) {
        const docRef = firestoreDb.collection(COLLECTION_NAME).doc(String(item.id));
        batch.set(docRef, item);
        count++;
      }
      await batch.commit();
      return { count, message: `${count}개의 로컬 설문 기록이 클라우드 DB로 안전하게 업로드되었습니다!` };
    },

    // 데이터 내보내기 (JSON / CSV)
    exportJSON: (records) => {
      const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
      const a = document.createElement('a');
      a.setAttribute("href", jsonStr);
      a.setAttribute("download", `mind_lens_research_db_${Date.now()}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    exportCSV: (records) => {
      if (!records || !records.length) {
        alert("내보낼 설문 기록이 없습니다.");
        return;
      }
      const headers = ["ID", "작성일시", "내담자닉네임", "1_컨디션", "2_계기", "3_생각", "4_감정", "5_몸느낌", "6_회피행동", "7_남은결과", "8_긍정대처"];
      const rows = records.map(item => {
        const seqMap = {};
        (item.sequence || []).forEach(s => { seqMap[s.type] = s.label; });
        return [
          item.id,
          `"${item.date || ''}"`,
          `"${item.nickname || ''}"`,
          `"${seqMap['컨디션'] || ''}"`,
          `"${seqMap['계기'] || ''}"`,
          `"${seqMap['생각'] || ''}"`,
          `"${seqMap['감정'] || ''}"`,
          `"${seqMap['몸느낌'] || ''}"`,
          `"${seqMap['행동'] || ''}"`,
          `"${seqMap['결과'] || ''}"`,
          `"${seqMap['긍정대처'] || ''}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute("href", url);
      a.setAttribute("download", `mind_lens_surveys_${Date.now()}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    // ==========================================
    // 5. 상담자 전용 비공개 데이터 레이어 (내담자 앱에 비노출)
    // ==========================================
    // 내담자 기본 인적사항 (성별, 나이, 접수일, 주호소 등)
    Profile: {
      getAll: async () => {
        if (!isFirestoreInitialized) initFirestore();
        if (isFirestoreInitialized && firestoreDb) {
          try {
            const snap = await firestoreDb.collection(COLLECTION_PROFILES).get();
            const map = {};
            snap.forEach(doc => { map[doc.id] = doc.data(); });
            return map;
          } catch (e) {
            console.warn('[MindDB Profile] Firestore 조회 실패, 로컬 사용:', e);
            return LocalProfiles.getAll();
          }
        }
        return LocalProfiles.getAll();
      },

      get: async (nickname) => {
        if (!nickname || nickname === 'ALL') return null;
        if (!isFirestoreInitialized) initFirestore();
        if (isFirestoreInitialized && firestoreDb) {
          try {
            const doc = await firestoreDb.collection(COLLECTION_PROFILES).doc(nickname).get();
            if (doc.exists) return doc.data();
          } catch (e) {}
        }
        return LocalProfiles.getAll()[nickname] || null;
      },

      save: async (profile) => {
        if (!profile || !profile.nickname) return { success: false, error: '닉네임 필수' };
        LocalProfiles.save(profile);

        if (!isFirestoreInitialized) initFirestore();
        if (isFirestoreInitialized && firestoreDb) {
          try {
            await firestoreDb.collection(COLLECTION_PROFILES).doc(profile.nickname).set(profile, { merge: true });
            console.log('[MindDB Profile] 내담자 기본정보 클라우드 저장 완료:', profile.nickname);
            return { success: true, mode: 'firestore' };
          } catch (e) {
            console.error('[MindDB Profile] Firestore 저장 실패:', e);
            return { success: false, mode: 'local', error: e.message };
          }
        }
        return { success: true, mode: 'local' };
      },

      subscribe: (onUpdate) => {
        if (!isFirestoreInitialized) initFirestore();
        if (isFirestoreInitialized && firestoreDb) {
          try {
            return firestoreDb.collection(COLLECTION_PROFILES).onSnapshot(snap => {
              const map = {};
              snap.forEach(doc => { map[doc.id] = doc.data(); });
              if (onUpdate) onUpdate(map);
            }, err => console.warn('[MindDB Profile] 구독 에러:', err));
          } catch (e) {}
        }
        if (onUpdate) onUpdate(LocalProfiles.getAll());
        return () => {};
      }
    },

    // 상담자 전용 비공개 임상 메모 히스토리
    Notes: {
      getByNickname: async (nickname) => {
        if (!isFirestoreInitialized) initFirestore();
        if (isFirestoreInitialized && firestoreDb) {
          try {
            let query = firestoreDb.collection(COLLECTION_NOTES);
            if (nickname && nickname !== 'ALL') {
              query = query.where('nickname', '==', nickname);
            }
            const snap = await query.get();
            const list = [];
            snap.forEach(doc => list.push(doc.data()));
            return list.sort((a, b) => (b.id || 0) - (a.id || 0));
          } catch (e) {
            console.warn('[MindDB Notes] Firestore 메모 조회 실패, 로컬 사용:', e);
          }
        }
        const all = LocalNotes.getAll();
        const filtered = (nickname && nickname !== 'ALL') ? all.filter(n => n.nickname === nickname) : all;
        return filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
      },

      save: async (note) => {
        if (!note.id) note.id = Date.now();
        if (!note.createdAt) note.createdAt = new Date().toISOString();
        LocalNotes.save(note);

        if (!isFirestoreInitialized) initFirestore();
        if (isFirestoreInitialized && firestoreDb) {
          try {
            const docId = String(note.id);
            await firestoreDb.collection(COLLECTION_NOTES).doc(docId).set(note);
            console.log('[MindDB Notes] 임상 메모 클라우드 저장 완료: ID', docId);
            return { success: true, mode: 'firestore', id: note.id };
          } catch (e) {
            console.error('[MindDB Notes] Firestore 메모 저장 실패:', e);
            return { success: false, mode: 'local', error: e.message };
          }
        }
        return { success: true, mode: 'local', id: note.id };
      },

      delete: async (noteId) => {
        LocalNotes.delete(noteId);
        if (isFirestoreInitialized && firestoreDb) {
          try {
            await firestoreDb.collection(COLLECTION_NOTES).doc(String(noteId)).delete();
            console.log('[MindDB Notes] 임상 메모 삭제 완료: ID', noteId);
            return true;
          } catch (e) {
            console.error('[MindDB Notes] Firestore 메모 삭제 오류:', e);
            return false;
          }
        }
        return true;
      },

      subscribe: (nickname, onUpdate) => {
        if (!isFirestoreInitialized) initFirestore();
        if (isFirestoreInitialized && firestoreDb) {
          try {
            let query = firestoreDb.collection(COLLECTION_NOTES);
            if (nickname && nickname !== 'ALL') {
              query = query.where('nickname', '==', nickname);
            }
            return query.onSnapshot(snap => {
              const list = [];
              snap.forEach(doc => list.push(doc.data()));
              list.sort((a, b) => (b.id || 0) - (a.id || 0));
              if (onUpdate) onUpdate(list);
            }, err => console.warn('[MindDB Notes] 메모 실시간 구독 에러:', err));
          } catch (e) {}
        }
        MindDB.Notes.getByNickname(nickname).then(list => {
          if (onUpdate) onUpdate(list);
        });
        return () => {};
      }
    }
  };

  window.MindDB = MindDB;
})(window);
