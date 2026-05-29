import React, { useState, useMemo, useEffect } from 'react';
import {
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch,
  COLLECTION_NAMES,
  getFirebaseService,
  serverTimestamp
} from '../services/firebaseService.js';
import { calculateStudentDeleteAfter, studentsDueForDeletion } from '../lib/adminStudentMaintenance.js';
import { REMARK_TONES, normalizeRemarkTemplates } from '../lib/remarkTemplates.js';
import { normalizeStandardUnitSubjects } from '../lib/standardUnits.js';

// Admin Accordion Card Component
function AdminAccordion({ id, title, subtitle, pipeColor = '#8436ff', open, onToggle, alert = false, badgeText = '', children }) {
  return (
    <article id={`card-${id}`} className={`admin-section-card card-3d rounded-2xl p-5 ${open ? 'open' : ''} ${alert ? 'admin-section-card-alert' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="admin-section-head w-full flex items-center justify-between text-left focus:outline-none"
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-center">
          <div className="pipe-bar" style={{ width: '4.5px', height: '1.1rem', background: pipeColor, marginRight: '0.75rem', borderRadius: '2px', boxShadow: `0 0 10px ${pipeColor}44` }}></div>
          <span className="text-[17px] leading-snug font-extrabold text-white">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {badgeText && (
            <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-black text-rose-200">
              {badgeText}
            </span>
          )}
          <span className="text-[10px] text-slate-500 font-bold">{subtitle}</span>
          <span className={`text-slate-400 font-extrabold text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>
      {open && (
        <div className="mt-5 pt-5 border-t border-slate-800/80 space-y-5 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </article>
  );
}

export default function AdminSetup({
  state,
  teachers,
  classes,
  students,
  allStudents,
  studentRequests,
  books,
  classBooks,
  updateLegacyState,
  deps
}) {
  const {
    showModalAlert,
    showModalConfirm,
    notify
  } = deps;

  if (state.currentTeacher?.role !== 'admin') {
    return (
      <div className="card-3d rounded-2xl p-8 text-center text-rose-400 border border-rose-500/20 bg-rose-950/10">
        관리자 권한 계정만 접근 가능한 영역입니다. 🔐
      </div>
    );
  }

  const purpleTheme = '#8436ff';
  const btnClass = 'btn-admin';

  // Derived Admin Lists
  const managedStudents = useMemo(() => {
    return allStudents.filter(s => s.deleted !== true && s.status !== 'promoted');
  }, [allStudents]);

  const withdrawnStudents = useMemo(() => {
    return allStudents.filter(s => s.deleted !== true && s.status === 'withdrawn');
  }, [allStudents]);

  const pendingRequests = useMemo(() => {
    return studentRequests.filter(req => (req.status || 'pending') === 'pending');
  }, [studentRequests]);

  const promotionGrades = useMemo(() => {
    const list = classes.map(c => c.grade).filter(Boolean);
    return Array.from(new Set([...list, '고1', '고2', '고3'])).sort();
  }, [classes]);

  // Local Form States
  const [adminCardExpanded, setAdminCardExpanded] = useState({});
  const [adminTeacherForm, setAdminTeacherForm] = useState({ id: '', name: '', pin: '', role: 'teacher' });
  const [adminTeacherEditId, setAdminTeacherEditId] = useState('');
  
  const [selectedAdminStudentIds, setSelectedAdminStudentIds] = useState(new Set());
  const [adminPromotionGrade, setAdminPromotionGrade] = useState('');
  const [adminPromotionClassId, setAdminPromotionClassId] = useState('');

  // Local System Config
  const [adminLoginConfigForm, setAdminLoginConfigForm] = useState({ ...state.loginConfig });
  // Local standard units subject
  const [selectedStandardSubjectCode, setSelectedStandardSubjectCode] = useState('common_math_1');
  const [standardUnitNewName, setStandardUnitNewName] = useState('');
  const [standardUnitInsertOrder, setStandardUnitInsertOrder] = useState('');

  // Local templates edits to avoid keyboard flickering
  const [localRemarkTemplates, setLocalRemarkTemplates] = useState([]);

  // Sync templates on initialization/changes
  useEffect(() => {
    setLocalRemarkTemplates(normalizeRemarkTemplates(state.remarkTemplates));
  }, [state.remarkTemplates]);

  // Sync config form on changes
  useEffect(() => {
    setAdminLoginConfigForm({ ...state.loginConfig });
  }, [state.loginConfig]);

  const selectedStandardSubject = useMemo(() => {
    return state.standardUnitSubjects.find(s => s.code === selectedStandardSubjectCode) || state.standardUnitSubjects[0] || null;
  }, [state.standardUnitSubjects, selectedStandardSubjectCode]);

  // Helpers
  const uid = () => Math.random().toString(36).slice(2, 10);
  const teacherNameById = (id) => teachers.find(t => t.id === id)?.name || '-';
  const classById = (id) => classes.find(c => c.id === id) || null;
  const classByName = (classId) => classes.find(c => c.id === classId)?.name || '-';

  const toggleCard = (cardId) => {
    setAdminCardExpanded(prev => {
      const isExpanded = !prev[cardId];
      return { [cardId]: isExpanded }; // accordion behavior: close others
    });
  };

  const formatMaybeDate = (value) => {
    if (!value) return '-';
    const date = value.toDate?.() || new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  // 1. Teacher CRUD
  const handleSaveAdminTeacher = async () => {
    const { refs } = await getFirebaseService();
    const f = adminTeacherForm;
    if (!f.name || !f.pin) {
      showModalAlert('강사 이름과 PIN 비밀번호를 입력해주세요.');
      return;
    }
    if (!/^\d{6}$/.test(f.pin)) {
      showModalAlert('PIN 번호는 6자리 숫자여야 합니다.');
      return;
    }

    const payload = {
      name: f.name.trim(),
      pin: f.pin.trim(),
      role: f.role || 'teacher',
      active: true
    };

    if (adminTeacherEditId) {
      await updateDoc(doc(refs.teachers, adminTeacherEditId), payload);
      notify('강사 계정 정보가 수정되었습니다.');
    } else {
      const generatedId = `t_custom_${uid()}`;
      await setDoc(doc(refs.teachers, generatedId), { ...payload, createdAt: serverTimestamp() });
      notify('신규 강사 계정이 생성되었습니다.');
    }

    setAdminTeacherForm({ id: '', name: '', pin: '', role: 'teacher' });
    setAdminTeacherEditId('');
  };

  const handleEditTeacherClick = (t) => {
    setAdminTeacherForm({ id: t.id, name: t.name, pin: t.pin || '', role: t.role || 'teacher' });
    setAdminTeacherEditId(t.id);
  };

  const handleRemoveAdminTeacher = async (teacherId) => {
    const { refs } = await getFirebaseService();
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    if (teacher.id === 't_admin') {
      showModalAlert('최고 관리자 기본 계정은 삭제할 수 없습니다.');
      return;
    }
    const hasClasses = classes.some(c => c.teacherId === teacherId && c.active !== false);
    if (hasClasses) {
      showModalAlert('해당 강사가 담당하고 있는 개설 학급이 존재하여 삭제할 수 없습니다.\n반 설정을 먼저 정리해 주세요.');
      return;
    }

    const confirmed = await showModalConfirm(`강사 '${teacher.name}' 계정을 영구 삭제하시겠습니까?`);
    if (!confirmed) return;

    await deleteDoc(doc(refs.teachers, teacherId));
    setAdminTeacherForm({ id: '', name: '', pin: '', role: 'teacher' });
    setAdminTeacherEditId('');
    notify('강사 계정이 삭제되었습니다.');
  };

  // 2. Class Purge CRUD
  const handleDeleteClass = async (classId) => {
    const { db } = await getFirebaseService();
    const c = classes.find(item => item.id === classId);
    if (!c) return;

    const hasStudents = students.some(s => s.classId === classId && s.active !== false);
    if (hasStudents) {
      showModalAlert('반에 소속된 활성 학생이 존재하여 삭제할 수 없습니다.\n반/학생 설정에서 학생 목록을 먼저 해제해 주세요.');
      return;
    }

    const confirmed = await showModalConfirm(`개설된 학급 '${c.name}'을 영구 삭제하시겠습니까?\n이 자산은 완전히 제거됩니다.`);
    if (!confirmed) return;

    await deleteDoc(doc(db, COLLECTION_NAMES.classes, classId));
    notify('반 삭제 완료');
  };

  // 3. Student requests approve / reject
  const handleApproveRequest = async (requestId) => {
    const { db, refs } = await getFirebaseService();
    const req = pendingRequests.find(item => item.id === requestId);
    if (!req) return;
    const klass = classById(req.classId);
    if (!klass) {
      showModalAlert('요청한 반 정보를 찾을 수 없습니다.');
      return;
    }

    const studentRef = doc(refs.students);
    await setDoc(studentRef, {
      name: String(req.name || '').trim(),
      school: String(req.school || '').trim(),
      grade: req.grade || klass.grade || '',
      classId: req.classId,
      active: true,
      status: 'active',
      studentProfileId: studentRef.id,
      pin: String(req.pin || '1234').replace(/\D/g, '').slice(0, 4) || '1234',
      pinFailedCount: 0,
      pinLocked: false,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, COLLECTION_NAMES.studentRequests, requestId), {
      status: 'approved',
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    notify('신규생 등록을 승인했습니다.');
  };

  const handleRejectRequest = async (requestId) => {
    const { db } = await getFirebaseService();
    await updateDoc(doc(db, COLLECTION_NAMES.studentRequests, requestId), {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
    notify('신규생 등록 요청을 보류 처리했습니다.');
  };

  // 4. Student Management settings
  const handleToggleStudentSelect = (studentId) => {
    setSelectedAdminStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleAdminStudentClassUpdate = async (studentId) => {
    const { db } = await getFirebaseService();
    const selectEl = document.getElementById(`adminStudentClass-${studentId}`);
    const nextClassId = selectEl?.value || '';
    const klass = classById(nextClassId);
    if (!klass) {
      showModalAlert('이동할 반을 선택해주세요.');
      return;
    }

    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      classId: nextClassId,
      grade: klass.grade || '',
      active: true,
      status: 'active',
      updatedAt: serverTimestamp()
    });
    notify('학생 소속 반을 수정했습니다.');
  };

  const handleAdminStudentPinUpdate = async (studentId) => {
    const { db } = await getFirebaseService();
    const inputEl = document.getElementById(`adminStudentPin-${studentId}`);
    const nextPin = String(inputEl?.value || '').replace(/\D/g, '').slice(0, 4);
    if (!/^\d{4}$/.test(nextPin)) {
      showModalAlert('PIN 번호는 4자리 숫자여야 합니다.');
      return;
    }

    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      pin: nextPin,
      pinFailedCount: 0,
      pinLocked: false,
      updatedAt: serverTimestamp()
    });
    notify('PIN 비밀번호를 변경했습니다.');
  };

  const handleAdminStudentWithdraw = async (studentId) => {
    const { db } = await getFirebaseService();
    const s = allStudents.find(item => item.id === studentId);
    if (!s) return;
    const ok = await showModalConfirm(`${s.name} 학생을 퇴원 처리할까요?\n퇴원 처리된 학생은 3개월 후 삭제 예정 상태가 됩니다.`);
    if (!ok) return;

    const withdrawnAt = new Date();
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      active: false,
      status: 'withdrawn',
      withdrawnAt,
      deleteAfter: calculateStudentDeleteAfter(withdrawnAt),
      updatedAt: serverTimestamp()
    });
    
    setSelectedAdminStudentIds(prev => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
    notify('학생 퇴원 처리 완료');
  };

  const handleAdminStudentDelete = async (studentId) => {
    const { db } = await getFirebaseService();
    const s = allStudents.find(item => item.id === studentId);
    if (!s) return;
    const ok = await showModalConfirm(`${s.name} 학생을 삭제 표시할까요?\n기존 점검 기록은 그대로 유지됩니다.`);
    if (!ok) return;

    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      active: false,
      deleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    setSelectedAdminStudentIds(prev => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
    notify('학생 삭제 표시 완료');
  };

  // 5. System Splash config CRUD
  const handleSaveLoginConfig = async () => {
    const { db } = await getFirebaseService();
    const form = adminLoginConfigForm;
    await setDoc(doc(db, COLLECTION_NAMES.configs, 'login_splash'), {
      splashTitleLine1: (form.splashTitleLine1 || '').trim(),
      splashTitleLine2: (form.splashTitleLine2 || '').trim(),
      splashTitleSizeLine1: (form.splashTitleSizeLine1 || '38px').trim(),
      splashTitleSizeLine2: (form.splashTitleSizeLine2 || '54px').trim(),
      splashSubtitle: (form.splashSubtitle || '').trim(),
      splashDescription: (form.splashDescription || '').trim(),
      splashKicker: (form.splashKicker || 'OPEN ACADEMY').trim(),
      gatewayBadge: (form.gatewayBadge || 'GATEWAY').trim(),
      gatewayTitle: (form.gatewayTitle || '').trim(),
      gatewayDescription: (form.gatewayDescription || '').trim(),
      studentPortalTitle: (form.studentPortalTitle || '').trim(),
      studentPortalDescription: (form.studentPortalDescription || '').trim(),
      teacherPortalTitle: (form.teacherPortalTitle || '').trim(),
      teacherPortalDescription: (form.teacherPortalDescription || '').trim(),
      adminPortalTitle: (form.adminPortalTitle || '').trim(),
      adminPortalDescription: (form.adminPortalDescription || '').trim(),
      splashTitleColor: (form.splashTitleColor || '#ffffff').trim(),
      splashTextColor: (form.splashTextColor || '#e5e7eb').trim(),
      splashMutedColor: (form.splashMutedColor || '#94a3b8').trim(),
      auroraColor1: (form.auroraColor1 || '#00d6cd').trim(),
      auroraColor2: (form.auroraColor2 || '#4169e1').trim(),
      auroraColor3: (form.auroraColor3 || '#8436ff').trim(),
      portalHoverGlowColor: (form.portalHoverGlowColor || '#00d6cd').trim(),
      loginTitle: (form.loginTitle || '').trim(),
      loginDescription: (form.loginDescription || '').trim(),
      loginInfoText: (form.loginInfoText || '').trim(),
      primaryColor: (form.primaryColor || '#384bff').trim(),
      fontFamily: (form.fontFamily || "'SUIT', sans-serif").trim(),
      fontScale: (form.fontScale || '1.0').trim(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    notify('종합 시스템 설정 변경 완료');
  };

  // 6. Bulk promotion clone students
  const handleRunPromotionClone = async () => {
    const { db, refs } = await getFirebaseService();
    const ids = Array.from(selectedAdminStudentIds);
    if (!ids.length) {
      showModalAlert('승급 복제할 학생을 먼저 선택해주세요.');
      return;
    }
    const grade = adminPromotionGrade;
    const classId = adminPromotionClassId;
    const targetClass = classById(classId);
    if (!grade) {
      showModalAlert('새 학년을 선택해주세요.');
      return;
    }
    if (!targetClass) {
      showModalAlert('새 반을 선택해주세요.');
      return;
    }

    const duplicatedTargets = [];
    ids.forEach(studentId => {
      const student = allStudents.find(s => s.id === studentId);
      if (!student) return;
      const existing = students.find(s =>
        s.id !== studentId &&
        s.classId === classId &&
        String(s.name || '').trim() === String(student.name || '').trim() &&
        String(s.school || '').trim() === String(student.school || '').trim() &&
        s.active !== false
      );
      if (existing) duplicatedTargets.push(student.name || '이름 없음');
    });

    if (duplicatedTargets.length) {
      showModalAlert(`새 반에 이미 같은 학생이 포함되어 있어 진행할 수 없습니다.\n확인 필요: ${duplicatedTargets.join(', ')}`);
      return;
    }

    const confirmed = await showModalConfirm(`선택한 학생 ${ids.length}명을 ${grade} / ${targetClass.name} 학생으로 복제 생성할까요?\n기존 학생 데이터와 점검 기록은 그대로 보존됩니다.`);
    if (!confirmed) return;

    const batch = writeBatch(db);
    ids.forEach(studentId => {
      const student = allStudents.find(s => s.id === studentId);
      if (!student) return;
      const profileId = student.studentProfileId || student.id;
      const newRef = doc(refs.students);
      batch.update(doc(db, COLLECTION_NAMES.students, studentId), {
        active: false,
        status: 'promoted',
        studentProfileId: profileId,
        promotedToStudentId: newRef.id,
        promotedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.set(newRef, {
        name: student.name || '',
        school: student.school || '',
        grade,
        classId,
        active: true,
        status: 'active',
        studentProfileId: profileId,
        previousStudentId: student.id,
        pin: student.pin || '1234',
        pinFailedCount: 0,
        pinLocked: false,
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();
    setSelectedAdminStudentIds(new Set());
    notify(`학생 ${ids.length}명 승급 복제 처리 완료`);
  };

  // 7. Retention withdrawn purge
  const handlePurgeWithdrawn = async () => {
    const { db } = await getFirebaseService();
    const dueStudents = studentsDueForDeletion(allStudents);
    if (!dueStudents.length) {
      showModalAlert('현재 삭제 예정일이 지난 퇴원 학생이 없습니다.');
      return;
    }

    const confirmed = await showModalConfirm(`삭제 예정일이 경과한 퇴원 학생 ${dueStudents.length}명을 정리하시겠습니까?\n이 학생들은 데이터베이스에서 안전하게 삭제 표시 처리됩니다.`);
    if (!confirmed) return;

    const batch = writeBatch(db);
    dueStudents.forEach(student => {
      batch.update(doc(db, COLLECTION_NAMES.students, student.id), {
        active: false,
        deleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
    notify(`퇴원 학생 ${dueStudents.length}명 정리 완료`);
  };

  // 8. Standard Units subject list CRUD
  const saveStandardUnitSubjects = async (message = '표준단원 설정 저장 완료') => {
    const { db } = await getFirebaseService();
    const list = normalizeStandardUnitSubjects(state.standardUnitSubjects);
    await setDoc(doc(db, COLLECTION_NAMES.configs, 'standard_units'), {
      subjects: list,
      updatedAt: serverTimestamp()
    }, { merge: true });
    notify(message);
  };

  const handleSaveStandardUnitName = async (unitId) => {
    const inputEl = document.getElementById(`standardUnitName-${unitId}`);
    const nextLabel = String(inputEl?.value || '').trim();
    if (!nextLabel) {
      showModalAlert('표준단원명을 입력해주세요.');
      return;
    }
    const updated = state.standardUnitSubjects.map(subject => ({
      ...subject,
      units: subject.units.map(unit => unit.id === unitId ? { ...unit, label: nextLabel } : unit)
    }));
    updateLegacyState({ standardUnitSubjects: updated }, () => saveStandardUnitSubjects('표준단원명 수정 완료'));
  };

  const handleAddStandardUnit = async () => {
    const subjectCode = selectedStandardSubjectCode;
    const label = String(standardUnitNewName || '').trim();
    if (!subjectCode || !label) {
      showModalAlert('추가할 표준단원명을 입력해주세요.');
      return;
    }
    const generatedId = `${subjectCode}_custom_${uid()}`;
    const updated = state.standardUnitSubjects.map(subject => {
      if (subject.code !== subjectCode) return subject;
      const units = subject.units.filter(unit => unit.active !== false);
      const maxOrder = units.length + 1;
      const requestedOrder = Number(standardUnitInsertOrder);
      const insertOrder = Number.isFinite(requestedOrder)
        ? Math.min(Math.max(1, Math.round(requestedOrder)), maxOrder)
        : maxOrder;
      const reorderedUnits = subject.units.map(unit => ({
        ...unit,
        order: Number(unit.order || 0) >= insertOrder ? Number(unit.order || 0) + 1 : Number(unit.order || 0)
      }));
      return {
        ...subject,
        units: [
          ...reorderedUnits,
          { id: generatedId, label, order: insertOrder, active: true }
        ]
      };
    });
    setStandardUnitNewName('');
    setStandardUnitInsertOrder('');
    updateLegacyState({ standardUnitSubjects: updated }, () => saveStandardUnitSubjects('표준단원 추가 완료'));
  };

  const handleDeleteStandardUnit = async (unitId) => {
    const confirmed = await showModalConfirm('해당 표준단원을 삭제하시겠습니까?\n(이미 등록된 교재 단원에 영향이 갈 수 있으므로 화면에서만 비활성화됩니다.)');
    if (!confirmed) return;

    const updated = state.standardUnitSubjects.map(subject => ({
      ...subject,
      units: subject.units.map(unit => unit.id === unitId ? { ...unit, active: false } : unit)
    }));
    updateLegacyState({ standardUnitSubjects: updated }, () => saveStandardUnitSubjects('표준단원 삭제 완료'));
  };

  // 9. Remark Templates CRUD
  const handleLocalTemplatesTextareaChange = (key, field, val) => {
    setLocalRemarkTemplates(prev => {
      return prev.map(row => {
        if (row.key !== key) return row;
        return {
          ...row,
          [field]: val.split('\n').map(v => v.trim()).filter(Boolean)
        };
      });
    });
  };

  const handleSaveRemarkTemplates = async () => {
    const { db } = await getFirebaseService();
    const finalTemplates = normalizeRemarkTemplates(localRemarkTemplates);
    await setDoc(doc(db, COLLECTION_NAMES.configs, 'remark_templates'), {
      templates: finalTemplates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    notify('대표 특이사항 문구 저장 완료');
  };

  // 10. Book Purge CRUD
  const handleDeleteBook = async (bookId) => {
    const { db } = await getFirebaseService();
    const b = books.find(item => item.id === bookId);
    if (!b) return;

    const confirmed = await showModalConfirm(`교재 '${b.title}' 자산을 완전히 영구 삭제하시겠습니까?\n보관 처리가 아닌 영구 제거입니다.`);
    if (!confirmed) return;

    await deleteDoc(doc(db, COLLECTION_NAMES.books, bookId));
    notify('교재 삭제 완료');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="card-3d rounded-2xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-white">포털 종합 관리자 센터</h2>
          <p className="text-xs text-slate-500 mt-1">강사 계정, 개설 학급, 모바일 인트로 텍스트 설정 등을 변경합니다. 실시간으로 반영됩니다.</p>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 font-extrabold">MASTER ADMIN</span>
      </div>

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        
        {/* LEFT COLUMN Accordions */}
        <div className="space-y-6">
          {/* Card 1: 강사 계정 및 목록 관리 */}
          <AdminAccordion
            id="teachers"
            title="강사 계정 및 목록 관리"
            subtitle="강사 계정 추가, 수정, 삭제 및 PIN 관리"
            open={!!adminCardExpanded.teachers}
            onToggle={() => toggleCard('teachers')}
          >
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <label className="block text-xs font-bold text-slate-400">강사 이름
                  <input
                    id="adminTeacherName"
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none"
                    placeholder="이름 입력"
                    value={adminTeacherForm.name}
                    onChange={(e) => setAdminTeacherForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-400">PIN 6자리
                  <input
                    id="adminTeacherPin"
                    maxLength={6}
                    inputMode="numeric"
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none font-mono"
                    placeholder="비밀번호(6자리)"
                    value={adminTeacherForm.pin}
                    onChange={(e) => setAdminTeacherForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-400">권한 선택
                  <select
                    id="adminTeacherRole"
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-350 mt-1.5 focus:outline-none"
                    value={adminTeacherForm.role}
                    onChange={(e) => setAdminTeacherForm(prev => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="teacher">teacher (일반 강사)</option>
                    <option value="admin">admin (최고 관리자)</option>
                  </select>
                </label>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => { setAdminTeacherForm({ id: '', name: '', pin: '', role: 'teacher' }); setAdminTeacherEditId(''); }} className="ghost-button rounded-xl px-4 py-2.5 text-xs font-extrabold">신규 생성</button>
                <button type="button" onClick={handleSaveAdminTeacher} className={`${btnClass} rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-md`}>저장/수정</button>
                <button type="button" onClick={() => { setAdminTeacherForm({ id: '', name: '', pin: '', role: 'teacher' }); setAdminTeacherEditId(''); }} className="ghost-button rounded-xl px-4 py-2.5 text-xs font-extrabold">초기화</button>
                {adminTeacherEditId && <button type="button" onClick={() => handleRemoveAdminTeacher(adminTeacherEditId)} className="rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2.5 text-xs font-extrabold hover:bg-rose-500 hover:text-white transition-all">삭제</button>}
              </div>
              
              <p className="text-[10px] text-slate-500">기본 admin 계정은 시스템 보호를 위해 삭제할 수 없으며, 강사의 경우 담당하고 있는 학급이 존재하면 삭제가 불가합니다.</p>
              
              <div className="border-t border-slate-850 pt-4 mt-2">
                <h4 className="text-xs font-extrabold text-slate-300 mb-3">현재 등록된 강사 목록 <span className="text-[10px] text-slate-550 font-normal">(수정하려면 강사를 클릭하세요)</span></h4>
                <div className="grid md:grid-cols-2 gap-3 max-h-56 overflow-y-auto mini-scroll pr-1">
                  {teachers.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko')).map(t => (
                    <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/10 p-3.5 flex justify-between items-start gap-2">
                      <div>
                        <div className="font-extrabold text-xs text-slate-200">{t.name}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-mono">PIN: {t.pin || '-'} &middot; 권한: {t.role}</div>
                      </div>
                      <button type="button" onClick={() => handleEditTeacherClick(t)} className="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 text-[10px] font-bold">수정</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AdminAccordion>

          {/* Card 2: 반 삭제 관리 */}
          <AdminAccordion
            id="classes"
            title="반 삭제 관리"
            subtitle="개설된 학급의 영구 삭제 통제"
            open={!!adminCardExpanded.classes}
            onToggle={() => toggleCard('classes')}
          >
            <div className="space-y-3">
              <div className="space-y-2 max-h-64 overflow-y-auto mini-scroll pr-1">
                {classes.length ? classes.map(c => (
                  <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-extrabold text-slate-200">{c.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{c.grade || '-'} &middot; 담당 강사: {teacherNameById(c.teacherId)}</div>
                    </div>
                    <button type="button" onClick={() => handleDeleteClass(c.id)} className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all">반 삭제</button>
                  </div>
                )) : <div className="text-xs text-slate-500 py-4 text-center">개설된 반이 없습니다.</div>}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">학급 내에 배정된 학생이 남아 있으면 해당 반은 삭제되지 않습니다. 학생 목록을 먼저 정리해주세요.</p>
            </div>
          </AdminAccordion>

          {/* Card 3: 신규생 등록 요청 확인 및 승인 */}
          <AdminAccordion
            id="studentRequests"
            title="신규생 등록 요청 확인 및 승인"
            subtitle={pendingRequests.length ? `${pendingRequests.length}건 신청 대기` : '대기 요청 없음'}
            alert={pendingRequests.length > 0}
            badgeText={pendingRequests.length ? `${pendingRequests.length}건` : ''}
            open={!!adminCardExpanded.studentRequests}
            onToggle={() => toggleCard('studentRequests')}
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 px-4 py-3">
                <div className="text-xs font-extrabold text-violet-200">신규생 등록 요청 대기 {pendingRequests.length}건</div>
                <div className="text-[10px] text-slate-550 mt-1">학생/학부모 등록 요청을 확인한 뒤 기존 학생 데이터로 승인합니다.</div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto mini-scroll pr-1">
                {pendingRequests.length ? pendingRequests.map(req => (
                  <div key={req.id} className="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-extrabold text-slate-100">{req.name || '이름 없음'}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{req.school || '-'} &middot; {req.grade || classByName(req.classId) || '-'} &middot; 요청 반: {classByName(req.classId)}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => handleApproveRequest(req.id)} className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all">승인</button>
                      <button type="button" onClick={() => handleRejectRequest(req.id)} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-750 transition-all">보류</button>
                    </div>
                  </div>
                )) : <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-8 text-center text-xs text-slate-500">대기 중인 신규생 등록 요청이 없습니다.</div>}
              </div>
            </div>
          </AdminAccordion>

          {/* Card 4: 학생 관리 */}
          <AdminAccordion
            id="studentManagement"
            title="학생 관리"
            subtitle="반 수정, 퇴원, 삭제"
            open={!!adminCardExpanded.studentManagement}
            onToggle={() => toggleCard('studentManagement')}
          >
            <div className="space-y-3">
              <div className="text-[10px] text-slate-500">학생별 소속 반 수정, 퇴원 처리, 삭제 표시를 진행합니다. 점검 기록은 별도 보존됩니다.</div>
              <div className="space-y-2 max-h-96 overflow-y-auto mini-scroll pr-1">
                {managedStudents.length ? managedStudents.map(s => (
                  <div key={s.id} className={`rounded-xl border ${s.status === 'withdrawn' ? 'border-amber-500/30 bg-amber-950/10' : 'border-slate-800 bg-slate-900/20'} px-4 py-3 text-xs`}>
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAdminStudentIds.has(s.id)}
                          onChange={() => handleToggleStudentSelect(s.id)}
                        />
                        <span>
                          <span className="font-extrabold text-slate-100">{s.name}</span>
                          <span className="text-[10px] text-slate-500 ml-2">{s.school || '-'} &middot; {s.grade || '-'} &middot; {classByName(s.classId)}</span>
                          {s.status === 'withdrawn' && <span className="ml-2 text-[10px] text-amber-300 font-black">퇴원</span>}
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <select
                          id={`adminStudentClass-${s.id}`}
                          defaultValue={s.classId}
                          className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-200 outline-none"
                        >
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.grade || '-'})</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-bold text-slate-400">
                          PIN
                          <input
                            id={`adminStudentPin-${s.id}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            className="w-14 bg-transparent text-center text-slate-100 outline-none font-mono font-bold"
                            defaultValue={s.pin || '1234'}
                            onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); }}
                          />
                        </label>
                        <button type="button" onClick={() => handleAdminStudentPinUpdate(s.id)} className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition-colors">PIN 저장</button>
                        <button type="button" onClick={() => handleAdminStudentClassUpdate(s.id)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:bg-slate-700 transition-colors">반 수정</button>
                        <button type="button" onClick={() => handleAdminStudentWithdraw(s.id)} className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500 hover:text-white transition-colors">퇴원</button>
                        <button type="button" onClick={() => handleAdminStudentDelete(s.id)} className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500 hover:text-white transition-colors">삭제</button>
                      </div>
                    </div>
                  </div>
                )) : <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-8 text-center text-xs text-slate-500">관리할 학생 데이터가 없습니다.</div>}
              </div>
            </div>
          </AdminAccordion>

          {/* Card 5: 로그인 & 스플래시 화면 설정 */}
          <AdminAccordion
            id="loginSplash"
            title="로그인 & 스플래시 화면 설정"
            subtitle="모바일 메인 인트로 및 테마 칼라/폰트 설정"
            open={!!adminCardExpanded.loginSplash}
            onToggle={() => toggleCard('loginSplash')}
          >
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="block text-xs font-bold text-slate-400">스플래시 메인 대제목
                  <input
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none"
                    placeholder="예: 열린학원 교재점검"
                    value={adminLoginConfigForm.splashTitleLine1}
                    onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, splashTitleLine1: e.target.value }))}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-400">스플래시 강조 타이틀
                  <input
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none"
                    placeholder="예: OATIS"
                    value={adminLoginConfigForm.splashTitleLine2}
                    onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, splashTitleLine2: e.target.value }))}
                  />
                </label>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <label className="block text-xs font-bold text-slate-400">메인 대제목 글자 크기
                  <select
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-300 mt-1.5 focus:outline-none"
                    value={adminLoginConfigForm.splashTitleSizeLine1 || '38px'}
                    onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, splashTitleSizeLine1: e.target.value }))}
                  >
                    {['24px', '28px', '32px', '38px', '44px', '50px'].map(sz => (
                      <option key={sz} value={sz}>{sz} {sz === '38px' ? '(기본)' : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-400">강조 타이틀 글자 크기
                  <select
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-300 mt-1.5 focus:outline-none"
                    value={adminLoginConfigForm.splashTitleSizeLine2 || '54px'}
                    onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, splashTitleSizeLine2: e.target.value }))}
                  >
                    {['32px', '40px', '48px', '54px', '60px', '70px'].map(sz => (
                      <option key={sz} value={sz}>{sz} {sz === '54px' ? '(기본)' : ''}</option>
                    ))}
                  </select>
                </label>
              </div>
              
              <label className="block text-xs font-bold text-slate-400">소제목 (영문 또는 요약 설명)
                <input
                  className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none"
                  placeholder="Open Academy Textbook Insight System"
                  value={adminLoginConfigForm.splashSubtitle}
                  onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, splashSubtitle: e.target.value }))}
                />
              </label>
              
              <label className="block text-xs font-bold text-slate-400">시스템 상세 소개글 (HTML 사용 가능)
                <textarea
                  className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white h-20 mt-1.5 leading-relaxed focus:outline-none resize-y"
                  placeholder="설명 문구"
                  value={adminLoginConfigForm.splashDescription}
                  onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, splashDescription: e.target.value }))}
                />
              </label>

              <div className="border-t border-slate-800/80 pt-4 space-y-3">
                <div className="text-xs font-black text-cyan-200">현재 첫 화면 문구</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block text-xs font-bold text-slate-400">상단 작은 문구
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.splashKicker || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, splashKicker: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-bold text-slate-400">포털 배지 문구
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.gatewayBadge || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, gatewayBadge: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-bold text-slate-400">포털 선택 제목
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.gatewayTitle || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, gatewayTitle: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-bold text-slate-400">포털 선택 설명
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.gatewayDescription || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, gatewayDescription: e.target.value }))} />
                  </label>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <label className="block text-xs font-bold text-slate-400">학생 포털 제목
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.studentPortalTitle || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, studentPortalTitle: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-bold text-slate-400">강사 포털 제목
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.teacherPortalTitle || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, teacherPortalTitle: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-bold text-slate-400">관리자 포털 제목
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.adminPortalTitle || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, adminPortalTitle: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-bold text-slate-400">학생 포털 설명
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.studentPortalDescription || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, studentPortalDescription: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-bold text-slate-400">강사 포털 설명
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.teacherPortalDescription || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, teacherPortalDescription: e.target.value }))} />
                  </label>
                  <label className="block text-xs font-bold text-slate-400">관리자 포털 설명
                    <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" value={adminLoginConfigForm.adminPortalDescription || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, adminPortalDescription: e.target.value }))} />
                  </label>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <label className="block text-xs font-bold text-slate-400">로그인 카드 제목
                  <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="빠른 PIN 로그인" value={adminLoginConfigForm.loginTitle || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, loginTitle: e.target.value }))} />
                </label>
                <label className="block text-xs font-bold text-slate-400">로그인 카드 안내문구
                  <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="선생님을 선택하고 6자리 PIN을 입력하세요." value={adminLoginConfigForm.loginDescription || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, loginDescription: e.target.value }))} />
                </label>
              </div>
              
              <label className="block text-xs font-bold text-slate-400">포털 로그인 최하단 정보 텍스트
                <input className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="초기 로그인 계정은 관리자 설정에서 관리됩니다." value={adminLoginConfigForm.loginInfoText || ''} onChange={e => setAdminLoginConfigForm(prev => ({ ...prev, loginInfoText: e.target.value }))} />
              </label>

              {/* Color configurations */}
              <div className="border-t border-slate-800/80 pt-4 mt-2">
                <span className="text-xs font-bold text-slate-400 block mb-2">첫 화면 색상</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    ['splashTitleColor', '큰 제목 색상'],
                    ['splashTextColor', '본문 글자 색상'],
                    ['splashMutedColor', '보조 글자 색상'],
                    ['portalHoverGlowColor', '포털 hover 빛 색상']
                  ].map(([id, label]) => (
                    <label key={id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-[10px] font-bold text-slate-400">
                      {label}
                      <input
                        type="color"
                        className="mt-2 block h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent"
                        value={adminLoginConfigForm[id] || '#ffffff'}
                        onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, [id]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
                
                <span className="text-xs font-bold text-slate-400 block mb-2">오로라 배경 색상</span>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    ['auroraColor1', '오로라 1'],
                    ['auroraColor2', '오로라 2'],
                    ['auroraColor3', '오로라 3']
                  ].map(([id, label]) => (
                    <label key={id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-[10px] font-bold text-slate-400">
                      {label}
                      <input
                        type="color"
                        className="mt-2 block h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent"
                        value={adminLoginConfigForm[id] || '#00d6cd'}
                        onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, [id]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>

                <span className="text-xs font-bold text-slate-400 block mb-2">전역 대표 색상</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 border border-slate-800 rounded-xl p-2 bg-slate-900">
                    <input
                      type="color"
                      className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                      value={adminLoginConfigForm.primaryColor || '#8436ff'}
                      onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                    />
                    <span className="text-xs font-mono font-bold text-slate-300">{adminLoginConfigForm.primaryColor || '#8436ff'}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: '네온 퍼플 (관리자)', color: '#8436ff' },
                      { name: '로열 블루 (교사)', color: '#4169e1' },
                      { name: '민트 그린 (학생)', color: '#00d6cd' },
                      { name: '우주 바이올렛', color: '#6366f1' },
                      { name: '블랙홀 스틸', color: '#334155' }
                    ].map(preset => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setAdminLoginConfigForm(prev => ({ ...prev, primaryColor: preset.color }))}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                          adminLoginConfigForm.primaryColor === preset.color
                            ? 'bg-slate-800 border-slate-650 text-white'
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fonts Configuration */}
              <div className="border-t border-slate-800/80 pt-4 grid md:grid-cols-2 gap-4">
                <label className="block text-xs font-bold text-slate-400">기본 시스템 글꼴(Font Family)
                  <select
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-350 mt-1.5 focus:outline-none"
                    value={adminLoginConfigForm.fontFamily}
                    onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, fontFamily: e.target.value }))}
                  >
                    <option value="'SUIT', sans-serif">SUIT (기본 고딕)</option>
                    <option value="'Pretendard', sans-serif">Pretendard (깔끔한 본문체)</option>
                    <option value="'GmarketSansMedium', sans-serif">지마켓 산스 (타이틀 체)</option>
                    <option value="'Gowun Batang', serif">고운 바탕 (세리프체)</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-400">전체 웹 글자 크기 비율
                  <select
                    className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-355 mt-1.5 focus:outline-none"
                    value={adminLoginConfigForm.fontScale || '1.0'}
                    onChange={(e) => setAdminLoginConfigForm(prev => ({ ...prev, fontScale: e.target.value }))}
                  >
                    <option value="0.9">작게 (90%)</option>
                    <option value="1.0">기본 크기 (100%)</option>
                    <option value="1.1">조금 크게 (110%)</option>
                    <option value="1.2">아주 크게 (120%)</option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button type="button" onClick={handleSaveLoginConfig} className={`${btnClass} rounded-xl px-5 py-3 text-xs font-extrabold shadow-md`}>설정 변경 저장</button>
              </div>
            </div>
          </AdminAccordion>
        </div>
        
        {/* RIGHT COLUMN Accordions */}
        <div className="space-y-6">
          {/* Card 6: 학생 일괄 승급 복제 */}
          <AdminAccordion
            id="bulkStudentEdit"
            title="학생 일괄 승급 복제"
            subtitle="기존 기록 보존 후 새 학생 생성"
            open={!!adminCardExpanded.bulkStudentEdit}
            onToggle={() => toggleCard('bulkStudentEdit')}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-xs text-slate-300">
                선택된 학생 <span className="font-black text-violet-300">{selectedAdminStudentIds.size}명</span>을 새 학년/새 반 학생으로 복제 생성합니다. 기존 학생과 기록은 그대로 보존됩니다.
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-400 mb-2">새 학년 선택</div>
                  <div className="flex flex-wrap gap-1.5">
                    {promotionGrades.map(grade => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setAdminPromotionGrade(grade)}
                        className={`rounded-lg border px-3 py-2 text-xs font-black transition-all ${adminPromotionGrade === grade ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-violet-500/60 hover:text-white'}`}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 mb-2">새 반 선택</div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {classes.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setAdminPromotionClassId(c.id);
                          if (c.grade) setAdminPromotionGrade(c.grade);
                        }}
                        className={`rounded-xl border px-3 py-3 text-left transition-all ${adminPromotionClassId === c.id ? 'border-violet-500 bg-violet-500/20 text-white' : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-violet-500/60 hover:text-white'}`}
                      >
                        <span className="block text-xs font-black">{c.name}</span>
                        <span className="block text-[10px] mt-1 text-slate-500">{c.grade || '-'} · {teacherNameById(c.teacherId)}T</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" onClick={handleRunPromotionClone} className={`${btnClass} rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-md`}>선택 학생 승급 복제 실행</button>
            </div>
          </AdminAccordion>

          {/* Card 7: 퇴원 학생 자동 삭제 준비 */}
          <AdminAccordion
            id="studentRetention"
            title="퇴원 학생 자동 삭제 준비"
            subtitle="3개월 후 삭제 배치 구조"
            open={!!adminCardExpanded.studentRetention}
            onToggle={() => toggleCard('studentRetention')}
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3">
                <div className="text-xs font-extrabold text-amber-200">퇴원 학생 {withdrawnStudents.length}명</div>
                <div className="text-[10px] text-slate-500 mt-1">퇴원 처리된 학생은 삭제 예정일이 지나면 정리 대상이 됩니다. 현재는 관리자 버튼으로 실행하는 배치 구조입니다.</div>
              </div>
              <button type="button" onClick={handlePurgeWithdrawn} className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-xs font-extrabold text-rose-300 hover:bg-rose-500 hover:text-white transition-all">삭제 예정일 지난 퇴원 학생 정리</button>
              <div className="space-y-2 max-h-52 overflow-y-auto mini-scroll pr-1">
                {withdrawnStudents.length ? withdrawnStudents.map(s => (
                  <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3 text-xs">
                    <div className="font-extrabold text-slate-100">{s.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1">삭제 예정일: {formatMaybeDate(s.deleteAfter)}</div>
                  </div>
                )) : <div className="text-xs text-slate-500 py-4 text-center">퇴원 처리된 학생이 없습니다.</div>}
              </div>
            </div>
          </AdminAccordion>

          {/* Card 8: 교과목별 표준 소단원 관리 */}
          <AdminAccordion
            id="standardUnits"
            title="교과목별 표준 소단원 관리"
            subtitle="단원 ID 수정/추가"
            open={!!adminCardExpanded.standardUnits}
            onToggle={() => toggleCard('standardUnits')}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 px-4 py-3">
                <div className="text-xs font-extrabold text-cyan-200">교과목별 표준 소단원 ID 관리</div>
                <div className="text-[10px] text-slate-500 mt-1">표준단원명을 수정하면 해당 ID에 연결된 교재 단원 표시명도 함께 바뀝니다.</div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {state.standardUnitSubjects.map(subject => (
                  <button
                    key={subject.code}
                    type="button"
                    onClick={() => {
                      setSelectedStandardSubjectCode(subject.code);
                      setStandardUnitNewName('');
                      setStandardUnitInsertOrder('');
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black transition-all ${selectedStandardSubjectCode === subject.code ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-cyan-500/60 hover:text-cyan-200'}`}
                  >
                    {subject.label}
                  </button>
                ))}
              </div>

              {selectedStandardSubject ? (
                <>
                  <div className="space-y-2 max-h-80 overflow-y-auto mini-scroll pr-1">
                    {selectedStandardSubject.units.filter(unit => unit.active !== false).map((unit, index) => (
                      <div key={unit.id} className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2.5 text-xs">
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                          <span className="w-7 shrink-0 text-[10px] font-black text-slate-500">{index + 1}</span>
                          <input id={`standardUnitName-${unit.id}`} className="flex-1 rounded-lg border border-slate-800 bg-slate-955 px-3 py-2 text-xs text-slate-100 outline-none" defaultValue={unit.label} />
                          <button type="button" onClick={() => handleSaveStandardUnitName(unit.id)} className="rounded-lg bg-cyan-500/10 border border-cyan-500/25 px-3 py-2 text-[10px] font-black text-cyan-200 hover:bg-cyan-505 hover:text-slate-950 transition-colors">수정 저장</button>
                          <button type="button" onClick={() => handleDeleteStandardUnit(unit.id)} className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[10px] font-black text-rose-400 hover:bg-rose-500 hover:text-white transition-colors">삭제</button>
                        </div>
                        <div className="mt-1.5 pl-0 md:pl-9 text-[9px] font-mono text-slate-600">{unit.id}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                    <div className="grid md:grid-cols-[120px_1fr] gap-3">
                      <label className="block text-xs font-bold text-slate-400">삽입 번호
                        <input
                          id="standardUnitInsertOrder"
                          type="number"
                          min="1"
                          max={selectedStandardSubject.units.filter(unit => unit.active !== false).length + 1}
                          className="w-full mt-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none"
                          placeholder="예: 7"
                          value={standardUnitInsertOrder}
                          onChange={(e) => setStandardUnitInsertOrder(e.target.value.replace(/\D/g, ''))}
                        />
                      </label>
                      <label className="block text-xs font-bold text-slate-400">새 표준단원 추가 ({selectedStandardSubject.label})
                        <input
                          id="standardUnitNewName"
                          className="w-full mt-2 rounded-xl border border-slate-800 bg-slate-955 px-3 py-2.5 text-xs text-slate-100 outline-none"
                          placeholder="예: 멋진단원"
                          value={standardUnitNewName}
                          onChange={(e) => setStandardUnitNewName(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500">번호를 비우면 마지막에 추가됩니다. 예: 7번에 넣으면 기존 7번부터 자동으로 한 칸씩 밀립니다.</div>
                    <button type="button" onClick={handleAddStandardUnit} className={`${btnClass} mt-3 rounded-xl px-4 py-2.5 text-xs font-extrabold`}>표준단원 추가</button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-955/20 px-4 py-8 text-center text-xs text-slate-500">표준단원 정보가 없습니다.</div>
              )}
            </div>
          </AdminAccordion>

          {/* Card 9: 대표 특이사항 문구 관리 */}
          <AdminAccordion
            id="remarkTemplates"
            title="대표 특이사항 문구 관리"
            subtitle="6요소별 긍정/평이/부정 문구"
            open={!!adminCardExpanded.remarkTemplates}
            onToggle={() => toggleCard('remarkTemplates')}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 px-4 py-3">
                <div className="text-xs font-extrabold text-cyan-200">대표 특이사항 문구 관리</div>
                <div className="text-[10px] text-slate-500 mt-1">각 칸에 한 줄에 한 문장씩 입력하세요. 줄을 지우면 삭제, 새 줄을 추가하면 문구가 추가됩니다.</div>
              </div>
              
              <div className="overflow-x-auto mini-scroll">
                <div className="min-w-[760px] space-y-2">
                  <div className="grid grid-cols-[0.28fr_1fr_1fr_1fr] gap-2 px-2 text-[10px] font-black text-slate-500">
                    <div>6요소</div>
                    {REMARK_TONES.map(tone => <div key={tone.key}>{tone.label}</div>)}
                  </div>
                  {localRemarkTemplates.map(row => (
                    <div key={row.key} className="grid grid-cols-[0.28fr_1fr_1fr_1fr] gap-2 rounded-xl border border-slate-800 bg-slate-950/20 p-2">
                      <div className="flex items-center rounded-lg bg-slate-900/70 px-2.5 py-2 text-[10px] font-black text-slate-200 select-none">
                        {row.label}
                      </div>
                      {REMARK_TONES.map(tone => (
                        <textarea
                          key={tone.key}
                          id={`remarkTemplate-${row.key}-${tone.key}`}
                          className="min-h-[84px] rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-[10px] leading-5 text-slate-200 outline-none focus:border-cyan-500"
                          value={(row[tone.key] || []).join('\n')}
                          onChange={(e) => handleLocalTemplatesTextareaChange(row.key, tone.key, e.target.value)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={handleSaveRemarkTemplates} className={`${btnClass} rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-md`}>대표 특이사항 문구 저장</button>
              </div>
            </div>
          </AdminAccordion>

          {/* Card 10: 교재 영구 삭제 통제 */}
          <AdminAccordion
            id="books"
            title="교재 영구 삭제 통제"
            subtitle="배정이 안 된 교재 자산의 영구 삭제"
            open={!!adminCardExpanded.books}
            onToggle={() => toggleCard('books')}
          >
            <div className="space-y-3">
              <div className="space-y-2 max-h-64 overflow-y-auto mini-scroll pr-1">
                {books.filter(b => !b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko')).map(b => (
                  <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-extrabold text-slate-200">{b.title}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{b.subject || '-'} &middot; {b.grade || '-'}</div>
                    </div>
                    <button type="button" onClick={() => handleDeleteBook(b.id)} className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all">영구 삭제</button>
                  </div>
                ))}
                {books.filter(b => !b.archived).length === 0 && <div className="text-xs text-slate-500 py-4 text-center">삭제 가능한 활성 교재가 없습니다.</div>}
              </div>
              <p className="text-[10px] text-slate-550 mt-1">학원 자산으로서 영구 삭제를 실행합니다. 교재를 임시로 숨기고 보존하시려면 "반 세팅 &gt; 교재 관리"에서 <b>보관</b> 기능을 활용하세요.</p>
            </div>
          </AdminAccordion>
        </div>

      </div>

    </div>
  );
}
