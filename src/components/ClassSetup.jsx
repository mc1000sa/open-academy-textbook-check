import React, { useState, useMemo } from 'react';
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

// Chip Select Button Component
function BtnSelect({ id, options, selectedValue, onChange, placeholder = '선택사항이 없습니다.' }) {
  if (!options || options.length === 0) {
    return <div className="text-xs text-slate-500 p-2 font-bold">{placeholder}</div>;
  }
  return (
    <div className="choice-grid" id={id}>
      {options.map(opt => {
        const active = String(opt.value) === String(selectedValue);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`choice-button btn-choice-teacher ${active ? 'selected' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Accordion Wrapper Component
function AccordionItem({ id, title, icon, colorClass, isOpen, onToggle, children }) {
  return (
    <div className={`rounded-[28px] border transition-all duration-300 ${isOpen ? 'border-cyan-500/40 ring-1 ring-cyan-500/20 bg-slate-900/40 shadow-xl' : 'border-slate-800 bg-slate-900/20 shadow-sm hover:border-slate-700'} mb-6`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-800/50 transition-colors rounded-[28px] outline-none focus:outline-none"
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-xs font-black shadow-sm ${colorClass}`}>
            <i className={`fas ${icon}`}></i>
          </div>
          <span className="font-black text-slate-100 text-[15px]">{title}</span>
        </div>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? 'bg-cyan-600 text-white rotate-180' : 'bg-slate-800 text-slate-400'}`}>
          <i className="fas fa-chevron-down text-[10px]"></i>
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="h-px bg-slate-800 mb-5"></div>
          {children}
        </div>
      )}
    </div>
  );
}

export default function ClassSetup({
  state,
  teachers,
  classes,
  students,
  allStudents,
  studentRequests,
  updateLegacyState,
  deps
}) {
  const {
    showModalAlert,
    showModalConfirm,
    showModalPrompt,
    notify
  } = deps;

  const GRADE_OPTIONS = ['고1', '고2', '고3'];
  const isAdmin = state.currentTeacher?.role === 'admin';
  const btnClass = isAdmin ? 'btn-admin' : 'btn-teacher';

  const teacherClasses = useMemo(() => {
    return classes.filter(c => c.teacherId === state.currentTeacher.id);
  }, [classes, state.currentTeacher]);

  const availableClasses = useMemo(() => {
    return isAdmin ? classes : teacherClasses;
  }, [classes, teacherClasses, isAdmin]);

  const teacherOptions = useMemo(() => {
    return teachers.filter(t => t.active !== false && t.role !== 'admin');
  }, [teachers]);

  const selectedClass = useMemo(() => {
    return classes.find(c => c.id === state.selectedSetupClassId) || null;
  }, [classes, state.selectedSetupClassId]);

  const selectedStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => s.classId === selectedClass.id && s.active !== false);
  }, [students, selectedClass]);

  // UI state
  const [setupAccordion, setSetupAccordion] = useState({ class: true, bulk: false, edit: false });
  const [setupFormClass, setSetupFormClass] = useState({ id: '', name: '', grade: '', teacherId: '', note: '' });
  
  const [studentBulkText, setStudentBulkText] = useState('');
  const [studentBulkMode, setStudentBulkMode] = useState('nameSchool');
  
  const [existingStudentSearch, setExistingStudentSearch] = useState('');
  const [selectedExistingStudentId, setSelectedExistingStudentId] = useState('');
  
  const [setupSearchClass, setSetupSearchClass] = useState('');
  const [setupSearchStudent, setSetupSearchStudent] = useState('');

  // 1. Helpers
  const teacherNameById = (id) => {
    return teachers.find(t => t.id === id)?.name || '-';
  };

  const classById = (id) => {
    return classes.find(c => c.id === id) || null;
  };

  const findDuplicateStudentName = (classId, name, school = '') => {
    return students.find(s => s.classId === classId && String(s.name || '').trim() === String(name || '').trim() && String(s.school || '').trim() === String(school || '').trim() && s.active !== false);
  };

  const existingStudentProfilesForClass = (classId) => {
    const seen = new Set();
    return students
      .filter(s => s.active !== false && s.classId !== classId)
      .filter(s => {
        const key = `${String(s.name || '').trim()}__${String(s.school || '').trim()}__${String(s.grade || '').trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  };

  const filterByKeyword = (rows, keyword, getter) => {
    const q = String(keyword || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row => String(getter(row) || '').toLowerCase().includes(q));
  };

  // 2. Class CRUD
  const handleSaveClass = async () => {
    const { db, refs } = await getFirebaseService();
    const f = setupFormClass;
    if (!f.name || !f.teacherId || !f.grade) {
      showModalAlert('반 이름, 학년, 담당 강사를 입력해주세요.');
      return;
    }

    if (f.id) {
      await updateDoc(doc(refs.classes, f.id), { name: f.name, teacherId: f.teacherId, grade: f.grade, note: '' });
      updateLegacyState({ selectedSetupClassId: f.id });
      notify('반 수정 완료');
    } else {
      const ref = await addDoc(refs.classes, { name: f.name, teacherId: f.teacherId, grade: f.grade, note: '', active: true, createdAt: serverTimestamp() });
      updateLegacyState({
        selectedSetupClassId: ref.id,
        assigningClassId: ref.id,
        selectedInspectionClassId: ref.id,
        quickClassId: ref.id,
        reportClassId: ref.id
      });
      notify('반 생성 완료');
    }

    setSetupFormClass({ id: '', name: '', grade: '', teacherId: '', note: '' });
  };

  const handleEditClassClick = (c) => {
    setSetupFormClass({ id: c.id, name: c.name, grade: c.grade, teacherId: c.teacherId, note: c.note || '' });
    updateLegacyState({ selectedSetupClassId: c.id });
    setSetupAccordion(prev => ({ ...prev, class: true }));
  };

  const handleRemoveClass = async (classId) => {
    const { refs } = await getFirebaseService();
    const confirmed = await showModalConfirm('이 반을 정말로 삭제하시겠습니까?\n(반에 속한 학생들은 삭제되지 않으며 설정 정보만 제거됩니다.)');
    if (!confirmed) return;
    
    // Check if students are in the class
    const inClass = students.filter(s => s.classId === classId && s.active !== false);
    if (inClass.length > 0) {
      showModalAlert('반에 소속된 활성 학생이 존재하여 삭제할 수 없습니다.\n학생들을 다른 반으로 옮기거나 삭제한 후 진행해주세요.');
      return;
    }

    await deleteDoc(doc(refs.classes, classId));
    notify('반 삭제 완료');
  };

  // 3. Student Bulk / Clone Add
  const parseStudentBulkText = (text, mode) => {
    return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      if (mode === 'nameOnly') return { name: line, school: '' };
      const parts = line.split('/').map(v => v.trim());
      return { name: parts[0] || '', school: parts[1] || '' };
    }).filter(item => item.name);
  };

  const handleSaveStudentsBulk = async () => {
    const { db, refs } = await getFirebaseService();
    const classId = state.selectedSetupClassId;
    const klass = classById(classId);
    if (!klass) {
      showModalAlert('먼저 반을 선택하거나 생성해주세요.');
      return;
    }
    const rawText = String(studentBulkText || '').trim();
    if (!rawText) {
      showModalAlert('학생 명단을 입력해주세요.');
      return;
    }
    const rows = parseStudentBulkText(rawText, studentBulkMode).filter(row => String(row.name || '').trim());
    if (!rows.length) {
      showModalAlert('입력 형식을 확인해주세요. (예: 홍길동 / 학교)');
      return;
    }

    const batch = writeBatch(db);
    let addCount = 0;
    rows.forEach(row => {
      const cleanName = String(row.name || '').trim();
      const cleanSchool = String(row.school || '').trim();
      if (!cleanName) return;
      if (findDuplicateStudentName(classId, cleanName, cleanSchool)) return;
      const newRef = doc(refs.students);
      batch.set(newRef, { 
        name: cleanName, 
        school: cleanSchool, 
        grade: klass.grade, 
        classId, 
        active: true,
        status: 'active',
        studentProfileId: newRef.id,
        pin: '1234', 
        pinFailedCount: 0, 
        pinLocked: false, 
        createdAt: serverTimestamp() 
      });
      addCount++;
    });

    if (!addCount) {
      showModalAlert('이미 등록되어 있거나 추가할 학생이 없습니다.');
      return;
    }

    await batch.commit();
    setStudentBulkText('');
    notify(`학생 ${addCount}명 등록 완료`);
  };

  const handleAddExistingStudent = async () => {
    const { refs } = await getFirebaseService();
    const classId = state.selectedSetupClassId;
    const klass = classById(classId);
    const source = students.find(s => s.id === selectedExistingStudentId);
    if (!klass || !source) {
      showModalAlert('반과 기존 학생을 선택해주세요.');
      return;
    }
    if (findDuplicateStudentName(classId, source.name, source.school || '')) {
      showModalAlert('이미 이 반에 등록된 학생입니다.');
      return;
    }

    await addDoc(refs.students, {
      name: source.name || '',
      school: source.school || '',
      grade: klass.grade || source.grade || '',
      classId,
      active: true,
      status: 'active',
      studentProfileId: source.studentProfileId || source.id,
      pin: source.pin || '1234',
      pinFailedCount: 0,
      pinLocked: false,
      createdAt: serverTimestamp()
    });

    setSelectedExistingStudentId('');
    notify('기존 학생을 현재 반에 추가했습니다.');
  };

  const handleRemoveStudent = async (studentId) => {
    const { db } = await getFirebaseService();
    const s = students.find(x => x.id === studentId);
    if (!s) return;
    const ok = await showModalConfirm(`정말로 '${s.name}' 학생을 삭제하시겠습니까?`);
    if (!ok) return;

    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), { active: false, updatedAt: serverTimestamp() });
    
    // Clear editing inspection selection if deleted student was currently selected
    if (state.selectedInspectionStudentId === studentId) {
      updateLegacyState({ selectedInspectionStudentId: '' });
    }
    notify('학생 삭제 완료');
  };

  // 4. PIN Password settings
  const handleResetStudentPin = async (studentId) => {
    const { db } = await getFirebaseService();
    const confirmed = await showModalConfirm('이 학생의 PIN 비밀번호를 초기값(1234)으로 초기화하시겠습니까?');
    if (!confirmed) return;
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), { pin: '1234', pinFailedCount: 0, pinLocked: false, updatedAt: serverTimestamp() });
    notify('학생 PIN 비밀번호 초기화 완료');
  };

  const handleUnlockStudentPin = async (studentId) => {
    const { db } = await getFirebaseService();
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), { pinFailedCount: 0, pinLocked: false, updatedAt: serverTimestamp() });
    notify('학생 로그인 잠금 해제 완료');
  };

  const handleUpdateStudentPin = async (studentId, currentPin) => {
    const { db } = await getFirebaseService();
    const input = await showModalPrompt('새로운 학생용 4자리 PIN번호를 입력해주세요:', currentPin, 'PIN 변경');
    if (input !== null && input.trim() !== '') {
      const pinVal = input.trim().replace(/\D/g, '').slice(0, 4);
      if (!/^\d{4}$/.test(pinVal)) {
        showModalAlert('PIN번호는 4자리 숫자로 입력해야 합니다.');
        return;
      }
      await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), { pin: pinVal, pinFailedCount: 0, pinLocked: false, updatedAt: serverTimestamp() });
      notify('PIN 변경 완료');
    }
  };

  // Lists filtering
  const filteredExistingOptions = useMemo(() => {
    const baseList = existingStudentProfilesForClass(state.selectedSetupClassId);
    return filterByKeyword(baseList, existingStudentSearch, s => `${s.name} ${s.school} ${s.grade}`).map(s => ({
      value: s.id,
      label: `${s.name} (${s.school || '-'} · ${s.grade || '-'})`
    }));
  }, [students, state.selectedSetupClassId, existingStudentSearch]);

  const filteredClassesList = useMemo(() => {
    return filterByKeyword(classes, setupSearchClass, c => `${c.name} ${c.grade} ${teacherNameById(c.teacherId)}`);
  }, [classes, setupSearchClass, teachers]);

  const filteredStudentsList = useMemo(() => {
    return filterByKeyword(students, setupSearchStudent, s => `${s.name} ${s.school} ${s.grade} ${classById(s.classId)?.name || ''}`);
  }, [students, setupSearchStudent, classes]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20 pt-4">
      {/* Accordion 1: 신규 반 만들기 및 관리 */}
      <AccordionItem
        id="class"
        title="1. 신규 반 만들기 및 관리"
        icon="fa-users"
        colorClass="bg-blue-500/10 text-blue-400 border border-blue-500/20"
        isOpen={setupAccordion.class}
        onToggle={() => setSetupAccordion(prev => ({ ...prev, class: !prev.class }))}
      >
        <div className="space-y-4 text-slate-200">
          <label className="block text-xs font-bold text-slate-400">반 이름
            <input
              id="setupClassName"
              className="w-full border border-slate-700 rounded-xl p-3 bg-slate-900/50 text-xs text-white mt-1.5 focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="예: 중3 A반, 고1 특강반"
              value={setupFormClass.name}
              onChange={(e) => setSetupFormClass(prev => ({ ...prev, name: e.target.value }))}
            />
          </label>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400">학년 선택</span>
              <BtnSelect
                id="setupClassGrade"
                options={GRADE_OPTIONS.map(g => ({ value: g, label: g }))}
                selectedValue={setupFormClass.grade}
                onChange={(val) => setSetupFormClass(prev => ({ ...prev, grade: val }))}
                placeholder="학년 선택"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400">담당 강사</span>
              <BtnSelect
                id="setupClassTeacherId"
                options={teacherOptions.map(t => ({ value: t.id, label: t.name }))}
                selectedValue={setupFormClass.teacherId}
                onChange={(val) => setSetupFormClass(prev => ({ ...prev, teacherId: val }))}
                placeholder="담당 강사"
              />
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleSaveClass}
              className={`${btnClass} rounded-xl px-5 py-2.5 text-xs font-extrabold text-white hover:opacity-90 transition-opacity`}
              style={{ cursor: 'pointer' }}
            >
              {setupFormClass.id ? '반 수정 반영' : '반 생성'}
            </button>
            <button
              type="button"
              onClick={() => setSetupFormClass({ id: '', name: '', grade: '', teacherId: '', note: '' })}
              className="ghost-button border border-slate-700 text-slate-300 bg-slate-800/50 hover:bg-slate-700 rounded-xl px-5 py-2.5 text-xs font-extrabold transition-colors"
              style={{ cursor: 'pointer' }}
            >
              초기화
            </button>
          </div>
        </div>
      </AccordionItem>

      {/* Accordion 2: 학생 일괄 등록 및 복제 */}
      <AccordionItem
        id="bulk"
        title="2. 학생 일괄 등록 및 복제"
        icon="fa-user-plus"
        colorClass="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        isOpen={setupAccordion.bulk}
        onToggle={() => setSetupAccordion(prev => ({ ...prev, bulk: !prev.bulk }))}
      >
        <div className="space-y-4 text-slate-200">
          <div className="border-b border-slate-850 pb-4">
            <span className="text-xs font-bold text-slate-400 mb-2 block">학생 등록을 진행할 대상 반 선택</span>
            <BtnSelect
              id="selectedSetupClassId"
              options={availableClasses.map(c => ({ value: c.id, label: `${c.name} (${teacherNameById(c.teacherId)})` }))}
              selectedValue={state.selectedSetupClassId}
              onChange={(val) => updateLegacyState({ selectedSetupClassId: val, assigningClassId: val })}
              placeholder="선택 가능한 반이 존재하지 않습니다."
            />
          </div>

          {/* Quick Clone Existing Student */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
            <div className="text-xs font-extrabold text-slate-300 mb-3">기존 학생 검색하여 현재 반에 빠른 복제 추가</div>
            <div className="space-y-3">
              <input
                id="existingStudentSearch"
                className="w-full border border-slate-700 rounded-xl p-2.5 bg-slate-900/50 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="기존 학생 이름/학교 검색"
                value={existingStudentSearch}
                onChange={(e) => setExistingStudentSearch(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <BtnSelect
                  id="selectedExistingStudentId"
                  options={filteredExistingOptions}
                  selectedValue={selectedExistingStudentId}
                  onChange={(val) => setSelectedExistingStudentId(val)}
                  placeholder="검색 필터에 부합하는 학생이 없습니다."
                />
                <button
                  type="button"
                  onClick={handleAddExistingStudent}
                  className="rounded-xl bg-slate-700 hover:bg-slate-650 text-white font-bold px-4 py-2.5 text-xs max-w-[200px] transition-colors shadow-sm"
                  style={{ cursor: 'pointer' }}
                >
                  현재 반에 등록
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Text area / Class Students grid */}
          <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-4 mt-2">
            <div>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setStudentBulkMode('nameSchool')}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold border transition-colors ${studentBulkMode === 'nameSchool' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                >
                  이름 / 학교
                </button>
                <button
                  type="button"
                  onClick={() => setStudentBulkMode('nameOnly')}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold border transition-colors ${studentBulkMode === 'nameOnly' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                >
                  이름만
                </button>
              </div>
              <textarea
                id="wizardStudentBulkText"
                className="w-full min-h-[220px] border border-slate-700 rounded-xl p-3 bg-slate-900/50 text-xs text-white leading-relaxed focus:outline-none focus:border-cyan-500 shadow-inner"
                placeholder={studentBulkMode === 'nameOnly' ? '김다인\n박서윤' : '김다인 / 파주중\n박서윤 / 문산중'}
                value={studentBulkText}
                onChange={(e) => setStudentBulkText(e.target.value)}
              />
              <div className="mt-2.5 text-[10px] text-slate-500">한 줄에 한 명씩 줄바꿈하여 입력하세요.</div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveStudentsBulk}
                  className="rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors shadow-sm"
                  style={{ cursor: 'pointer' }}
                >
                  학생 일괄 저장
                </button>
                <button
                  type="button"
                  onClick={() => setStudentBulkText('')}
                  className="ghost-button border border-slate-700 text-slate-300 bg-slate-800/50 hover:bg-slate-700 rounded-xl px-4 py-2.5 text-xs transition-colors"
                  style={{ cursor: 'pointer' }}
                >
                  비우기
                </button>
              </div>
            </div>
            
            {/* Class Students View List */}
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-3">현재 반 소속 학생 ({selectedStudents.length}명):</span>
              <div className="space-y-2 max-h-[340px] overflow-y-auto mini-scroll pr-1">
                {selectedStudents.length ? (
                  selectedStudents.map(s => (
                    <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
                      <div>
                        <div className="font-bold text-slate-200">{s.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.school || '-'} · {s.grade || '-'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(s.id)}
                        className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded text-[10px] font-bold hover:bg-rose-500 hover:text-white transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/20 px-4 py-10 text-center text-xs text-slate-500">
                    학생이 존재하지 않습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AccordionItem>

      {/* Accordion 3: 기존 반/학생 수정 및 삭제 */}
      <AccordionItem
        id="edit"
        title="3. 기존 반/학생 수정 및 삭제"
        icon="fa-pen-to-square"
        colorClass="bg-amber-500/10 text-amber-400 border border-amber-500/20"
        isOpen={setupAccordion.edit}
        onToggle={() => setSetupAccordion(prev => ({ ...prev, edit: !prev.edit }))}
      >
        <div className="space-y-6 text-slate-200">
          {/* Class List Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 block">등록된 전체 반 관리</span>
              <input
                id="setupSearchClass"
                className="border border-slate-700 rounded-xl px-3 py-1.5 bg-slate-900/50 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="반 이름 검색"
                value={setupSearchClass}
                onChange={(e) => setSetupSearchClass(e.target.value)}
              />
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredClassesList.length ? (
                filteredClassesList.map(c => (
                  <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 shadow-sm flex items-center justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <div className="font-extrabold text-sm text-slate-100">{c.name}</div>
                      <div className="text-[11px] text-slate-550 mt-1">{c.grade || '-'} · {teacherNameById(c.teacherId)}T</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditClassClick(c)}
                        className="text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2.5 py-1.5 rounded hover:bg-cyan-500 hover:text-white transition-colors"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveClass(c.id)}
                        className="text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded hover:bg-rose-500 hover:text-white transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-550 py-4 col-span-full border border-dashed border-slate-700 rounded-xl text-center">
                  검색된 반이 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* Student List Settings */}
          <div className="border-t border-slate-800 pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 block">전체 학생 계정 관리 (비밀번호 등)</span>
              <input
                id="setupSearchStudent"
                className="border border-slate-700 rounded-xl px-3 py-1.5 bg-slate-900/50 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="이름/학교 검색"
                value={setupSearchStudent}
                onChange={(e) => setSetupSearchStudent(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto mini-scroll pr-1">
              {filteredStudentsList.length ? (
                filteredStudentsList.map(s => (
                  <div key={s.id} className={`rounded-xl border ${s.pinLocked ? 'border-rose-500/30 bg-rose-950/10' : 'border-slate-800 bg-slate-900/40'} px-4 py-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-700 transition-colors`}>
                    <div>
                      <div className="font-extrabold text-sm text-slate-100">
                        {s.name}
                        {s.pinLocked && <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded ml-1">계정잠김</span>}
                      </div>
                      <div className="text-[11px] text-slate-550 mt-1">{s.school || '-'} · {s.grade || '-'} · {classById(s.classId)?.name || '-'}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <div className="text-[10px] text-slate-500 mr-2 font-mono">PIN: {s.pin || '1234'}</div>
                      {s.pinLocked && (
                        <button
                          type="button"
                          onClick={() => handleUnlockStudentPin(s.id)}
                          className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1.5 rounded hover:bg-amber-500 hover:text-white transition-colors"
                        >
                          잠금해제
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleUpdateStudentPin(s.id, s.pin || '1234')}
                        className="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        PIN 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetStudentPin(s.id)}
                        className="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        초기화
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(s.id)}
                        className="text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1.5 rounded hover:bg-rose-500 hover:text-white transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-700 rounded-xl">
                  학생이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </AccordionItem>
    </div>
  );
}
