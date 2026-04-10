// ==========================================================
//                     الإعدادات الرئيسية
// ==========================================================
// !!! تنبيه هام: هذا هو رابط النشر الجديد الذي زودتني به
const API_URL = 'https://script.google.com/macros/s/AKfycbx25l82z57Q6HjvAPAX0qv7DIkWO1kOsQoZKk4BrScUiV8W9CjvJFQXttxp9chtKSNq/exec'; 
// ==========================================================
//                   دوال الأمان (جديد)
// ==========================================================
// دالة لتشفير كلمة المرور في متصفح المستخدم قبل إرسالها للخادم
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
// (جديد) تعريف أسماء الصفحات لمطابقة الخادم
const SHEETS = {
  USERS: 'المستخدمون',
  GRADES: 'الدرجات_2025_2026',
  GRADES_ARCHIVE: 'أرشيف_الدرجات',
  ABSENCES: 'الغيابات',
  ANNOUNCEMENTS: 'الاخبار',
  SETTINGS: 'إعدادات_النظام',
  HOMEWORK: 'الواجبات',
  DAILY_EVALUATIONS: 'التقييمات_اليومية',
  LIBRARY: 'المكتبة_الرقمية',
  EXAM_SCHEDULES: 'جداول_الامتحانات',
  WEEKLY_SCHEDULES: 'الجداول_الأسبوعية',
  TEACHER_ASSIGNMENTS: 'TeacherAssignments'
};

// ==========================================================
//                   تحسين التنبيهات (SweetAlert2)
// ==========================================================
// 1. إضافة ستايل سريع لتطبيق خط Tajawal على النوافذ المنبثقة
const swalStyle = document.createElement('style');
swalStyle.innerHTML = `
    .swal2-popup { font-family: 'Tajawal', sans-serif !important; }
    .swal2-title { font-size: 1.5em !important; }
`;
document.head.appendChild(swalStyle);

// 2. اعتراض دالة alert الافتراضية واستبدالها بنوافذ ذكية
window.alert = function(message) {
    let iconType = 'success';
    let titleText = 'نجاح';
    let btnColor = '#28a745'; // أخضر

    // التعرف التلقائي على نوع الرسالة (خطأ أم نجاح) من خلال الكلمات المفتاحية
    if (message.includes('خطأ') || message.includes('فشل') || message.includes('الرجاء') || message.includes('غير صحيح') || message.includes('لم يتم') || message.includes('لا يوجد')) {
        iconType = 'error';
        titleText = 'تنبيه';
        btnColor = '#dc3545'; // أحمر
    }

    Swal.fire({
        title: titleText,
        text: message,
        icon: iconType,
        confirmButtonText: 'موافق',
        confirmButtonColor: btnColor,
        backdrop: `rgba(0,0,0,0.4)`
    });
};
// ==========================================================
//                   دالة مساعدة للتواصل مع API
// ==========================================================
async function callApi(action, payload = {}) {
    const userInfo = JSON.parse(localStorage.getItem('userData'));
    try {
        document.body.style.cursor = 'wait';
        const res = await fetch(API_URL, {
            method: 'POST',
            cache: 'no-cache',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, payload, userInfo })
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const result = await res.json();
        if (!result.success) {
          console.error("API Error Response:", result.message, result.stack);
          // (تعديل) لا تعرض الخطأ إذا كان مجرد "لم يتم العثور على"
          // (تعديل) إضافة getUserDetails إلى القائمة
          if (action !== 'getWeeklySchedule' && action !== 'getExistingEvaluations' && action !== 'getUniqueClassesAndSubjects' && action !== 'getUserDetails') { 
            alert(`خطأ من الخادم: ${result.message || 'حدث خطأ غير متوقع.'}`);
          }
        }
        return result;
    } catch (error) {
        console.error('API Call Error:', action, error);
        alert(`فشل الاتصال بالخادم: ${error.message}`);
        return { success: false, message: `فشل الاتصال بالخادم.` };
    } finally {
        document.body.style.cursor = 'default';
    }
}

// ==========================================================
//                   الموجه الرئيسي والتوابع العامة
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.includes('StudentInterface.html')) { handleStudentPage(); }
    else if (path.includes('TeacherInterface.html')) { handleTeacherPage(); }
    else if (path.includes('AdminInterface.html')) { handleAdminPage(); }
    else { handleLoginPage(); }
});

function handleTeacherPage() {
    const userData = setupCommonElements();
    if (!userData) return;

    callApi('getSchoolStructure').then(res => {
        if(res.success) window.academicStructure = res.structure;
        
        callApi('getTeacherDashboard').then(result => {
            if(result.success) {
                const { announcements, canRecordAbsence, canUseMasterExcel, weeklySchedules } = result.data;
                
                window.teacherRawAssignments = result.data.rawAssignments || [];
                
                const classesOnly = [...new Set(window.teacherRawAssignments.map(a => String(a.class || '').trim()))].filter(c => c !== '');
                
                populateSelect('teacherClasses', classesOnly, '-- اختر الصف --');
                populateSelect('hwClasses', classesOnly, '-- اختر الصف --');
                populateSelect('evalClasses', classesOnly, '-- اختر الصف --');
                populateSelect('libClasses', classesOnly, '-- اختر الصف --');
                populateSelect('absenceClasses', classesOnly, '-- اختر الصف --');
                populateSelect('masterClass', classesOnly, '-- اختر الصف أولاً --');

                // 💥 [الحل السحري]: ربط التحديث تلقائياً برمجياً لتجاوز أي خطأ أو نقص في الـ HTML
                ['teacher', 'hw', 'eval', 'lib', 'absence'].forEach(prefix => {
                    const classEl = document.getElementById(`${prefix}Classes`);
                    if (classEl) {
                        classEl.onchange = () => updateTeacherFilters(prefix);
                    }
                });
                const masterEl = document.getElementById('masterClass');
                if (masterEl) {
                    masterEl.onchange = () => {
                        if (typeof updateMasterExcelFilters === 'function') updateMasterExcelFilters();
                    };
                }

                // الاختيار التلقائي أو التصفير
                if (classesOnly.length === 1) {
                    const singleClass = classesOnly[0];
                    ['teacher', 'hw', 'eval', 'lib', 'absence'].forEach(prefix => {
                        const classEl = document.getElementById(`${prefix}Classes`);
                        if (classEl) {
                            classEl.value = singleClass;
                            updateTeacherFilters(prefix); 
                        }
                    });
                    if (masterEl) {
                        masterEl.value = singleClass;
                        if (typeof updateMasterExcelFilters === 'function') updateMasterExcelFilters(); 
                    }
                } else {
                    ['teacher', 'hw', 'eval', 'lib', 'absence'].forEach(prefix => {
                        updateTeacherFilters(prefix);
                    });
                }

                renderAnnouncements(announcements, 'announcementsContainer');
                
                const allTeacherSubjects = [...new Set(window.teacherRawAssignments.map(a => String(a.subject || '').trim()))].filter(s => s !== '');
                renderTeacherWeeklySchedules(weeklySchedules, allTeacherSubjects);
                
                const absenceTabButton = document.querySelector('[onclick="showTab(\'absencesTab\')"]');
                const masterExcelTabButton = document.querySelector('[onclick="showTab(\'masterExcelTab\')"]');

                if (absenceTabButton) absenceTabButton.style.display = canRecordAbsence ? '' : 'none';
                if (masterExcelTabButton) masterExcelTabButton.style.display = canUseMasterExcel ? '' : 'none';
                
                showTab('gradesTab');
            } else {
                 document.body.innerHTML = `<p style="color:red; text-align:center; padding: 50px;">فشل تحميل بيانات المدرس. ${result.message}</p>`;
            }
        });
    });
    
    document.getElementById('loadStudentsBtn').addEventListener('click', loadStudentsForGrading);
    document.getElementById('gradesForm').addEventListener('submit', submitGradesForReview);
    document.getElementById('downloadExcelBtn').addEventListener('click', downloadExcelTemplate);
    document.getElementById('uploadExcelInput').addEventListener('change', handleExcelUpload);
    document.getElementById('loadStudentsForAbsenceBtn').addEventListener('click', loadStudentsForAttendance);
    document.getElementById('absenceForm').addEventListener('submit', recordAbsencesHandler);
    document.getElementById('homeworkForm').addEventListener('submit', submitHomeworkHandler); 
    document.getElementById('loadStudentsForEvalBtn').addEventListener('click', loadStudentsForEvaluation); 
    document.getElementById('evaluationsForm').addEventListener('submit', submitEvaluationsHandler); 
    document.getElementById('libraryForm').addEventListener('submit', addLibraryLinkHandler);
    
    document.getElementById('absenceDate').valueAsDate = new Date();
    document.getElementById('evalDate').valueAsDate = new Date();

    loadTeacherObjections();
    loadTeacherSentHomework();
    const loadSentHwBtn = document.getElementById('loadSentHomeworkBtn');
    if(loadSentHwBtn) loadSentHwBtn.addEventListener('click', loadTeacherSentHomework);
}

function handleLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        document.getElementById('message').textContent = 'جاري التحقق...';
        
        // (تعديل أمني) تشفير كلمة المرور قبل إرسالها عبر الشبكة
        const hashedPassword = await hashPassword(password);
        
        const result = await callApi('login', { email, password: hashedPassword });
        
        if (result.success) {
            // سيقوم الخادم الآن بإرجاع token أمني مع بيانات المستخدم لحفظه
            localStorage.setItem('userData', JSON.stringify(result.user));
            switch(result.user.role) {
                case 'إداري': window.location.href = 'AdminInterface.html'; break;
                case 'مدرس': window.location.href = 'TeacherInterface.html'; break;
                case 'طالب': window.location.href = 'StudentInterface.html'; break;
                default: document.getElementById('message').textContent = 'دور المستخدم غير معروف.';
            }
        } else {
            document.getElementById('message').textContent = result.message || 'خطأ في تسجيل الدخول';
        }
    });
}

function setupCommonElements() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData) {
        window.location.href = 'index.html';
        return null;
    }
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        if (document.body.classList.contains('student-page')) {
            userNameEl.textContent = `الطالب ${userData.name}`;
        } else if (document.body.classList.contains('teacher-page')) {
            userNameEl.textContent = `الأستاذ ${userData.name}`;
        } else {
            userNameEl.textContent = `${userData.name}`;
        }
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
    });
    return userData;
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    const activeButton = document.querySelector(`[onclick="showTab('${tabId}')"]`);
    if(activeButton) activeButton.classList.add('active');
}

function populateSelect(selectId, options, defaultOptionText = '-- اختر --') {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">${defaultOptionText}</option>` + (options || []).map(o => `<option value="${o}">${o}</option>`).join('');
}

// دالة لجلب البيانات من الشيت ووضعها داخل خانات واجهة الطالب
async function loadAndCheckProfile() {
    const res = await callApi('getMyProfile');
    if (res.success) {
        const p = res.profile;
        
        // ملء خانات الـ HTML بالبيانات المسترجعة
        if(document.getElementById('profFullName')) document.getElementById('profFullName').value = p.fullName || '';
        if(document.getElementById('profMotherName')) document.getElementById('profMotherName').value = p.motherName || '';
        if(document.getElementById('profStudentPhone')) document.getElementById('profStudentPhone').value = p.studentPhone || '';
        if(document.getElementById('profGuardianPhone')) document.getElementById('profGuardianPhone').value = p.guardianPhone || '';
        if(document.getElementById('profAddress')) document.getElementById('profAddress').value = p.address || '';
        if(document.getElementById('profDOB')) document.getElementById('profDOB').value = p.dob || '';
        if(document.getElementById('profBloodType')) document.getElementById('profBloodType').value = p.bloodType || '';
        if(document.getElementById('profTelegramId')) document.getElementById('profTelegramId').value = p.telegramId || '';
        if(document.getElementById('profMedical')) document.getElementById('profMedical').value = p.medicalNotes || '';
        
        // جلب الصورة الشخصية وعرضها في الدائرة الزرقاء
        if (p.profilePic) {
            document.getElementById('profilePreview').src = p.profilePic;
        }

        // التحكم في إظهار شعار التنبيه الأصفر
        const banner = document.getElementById('profileAlertBanner');
        if (banner) {
            // إذا كان اسم الأم أو العنوان أو الصورة فارغاً، يظهر التنبيه
            if (!p.motherName || !p.address || !p.profilePic) {
                banner.style.display = 'flex';
            } else {
                banner.style.display = 'none';
            }
        }
    }
}
// ==========================================================
//                  منطق صفحة الطالب
// ==========================================================
// (لا تغييرات هنا، الخادم يفلتر المحتوى "المنشور" فقط)
function handleStudentPage() {
    const userData = setupCommonElements();
    if (!userData) return;
    showTab('announcementsTab');
    
    // جلب البيانات الأساسية للوحة التحكم
    callApi('getStudentDashboard').then(result => {
        if (result.success) {
            renderAnnouncements(result.data.announcements, 'announcementsContainer');
            renderGrades(result.data.grades);
            renderAbsences(result.data.absences);
            renderHomework(result.data.homework);
            renderEvaluations(result.data.evaluations);
            renderLibrary(result.data.library);
            renderWeeklySchedule(result.data.weeklySchedule);
            renderExamSchedules(result.data.examSchedules);
            
            // (مهم جداً) استدعاء دالة جلب بيانات الملف الشخصي لملء الخانات
            loadAndCheckProfile(); 
        }
    });

    // ربط نموذج الملف الشخصي بالحدث
    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);
    
    // ربط اختيار الصورة
    const picInput = document.getElementById('profilePicInput');
    if (picInput) picInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => document.getElementById('profilePreview').src = ev.target.result;
        reader.readAsDataURL(e.target.files[0]);
    };
}

// دالة حفظ الملف الشخصي مع ميزة ضغط الصورة لضمان سرعة الحفظ
async function handleProfileUpdate(e) {
    e.preventDefault();
    
    // إظهار رسالة تحميل فورية
    Swal.fire({ title: 'جاري الحفظ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const profilePreview = document.getElementById('profilePreview');
    let profilePicBase64 = null;

    // ضغط الصورة إذا كانت جديدة (تبدأ بـ data:image)
    if (profilePreview.src.startsWith('data:image')) {
        profilePicBase64 = await compressImage(profilePreview.src, 300); // تصغير العرض إلى 300 بكسل فقط
    }

    const newPass = document.getElementById('profNewPass').value;
    let hashedPassword = newPass ? await hashPassword(newPass) : null;

    const payload = {
        fullName: document.getElementById('profFullName').value,
        motherName: document.getElementById('profMotherName').value,
        studentPhone: document.getElementById('profStudentPhone').value,
        guardianPhone: document.getElementById('profGuardianPhone').value,
        address: document.getElementById('profAddress').value,
        dob: document.getElementById('profDOB').value,
        bloodType: document.getElementById('profBloodType').value,
        telegramId: document.getElementById('profTelegramId').value,
        medicalNotes: document.getElementById('profMedical').value,
        newPassword: hashedPassword,
        profilePicBase64: profilePicBase64
    };

    const result = await callApi('updateMyProfile', payload);
    
    if (result.success) {
        Swal.fire('تم الحفظ!', 'تم تحديث بيانات ملفك الشخصي وصورتك بنجاح.', 'success');
        loadAndCheckProfile(); // لتحديث الواجهة وإخفاء التنبيه
    } else {
        Swal.fire('خطأ في الحفظ', result.message, 'error');
    }
}

// دالة مساعدة لضغط الصور (تضاف في نهاية script.js)
function compressImage(base64Str, maxWidth) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // ضغط الجودة بنسبة 70%
        };
    });
}
// (جديد) دالة جلب وعرض اعتراضات الطالب
async function loadStudentObjections() {
    const container = document.getElementById('myObjectionsContainer');
    if (!container) return;
    const res = await callApi('getStudentObjections');
    if (res.success && res.objections.length > 0) {
        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>التاريخ</th><th>المادة / الموضوع</th><th>التفاصيل</th><th>حالة الإدارة</th><th>حالة المدرس</th><th>رد المدرس</th></tr></thead>
                <tbody>
                    ${res.objections.map(obj => `
                        <tr>
                            <td>${obj.date}</td>
                            <td>${obj.subject}</td>
                            <td>${obj.content}</td>
                            <td style="font-weight:bold; color:${obj.adminStatus.includes('مرفوض') ? 'red' : (obj.adminStatus.includes('محول') ? 'green' : 'orange')}">${obj.adminStatus}</td>
                            <td style="font-weight:bold; color:${obj.teacherStatus === 'تم الرد' ? 'green' : 'orange'}">${obj.teacherStatus}</td>
                            <td>${obj.reply || 'لا يوجد رد بعد'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    } else {
        container.innerHTML = '<p>لا توجد اعتراضات سابقة.</p>';
    }
}

function renderAnnouncements(announcements, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!announcements || announcements.length === 0) {
        container.innerHTML = '<div class="card"><p>لا توجد إعلانات حالياً.</p></div>';
        return;
    }
    container.innerHTML = announcements.map(ann => `
        <div class="card announcement-card">
            <h4>${ann.title}</h4>
            <p>${ann.content.replace(/\n/g, '<br>')}</p>
            <small>تاريخ النشر: ${ann.date}</small>
        </div>
    `).join('');
}

function renderGrades(grades) {
    const container = document.getElementById('gradesContainer');
    if (!container) return;
    if (!grades || grades.length === 0) {
        container.innerHTML = '<p>لا توجد درجات منشورة لك حالياً.</p>';
        return;
    }
    container.innerHTML = `
        <div class="table-responsive">
        <table class="data-table">
            <thead>
                <tr><th rowspan="2">المادة</th><th colspan="4">الفصل الأول</th><th rowspan="2">نصف السنة</th><th colspan="4">الفصل الثاني</th><th rowspan="2">السعي السنوي</th><th rowspan="2">الامتحان النهائي</th><th rowspan="2">الدرجة النهائية</th></tr>
                <tr><th>ش1</th><th>ش2</th><th>ش3</th><th>السعي</th><th>ش1</th><th>ش2</th><th>ش3</th><th>السعي</th></tr>
            </thead>
            <tbody>
                ${grades.map(g => `
                    <tr>
                        <td>${g.subject || ''}</td>
                        <td>${g.term1_month1 || ''}</td><td>${g.term1_month2 || ''}</td><td>${g.term1_month3 || ''}</td><td style="background:#eafaf1;"><strong>${g.term1_avg || ''}</strong></td>
                        <td><strong>${g.midYear_exam || ''}</strong></td>
                        <td>${g.term2_month1 || ''}</td><td>${g.term2_month2 || ''}</td><td>${g.term2_month3 || ''}</td><td style="background:#eafaf1;"><strong>${g.term2_avg || ''}</strong></td>
                        <td style="background:#fff3cd;"><strong>${g.yearly_effort || ''}</strong></td><td>${g.final_exam || ''}</td><td style="background:#d4edda; color:green;"><strong>${g.final_result || ''}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    `;
}

function renderAbsences(absences) {
    const container = document.getElementById('absencesContainer');
    if (!container) return;
    if (!absences || absences.length === 0) {
        container.innerHTML = '<p>لا توجد غيابات مسجلة لك.</p>';
        return;
    }
    container.innerHTML = `
        <ul class="absences-list">
            ${absences.map(a => `<li><span>${a.date}</span>: ${a.notes || 'غياب بدون ملاحظات'}</li>`).join('')}
        </ul>
    `;
}

/**
 * دالة عرض الواجبات للطالب (محدثة لتشمل تسجيل المشاهدة تلقائياً)
 */
function renderHomework(homework) {
    const container = document.getElementById('homeworkContainer');
    if (!container) return;
    if (!homework || homework.length === 0) {
        container.innerHTML = '<p>لا توجد واجبات حالياً.</p>';
        return;
    }
    
    // 1. رسم الواجبات في الشاشة
    container.innerHTML = homework.map(hw => `
        <div class="card">
            <h4>${hw.subject} <small>(${hw.date})</small></h4>
            <p>${hw.content.replace(/\n/g, '<br>')}</p>
        </div>
    `).join('');

    // 2. (الإضافة الجديدة) إرسال إشارة المشاهدة للسيرفر بصمت لكل واجب تم عرضه
    homework.forEach(hw => {
        if (hw.id) {
            callApi('trackItemView', { itemId: hw.id, itemType: 'homework' });
        }
    });
}

function renderEvaluations(evaluations) {
    const container = document.getElementById('evaluationsContainer');
    if (!container) return;
    if (!evaluations || evaluations.length === 0) {
        container.innerHTML = '<p>لا توجد تقييمات مسجلة لك.</p>';
        return;
    }
    container.innerHTML = `
        <div class="table-responsive">
        <table class="data-table">
            <thead><tr><th>التاريخ</th><th>المادة</th><th>تحضير</th><th>مشاركة</th><th>سلوك</th><th>واجبات</th><th>ملاحظات</th></tr></thead>
            <tbody>
                ${evaluations.map(ev => `
                    <tr><td>${ev.date}</td><td>${ev.subject}</td><td>${ev.daily_prep || '-'}</td><td>${ev.participation || '-'}</td><td>${ev.behavior || '-'}</td><td>${ev.homework || '-'}</td><td>${ev.note || '-'}</td></tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    `;
}

function renderLibrary(links) {
    const container = document.getElementById('libraryContainer');
    if (!container) return;
    if (!links || links.length === 0) {
        container.innerHTML = '<p>لا توجد مواد في المكتبة حالياً.</p>';
        return;
    }
    container.innerHTML = links.map(link => `
        <div class="card">
            <h4>${link.title} <small>(${link.subject})</small></h4>
            <p>${link.description || ''}</p>
            <a href="${link.url}" target="_blank" class="button">فتح الرابط <i class="fas fa-external-link-alt"></i></a>
        </div>
    `).join('');
}

function renderWeeklySchedule(scheduleData) {
    const container = document.getElementById('weeklyScheduleContainer');
    if (!container) return;
    if (!scheduleData) {
        container.innerHTML = '<p>لم يتم نشر الجدول الأسبوعي الخاص بصفك بعد.</p>';
        return;
    }
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    let tableHtml = '<div class="table-responsive"><table class="data-table weekly-schedule-table"><thead><tr><th>اليوم</th>';
    for(let i = 1; i <= 6; i++) {
        tableHtml += `<th>الدرس ${i}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    
    days.forEach(day => {
        tableHtml += `<tr><td><strong>${day}</strong></td>`;
        for(let i = 1; i <= 6; i++) {
            tableHtml += `<td>${scheduleData[day]?.[`lesson${i}`] || ''}</td>`;
        }
        tableHtml += '</tr>';
    });
    
    tableHtml += '</tbody></table></div>';
    container.innerHTML = tableHtml;
}

function renderExamSchedules(schedules) {
    const container = document.getElementById('examSchedulesContainer');
    if (!container) return;
    if (!schedules || schedules.length === 0) {
        container.innerHTML = '<p>لا توجد جداول امتحانات منشورة حالياً.</p>';
        return;
    }
    
    container.innerHTML = schedules.map(schedule => `
        <div class="card exam-schedule-card">
            <h3>${schedule.title}</h3>
            <ul>
                ${schedule.scheduleData.map(day => `
                    <li>
                        <span><strong>${day.date} (${day.day})</strong></span>
                        <span>${day.subject}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `).join('');
}

// ==========================================================
//                 دوال الاعتراضات للمدرس (جديد)
// ==========================================================
async function loadTeacherObjections() {
    const container = document.getElementById('teacherObjectionsContainer');
    if (!container) return;
    
    const res = await callApi('getTeacherObjections');
    if (res.success && res.objections.length > 0) {
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>الطالب</th>
                        <th>المادة</th>
                        <th>نص الاعتراض / الملاحظة</th>
                        <th>الرد</th>
                    </tr>
                </thead>
                <tbody>
                    ${res.objections.map(obj => `
                        <tr>
                            <td>${obj.date}</td>
                            <td>${obj.studentName}</td>
                            <td>${obj.subject}</td>
                            <td>${obj.content}</td>
                            <td>
                                <div style="display: flex; flex-direction: column; gap: 5px; align-items: center;">
                                    <textarea id="reply-text-${obj.id}" rows="2" placeholder="اكتب ردك هنا لولي الأمر/الطالب..." style="padding: 5px; width: 100%; border: 1px solid #ccc; font-size: 0.9em;" required></textarea>
                                    <button onclick="submitTeacherReply('${obj.id}')" class="button btn-publish" style="padding: 5px 10px; font-size: 0.8em; width: 100%;">إرسال الرد</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    } else {
        container.innerHTML = '<p>لا توجد اعتراضات أو ملاحظات محولة إليك حالياً.</p>';
    }
}

async function submitTeacherReply(objectionId) {
    const replyInput = document.getElementById(`reply-text-${objectionId}`);
    if (!replyInput || !replyInput.value.trim()) {
        return alert('الرجاء كتابة الرد قبل الإرسال.');
    }
    
    const payload = { objectionId, reply: replyInput.value.trim() };
    const res = await callApi('handleTeacherObjection', payload);
    
    if (res.success) {
        alert(res.message);
        loadTeacherObjections(); // إعادة تحميل القائمة لاختفاء السجل بعد الرد
    }
}

function renderTeacherWeeklySchedules(schedules, teacherSubjects) {
    const container = document.getElementById('teacherScheduleContainer');
    if (!container) return;
    if (!schedules || schedules.length === 0) {
        container.innerHTML = '<p>لم يتم نشر أي جداول للصفوف والشعب المسندة إليك بعد.</p>';
        return;
    }
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    let finalHtml = '';
    schedules.forEach(schedule => {
        finalHtml += `<div class="form-section"><h3>الصف: ${schedule.targetClass} - الشعبة: ${schedule.targetSection}</h3>`;
        let tableHtml = '<div class="table-responsive"><table class="data-table weekly-schedule-table"><thead><tr><th>اليوم</th>';
        for (let i = 1; i <= 6; i++) { tableHtml += `<th>الدرس ${i}</th>`; }
        tableHtml += '</tr></thead><tbody>';
        days.forEach(day => {
            tableHtml += `<tr><td><strong>${day}</strong></td>`;
            for (let i = 1; i <= 6; i++) {
                const subject = schedule.scheduleData[day]?.[`lesson${i}`] || '';
                const isMySubject = (teacherSubjects || []).includes(subject);
                tableHtml += `<td class="${isMySubject ? 'my-subject' : ''}">${subject}</td>`;
            }
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table></div></div>';
        finalHtml += tableHtml;
    });
    container.innerHTML = finalHtml;
}


async function loadStudentsForGrading() {
    const payload = {
        studentClass: document.getElementById('teacherClasses').value,
        studentSection: document.getElementById('teacherSections').value,
        subject: document.getElementById('teacherSubjects').value,
    };
    if (!payload.studentClass || !payload.studentSection || !payload.subject) {
        return alert('الرجاء اختيار الصف والشعبة والمادة.');
    }
    
    const result = await callApi('getStudentsForGrading', payload);
    const container = document.getElementById('studentsGradeContainer');
    
    if (result.success && result.students && result.students.length > 0) {
        const settings = result.settings || {}; 

        const getInputState = (gradeType) => {
            const settingKey = `${gradeType}_Status`; 
            if (!settings[settingKey] || settings[settingKey].value === 'مفتوح') {
                return '';
            }
            return 'readonly style="background-color: #eee; color:#888;" tabindex="-1"';
        };
        
        container.innerHTML = `
            <div class="table-responsive" style="overflow-x: auto; white-space: nowrap;">
            <table class="data-table" style="font-size: 0.85em; min-width: 1200px;">
                <thead><tr>
                    <th style="position: sticky; right: 0; background: var(--light-green); z-index: 2;">اسم الطالب</th>
                    <th>ش1 (ف1)</th><th>ش2 (ف1)</th><th>ش3 (ف1)</th><th style="background:#eafaf1;">السعي (ف1)</th>
                    <th>نصف السنة</th>
                    <th>ش1 (ف2)</th><th>ش2 (ف2)</th><th>ش3 (ف2)</th><th style="background:#eafaf1;">السعي (ف2)</th>
                    <th style="background:#fff3cd;">السعي السنوي</th><th>الدفتر</th><th style="background:#d4edda;">النهائي</th><th>الحالة</th>
                </tr></thead>
                <tbody>
                    ${result.students.map(s => {
                        const g = result.grades[s.studentId] || {};
                        const latestStatus = g.Term1_Month1?.status || g.Term1_Avg?.status || 'جديد';
                        return `
                        <tr data-student-id="${s.studentId}">
                            <td style="position: sticky; right: 0; background: #fff; font-weight:bold; z-index: 1;">${s.name}</td>
                            <td><input type="number" class="grade-input" data-grade-type="Term1_Month1" value="${g.Term1_Month1?.grade || ''}" ${getInputState('Term1_Month1')}></td>
                            <td><input type="number" class="grade-input" data-grade-type="Term1_Month2" value="${g.Term1_Month2?.grade || ''}" ${getInputState('Term1_Month2')}></td>
                            <td><input type="number" class="grade-input" data-grade-type="Term1_Month3" value="${g.Term1_Month3?.grade || ''}" ${getInputState('Term1_Month3')}></td>
                            <td><input type="number" class="grade-input" data-grade-type="Term1_Avg" value="${g.Term1_Avg?.grade || ''}" ${getInputState('Term1_Avg')} style="background:#eafaf1; font-weight:bold;"></td>
                            
                            <td><input type="number" class="grade-input" data-grade-type="MidYear_Exam" value="${g.MidYear_Exam?.grade || ''}" ${getInputState('MidYear_Exam')} style="font-weight:bold;"></td>
                            
                            <td><input type="number" class="grade-input" data-grade-type="Term2_Month1" value="${g.Term2_Month1?.grade || ''}" ${getInputState('Term2_Month1')}></td>
                            <td><input type="number" class="grade-input" data-grade-type="Term2_Month2" value="${g.Term2_Month2?.grade || ''}" ${getInputState('Term2_Month2')}></td>
                            <td><input type="number" class="grade-input" data-grade-type="Term2_Month3" value="${g.Term2_Month3?.grade || ''}" ${getInputState('Term2_Month3')}></td>
                            <td><input type="number" class="grade-input" data-grade-type="Term2_Avg" value="${g.Term2_Avg?.grade || ''}" ${getInputState('Term2_Avg')} style="background:#eafaf1; font-weight:bold;"></td>
                            
                            <td><input type="number" class="grade-input" data-grade-type="Yearly_Effort" value="${g.Yearly_Effort?.grade || ''}" ${getInputState('Yearly_Effort')} style="background:#fff3cd; font-weight:bold;"></td>
                            <td><input type="number" class="grade-input" data-grade-type="Final_Exam" value="${g.Final_Exam?.grade || ''}" ${getInputState('Final_Exam')}></td>
                            <td><input type="number" class="grade-input" data-grade-type="Final_Result" value="${g.Final_Result?.grade || ''}" ${getInputState('Final_Result')} style="background:#d4edda; color:green; font-weight:bold;"></td>
                            
                            <td><span class="status">${latestStatus}</span></td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
            </div>`;
        document.getElementById('submitGradesBtn').style.display = 'block';
        
        // استدعاء دالة الحساب الذكي بعد بناء الجدول
        if (typeof attachGradeCalculators === 'function') attachGradeCalculators();
    } else {
        container.innerHTML = `<p>${result.message || 'لا يوجد طلاب في هذه الشعبة.'}</p>`;
    }
}
async function submitGradesForReview(e) {
    e.preventDefault();
    const grades = [];
    document.querySelectorAll('#studentsGradeContainer tbody tr').forEach(row => {
        const studentGrade = { studentId: row.dataset.studentId, grades: {} };
        let hasChanged = false;
        row.querySelectorAll('.grade-input').forEach(input => {
            // فقط أضف الدرجة إذا لم تكن للقراءة فقط
            if (input.value !== '' && !input.hasAttribute('readonly')) { 
                studentGrade.grades[input.dataset.gradeType] = input.value;
                hasChanged = true;
            }
        });
        if(hasChanged) grades.push(studentGrade);
    });

    if (grades.length === 0) return alert('لم يتم إدخال أي درجات جديدة (أو أن الحقول المفتوحة فارغة).');

    const payload = {
        subject: document.getElementById('teacherSubjects').value,
        grades: grades
    };

    const result = await callApi('submitGrades', payload);
    if (result.success) {
        alert(result.message); // سيعرض (تم الإرسال للمراجعة)
        loadStudentsForGrading(); // إعادة تحميل لإظهار الحالة الجديدة "بانتظار الموافقة"
    }
}

async function loadStudentsForAttendance() {
    const payload = {
        studentClass: document.getElementById('absenceClasses').value,
        studentSection: document.getElementById('absenceSections').value
    };
    if (!payload.studentClass || !payload.studentSection) return alert('الرجاء اختيار الصف والشعبة.');

    const result = await callApi('getStudentsForAttendance', payload);
    const container = document.getElementById('studentsForAbsenceContainer');
    if (result.success && result.students.length > 0) {
        container.innerHTML = `<ul class="students-list">${result.students.map(s => `<li><label><input type="checkbox" name="absentStudent" value="${s.studentId}"> ${s.name}</label></li>`).join('')}</ul>`;
        document.getElementById('submitAbsencesBtn').style.display = 'block';
    } else {
        container.innerHTML = '<p>لا يوجد طلاب في هذه الشعبة.</p>';
    }
}

async function recordAbsencesHandler(e) {
    e.preventDefault();
    const studentIds = Array.from(document.querySelectorAll('input[name="absentStudent"]:checked')).map(cb => cb.value);
    if (studentIds.length === 0) return alert('الرجاء تحديد طالب واحد على الأقل.');

    const payload = {
        date: document.getElementById('absenceDate').value,
        studentIds: studentIds,
        notes: document.getElementById('absenceNotes').value
    };
    
    const result = await callApi('recordAbsences', payload);
    if (result.success) {
        alert(result.message); // سيعرض (تم الإرسال للمراجعة)
        e.target.reset();
        document.getElementById('absenceDate').valueAsDate = new Date();
        document.getElementById('studentsForAbsenceContainer').innerHTML = '<p>الرجاء اختيار الصف والشعبة والتاريخ لعرض الطلاب.</p>';
        document.getElementById('submitAbsencesBtn').style.display = 'none';
    }
}

/**
 * (جديد) دالة جلب الواجبات المرسلة للمدرس وعرضها
 */
async function loadTeacherSentHomework() {
    const container = document.getElementById('sentHomeworkContainer');
    if (!container) return;
    
    container.innerHTML = '<p>جاري التحميل...</p>';
    const result = await callApi('getTeacherSentHomework');
    
    if (result.success && result.homework && result.homework.length > 0) {
        let html = `<table class="data-table">
            <thead>
                <tr>
                    <th>التاريخ</th>
                    <th>الصف والشعبة</th>
                    <th>المادة</th>
                    <th>المحتوى</th>
                    <th>الحالة</th>
                    <th>المشاهدات</th>
                </tr>
            </thead>
            <tbody>`;
        
        result.homework.forEach(hw => {
            html += `<tr>
                <td>${hw.date}</td>
                <td>${hw.class} ${hw.section}</td>
                <td>${hw.subject}</td>
                <td>${hw.content.substring(0, 40)}...</td>
                <td style="font-weight: bold; color: ${hw.status === 'منشور' ? '#28a745' : '#ffc107'};">${hw.status}</td>
                <td>
                    <button onclick="showItemViews('${hw.id}', '${hw.class}', '${hw.section}')" class="button" style="background-color: #17a2b8; padding: 5px 10px; font-size: 0.85em; width: auto;">
                        <i class="fas fa-eye"></i> الإحصائيات
                    </button>
                </td>
            </tr>`;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p>لا توجد واجبات مرسلة مسبقاً.</p>';
    }
}

/**
 * (جديد) دالة عرض نافذة بأسماء الطلاب الذين شاهدوا/لم يشاهدوا الواجب
 */
async function showItemViews(itemId, targetClass, targetSection) {
    Swal.fire({ title: 'جاري جلب المشاهدات...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    
    const result = await callApi('getItemViews', { itemId, targetClass, targetSection });
    
    if (result.success) {
        const { viewed, notViewed, viewedCount, totalCount } = result;
        
        let html = `
            <div style="text-align: right; font-family: 'Tajawal', sans-serif;">
                <h4 style="color: #28a745; margin-bottom: 5px;"><i class="fas fa-check-circle"></i> شاهدوا الواجب (${viewedCount}):</h4>
                <div style="max-height: 150px; overflow-y: auto; background: #eafaf1; padding: 10px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #c3e6cb;">
                    ${viewed.length > 0 ? viewed.map(name => `<div>- ${name}</div>`).join('') : '<div style="color: #666;">لم يشاهد أحد الواجب بعد.</div>'}
                </div>
                
                <h4 style="color: #dc3545; margin-bottom: 5px;"><i class="fas fa-times-circle"></i> لم يشاهدوا الواجب (${totalCount - viewedCount}):</h4>
                <div style="max-height: 150px; overflow-y: auto; background: #f8d7da; padding: 10px; border-radius: 5px; border: 1px solid #f5c6cb;">
                    ${notViewed.length > 0 ? notViewed.map(name => `<div>- ${name}</div>`).join('') : '<div style="color: #28a745; font-weight: bold;">ممتاز! الجميع شاهد الواجب!</div>'}
                </div>
            </div>
        `;
        
        Swal.fire({
            title: 'إحصائيات المشاهدة للواجب',
            html: html,
            confirmButtonText: 'إغلاق',
            confirmButtonColor: '#6c757d',
            width: '600px'
        });
    } else {
        Swal.fire('خطأ', result.message, 'error');
    }
}

// (محدث - تم إزالة تاريخ الاستحقاق)
async function submitHomeworkHandler(e) {
    e.preventDefault();
    const payload = {
        content: document.getElementById('hwContent').value,
        targetClass: document.getElementById('hwClasses').value,
        targetSection: document.getElementById('hwSections').value,
        targetSubject: document.getElementById('hwSubjects').value
        // (لا يوجد تاريخ استحقاق، النظام سيجدوله آلياً)
    };
    if(!payload.targetClass || !payload.targetSection || !payload.targetSubject || !payload.content) return alert('الرجاء ملء جميع الحقول.');
    
    const result = await callApi('submitHomework', payload);
    if(result.success) {
        alert(result.message); // سيعرض (تم الإرسال للمراجعة)
        e.target.reset();
    }
}

// (محدث بالكامل - لجلب التقييمات الموجودة مسبقاً)
async function loadStudentsForEvaluation() {
    const payload = {
        studentClass: document.getElementById('evalClasses').value,
        studentSection: document.getElementById('evalSections').value
    };
    if(!payload.studentClass || !payload.studentSection) return alert('الرجاء اختيار الصف والشعبة.');
    
    // 1. جلب قائمة الطلاب
    const studentsResult = await callApi('getStudentsForAttendance', payload);
    const container = document.getElementById('studentsForEvalContainer');
    
    if (!studentsResult.success || studentsResult.students.length === 0) {
        container.innerHTML = '<p>لا يوجد طلاب في هذه الشعبة.</p>';
        return;
    }
    
    const students = studentsResult.students;
    const studentIds = students.map(s => s.studentId);
    
    // 2. (جديد) جلب التقييمات الموجودة مسبقاً لهذا اليوم والمادة
    const evalPayload = {
        date: document.getElementById('evalDate').value,
        subject: document.getElementById('evalSubjects').value,
        studentIds: studentIds
    };
    
    // لن نعرض خطأ إذا لم يتم العثور على تقييمات (هذا طبيعي)
    const existingEvalsResult = await callApi('getExistingEvaluations', evalPayload);
    const existingEvalsMap = new Map();
    if (existingEvalsResult.success) {
        existingEvalsResult.evaluations.forEach(ev => {
            existingEvalsMap.set(ev.studentId, ev);
        });
    }

    // 3. بناء الجدول مع ملء البيانات الموجودة
    const evalTypes = { 'DailyPrep': 'تحضير يومي', 'Participation': 'مشاركة', 'Behavior': 'سلوك', 'Homework': 'واجب بيتي' };
    const optionsHtml = (selectedValue = "") => `
        <option value="" ${selectedValue === "" ? "selected" : ""}>--</option>
        <option value="جيد" ${selectedValue === "جيد" ? "selected" : ""}>جيد</option>
        <option value="متوسط" ${selectedValue === "متوسط" ? "selected" : ""}>متوسط</option>
        <option value="ضعيف" ${selectedValue === "ضعيف" ? "selected" : ""}>ضعيف</option>
    `;

    let tableHtml = `
        <div class="table-responsive">
        <table class="data-table">
            <thead>
                <tr><th>اسم الطالب</th><th>تحضير يومي</th><th>مشاركة</th><th>سلوك</th><th>واجب بيتي</th><th>ملاحظات</th><th>الحالة</th></tr>
            </thead>
            <tbody>
    `;
    students.forEach(s => {
        const existing = existingEvalsMap.get(s.studentId) || {};
        const status = existing.status || 'جديد';
        // لا يمكن التعديل إذا كان منشوراً أو مرفوضاً أو تمت الموافقة عليه (حفظ فقط)
        const isEditable = (status === 'جديد' || status === 'بانتظار الموافقة');
        
        tableHtml += `
            <tr data-student-id="${s.studentId}" data-evaluation-id="${existing.evaluationId || ''}">
                <td>${s.name}</td>
                <td><select class="eval-select" data-type="DailyPrep" ${!isEditable ? 'disabled' : ''}>${optionsHtml(existing.daily_prep)}</select></td>
                <td><select class="eval-select" data-type="Participation" ${!isEditable ? 'disabled' : ''}>${optionsHtml(existing.participation)}</select></td>
                <td><select class="eval-select" data-type="Behavior" ${!isEditable ? 'disabled' : ''}>${optionsHtml(existing.behavior)}</select></td>
                <td><select class="eval-select" data-type="Homework" ${!isEditable ? 'disabled' : ''}>${optionsHtml(existing.homework)}</select></td>
                <td><input type="text" class="eval-note" placeholder="ملاحظة" value="${existing.note || ''}" ${!isEditable ? 'readonly' : ''}></td>
                <td><span class="status" style="color: ${isEditable ? '#ffc107' : '#28a745'}">${status}</span></td>
            </tr>
        `;
    });
    tableHtml += '</tbody></table></div>';
    container.innerHTML = tableHtml;
    document.getElementById('submitEvaluationsBtn').style.display = 'block';
}

// (محدث بالكامل - ليدعم إرسال التعديلات)
async function submitEvaluationsHandler(e) {
    e.preventDefault();
    const evaluationsPayload = [];
    const date = document.getElementById('evalDate').value;
    const subject = document.getElementById('evalSubjects').value;
    
    if (!subject) return alert('الرجاء اختيار المادة.');

    document.querySelectorAll('#studentsForEvalContainer tbody tr').forEach(row => {
        const evaluationId = row.dataset.evaluationId; // جلب ID التقييم
        
        // إذا كان السجل غير قابل للتعديل (select معطل)، تجاهله
        if (row.querySelector('select').disabled) return;
        
        const studentEvals = {
            studentId: row.dataset.studentId,
            evaluationId: evaluationId || null, // إرسال ID السجل للتعديل
            evaluations: {},
            note: row.querySelector('.eval-note').value
        };
        
        let hasEval = false;
        row.querySelectorAll('.eval-select').forEach(select => {
            if (select.value) {
                studentEvals.evaluations[select.dataset.type] = select.value;
                hasEval = true;
            }
        });
        
        // إرسال فقط إذا كان هناك تقييم أو ملاحظة
        if (hasEval || studentEvals.note) {
            evaluationsPayload.push(studentEvals);
        }
    });

    if (evaluationsPayload.length === 0) return alert('الرجاء تقييم طالب واحد على الأقل أو كتابة ملاحظة (في الحقول القابلة للتعديل).');

    const result = await callApi('submitDailyEvaluation', { evaluations: evaluationsPayload, date: date, subject: subject });
    if (result.success) {
        alert(result.message); // سيعرض (تم الإرسال للمراجعة)
        loadStudentsForEvaluation(); // إعادة تحميل لإظهار الحالة "بانتظار الموافقة"
    }
}

async function addLibraryLinkHandler(e) {
    e.preventDefault();
    const payload = {
        title: document.getElementById('libTitle').value,
        url: document.getElementById('libUrl').value,
        description: document.getElementById('libDescription').value,
        targetClass: document.getElementById('libClasses').value,
        targetSubject: document.getElementById('libSubjects').value
    };
    if (!payload.title || !payload.url || !payload.targetClass || !payload.targetSubject) return alert('الرجاء ملء الحقول المطلوبة.');
    
    const result = await callApi('addLibraryLink', payload);
    if (result.success) {
        alert(result.message); // سيعرض (تم الإرسال للمراجعة)
        e.target.reset();
    }
}

// ==========================================================
//                  منطق صفحة المشرف (محدث ومدمج بالكامل)
// ==========================================================
function handleAdminPage() {
    const userData = setupCommonElements();
    if (!userData) return;
    
    showTab('pendingTab'); // عرض تبويب الموافقات الافتراضي
    
    // (الإضافة الأهم) استدعاء الإحصائيات لتظهر في الكروت الملونة فوراً
    refreshAdminAnalytics();

    // تحميل جميع بيانات الموافقات
    loadPendingGrades();
    loadPendingAbsences();
    loadPendingEvaluations();
    loadPendingHomeworks();
    loadPendingLibraryLinks();
    
    // تحميل بيانات باقي التبويبات
    loadAllUsers();
    loadSystemSettings();

    // تحميل بيانات الجداول والتقارير
    callApi('getUniqueClassesAndSubjects').then(result => {
        if (result.success) {
            window.allSubjects = result.subjects || []; 
            window.allClasses = result.classes || [];
            window.allSections = result.sections || [];
            
            populateSelect('examScheduleClass', window.allClasses, '-- اختر الصف --');
            populateSelect('weeklyScheduleClass', window.allClasses, '-- اختر الصف --');
            populateSelect('weeklyScheduleSection', window.allSections, '-- اختر الشعبة --');
            // تعبئة قوائم التقارير
            populateSelect('reportClassSelect', window.allClasses, '-- اختر الصف --');
            populateSelect('reportSectionSelect', window.allSections, '-- اختر الشعبة --');

            // (تعبئة قوائم الإكسل الشامل للمشرف)
            populateSelect('masterClass', window.allClasses, '-- اختر الصف --');
            populateSelect('masterSection', window.allSections, 'الكل');
            const masterSubjContainerAdmin = document.getElementById('masterSubjectsContainer');
            if (masterSubjContainerAdmin) {
                masterSubjContainerAdmin.innerHTML = (window.allSubjects || []).map(s => `<label style="margin-left: 10px;"><input type="checkbox" value="${s}" class="master-subject-cb" checked> ${s}</label>`).join('');
            }
            const masterUploadInputAdmin = document.getElementById('masterExcelUploadInput');
            if (masterUploadInputAdmin) masterUploadInputAdmin.addEventListener('change', handleMasterExcelUpload);
            
            buildWeeklyScheduleGrid(window.allSubjects);
            addExamDayField();
        }
    });

    // مستمعي الأحداث
    document.getElementById('announcementForm').addEventListener('submit', handleAnnouncementSubmit);
    document.getElementById('addExamDayBtn').addEventListener('click', addExamDayField);
    document.getElementById('examScheduleForm').addEventListener('submit', publishExamScheduleHandler);
    document.getElementById('weeklyScheduleForm').addEventListener('submit', publishWeeklyScheduleHandler);
    document.getElementById('loadWeeklyScheduleBtn').addEventListener('click', loadExistingWeeklySchedule);
    document.getElementById('archiveStudentBtn').addEventListener('click', archiveStudent);
    
    // مستمعي أحداث التقارير
    document.getElementById('loadMissingSubmissionsBtn').addEventListener('click', loadMissingSubmissions);
    document.getElementById('getSummaryBtn').addEventListener('click', getStudentEvaluationSummary);
    document.getElementById('sendSummaryToTelegramBtn').addEventListener('click', sendSummaryToTelegram);
    document.getElementById('getGradesReportBtn').addEventListener('click', getGradesReportBySection);
    
    // مستمعي أحداث إدارة المستخدمين
    document.getElementById('loadUserBtn').addEventListener('click', loadUserForEditing);
    document.getElementById('closeModalBtn').addEventListener('click', closeUserModal);
    document.getElementById('saveUserBtn').addEventListener('click', saveUserChanges);

    // مستمعي أحداث متابعة الإرسال
    document.getElementById('loadHwStatusBtn').addEventListener('click', () => loadSubmissionStatusReport(SHEETS.HOMEWORK, 'hwStatusContainer'));
    document.getElementById('loadEvalStatusBtn').addEventListener('click', () => loadSubmissionStatusReport(SHEETS.DAILY_EVALUATIONS, 'evalStatusContainer'));
    
    // تهيئة تواريخ التقارير
    document.getElementById('summaryStartDate').valueAsDate = new Date();
    document.getElementById('summaryEndDate').valueAsDate = new Date();

    // تحميل الاعتراضات عند فتح لوحة المشرف
    loadAdminObjections();
}
// ==========================================================
//                 دوال الاعتراضات للمشرف (جديد)
// ==========================================================
// ==========================================================
//                 دوال الاعتراضات للمشرف (جديد)
// ==========================================================
async function loadAdminObjections() {
    const container = document.getElementById('adminObjectionsContainer');
    if (!container) return;
    
    const res = await callApi('getAdminObjections');
    if (res.success && res.objections.length > 0) {
        // بناء خيارات قائمة المدرسين
        const teachers = res.teachers || [];

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>الطالب</th>
                        <th>الصف والشعبة</th>
                        <th>المادة</th>
                        <th>نص الاعتراض</th>
                        <th>إجراء الإدارة</th>
                    </tr>
                </thead>
                <tbody>
                    ${res.objections.map(obj => {
                        // تحديد المدرس المقترح تلقائياً في القائمة المنسدلة
                        const teacherOptions = teachers.map(t => 
                            `<option value="${t.id}" ${t.id === obj.suggestedTeacherId ? 'selected' : ''}>${t.name}</option>`
                        ).join('');

                        return `
                        <tr>
                            <td>${obj.date}</td>
                            <td>${obj.studentName}</td>
                            <td>${obj.classSection}</td>
                            <td>${obj.subject}</td>
                            <td>${obj.content}</td>
                            <td>
                                <div style="display: flex; flex-direction: column; gap: 5px; align-items: center;">
                                    <select id="teacher-id-${obj.id}" style="padding: 5px; width: 100%; border: 1px solid #ccc; text-align: center; font-size: 0.9em; border-radius: 4px;">
                                        <option value="">-- اختر المدرس --</option>
                                        ${teacherOptions}
                                    </select>
                                    <button onclick="handleAdminObjectionAction('${obj.id}', 'approve')" class="button btn-publish" style="padding: 5px 10px; font-size: 0.8em; width: 100%;">موافقة وتحويل</button>
                                    <button onclick="handleAdminObjectionAction('${obj.id}', 'reject')" class="button btn-reject" style="padding: 5px 10px; font-size: 0.8em; width: 100%;">رفض</button>
                                </div>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>`;
    } else {
        container.innerHTML = '<p>لا توجد اعتراضات معلقة بانتظار قرار الإدارة.</p>';
    }
}

async function handleAdminObjectionAction(objectionId, action) {
    let payload = { objectionId, action };
    
    if (action === 'approve') {
        const teacherSelect = document.getElementById(`teacher-id-${objectionId}`);
        if (!teacherSelect || !teacherSelect.value) {
            return alert('الرجاء اختيار المدرس من القائمة لتحويل الاعتراض إليه.');
        }
        payload.teacherId = teacherSelect.value;
    }

    const res = await callApi('handleAdminObjection', payload);
    if (res.success) {
        alert(res.message);
        loadAdminObjections(); // إعادة تحميل القائمة لاختفاء الاعتراض المعالج
    }
}

// --- دوال الموافقات (محدثة بالكامل) ---

// (دالة معالجة مركزية جديدة)
async function handleApproval(sheetName, action, sendTelegram = false) {
    const checkboxClass = `.checkbox-${sheetName.replace(/[_\.]/g, '-')}`; // تحويل _ إلى - ليطابق ID
    const itemIds = Array.from(document.querySelectorAll(`${checkboxClass}:checked`)).map(cb => cb.value);
    
    if (itemIds.length === 0) return alert('الرجاء تحديد سجل واحد على الأقل.');

    const payload = {
        itemIds: itemIds,
        action: action, // 'approve', 'publish', 'reject'
        sendTelegram: sendTelegram,
        sheetName: sheetName // إرسال الاسم الحقيقي للورقة
    };
    
    const result = await callApi('handleApproval', payload);
    if (result.success) {
        alert(result.message);
        // إعادة تحميل القسم المناسب
        if (sheetName === SHEETS.GRADES) loadPendingGrades();
        else if (sheetName === SHEETS.ABSENCES) loadPendingAbsences();
        else if (sheetName === SHEETS.DAILY_EVALUATIONS) loadPendingEvaluations();
        else if (sheetName === SHEETS.HOMEWORK) loadPendingHomeworks();
        else if (sheetName === SHEETS.LIBRARY) loadPendingLibraryLinks();
    }
}

// (دالة عرض أزرار الموافقة الثلاثية الجديدة)
function getApprovalControls(sheetName) {
    const sheetId = sheetName.replace(/[_\.]/g, '-'); // اسم فريد للاختصارات
    const checkboxClass = `checkbox-${sheetId}`;
    const selectAllId = `selectAll-${sheetId}`;
    
    // (جديد) تخصيص الأزرار للواجبات
    const isHomework = (sheetName === SHEETS.HOMEWORK);
    const publishText = isHomework ? 'جدولة للمنصة' : 'حفظ ونشر للمنصة';
    const telegramText = isHomework ? 'جدولة + إرسال آلي' : 'نشر + إرسال تليجرام';
    const publishTitle = isHomework ? 'جدولة الواجب ليتم إرساله آلياً (للمنصة فقط) قبل يوم الحصة' : 'حفظ ونشر السجلات لتظهر في واجهة الطالب.';
    const telegramTitle = isHomework ? 'جدولة الواجب ليتم إرساله آلياً (للمنصة وتليجرام) قبل يوم الحصة' : 'حفظ ونشر، وإرسال إشعار فوري لولي الأمر عبر تليجرام.';

    // ربط المستمع ديناميكياً
    setTimeout(() => {
        try {
            const updateCount = () => {
                const count = document.querySelectorAll(`.${checkboxClass}:checked`).length;
                const label = document.querySelector(`#controls-${sheetId} label`);
                if (label) label.innerText = 'للـ ' + count + ' محدد:';
            };
            
            document.querySelectorAll(`.${checkboxClass}`).forEach(cb => {
                cb.onchange = updateCount;
            });
            const selectAll = document.getElementById(selectAllId);
            if (selectAll) {
                selectAll.onchange = (e) => {
                    document.querySelectorAll(`.${checkboxClass}`).forEach(cb => cb.checked = e.target.checked);
                    updateCount();
                };
            }
        } catch (e) {
            console.error("Error attaching listeners:", e);
        }
    }, 100);

    return `
    <div class="approval-controls" id="controls-${sheetId}">
        <label>للـ 0 محدد:</label>
        <button onclick="handleApproval('${sheetName}', 'approve', false)" class="button btn-approve" title="حفظ السجلات في النظام (للاستخدام الداخلي) دون إظهارها للطالب.">
            <i class="fas fa-save"></i> حفظ فقط (موافقة)
        </button>
        <button onclick="handleApproval('${sheetName}', 'publish', false)" class="button btn-publish" title="${publishTitle}">
            <i class="fas fa-check"></i> ${publishText}
        </button>
        <button onclick="handleApproval('${sheetName}', 'publish', true)" class="button btn-telegram" title="${telegramTitle}">
            <i class="fab fa-telegram-plane"></i> ${telegramText}
        </button>
        <button onclick="handleApproval('${sheetName}', 'reject', false)" class="button btn-reject" title="رفض السجلات، لن يتم حفظها أو نشرها.">
            <i class="fas fa-times"></i> رفض
        </button>
    </div>
    `;
}

async function loadPendingGrades() {
    const result = await callApi('getPendingGrades');
    const container = document.getElementById('pendingGradesContainer');
    const sheetName = SHEETS.GRADES;
    const sheetId = sheetName.replace(/[_\.]/g, '-');
    
    if (result.success && result.items.length > 0) {
        container.innerHTML = `<div class="table-responsive"><table class="data-table"><thead><tr><th><input type="checkbox" id="selectAll-${sheetId}"></th><th>الطالب</th><th>المادة</th><th>نوع الدرجة</th><th>التغييرات</th><th>المدرس</th></tr></thead><tbody>${result.items.map(g => `<tr><td><input type="checkbox" class="checkbox-${sheetId}" value="${g.id}"></td><td>${g.studentName}</td><td>${g.subject}</td><td>${g.gradeType}</td><td><details><summary class="details-toggle">عرض</summary><div class="changes-details"><span class="old-value">${g.changes.old || '(فارغ)'}</span> &rarr; <span class="new-value">${g.changes.new}</span></div></details></td><td>${g.teacher}</td></tr>`).join('')}</tbody></table></div>
        ${getApprovalControls(sheetName)}`;
    } else { container.innerHTML = '<p>لا توجد درجات بانتظار الموافقة.</p>'; }
}

async function loadPendingAbsences() {
    const result = await callApi('getPendingAbsences');
    const container = document.getElementById('pendingAbsencesContainer');
    const sheetName = SHEETS.ABSENCES;
    const sheetId = sheetName.replace(/[_\.]/g, '-');

    if (result.success && result.items.length > 0) {
         container.innerHTML = `<div class="table-responsive"><table class="data-table"><thead><tr><th><input type="checkbox" id="selectAll-${sheetId}"></th><th>الطالب</th><th>التاريخ</th><th>الملاحظات</th><th>بواسطة</th></tr></thead><tbody>${result.items.map(a => `<tr><td><input type="checkbox" class="checkbox-${sheetId}" value="${a.id}"></td><td>${a.studentName}</td><td>${new Date(a.date).toLocaleDateString('ar-IQ')}</td><td>${a.notes || '-'}</td><td>${a.teacher}</td></tr>`).join('')}</tbody></table></div>
         ${getApprovalControls(sheetName)}`;
    } else { container.innerHTML = '<p>لا توجد غيابات بانتظار الموافقة.</p>'; }
}

async function loadPendingEvaluations() {
    const result = await callApi('getPendingEvaluations');
    const container = document.getElementById('pendingEvaluationsContainer');
    const sheetName = SHEETS.DAILY_EVALUATIONS;
    const sheetId = sheetName.replace(/[_\.]/g, '-');

    if (result.success && result.items.length > 0) {
         container.innerHTML = `<div class="table-responsive"><table class="data-table"><thead><tr><th><input type="checkbox" id="selectAll-${sheetId}"></th><th>الطالب</th><th>المادة</th><th>التاريخ</th><th>التقييم</th><th>ملاحظات</th><th>بواسطة</th></tr></thead><tbody>${result.items.map(ev => `<tr><td><input type="checkbox" class="checkbox-${sheetId}" value="${ev.id}"></td><td>${ev.studentName}</td><td>${ev.subject}</td><td>${new Date(ev.date).toLocaleDateString('ar-IQ')}</td><td><ul style="padding-right: 20px; margin: 0; text-align: right;">${ev.data.daily_prep ? `<li>تحضير: ${ev.data.daily_prep}</li>` : ''}${ev.data.participation ? `<li>مشاركة: ${ev.data.participation}</li>` : ''}${ev.data.behavior ? `<li>سلوك: ${ev.data.behavior}</li>` : ''}${ev.data.homework ? `<li>واجب: ${ev.data.homework}</li>` : ''}</ul></td><td>${ev.data.note || '-'}</td><td>${ev.teacher}</td></tr>`).join('')}</tbody></table></div>
         ${getApprovalControls(sheetName)}`;
    } else { container.innerHTML = '<p>لا توجد تقييمات بانتظار الموافقة.</p>'; }
}

async function loadPendingHomeworks() {
    const result = await callApi('getPendingHomeworks');
    const container = document.getElementById('pendingHomeworkContainer');
    const sheetName = SHEETS.HOMEWORK;
    const sheetId = sheetName.replace(/[_\.]/g, '-');
    
     if (result.success && result.items.length > 0) {
        container.innerHTML = `<div class="table-responsive"><table class="data-table">
            <thead><tr><th><input type="checkbox" id="selectAll-${sheetId}"></th><th>تاريخ الإرسال</th><th>المدرس</th><th>الصف</th><th>المادة</th><th>المحتوى</th></tr></thead>
            <tbody>${result.items.map(hw => `<tr>
                <td><input type="checkbox" class="checkbox-${sheetId}" value="${hw.id}"></td>
                <td>${new Date(hw.date).toLocaleDateString('ar-IQ')}</td>
                <td>${hw.teacher}</td>
                <td>${hw.class} ${hw.section}</td>
                <td>${hw.subject}</td>
                <td>${hw.content.substring(0, 100)}...</td>
            </tr>`).join('')}</tbody></table></div>
            ${getApprovalControls(sheetName)}`;
     } else { container.innerHTML = '<p>لا توجد واجبات بانتظار الموافقة.</p>'; }
}

async function loadPendingLibraryLinks() {
    const result = await callApi('getPendingLibraryLinks');
    const container = document.getElementById('pendingLibraryContainer');
    const sheetName = SHEETS.LIBRARY;
    const sheetId = sheetName.replace(/[_\.]/g, '-');

     if (result.success && result.items.length > 0) {
        container.innerHTML = `<div class="table-responsive"><table class="data-table">
            <thead><tr><th><input type="checkbox" id="selectAll-${sheetId}"></th><th>التاريخ</th><th>المدرس</th><th>الصف</th><th>المادة</th><th>العنوان</th><th>الرابط</th></tr></thead>
            <tbody>${result.items.map(lib => `<tr>
                <td><input type="checkbox" class="checkbox-${sheetId}" value="${lib.id}"></td>
                <td>${new Date(lib.date).toLocaleDateString('ar-IQ')}</td>
                <td>${lib.teacher}</td>
                <td>${lib.class}</td>
                <td>${lib.subject}</td>
                <td>${lib.title}</td>
                <td><a href="${lib.url}" target="_blank">فتح</a></td>
            </tr>`).join('')}</tbody></table></div>
            ${getApprovalControls(sheetName)}`;
     } else { container.innerHTML = '<p>لا توجد روابط مكتبة بانتظار الموافقة.</p>'; }
}


// --- دوال التقارير (جديد) ---
async function loadMissingSubmissions() {
    const container = document.getElementById('missingSubmissionsContainer');
    container.style.display = 'block';
    container.innerHTML = '<p>جاري تحليل جداول آخر 7 أيام... الرجاء الانتظار.</p>';
    
    const result = await callApi('getMissingSubmissions');
    if (!result.success) {
        container.innerHTML = `<p>خطأ: ${result.message}</p>`;
        return;
    }
    
    const report = result.report;
    if (Object.keys(report).length === 0) {
        container.innerHTML = '<p>ممتاز! جميع المدرسين ملتزمون بإرسال الواجبات والتقييمات لآخر 7 أيام.</p>';
        return;
    }
    
    let html = `<table class="data-table">
                    <thead>
                        <tr>
                            <th>المدرس</th>
                            <th>عدد تقصير (تقييمات)</th>
                            <th>عدد تقصير (واجبات)</th>
                            <th>التفاصيل</th>
                            <th>إجراء</th>
                        </tr>
                    </thead>
                    <tbody>`;
    
    for (const teacherId in report) {
        const item = report[teacherId];
        const message = `الأستاذ ${item.teacherName}، \nيرجى متابعة إرسال التقييمات والواجبات اليومية للحصص. \n\nتفاصيل التقصير (آخر 7 أيام):\n- ${item.details.join('\n- ')}`;
        
        html += `<tr>
            <td>${item.teacherName} (ID: ${item.teacherId})</td>
            <td>${item.evalMisses}</td>
            <td>${item.hwMisses}</td>
            <td>${item.details.join('<br>')}</td>
            <td>
                <button onclick="sendReminder('${item.teacherId}', \`${message}\`)" class="button btn-telegram" style="padding: 5px 10px; font-size: 0.8em;">
                    <i class="fab fa-telegram-plane"></i> إرسال تذكير
                </button>
            </td>
        </tr>`;
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function sendReminder(teacherId, message) {
    // (تعديل) استبدال confirm بـ alert بسيط مؤقتاً
    // if (!confirm(`هل أنت متأكد من إرسال هذا التذكير؟\n\n${message}`)) return;
    const result = await callApi('sendSubmissionReminder', { teacherId, message });
    if (result.success) {
        alert(result.message);
    }
}

async function getStudentEvaluationSummary() {
    const payload = {
        studentId: document.getElementById('summaryStudentId').value,
        startDate: document.getElementById('summaryStartDate').value,
        endDate: document.getElementById('summaryEndDate').value,
    };
    if (!payload.studentId || !payload.startDate || !payload.endDate) {
        return alert('الرجاء إدخال ID الطالب وتحديد فترة زمنية.');
    }
    
    const result = await callApi('getStudentEvaluationSummary', payload);
    const container = document.getElementById('summaryReportContainer');
    const textArea = document.getElementById('summaryText');
    
    if (result.success) {
        container.style.display = 'block';
        textArea.value = result.summaryText; // (محدث) استخدام النص المنسق من الخادم
    } else {
        container.style.display = 'none';
        textArea.value = '';
        alert(result.message); // إظهار خطأ "لا توجد تقييمات"
    }
}

async function sendSummaryToTelegram() {
    const studentId = document.getElementById('summaryStudentId').value;
    const summaryText = document.getElementById('summaryText').value;
    if (!studentId || !summaryText) {
        return alert('الرجاء إنشاء الخلاصة أولاً.');
    }
    
    const result = await callApi('sendSummaryToTelegram', { studentId, summaryText });
    if (result.success) {
        alert(result.message);
    }
}

async function getGradesReportBySection() {
    const payload = {
        studentClass: document.getElementById('reportClassSelect').value,
        studentSection: document.getElementById('reportSectionSelect').value
    };
    if (!payload.studentClass || !payload.studentSection) {
        return alert('الرجاء اختيار الصف والشعبة.');
    }
    
    const result = await callApi('getGradesReportBySection', payload);
    const container = document.getElementById('gradesReportContainer');
    
    if (result.success && result.report.length > 0) {
        const allSubjects = new Set();
        result.report.forEach(student => {
            Object.keys(student.grades).forEach(subject => allSubjects.add(subject));
        });
        const subjectsArray = Array.from(allSubjects);
        
        let html = `<table class="data-table"><thead><tr><th>اسم الطالب</th>`;
        subjectsArray.forEach(subject => {
            html += `<th colspan="6">${subject}</th>`;
        });
        html += `</tr><tr><th></th>`;
        subjectsArray.forEach(subject => {
            html += `<th>ش1 ف1</th><th>ش2 ف1</th><th>نصف سنة</th><th>ش1 ف2</th><th>ش2 ف2</th><th>نهائي</th>`;
        });
        html += `</tr></thead><tbody>`;

        result.report.forEach(student => {
            html += `<tr><td>${student.studentName}</td>`;
            subjectsArray.forEach(subject => {
                const gradeData = student.grades[subject] || {};
                html += `
                    <td>${gradeData.Term1_Month1 || '-'}</td><td>${gradeData.Term1_Month2 || '-'}</td>
                    <td>${gradeData.MidYear_Exam || '-'}</td><td>${gradeData.Term2_Month1 || '-'}</td>
                    <td>${gradeData.Term2_Month2 || '-'}</td><td>${gradeData.Final_Exam || '-'}</td>
                `;
            });
            html += `</tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p>لا توجد درجات معتمدة لعرضها لهذه الشعبة.</p>';
    }
}

// ==========================================================
//                   (جديد) دوال متابعة الإرسال
// ==========================================================
async function loadSubmissionStatusReport(sheetName, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<p>جاري تحميل السجلات...</p>';
    
    const result = await callApi('getSubmissionStatusReport', { sheetName });
    
    if (result.success && result.items.length > 0) {
        renderSubmissionStatusReport(result.items, containerId, sheetName);
    } else {
        container.innerHTML = `<p>${result.message || 'لا توجد سجلات لعرضها.'}</p>`;
    }
}

function renderSubmissionStatusReport(items, containerId, sheetName) {
    const container = document.getElementById(containerId);
    let html = `<div class="table-responsive"><table class="data-table">
                    <thead>
                        <tr>
                            <th>المدرس</th>
                            <th>الصف</th>
                            <th>المادة/المحتوى</th>
                            <th>حالة الموافقة</th>
                            <th>حالة التليجرام</th>
                            <th>إجراء</th>
                        </tr>
                    </thead>
                    <tbody>`;
    
    items.forEach(item => {
        let statusColor = 'black';
        if (item.telegramStatus.includes('فشل')) statusColor = '#dc3545';
        if (item.telegramStatus.includes('تم الإرسال')) statusColor = '#28a745';
        if (item.telegramStatus.includes('جاهز')) statusColor = '#007bff';
        
        const canBeSent = (item.status === 'منشور' || item.status === 'مجدول') && 
                          (item.telegramStatus.includes('فشل') || item.telegramStatus === 'جاهز للإرسال الآلي');

        html += `<tr>
            <td>${item.teacher}</td>
            <td>${item.class}</td>
            <td>${item.subject}</td>
            <td>${item.status}</td>
            <td style="color: ${statusColor}; font-weight: bold;">${item.telegramStatus}</td>
            <td>
                <button onclick="manualSend('${item.id}', '${sheetName}', this)" 
                        class="button btn-telegram" 
                        style="padding: 5px 10px; font-size: 0.8em;"
                        ${!canBeSent ? 'disabled' : ''}
                        title="${canBeSent ? 'إرسال هذا السجل الآن' : 'لا يمكن إرساله يدوياً'}">
                    <i class="fab fa-telegram-plane"></i> إرسال يدوي
                </button>
            </td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function manualSend(itemId, sheetName, btnElement) {
    // استخدام رسالة التأكيد العصرية بدلاً من confirm الافتراضية
    const confirmResult = await Swal.fire({
        title: 'تأكيد الإرسال',
        text: 'هل أنت متأكد من رغبتك في إرسال هذا الإشعار يدوياً عبر تليجرام الآن؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#007bff',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'نعم، أرسل الآن',
        cancelButtonText: 'إلغاء'
    });

    if (!confirmResult.isConfirmed) return; // إذا ضغط إلغاء، تتوقف العملية
    
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    const result = await callApi('manualSendTelegram', { itemId, sheetName });
    
    if (result.success) {
        alert(result.message);
        // إعادة تحميل الجدول لتحديث الحالة
        if (sheetName === SHEETS.HOMEWORK) {
            loadSubmissionStatusReport(SHEETS.HOMEWORK, 'hwStatusContainer');
        } else {
            loadSubmissionStatusReport(SHEETS.DAILY_EVALUATIONS, 'evalStatusContainer');
        }
    } else {
        alert(result.message);
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="fab fa-telegram-plane"></i> إرسال يدوي';
    }
}

// --- دوال الإدارة (مستخدمين، إعدادات، جداول، أرشفة) ---

async function loadSystemSettings() {
    const result = await callApi('getSystemSettings');
    if (result.success) {
        const container = document.getElementById('settingsContainer');
        container.innerHTML = Object.keys(result.settings).map(key => {
            const setting = result.settings[key];
            return `<div class="setting-item">
                        <label>${setting.description}</label>
                        <label class="switch">
                            <input type="checkbox" data-key="${key}" ${setting.value === 'مفتوح' ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>`;
        }).join('');
        container.querySelectorAll('input[type="checkbox"]').forEach(toggle => {
            toggle.addEventListener('change', async (event) => {
                const key = event.target.dataset.key;
                const value = event.target.checked ? 'مفتوح' : 'مغلق';
                await callApi('updateSystemSettings', { [key]: value });
            });
        });
    }
}

async function loadAllUsers() {
    const result = await callApi('getAllUsers');
    const container = document.getElementById('usersContainer');
    if (result.success) {
        container.innerHTML = `<div class="table-responsive"><table class="data-table"><thead><tr><th>ID</th><th>الاسم الكامل</th><th>الدور</th><th>الحالة</th><th>ID تليجرام</th><th>صلاحية الغياب</th><th>صلاحية الإكسل الشامل</th></tr></thead><tbody>${result.users.map(user => `<tr><td>${user.userId}</td><td>${user.fullName}</td><td>${user.role}</td><td>${user.status}</td><td>${user.telegramId || 'لا يوجد'}</td><td>${user.role === 'مدرس' ? `<label class="switch"><input type="checkbox" class="permission-toggle" data-userid="${user.userId}" data-permission="canRecordAbsence" ${user.canRecordAbsence ? 'checked' : ''}><span class="slider round"></span></label>` : 'N/A'}</td><td>${user.role === 'مدرس' ? `<label class="switch"><input type="checkbox" class="permission-toggle" data-userid="${user.userId}" data-permission="canUseMasterExcel" ${user.canUseMasterExcel ? 'checked' : ''}><span class="slider round"></span></label>` : 'N/A'}</td></tr>`).join('')}</tbody></table></div>`;
        document.querySelectorAll('.permission-toggle').forEach(toggle => {
            toggle.addEventListener('change', async (event) => {
                const payload = { userId: event.target.dataset.userid, permission: event.target.dataset.permission, value: event.target.checked };
                await callApi('updateUserPermission', payload);
            });
        });
    }
}

// (جديد) دوال المودال لإدارة المستخدمين
async function loadUserForEditing() {
    const userId = document.getElementById('searchUserId').value;
    if (!userId) return alert('الرجاء إدخال ID المستخدم.');
    
    const result = await callApi('getUserDetails', { userId });
    if (!result.success) return alert(result.message);
    
    const { headers, userData } = result;
    const form = document.getElementById('userEditForm');
    form.innerHTML = ''; // إفراغ النموذج
    form.dataset.currentUserId = userId; // تخزين ID المستخدم الحالي
    
    // بناء حقول النموذج ديناميكياً
    headers.forEach((header, index) => {
        const value = userData[index];
        const isReadOnly = (header === 'ID'); // جعل حقل ID للقراءة فقط
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.setAttribute('for', `edit-${header}`);
        label.textContent = header;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `edit-${header}`;
        input.name = header;
        input.value = value;
        if (isReadOnly) input.readOnly = true;
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        
        // جعل بعض الحقول بعرض كامل
        if (['FullName', 'Email', 'Password', 'TelegramID', 'GuardianName', 'GuardianPhone', 'StudentPhone'].includes(header)) {
            formGroup.classList.add('full-width');
        }
        
        form.appendChild(formGroup);
    });
    
    document.getElementById('modalUserName').textContent = userData[4]; // (FullName)
    document.getElementById('userEditModal').style.display = 'flex';
}

function closeUserModal() {
    document.getElementById('userEditModal').style.display = 'none';
}

async function saveUserChanges() {
    const form = document.getElementById('userEditForm');
    const userId = form.dataset.currentUserId;
    if (!userId) return alert('خطأ: لم يتم العثور على ID المستخدم.');
    
    const inputs = form.querySelectorAll('input, select');
    // (مهم) التأكد من الحفاظ على ترتيب الأعمدة
    const newRowData = Array.from(inputs).map(input => input.value); 
    
    const result = await callApi('updateUser', { userId, newRowData });
    if (result.success) {
        alert(result.message);
        closeUserModal();
        loadAllUsers(); // إعادة تحميل قائمة المستخدمين
    }
}
// ---------------------------------

async function archiveStudent() {
    const studentId = document.getElementById('archiveStudentId').value;
    if (!studentId) return alert('الرجاء إدخال ID الطالب.');
    // (تعديل) إزالة confirm
    // if (!confirm(`هل أنت متأكد من رغبتك في أرشفة جميع درجات الطالب صاحب الـ ID: ${studentId}؟`)) return;
    const result = await callApi('archiveStudentGrades', { studentId });
    if (result.success) {
        alert(result.message);
        document.getElementById('archiveStudentId').value = '';
    }
}

async function handleAnnouncementSubmit(e) {
    e.preventDefault(); 
    const payload = { 
        title: document.getElementById('annTitle').value, 
        content: document.getElementById('annContent').value, 
        audience: document.getElementById('annAudience').value,
        sendTelegram: document.getElementById('annSendTelegram').checked
    }; 
    const result = await callApi('createAnnouncement', payload); 
    if (result.success) { 
        alert(result.message); 
        e.target.reset(); 
    } 
}

function addExamDayField() {
    const container = document.getElementById('examDaysContainer');
    const div = document.createElement('div');
    div.className = 'exam-day-row';
    const subjectOptions = (window.allSubjects || []).map(s => `<option value="${s}">${s}</option>`).join('');

    div.innerHTML = `
        <div class="controls" style="padding: 5px; background: #f9f9f9;">
            <input type="date" class="exam-date" required>
            <input type="text" class="exam-day" placeholder="اليوم" required>
            <select class="exam-subject" required><option value="">-- اختر المادة --</option>${subjectOptions}</select>
            <button type="button" onclick="this.parentElement.parentElement.remove()" class="button" style="background-color: #dc3545; padding: 8px 12px;">حذف</button>
        </div>
    `;
    container.appendChild(div);
}


async function publishExamScheduleHandler(e) {
    e.preventDefault();
    const scheduleData = [];
    document.querySelectorAll('#examDaysContainer .exam-day-row').forEach(row => {
        scheduleData.push({
            date: row.querySelector('.exam-date').value,
            day: row.querySelector('.exam-day').value,
            subject: row.querySelector('.exam-subject').value
        });
    });
    
    const payload = {
        title: document.getElementById('examScheduleTitle').value,
        targetClass: document.getElementById('examScheduleClass').value,
        scheduleData: scheduleData
    };

    const result = await callApi('publishExamSchedule', payload);
    if (result.success) {
        alert(result.message);
        e.target.reset();
        document.getElementById('examDaysContainer').innerHTML = '';
        addExamDayField();
    }
}

function buildWeeklyScheduleGrid(subjects = []) {
    const container = document.getElementById('weeklyScheduleContainer');
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    let html = '';
    const subjectOptions = `<option value="">--</option>` + (subjects || []).map(s => `<option value="${s}">${s}</option>`).join('');

    html += `<div class="schedule-grid">
        <div class="schedule-header"></div> 
        ${[1,2,3,4,5,6].map(i => `<div class="schedule-header">الدرس ${i}</div>`).join('')}
    </div>`;

    days.forEach(day => {
        html += `<div class="schedule-grid">
            <div class="schedule-header">${day}</div>
            ${[1,2,3,4,5,6].map(i => `<select id="${day}-lesson${i}">${subjectOptions}</select>`).join('')}
        </div>`;
    });
    container.innerHTML = html;
}

async function publishWeeklyScheduleHandler(e) {
    e.preventDefault();
    const scheduleData = {};
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    days.forEach(day => {
        scheduleData[day] = {};
        for (let i = 1; i <= 6; i++) {
            const lessonInput = document.getElementById(`${day}-lesson${i}`);
            if (lessonInput && lessonInput.value) {
                scheduleData[day][`lesson${i}`] = lessonInput.value;
            } else {
                scheduleData[day][`lesson${i}`] = ''; // حفظ الفراغ
            }
        }
    });

    const payload = {
        targetClass: document.getElementById('weeklyScheduleClass').value,
        targetSection: document.getElementById('weeklyScheduleSection').value,
        scheduleData: scheduleData
    };

    if (!payload.targetClass || !payload.targetSection) {
        return alert('الرجاء اختيار الصف والشعبة.');
    }
    
    const result = await callApi('publishWeeklySchedule', payload);
    if (result.success) {
        alert(result.message);
    }
}

async function loadExistingWeeklySchedule() {
    const payload = {
        targetClass: document.getElementById('weeklyScheduleClass').value,
        targetSection: document.getElementById('weeklyScheduleSection').value,
    };

    if (!payload.targetClass || !payload.targetSection) {
        return alert('الرجاء اختيار الصف والشعبة لتحميل الجدول.');
    }

    const result = await callApi('getWeeklySchedule', payload);
    if (result.success && result.schedule) {
        const schedule = result.schedule;
        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        days.forEach(day => {
            for (let i = 1; i <= 6; i++) {
                const lessonSelect = document.getElementById(`${day}-lesson${i}`);
                if (lessonSelect) {
                    lessonSelect.value = schedule[day]?.[`lesson${i}`] || '';
                }
            }
        });
        alert('تم تحميل الجدول بنجاح.');
    } else {
        alert('لم يتم العثور على جدول محفوظ لهذا الصف والشعبة. يمكنك إنشاء جدول جديد الآن.');
        buildWeeklyScheduleGrid(window.allSubjects || []);
    }
}

async function refreshAdminAnalytics() {
    const res = await callApi('getAdminAnalytics');
    if (res.success) {
        const a = res.analytics;
        document.getElementById('statStudents').innerText = a.studentsCount;
        document.getElementById('statTeachers').innerText = a.teachersCount;
        document.getElementById('statPending').innerText = a.pendingApprovals;
        document.getElementById('statObjections').innerText = a.activeObjections;
    }
}

// ==========================================================
//               دوال الإكسل والحساب الذكي للدرجات (جديد)
// ==========================================================

// ==========================================================
//               دوال الإكسل والحساب الذكي للدرجات
// ==========================================================

function attachGradeCalculators() {
    document.querySelectorAll('#studentsGradeContainer tbody tr').forEach(row => {
        const inputs = Array.from(row.querySelectorAll('.grade-input'));
        
        const getVal = (type) => {
            const el = inputs.find(i => i.dataset.gradeType === type);
            return (el && el.value !== '') ? Number(el.value) : null;
        };
        
        const setVal = (type, val) => {
            const el = inputs.find(i => i.dataset.gradeType === type);
            // يقوم بالتحديث فقط إذا لم يكن الحقل مغلقاً من الإدارة، ولم يقم المدرس بكتابته يدوياً
            if (el && !el.hasAttribute('readonly') && el.dataset.manualOverride !== 'true') {
                el.value = val;
            }
        };

        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const type = e.target.dataset.gradeType;
                
                // إذا كتب المدرس السعي بيده، نوقف الحساب التلقائي لهذا الحقل ليحترم إرادته
                if(['Term1_Avg', 'Term2_Avg', 'Yearly_Effort', 'Final_Result'].includes(type)) {
                    e.target.dataset.manualOverride = (e.target.value !== '') ? 'true' : 'false';
                }

                // حساب سعي ف1
                let m1_1 = getVal('Term1_Month1'), m2_1 = getVal('Term1_Month2'), m3_1 = getVal('Term1_Month3');
                let sum1 = 0, count1 = 0;
                if(m1_1 !== null) { sum1 += m1_1; count1++; }
                if(m2_1 !== null) { sum1 += m2_1; count1++; }
                if(m3_1 !== null) { sum1 += m3_1; count1++; }
                if(count1 > 0) setVal('Term1_Avg', Math.round(sum1/count1));

                // حساب سعي ف2
                let m1_2 = getVal('Term2_Month1'), m2_2 = getVal('Term2_Month2'), m3_2 = getVal('Term2_Month3');
                let sum2 = 0, count2 = 0;
                if(m1_2 !== null) { sum2 += m1_2; count2++; }
                if(m2_2 !== null) { sum2 += m2_2; count2++; }
                if(m3_2 !== null) { sum2 += m3_2; count2++; }
                if(count2 > 0) setVal('Term2_Avg', Math.round(sum2/count2));

                // حساب السعي السنوي
                let avg1 = getVal('Term1_Avg'), mid = getVal('MidYear_Exam'), avg2 = getVal('Term2_Avg');
                if (avg1 !== null && mid !== null && avg2 !== null) {
                    setVal('Yearly_Effort', Math.round((avg1 + mid + avg2)/3));
                }

                // حساب الدرجة النهائية
                let yearly = getVal('Yearly_Effort'), final_exam = getVal('Final_Exam');
                if (yearly !== null && final_exam !== null) {
                    setVal('Final_Result', Math.round((yearly + final_exam)/2));
                }
            });
        });
    });
}

async function downloadExcelTemplate() {
    const studentClass = document.getElementById('teacherClasses').value;
    const subject = document.getElementById('teacherSubjects').value;
    if (!studentClass || !subject) return alert('الرجاء اختيار الصف والمادة أولاً.');

    Swal.fire({ title: 'جاري تجهيز الملف...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const result = await callApi('getStudentsForExcel', { studentClass, subject });
    if (!result.success) return Swal.fire('خطأ', result.message, 'error');

    const data = [['ID الطالب', 'اسم الطالب', 'الشعبة', 'ش1 (ف1)', 'ش2 (ف1)', 'ش3 (ف1)', 'السعي (ف1)', 'نصف السنة', 'ش1 (ف2)', 'ش2 (ف2)', 'ش3 (ف2)', 'السعي (ف2)', 'السعي السنوي', 'الدفتر النهائي', 'الدرجة النهائية']];

    result.students.forEach(s => {
        const g = result.grades[s.studentId] || {};
        data.push([
            s.studentId, s.name, s.section,
            g.Term1_Month1?.grade || '', g.Term1_Month2?.grade || '', g.Term1_Month3?.grade || '', g.Term1_Avg?.grade || '',
            g.MidYear_Exam?.grade || '',
            g.Term2_Month1?.grade || '', g.Term2_Month2?.grade || '', g.Term2_Month3?.grade || '', g.Term2_Avg?.grade || '',
            g.Yearly_Effort?.grade || '', g.Final_Exam?.grade || '', g.Final_Result?.grade || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    if(!ws['!views']) ws['!views'] = [];
    ws['!views'][0] = { rightToLeft: true }; 

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الدرجات");
    XLSX.writeFile(wb, `درجات_${studentClass}_${subject}.xlsx`);
    Swal.close();
}

async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const subject = document.getElementById('teacherSubjects').value;
    if (!subject) {
        e.target.value = '';
        return alert('الرجاء اختيار المادة قبل رفع الملف.');
    }

    const reader = new FileReader();
    reader.onload = async function(evt) {
        const data = evt.target.result;
        const workbook = XLSX.read(data, {type: 'binary'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});

        const gradesPayload = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue; 

            const studentId = String(row[0]);
            const grades = {};

            const getVal = (idx) => (row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') ? Number(row[idx]) : '';

            let m1_1 = getVal(3), m2_1 = getVal(4), m3_1 = getVal(5), avg_1 = getVal(6);
            let mid = getVal(7);
            let m1_2 = getVal(8), m2_2 = getVal(9), m3_2 = getVal(10), avg_2 = getVal(11);
            let yearly = getVal(12), final_exam = getVal(13), final_result = getVal(14);

            if (avg_1 === '') {
                let sum = 0, count = 0;
                if(m1_1 !== '') { sum += m1_1; count++; }
                if(m2_1 !== '') { sum += m2_1; count++; }
                if(m3_1 !== '') { sum += m3_1; count++; }
                if (count > 0) avg_1 = Math.round(sum / count);
            }

            if (avg_2 === '') {
                let sum = 0, count = 0;
                if(m1_2 !== '') { sum += m1_2; count++; }
                if(m2_2 !== '') { sum += m2_2; count++; }
                if(m3_2 !== '') { sum += m3_2; count++; }
                if (count > 0) avg_2 = Math.round(sum / count);
            }

            if (yearly === '' && avg_1 !== '' && mid !== '' && avg_2 !== '') {
                yearly = Math.round((avg_1 + mid + avg_2) / 3);
            }

            if (final_result === '' && yearly !== '' && final_exam !== '') {
                final_result = Math.round((yearly + final_exam) / 2);
            }

            if(m1_1 !== '') grades.Term1_Month1 = m1_1;
            if(m2_1 !== '') grades.Term1_Month2 = m2_1;
            if(m3_1 !== '') grades.Term1_Month3 = m3_1;
            if(avg_1 !== '') grades.Term1_Avg = avg_1;

            if(mid !== '') grades.MidYear_Exam = mid;

            if(m1_2 !== '') grades.Term2_Month1 = m1_2;
            if(m2_2 !== '') grades.Term2_Month2 = m2_2;
            if(m3_2 !== '') grades.Term2_Month3 = m3_2;
            if(avg_2 !== '') grades.Term2_Avg = avg_2;

            if(yearly !== '') grades.Yearly_Effort = yearly;
            if(final_exam !== '') grades.Final_Exam = final_exam;
            if(final_result !== '') grades.Final_Result = final_result;

            if(Object.keys(grades).length > 0) {
                gradesPayload.push({ studentId, grades });
            }
        }

        if(gradesPayload.length === 0) {
            e.target.value = '';
            return alert('لم يتم العثور على درجات في الملف.');
        }

        Swal.fire({ title: 'جاري حفظ درجات الإكسل...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        const result = await callApi('submitGrades', { subject: subject, grades: gradesPayload });
        e.target.value = ''; 

        if (result.success) {
            Swal.fire('نجاح', 'تم رفع وحساب الدرجات وإرسالها للمراجعة بنجاح.', 'success');
            const sec = document.getElementById('teacherSections').value;
            if(sec) loadStudentsForGrading();
        } else {
            Swal.fire('خطأ', result.message, 'error');
        }
    };
    reader.readAsBinaryString(file);
}

// ==========================================================
//               دوال الإكسل الشامل (الماستر) الجديد
// ==========================================================

const ARABIC_GRADE_MAP = {
    'Term1_Month1': 'شهر 1 (ف1)', 'Term1_Month2': 'شهر 2 (ف1)', 'Term1_Month3': 'شهر 3 (ف1)', 'Term1_Avg': 'سعي (ف1)',
    'MidYear_Exam': 'نصف السنة',
    'Term2_Month1': 'شهر 1 (ف2)', 'Term2_Month2': 'شهر 2 (ف2)', 'Term2_Month3': 'شهر 3 (ف2)', 'Term2_Avg': 'سعي (ف2)',
    'Yearly_Effort': 'السعي السنوي', 'Final_Exam': 'الامتحان النهائي', 'Final_Result': 'الدرجة النهائية'
};

async function downloadMasterExcel() {
    const studentClass = document.getElementById('masterClass').value;
    const studentSection = document.getElementById('masterSection').value;
    
    if (!studentClass) return alert('الرجاء تحديد الصف أولاً.');

    const selectedSubjects = Array.from(document.querySelectorAll('.master-subject-cb:checked')).map(cb => cb.value);
    const selectedTypes = Array.from(document.querySelectorAll('#masterGradeTypesContainer input:checked')).map(cb => cb.value);

    if (selectedSubjects.length === 0 || selectedTypes.length === 0) return alert('يجب اختيار مادة واحدة ونوع درجة واحد على الأقل.');

    Swal.fire({ title: 'جاري استخراج البيانات السابقة...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const result = await callApi('getMasterExcelData', { studentClass, studentSection });
    if (!result.success) return Swal.fire('خطأ', result.message, 'error');

    const row1 = ['ID الطالب', 'اسم الطالب', 'الشعبة'];
    const row2 = ['', '', ''];
    const merges = [];
    let colIndex = 3;

    selectedSubjects.forEach(subj => {
        row1[colIndex] = subj; // وضع اسم المادة
        merges.push({ s: {r: 0, c: colIndex}, e: {r: 0, c: colIndex + selectedTypes.length - 1} }); // دمج الخلايا للمادة
        
        selectedTypes.forEach(type => {
            row2[colIndex] = ARABIC_GRADE_MAP[type];
            colIndex++;
        });
        // ملء الفراغات في الصف الأول بسبب الدمج
        while (row1.length < colIndex) row1.push('');
    });

    const data = [row1, row2];

    result.students.forEach(s => {
        const rowData = [s.studentId, s.name, s.section];
        const studentGrades = result.grades[s.studentId] || {};
        
        selectedSubjects.forEach(subj => {
            const subjGrades = studentGrades[subj] || {};
            selectedTypes.forEach(type => {
                rowData.push(subjGrades[type] !== undefined ? subjGrades[type] : '');
            });
        });
        data.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!merges'] = merges; // تطبيق دمج الخلايا
    if(!ws['!views']) ws['!views'] = [];
    ws['!views'][0] = { rightToLeft: true }; 

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الشيت_الشامل");
    XLSX.writeFile(wb, `الشيت_الشامل_${studentClass}_${studentSection}.xlsx`);
    Swal.close();
}


async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const subject = document.getElementById('teacherSubjects').value;
    if (!subject) {
        e.target.value = '';
        return alert('الرجاء اختيار المادة قبل رفع الملف.');
    }

    const reader = new FileReader();
    reader.onload = async function(evt) {
        const data = evt.target.result;
        const workbook = XLSX.read(data, {type: 'binary'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});

        const gradesPayload = [];
        // نبدأ من الصف الثاني لأن السطر الأول هو العناوين
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue; 

            const studentId = String(row[0]);
            const grades = {};

            const getVal = (idx) => (row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') ? Number(row[idx]) : '';

            // استخراج القيم من الأعمدة بناءً على الترتيب في التنزيل
            let m1_1 = getVal(3), m2_1 = getVal(4), m3_1 = getVal(5), avg_1 = getVal(6);
            let mid = getVal(7);
            let m1_2 = getVal(8), m2_2 = getVal(9), m3_2 = getVal(10), avg_2 = getVal(11);
            let yearly = getVal(12), final_exam = getVal(13), final_result = getVal(14);

            // الحساب التلقائي إذا كانت حقول السعي فارغة في الإكسل
            if (avg_1 === '') {
                let sum = 0, count = 0;
                if(m1_1 !== '') { sum += m1_1; count++; }
                if(m2_1 !== '') { sum += m2_1; count++; }
                if(m3_1 !== '') { sum += m3_1; count++; }
                if (count > 0) avg_1 = Math.round(sum / count);
            }

            if (avg_2 === '') {
                let sum = 0, count = 0;
                if(m1_2 !== '') { sum += m1_2; count++; }
                if(m2_2 !== '') { sum += m2_2; count++; }
                if(m3_2 !== '') { sum += m3_2; count++; }
                if (count > 0) avg_2 = Math.round(sum / count);
            }

            if (yearly === '' && avg_1 !== '' && mid !== '' && avg_2 !== '') {
                yearly = Math.round((avg_1 + mid + avg_2) / 3);
            }

            if (final_result === '' && yearly !== '' && final_exam !== '') {
                final_result = Math.round((yearly + final_exam) / 2);
            }

            // إضافتها للحزمة
            if(m1_1 !== '') grades.Term1_Month1 = m1_1;
            if(m2_1 !== '') grades.Term1_Month2 = m2_1;
            if(m3_1 !== '') grades.Term1_Month3 = m3_1;
            if(avg_1 !== '') grades.Term1_Avg = avg_1;

            if(mid !== '') grades.MidYear_Exam = mid;

            if(m1_2 !== '') grades.Term2_Month1 = m1_2;
            if(m2_2 !== '') grades.Term2_Month2 = m2_2;
            if(m3_2 !== '') grades.Term2_Month3 = m3_2;
            if(avg_2 !== '') grades.Term2_Avg = avg_2;

            if(yearly !== '') grades.Yearly_Effort = yearly;
            if(final_exam !== '') grades.Final_Exam = final_exam;
            if(final_result !== '') grades.Final_Result = final_result;

            if(Object.keys(grades).length > 0) {
                gradesPayload.push({ studentId, grades });
            }
        }

        if(gradesPayload.length === 0) {
            e.target.value = '';
            return alert('لم يتم العثور على درجات في الملف.');
        }

        Swal.fire({ title: 'جاري حفظ درجات الإكسل...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        const result = await callApi('submitGrades', { subject: subject, grades: gradesPayload });
        e.target.value = ''; 

        if (result.success) {
            Swal.fire('نجاح', 'تم رفع وحساب الدرجات وإرسالها للمراجعة بنجاح.', 'success');
            // إعادة تحميل الواجهة لعرض الدرجات
            const sec = document.getElementById('teacherSections').value;
            if(sec) loadStudentsForGrading();
        } else {
            Swal.fire('خطأ', result.message, 'error');
        }
    };
    reader.readAsBinaryString(file);
}

// ==========================================================
//               دوال الإكسل الشامل (الماستر) الجديد
// ==========================================================

const ARABIC_GRADE_MAP = {
    'Term1_Month1': 'شهر 1 (ف1)', 'Term1_Month2': 'شهر 2 (ف1)', 'Term1_Month3': 'شهر 3 (ف1)', 'Term1_Avg': 'سعي (ف1)',
    'MidYear_Exam': 'نصف السنة',
    'Term2_Month1': 'شهر 1 (ف2)', 'Term2_Month2': 'شهر 2 (ف2)', 'Term2_Month3': 'شهر 3 (ف2)', 'Term2_Avg': 'سعي (ف2)',
    'Yearly_Effort': 'السعي السنوي', 'Final_Exam': 'الامتحان النهائي', 'Final_Result': 'الدرجة النهائية'
};

async function downloadMasterExcel() {
    const studentClass = document.getElementById('masterClass').value;
    const studentSection = document.getElementById('masterSection').value;
    
    if (!studentClass) return alert('الرجاء تحديد الصف أولاً.');

    // جلب المواد والسعيات المختارة
    const selectedSubjects = Array.from(document.querySelectorAll('.master-subject-cb:checked')).map(cb => cb.value);
    const selectedTypes = Array.from(document.querySelectorAll('#masterGradeTypesContainer input:checked')).map(cb => cb.value);

    if (selectedSubjects.length === 0 || selectedTypes.length === 0) return alert('يجب اختيار مادة واحدة ونوع درجة واحد على الأقل.');

    Swal.fire({ title: 'جاري استخراج البيانات السابقة...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const result = await callApi('getMasterExcelData', { studentClass, studentSection });
    if (!result.success) return Swal.fire('خطأ', result.message, 'error');

    // بناء رأس الجدول المزدوج للإكسل (الصف 1 للمواد، الصف 2 للسعيات)
    const row1 = ['ID الطالب', 'اسم الطالب', 'الشعبة'];
    const row2 = ['', '', ''];
    const merges = [];
    let colIndex = 3;

    selectedSubjects.forEach(subj => {
        row1[colIndex] = subj; // وضع اسم المادة
        merges.push({ s: {r: 0, c: colIndex}, e: {r: 0, c: colIndex + selectedTypes.length - 1} }); // دمج الخلايا للمادة
        
        selectedTypes.forEach(type => {
            row2[colIndex] = ARABIC_GRADE_MAP[type];
            colIndex++;
        });
        // ملء الفراغات في الصف الأول بسبب الدمج
        while (row1.length < colIndex) row1.push('');
    });

    const data = [row1, row2];

    // وضع بيانات الطلاب والدرجات السابقة المحفوظة
    result.students.forEach(s => {
        const rowData = [s.studentId, s.name, s.section];
        const studentGrades = result.grades[s.studentId] || {};
        
        selectedSubjects.forEach(subj => {
            const subjGrades = studentGrades[subj] || {};
            selectedTypes.forEach(type => {
                rowData.push(subjGrades[type] !== undefined ? subjGrades[type] : '');
            });
        });
        data.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!merges'] = merges; // تطبيق دمج الخلايا
    if(!ws['!views']) ws['!views'] = [];
    ws['!views'][0] = { rightToLeft: true }; 

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الشيت_الشامل");
    XLSX.writeFile(wb, `الشيت_الشامل_${studentClass}_${studentSection}.xlsx`);
    Swal.close();
}

async function handleMasterExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const data = evt.target.result;
            const workbook = XLSX.read(data, {type: 'binary'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});

            if (rows.length < 3) {
                e.target.value = '';
                return alert('الملف فارغ أو تنسيقه غير صحيح. تأكد من أنك تستخدم النموذج المخصص للإكسل الشامل.');
            }

            const header1 = rows[0] || []; // صف المواد
            const header2 = rows[1] || []; // صف السعيات

            // بناء خريطة للأعمدة
            const colMapping = {};
            let currentSubject = '';
            
            // البحث في الأعمدة ابتداءً من العمود الرابع (الرقم 3 برمجياً)
            const maxCols = Math.max(header1.length, header2.length);
            for (let c = 3; c < maxCols; c++) {
                if (header1[c] && String(header1[c]).trim() !== '') {
                    currentSubject = String(header1[c]).trim();
                }
                if (currentSubject && header2[c]) {
                    const arabicType = String(header2[c]).trim();
                    const englishType = Object.keys(ARABIC_GRADE_MAP).find(key => ARABIC_GRADE_MAP[key] === arabicType);
                    if (englishType) {
                        colMapping[c] = { subject: currentSubject, type: englishType };
                    }
                }
            }

            const gradesPayload = [];
            
            // فحص الدرجات من الصف الثالث نزولاً (الرقم 2 برمجياً)
            for (let i = 2; i < rows.length; i++) {
                const row = rows[i];
                if (!row || !row[0]) continue;
                
                const studentId = String(row[0]).trim();
                if (!studentId) continue;

                const studentSubjectGrades = {}; // تجميع حسب المادة للطالب الواحد
                
                for (let c = 3; c < row.length; c++) {
                    const map = colMapping[c];
                    
                    // (مهم جداً) إذا لم يتعرف على العمود، يتخطاه بدلاً من إظهار خطأ
                    if (!map || !map.subject) continue; 

                    const val = row[c];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        if (!studentSubjectGrades[map.subject]) {
                            studentSubjectGrades[map.subject] = {};
                        }
                        studentSubjectGrades[map.subject][map.type] = Number(val);
                    }
                }
                
                // تحويل التجميع إلى صيغة الـ Payload الخاصة بالسيرفر
                for (const subj in studentSubjectGrades) {
                    if (Object.keys(studentSubjectGrades[subj]).length > 0) {
                        gradesPayload.push({
                            studentId: studentId,
                            subject: subj, // وضع المادة هنا
                            grades: studentSubjectGrades[subj]
                        });
                    }
                }
            }

            if (gradesPayload.length === 0) {
                e.target.value = '';
                return alert('لم يتم العثور على أي درجات جديدة في الملف. تأكد من تعبئة الدرجات تحت الأعمدة الصحيحة.');
            }

            Swal.fire({ title: 'جاري معالجة الإكسل الشامل...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
            
            // إرسال الحزمة للسيرفر (السيرفر سيقوم أوتوماتيكياً بتخطي الدرجات المطابقة للقديمة)
            const result = await callApi('submitGrades', { grades: gradesPayload });
            e.target.value = ''; 

            if (result.success) {
                Swal.fire('نجاح', 'تم رفع الملف بنجاح! تم حفظ التعديلات الجديدة وتجاهل الدرجات التي لم تتغير.', 'success');
            } else {
                Swal.fire('خطأ', result.message, 'error');
            }
            
        } catch (error) {
            console.error('Excel Upload Error:', error);
            e.target.value = '';
            Swal.fire('خطأ', 'حدث خطأ أثناء قراءة الملف. يرجى التأكد من أن الملف سليم وغير تالف.', 'error');
        }
    };
    reader.readAsBinaryString(file);
}

// ==========================================================
//               فلترة القوائم المترابطة (للمدرس)
// ==========================================================
function updateTeacherFilters(prefix) {
    try {
        const classSelect = document.getElementById(`${prefix}Classes`);
        const sectionSelect = document.getElementById(`${prefix}Sections`);
        const subjectSelect = document.getElementById(`${prefix}Subjects`);

        if (!classSelect) return;

        const selectedClass = classSelect.value ? String(classSelect.value).trim() : '';
        const assignments = window.teacherRawAssignments || [];
        const s = window.academicStructure || {};
        
        if (!selectedClass || selectedClass === '-- اختر الصف --' || selectedClass === '') {
            if (sectionSelect) sectionSelect.innerHTML = '<option value="">-- اختر الصف أولاً --</option>';
            if (subjectSelect) subjectSelect.innerHTML = '<option value="">-- اختر الصف أولاً --</option>';
            return;
        }

        // جلب المهام المرتبطة بهذا الصف
        const classAssignments = assignments.filter(a => a.class && String(a.class).trim() === selectedClass);

        if (sectionSelect) {
            // استخراج الشعب وإلغاء أي قيم فارغة (لمنع المربعات الصغيرة)
            let assignedSections = [...new Set(classAssignments.map(a => a.section ? String(a.section).trim() : ''))].filter(sec => sec !== '');
            
            let hasAll = assignedSections.includes('الكل');
            
            if (hasAll) {
                if (s.classSections && s.classSections[selectedClass] && s.classSections[selectedClass].length > 0) {
                    assignedSections = s.classSections[selectedClass];
                } else if (s.sections && s.sections.length > 0) {
                    assignedSections = s.sections;
                }
            }
            
            let secOptions = '';
            if (Array.isArray(assignedSections)) {
                assignedSections.forEach(sec => {
                    if (sec && sec !== 'الكل') secOptions += `<option value="${sec}">${sec}</option>`;
                });
            }
            
            // إضافة "الكل" فقط إذا كان يملك أكثر من شعبة
            if(hasAll || assignedSections.length > 1) {
                secOptions = '<option value="الكل">جميع الشعب</option>' + secOptions;
            }

            sectionSelect.innerHTML = secOptions || '<option value="">لا توجد شعب مسندة</option>';
        }

        if (subjectSelect) {
            // استخراج المواد وإلغاء القيم الفارغة
            const subjects = [...new Set(classAssignments.map(a => a.subject ? String(a.subject).trim() : ''))].filter(sub => sub !== '');
            let subOptions = '';
            subjects.forEach(sub => {
                if (sub) subOptions += `<option value="${sub}">${sub}</option>`;
            });
            subjectSelect.innerHTML = subOptions || '<option value="">لا توجد مواد مسندة</option>';
        }
    } catch (e) {
        console.error('Error filtering dropdowns:', e);
    }
}