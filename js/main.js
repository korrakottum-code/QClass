import { DEFAULT_API_URL } from './config.js';
import { state, setDetectedItems, addToCart } from './state.js';
import { loadConfig } from './api.js';
import { renderCart, renderDetected, addToHistory } from './ui.js';
import { processSmartInput, extractHeaderData, guessCategory } from './logic.js';
import { saveData as apiSaveData } from './api.js';


let API_URL = localStorage.getItem('API_URL') || DEFAULT_API_URL;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('dateInput').valueAsDate = new Date();

    if (API_URL) {
        document.getElementById('apiUrl').value = API_URL;
        await initializeConfig();
    } else {
        toggleSettings();
    }

    attachGlobalEvents();
});

async function initializeConfig() {
    await loadConfig(API_URL);
    // UI updates for branch/program after config load are handled via state/dom in api.js? 
    // Wait, loadConfig only updates state. We need to render options.
    // Let's implement renderOptions here or in UI.
    // For simplicity, let's do it here or call a UI function.

    renderProgramOptions();
    renderBranchOptions();
}

function renderProgramOptions() {
    const programSelect = document.getElementById('programInput');
    programSelect.innerHTML = '<option value="">1. เลือกหมวดหมู่...</option>';
    for (const cat in state.services) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        programSelect.appendChild(opt);
    }
}

function renderBranchOptions() {
    const branchSelect = document.getElementById('branchInput');
    branchSelect.innerHTML = '';
    for (const [name, code] of Object.entries(state.branchMap)) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.innerText = `${name} (${code})`;
        branchSelect.appendChild(opt);
    }
}

function attachGlobalEvents() {
    // Top Bar
    window.toggleSettings = () => {
        document.getElementById('settingsBox').classList.toggle('hidden');
    };

    window.saveApiUrl = () => {
        const url = document.getElementById('apiUrl').value.trim();
        if (url) {
            localStorage.setItem('API_URL', url);
            API_URL = url;
        }
    };

    window.loadConfig = () => {
        initializeConfig();
    }

    // Manual Input
    document.getElementById('programInput').addEventListener('change', () => {
        const program = document.getElementById('programInput').value;
        const subSelect = document.getElementById('subInput');
        subSelect.innerHTML = '<option value="">2. เลือกบริการย่อย...</option>';

        if (program && state.services[program]) {
            subSelect.disabled = false;
            state.services[program].forEach(item => {
                const opt = document.createElement('option');
                opt.value = item;
                opt.innerText = item;
                subSelect.appendChild(opt);
            });
        } else {
            subSelect.disabled = true;
        }
    });

    window.addManualItem = () => {
        const program = document.getElementById('programInput').value;
        const sub = document.getElementById('subInput').value;
        const que = parseInt(document.getElementById('queInput').value);

        if (!program || !sub) {
            Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'เลือกหมวดหมู่และบริการย่อย', timer: 1000, showConfirmButton: false });
            return;
        }

        // Add to "Detected Items" list directly, marked as Verified
        const newItem = {
            id: Date.now(),
            program,
            sub,
            que,
            verified: true // Manual items are always verified
        };

        const currentItems = state.detectedItems || [];
        setDetectedItems([...currentItems, newItem]);
        renderDetected();

        // Show the zone if hidden
        document.getElementById('detectedZone').classList.remove('hidden');

        // Reset inputs
        document.getElementById('queInput').value = 1;

        // Optional: Scroll to list?
    };

    // Smart Import
    window.processSmartInput = () => {
        const text = document.getElementById('smartInput').value;
        if (!text.trim()) {
            Swal.fire({ icon: 'info', title: 'ช่องว่าง', text: 'กรุณาวางข้อความก่อนครับ' });
            return;
        }

        // Header Extraction
        const headerData = extractHeaderData(text);
        if (headerData.branch) document.getElementById('branchInput').value = headerData.branch;
        if (headerData.date) {
            const d = new Date(headerData.date);
            if (!isNaN(d.getTime())) document.getElementById('dateInput').value = headerData.date;
        }

        const items = processSmartInput(text);
        if (items.length > 0) {
            setDetectedItems(items);
            renderDetected();
        } else {
            Swal.fire('ไม่พบรายการ', 'ไม่พบรูปแบบรายการสินค้า (เช่น "... 2 คน")', 'warning');
        }
    };

    window.clearDetected = () => {
        setDetectedItems([]);
        document.getElementById('detectedZone').classList.add('hidden');
        document.getElementById('smartInput').value = '';
    };

    window.confirmDetected = () => {
        // 1. Check Missing Data
        const incomplete = state.detectedItems.filter(i => !i.program || !i.sub);
        if (incomplete.length > 0) {
            Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณาเลือกหมวดหมู่และบริการให้ครบถ้วน' });
            return;
        }

        // 2. Check Verification (Manual Tick)
        const unverified = state.detectedItems.filter(i => !i.verified);
        if (unverified.length > 0) {
            Swal.fire({ icon: 'warning', title: 'ยังไม่ได้ตรวจสอบ', text: 'กรุณาติ๊ก "ตรวจสอบแล้ว" ให้ครบทุกรายการเพื่อยืนยันความถูกต้อง' });
            return;
        }

        saveData(state.detectedItems);
    };

    window.removeDetected = (index) => {
        // This is now handled globally in UI.js via dataset, but if onclick remains in HTML, we need this.
        // wait, renderDetected generates HTML with onclick="removeDetected(..)"? 
        // No, I changed renderDetected to use data attributes and addEventListener in ui.js. 
        // So I DON'T need to expose removeDetected/updateDetected to window.
        // However, I DO need to ensure the HTML generated in renderDetected doesn't use onclick=...
        // Let's double check ui.js content I wrote.
        // I used `element.addEventListener` in `attachDetectedEvents`. 
        // However, the HTML string in `ui.js` still had `onclick` attributes 
        // NO, I verified `ui.js` I generated. I REMOVED onclick attributes in the HTML string generation
        // and added classes/data-attributes instead. 
        // Wait, looking at `js/ui.js` code I wrote in previous step:
        // `button onclick="updateDetected(..."` -> I REPLACED this with `class="verify-btn" ...`
        // So we are good.
    };

    // Cart / Save
    window.clearAll = () => {
        state.cart = [];
        renderCart();
    }

    window.saveData = (customItems = null) => {
        // If customItems is event (click), set to null
        if (customItems instanceof Event) customItems = null;

        const items = Array.isArray(customItems) ? customItems : state.cart;

        if (!items || items.length === 0) {
            Swal.fire({ icon: 'error', title: 'ว่างเปล่า', text: 'เพิ่มรายการก่อนบันทึกนะครับ' });
            return;
        }

        if (!API_URL) {
            Swal.fire({ icon: 'error', title: 'No Link', text: 'Please set Google Script URL in settings.' });
            toggleSettings();
            return;
        }

        const date = document.getElementById('dateInput').value;
        const branchSelect = document.getElementById('branchInput');
        const branchName = branchSelect.options[branchSelect.selectedIndex]?.text || branchSelect.value;
        const totalQue = items.reduce((sum, item) => sum + item.que, 0);
        const totalItems = items.length;

        // Format Date for display (e.g., DD/MM/YYYY)
        const [y, m, d] = date.split('-');
        const dateDisplay = `${d}/${m}/${Number(y) + 543}`; // Buddhist Year? Or just regular? Let's use standard or requested. User interface is Thai, usually BE or just clear format. Let's use simple DD/MM/YYYY for now or keep YYYY-MM-DD but large.
        // User said "Check Date Big Text". 
        // Let's use Thai Date format if possible or just clear DD/MM/YYYY.
        const dateObj = new Date(date);
        const dateThai = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

        // STEP 1: Confirm Date
        Swal.fire({
            title: 'เช็ควันที่ก่อนนะ! 📅',
            html: `
                <div class="text-gray-500 text-sm">ยอดนี้เป็นของวันที่</div>
                <div class="text-3xl font-bold text-indigo-600 my-2 border-y-2 border-indigo-100 py-2">
                    ${dateThai}
                </div>
                <div class="text-red-400 text-xs mt-2">*ตรวจสอบให้แน่ใจว่าไม่ได้ลงผิดวัน</div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ถูกต้อง (ไปต่อ) ➡️',
            cancelButtonText: 'ผิด (แก้ไข) ↩️',
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#9ca3af',
            reverseButtons: true
        }).then((step1) => {
            if (step1.isConfirmed) {
                // STEP 2: Confirm Items
                let itemsHtml = '<ul class="text-left text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto border-t border-b border-gray-200 py-2 my-2">';
                items.forEach(item => {
                    itemsHtml += `<li>• <span class="font-bold text-gray-800">${item.sub || item.program}</span> <span class="text-gray-500">x${item.que}</span></li>`;
                });
                itemsHtml += '</ul>';

                Swal.fire({
                    title: 'ยืนยันรายการ 📝',
                    html: `
                        <div class="text-left text-sm bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2">
                            <p><strong>สาขา:</strong> ${branchName}</p>
                            <p><strong>รายการ:</strong> ${totalItems} รายการ</p>
                            ${itemsHtml}
                            <p class="text-right mt-2"><strong>รวมทั้งหมด:</strong> <span class="text-blue-600 font-bold text-lg">${totalQue} คิว</span></p>
                        </div>
                    `,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'ยืนยัน, บันทึกเลย! ✅',
                    cancelButtonText: 'แก้ไขก่อน ❌',
                    confirmButtonColor: '#10b981',
                    cancelButtonColor: '#6b7280'
                }).then((step2) => {
                    if (step2.isConfirmed) {
                        performSave(date, branchSelect.value, items);
                    }
                });
            }
        });
    }

    function performSave(date, branchCode, items) {
        const payload = {
            date: date,
            branch: branchCode,
            items: items
        };

        Swal.fire({
            title: 'กำลังบันทึก...',
            text: 'Sending to Google Sheets',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        apiSaveData(API_URL, payload)
            .then(() => {
                addToHistory(payload);
                state.cart = [];
                addToHistory(payload);
                state.cart = [];
                // renderCart(); // Deprecated
                document.getElementById('smartInput').value = '';

                // Clear detected logic
                setDetectedItems([]);
                document.getElementById('detectedZone').classList.add('hidden');

                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกเรียบร้อย!',
                    text: 'ข้อมูลถูกส่งไปที่ Google Sheet แล้ว',
                    confirmButtonText: 'ตกลง',
                    showConfirmButton: true
                });
            })
            .catch(error => {
                console.error('Save Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'บันทึกไม่สำเร็จ',
                    text: 'เกิดข้อผิดพลาด: ' + error.message
                });
            });
    }

    // Expose Dashboard Functions (Removed as Dashboard is now on separate page)
    // window.switchTab = switchTab;
    // window.filterRecords = filterRecords;
    // window.filterMissing = filterMissing;
    // window.filterLeaderboard = filterLeaderboard;
    // window.editSubmission = editSubmission;

    // Actually, we NEED these exposed because dashboard.html uses inline onclick
    import('./dashboard.js').then(module => {
        window.renderDashboard = module.renderDashboard;
        window.switchTab = module.switchTab;
        window.filterRecords = module.filterRecords;
        window.filterMissing = module.filterMissing;
        window.filterLeaderboard = module.filterLeaderboard;
        window.editBranchGroup = module.editBranchGroup; // NEW

        // Init Dashboard if on dashboard page
        if (window.location.pathname.includes('dashboard.html')) {
            module.initDashboard();
        }
    });
}
