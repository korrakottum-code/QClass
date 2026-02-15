import { DEFAULT_API_URL } from './config.js';
import { state, setDetectedItems, addToCart } from './state.js';
import { loadConfig, fetchDashboardData } from './api.js';
import { renderCart, renderDetected, addToHistory } from './ui.js';
import { processSmartInput as analyzeText, extractHeaderData } from './logic.js';
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
    try {
        const success = await loadConfig(API_URL);
        if (!success) {
            Swal.fire({
                icon: 'error',
                title: 'โหลดการตั้งค่าไม่สำเร็จ',
                text: 'ไม่สามารถดึงข้อมูลจาก Google Sheet ได้ (' + API_URL + ') กรุณาตรวจสอบ URL หรือลองใหม่',
                footer: '<a href="#" onclick="loadConfig()">ลองใหม่ (Retry)</a>'
            });
        }
    } catch (error) {
        console.error("Init Error:", error);
        Swal.fire({
            icon: 'error',
            title: 'เชื่อมต่อล้มเหลว',
            html: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${error.message}<br><small class="text-gray-400 mt-2 block break-all text-xs">${API_URL}</small>`
        });
    }

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

    if (Object.keys(state.branchMap).length === 0) {
        branchSelect.innerHTML = '<option value="">ไม่พบข้อมูลสาขา (ตรวจสอบการตั้งค่า)</option>';
        return;
    }

    branchSelect.innerHTML = '<option value="">เลือกสาขา...</option>';
    for (const [name, code] of Object.entries(state.branchMap)) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.innerText = `${name} (${code})`;
        branchSelect.appendChild(opt);
    }
}

function attachGlobalEvents() {
    // Top Bar
    window.toggleSettings = async () => {
        const box = document.getElementById('settingsBox');

        // If already showing, just hide it
        if (!box.classList.contains('hidden')) {
            box.classList.add('hidden');
            return;
        }

        // Verify Admin
        const { value: pass } = await Swal.fire({
            title: 'Admin Only',
            input: 'password',
            inputLabel: 'ใส่รหัสผ่านเพื่อตั้งค่า (PIN)',
            inputPlaceholder: 'Pin Code',
            inputAttributes: {
                maxlength: 10,
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            showCancelButton: true
        });

        // Default PIN: 9999 (Hardcoded for now, can be changed later)
        if (pass === '9999' || pass === 'admin') {
            box.classList.remove('hidden');
        } else if (pass) {
            Swal.fire({
                icon: 'error',
                title: 'รหัสผิด!',
                text: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    window.saveApiUrl = () => {
        const url = document.getElementById('apiUrl').value.trim();
        if (url) {
            localStorage.setItem('API_URL', url);
            API_URL = url;
        } else {
            // If empty, reset to default
            localStorage.removeItem('API_URL');
            API_URL = DEFAULT_API_URL;
        }
    };

    window.resetApiUrl = () => {
        localStorage.removeItem('API_URL');
        API_URL = DEFAULT_API_URL;
        document.getElementById('apiUrl').value = '';
        Swal.fire({ icon: 'success', title: 'Reset Default', text: 'กลับมาใช้ค่าเริ่มต้นแล้วครับ', timer: 1500, showConfirmButton: false });
        initializeConfig();
    };

    window.loadConfig = () => {
        initializeConfig();
    }

    // Manual Input
    document.getElementById('programInput').addEventListener('change', (e) => {
        const program = e.target.value;
        const subSelect = document.getElementById('subInput');

        // Clear old options
        subSelect.innerHTML = '<option value="">2. เลือกบริการย่อย...</option>';
        subSelect.disabled = true;

        if (program && state.services[program]) {
            subSelect.disabled = false;
            state.services[program].forEach(item => {
                const opt = document.createElement('option');
                opt.value = item;
                opt.innerText = item;
                subSelect.appendChild(opt);
            });
        }
    });

    // Branch Change Sync & Learn
    document.getElementById('branchInput').addEventListener('change', (e) => {
        renderDetected(); // Sync header immediately

        // Branch Learning Logic
        const newBranchCode = e.target.value;
        const text = document.getElementById('smartInput').value;
        if (newBranchCode && text.trim()) {
            // Attempt to find a branch keyword in the text that caused a mismatch
            // This is a naive heuristic: if the text contains a word that looks like it SHOULD be the branch
            // We can't know for sure which word without user highlighting, but we can try common words
            // OR we just assume the user wants to associate the *entire* context? No.

            // Allow manual "Teaching" via console or specific UI better? 
            // For now, let's just Log it, or if we want to be smart:
            // If the text contains "โคราช" and user selected "NMA", maybe learn "โคราช" -> "NMA"?
            // But "โคราช" might already be mapped to "KOR". Overwrite?

            // Implementation: Scan keywords? No, too complex to auto-guess.
            // Let's at least sync the UI which is the main bug. 
            // For "Add Learning", I'll add a specific check for common Thai branch names not in the map?

            // Simple Heuristic for "Korat" case
            // If text contains "โคราช" and user selected "NMA", learn "โคราช" -> "NMA"
            // We can add a list of common potential aliases to check against
            const potentialAliases = ['โคราช', 'สยาม', 'อโศก', 'ปิ่นเกล้า', 'บางนา', 'รังสิต', 'พระราม 9', 'เชียงใหม่', 'ขอนแก่น', 'หาดใหญ่', 'อุดร', 'อุบล', 'ชลบุรี', 'พัทยา'];

            const lowerText = text.toLowerCase();
            const foundAlias = potentialAliases.find(alias => lowerText.includes(alias));

            if (foundAlias) {
                import('./state.js').then(module => {
                    // Only learn if it differs from default map? 
                    // Or just overwrite. Overwriting is safer for user correction.
                    module.learnBranch(foundAlias, newBranchCode);

                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
                    Toast.fire({ icon: 'success', title: `จำสาขาแล้ว! "${foundAlias}" = ${newBranchCode}` });
                });
            }
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

        // --- EARLY DUPLICATE CHECK START ---
        const checkDate = document.getElementById('dateInput').value;
        const checkBranch = document.getElementById('branchInput').value;

        if (checkDate && checkBranch) {
            checkDuplicateRecords(checkDate, checkBranch).then(duplicates => {
                if (duplicates && duplicates.length > 0) {
                    Swal.fire({
                        title: 'มีข้อมูลสาขานี้แล้ว!',
                        html: duplicates.summaryHtml || `
                            <p class="text-sm text-gray-600 mb-2">พบข้อมูล <b>${checkBranch}</b> วันที่ <b>${checkDate}</b> อยู่แล้ว <br>ต้องการทำรายการอย่างไร?</p>
                            <ul class="text-left text-xs bg-red-50 p-2 rounded text-red-600 mb-2 max-h-32 overflow-y-auto">
                                 ${duplicates.map(r => `<li>• มี ${r.totalQue} คิว (บันทึกเมื่อ ${new Date(r.timestamp).toLocaleTimeString()})</li>`).join('')}
                            </ul>
                        `,
                        icon: 'warning',
                        showDenyButton: true,
                        showCancelButton: true,
                        confirmButtonText: 'ลบอันเก่า (ลงใหม่) 🗑️',
                        denyButtonText: 'แก้ไขอันเดิม ✏️',
                        cancelButtonText: 'ยกเลิก ❌',
                        confirmButtonColor: '#ef4444',
                        denyButtonColor: '#f59e0b',
                        cancelButtonColor: '#9ca3af',
                        reverseButtons: true
                    }).then((result) => {
                        if (result.isConfirmed) {
                            // Option 1: Overwrite (Delete Old & Save New)
                            // Logic: Allow them to import new text.
                            // On Save, we will delete old.
                            // But for clarity, we can just proceed with parsing.
                            proceedWithParsing(text);
                        } else if (result.isDenied) {
                            // Option 2: Edit Existing
                            loadRecordsToUI(duplicates);
                            Swal.fire('โหลดข้อมูลเดิมแล้ว', 'แก้ไขรายการที่ต้องการ แล้วกดบันทึกใหม่ได้เลยครับ (ระบบจะถามให้ทับอันเดิม)', 'info');
                        }
                    });
                } else {
                    // No duplicates, proceed
                    proceedWithParsing(text);
                }
            });
            return; // Stop here, let async check handle logic
        } else {
            proceedWithParsing(text);
        }
    };

    function proceedWithParsing(text) {
        const items = analyzeText(text);
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

    window.confirmDetected = async () => {
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

        await saveData(state.detectedItems);
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

    window.saveData = async (customItems = null) => {
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
        const branchCode = branchSelect.value;

        // --- BRANCH VALIDATION ---
        if (!branchCode) {
            Swal.fire({
                icon: 'warning',
                title: 'ยังไม่ได้เลือกสาขา!',
                html: '<p class="text-sm text-gray-600">กรุณาเลือกสาขาก่อนบันทึกข้อมูลครับ</p>',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#f59e0b'
            });
            // Highlight the branch dropdown
            branchSelect.focus();
            branchSelect.style.border = '2px solid #ef4444';
            branchSelect.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
            setTimeout(() => {
                branchSelect.style.border = '';
                branchSelect.style.boxShadow = '';
            }, 3000);
            return;
        }
        const totalQue = items.reduce((sum, item) => sum + item.que, 0);
        const totalItems = items.length;

        // --- DUPLICATE CHECK START ---
        // Fetch existing data for this date & branch
        Swal.fire({
            title: 'กำลังตรวจสอบข้อมูล...',
            text: 'Checking for duplicates',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            // Fetch for THIS date
            const response = await fetch(`${API_URL}?action=get_dashboard&startDate=${date}&endDate=${date}&_=${Date.now()}`);
            const resData = await response.json();

            // Filter checking for SAME Branch, excluding deleted records (que: 0)
            let duplicateRecords = [];
            if (resData.status === 'success' && Array.isArray(resData.records)) {
                duplicateRecords = resData.records.filter(r => {
                    if (r.branch !== branchCode) return false;
                    // Exclude records where all items have que: 0 (deleted)
                    if (!r.items || !Array.isArray(r.items)) return false;
                    return r.items.some(item => parseInt(item.que) > 0);
                });
            }

            if (duplicateRecords.length > 0) {
                // Found duplicates!
                const result = await Swal.fire({
                    title: 'มีข้อมูลสาขานี้แล้ว!',
                    html: duplicateRecords.summaryHtml || `
                        <p class="text-sm text-gray-600 mb-2">พบข้อมูล <b>${branchName}</b> วันที่ <b>${date}</b> อยู่แล้ว <br>ต้องการทำรายการอย่างไร?</p>
                        <ul class="text-left text-xs bg-red-50 p-2 rounded text-red-600 mb-2 max-h-32 overflow-y-auto">
                             ${duplicateRecords.map(r => `<li>• มี ${r.totalQue} คิว (บันทึกเมื่อ ${new Date(r.timestamp).toLocaleTimeString()})</li>`).join('')}
                        </ul>
                    `,
                    icon: 'warning',
                    showDenyButton: true,
                    showCancelButton: true,
                    confirmButtonText: 'ลบอันเก่า (ลงใหม่) 🗑️',
                    denyButtonText: 'แก้ไขอันเดิม ✏️',
                    cancelButtonText: 'ยกเลิก ❌',
                    confirmButtonColor: '#ef4444',
                    denyButtonColor: '#f59e0b',
                    cancelButtonColor: '#9ca3af',
                    reverseButtons: true
                });

                if (result.isConfirmed) {
                    // Option 1: Delete Old & Save New
                    // We need to overwrite existing records with 0 logic first
                    await overwriteOldRecords(duplicateRecords);
                    // Then continue to save NEW items below
                }
                else if (result.isDenied) {
                    // Option 2: Edit Existing -> Load into UI
                    loadRecordsToUI(duplicateRecords);
                    // Need to also queue these old records for deletion upon NEW save?
                    // Yes, we will simulate "Delete Old" logic when they hit save again.
                    // But wait, `saveData` checks again next time? 
                    // No, duplicates check will happen again.
                    // Best approach: "Delete Old" IMMEDIATELY (Safety copy first?) 
                    // OR: Flag them to be deleted when saving. 

                    // Let's do: Load into Detect Zone, and let the user modify.
                    // When they click Save again, duplicate check will fire again.
                    // They will likely choose "Delete Old & Save New" then?
                    // To make it smoother: 
                    // We can just load them and instruct user "แก้ไขเสร็จแล้วกดบันทึก (เลือกทับอันเดิม)"
                    Swal.fire('โหลดข้อมูลเดิมแล้ว', 'แก้ไขรายการที่ต้องการ แล้วกดบันทึกใหม่ได้เลยครับ (ระบบจะถามให้ทับอันเดิม)', 'info');
                    return; // Stop saving now
                } else {
                    return; // Cancel
                }
            }

        } catch (error) {
            console.error("Duplicate Check Error:", error);
            // If fetch fails, ask user to proceed riskily?
            const proceed = await Swal.fire({
                title: 'เช็คข้อมูลเก่าไม่ได้',
                text: 'ไม่สามารถตรวจสอบข้อมูลซ้ำได้ (เน็ตหลุด?) ต้องการบันทึกเลยไหม?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'บันทึกเลย (เสี่ยงทับ)',
                cancelButtonText: 'ยกเลิก'
            });
            if (!proceed.isConfirmed) return;
        }
        // --- DUPLICATE CHECK END ---

        // Format Date for display
        const [y, m, d] = date.split('-');
        const dateDisplay = `${d}/${m}/${Number(y) + 543}`;
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

    async function overwriteOldRecords(records) {
        // Zero out quantities
        const promises = records.map(rec => {
            // Need to update EACH item in the record? 
            // The API expects 'update_record' action with date, branch, program, sub, que.
            // Wait, records structure is: { id, date, branch, items: [ {program, sub, que}, ...], totalQue }

            // We need to iterate ALL items in this record and set them to 0??
            // Actually, if we send a new submission, it appends.
            // If main logic is "Append", then old data remains.
            // So yes, we MUST set old data to 0 to "Flag as deleted/cancelled".

            const itemPromises = rec.items.map(item => {
                const payload = {
                    action: 'update_record',
                    date: rec.date,
                    branch: rec.branch,
                    program: item.program,
                    sub: item.sub || '',
                    que: 0 // DELETE (Zero out)
                };
                const queryString = new URLSearchParams(payload).toString();
                return fetch(`${API_URL}?${queryString}`).then(r => r.json());
            });
            return Promise.all(itemPromises);
        });

        Swal.fire({
            title: 'กำลังลบข้อมูลเก่า...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        await Promise.all(promises);
    }

    function loadRecordsToUI(records) {
        // Flatten all items from all duplicate records
        let allItems = [];
        records.forEach(rec => {
            rec.items.forEach(item => {
                // Ignore zero items if any
                if (parseInt(item.que) > 0) {
                    allItems.push({
                        id: Date.now() + Math.random(),
                        program: item.program,
                        sub: item.sub || '',
                        que: parseInt(item.que),
                        verified: true // Already from DB, so verified
                    });
                }
            });
        });

        setDetectedItems(allItems);
        renderDetected();
        document.getElementById('detectedZone').classList.remove('hidden');
        document.getElementById('smartInput').value = ''; // clear input
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

// Helper for Duplicate Check
async function checkDuplicateRecords(date, branchCode) {
    try {
        Swal.fire({
            title: 'กำลังตรวจสอบข้อมูล...',
            text: 'Checking for duplicates',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const response = await fetch(`${API_URL}?action=get_dashboard&startDate=${date}&endDate=${date}&_=${Date.now()}`);
        const resData = await response.json();

        Swal.close(); // Close loading

        if (resData.status === 'success' && Array.isArray(resData.records)) {
            // Filter by branch AND exclude deleted records (all items que: 0)
            const duplicates = resData.records.filter(r => {
                if (r.branch !== branchCode) return false;
                if (!r.items || !Array.isArray(r.items)) return false;
                return r.items.some(item => parseInt(item.que) > 0);
            });

            if (duplicates.length > 0) {
                // Aggregate items for summary
                let totalQue = 0;
                let itemsSummary = [];

                duplicates.forEach(rec => {
                    totalQue += parseInt(rec.totalQue || 0);
                    if (rec.items && Array.isArray(rec.items)) {
                        rec.items.forEach(item => {
                            // Group by "Program - Sub"
                            const key = `${item.program} - ${item.sub || ''}`;
                            const existing = itemsSummary.find(i => i.key === key);
                            if (existing) {
                                existing.que += parseInt(item.que);
                            } else {
                                itemsSummary.push({ key, name: key, que: parseInt(item.que) });
                            }
                        });
                    }
                });

                // Generate HTML for SweetAlert
                const itemsHtml = itemsSummary.map(i =>
                    `<li class="flex justify-between border-b border-orange-100 last:border-0 py-1"><span>${i.name}</span> <span class="font-bold bg-white px-2 rounded text-orange-600">${i.que}</span></li>`
                ).join('');

                // We need to pass this structure to the caller? 
                // Wait, if I change the return type, I break the caller which expects an array of records?
                // The caller (`saveData` / `processSmartInput`) uses `duplicates.length`.
                // If I return the ORIGINAL records array, I can attach the summary HTML to it? 
                // Or I can just continue returning records, BUT I missed the point:
                // The ALERT is inside the CALLER in my previous code (step 289/321).
                // I need to update the Alert HTML in the CALLER.

                // Let's look at `saveData` again.
                // It calls `checkDuplicateRecords`.
                // `checkDuplicateRecords` returns `duplicates` array.
                // Then `saveData` constructs the `Swal`.

                // So updating `checkDuplicateRecords` to just return data is NOT enough if the Swal is in `saveData`.
                // I need to update `saveData` and `processSmartInput`.

                // However, I can attach the `summaryHtml` property to the returned array!
                duplicates.summaryHtml = `
                    <div class="text-left text-gray-700">
                        <div class="bg-orange-50 p-3 rounded-lg border border-orange-200 mb-3">
                            <p class="font-bold text-orange-800 mb-2 border-b border-orange-200 pb-1">📌 ข้อมูลเดิม (${duplicates.length} รายการ):</p>
                            <ul class="text-xs space-y-1 mb-2 max-h-40 overflow-y-auto pr-1">
                                ${itemsHtml}
                            </ul>
                            <div class="border-t border-orange-200 pt-2 flex justify-between text-sm font-bold text-orange-900 mt-2">
                                <span>รวมทั้งหมด</span>
                                <span>${totalQue} คิว</span>
                            </div>
                        </div>
                    </div>
                `;
                return duplicates;
            }
            return [];
        }
        return [];
    } catch (error) {
        console.error("Duplicate Check Error:", error);
        Swal.close();
        return [];
    }
}
