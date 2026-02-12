import { state, removeDetectedItem, updateDetectedItem, clearCart, learnKeyword, learnBranch } from './state.js';
import { saveData } from './api.js';

export function renderCart() {
    // Deprecated: kept empty to prevent errors if called.
}

export function addToHistory(payload) {
    const historyZone = document.getElementById('historyZone');
    const historyList = document.getElementById('historyList');

    historyZone.classList.remove('hidden');

    // Create history item
    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const totalQ = payload.items.reduce((sum, item) => sum + item.que, 0);

    div.className = 'text-xs text-gray-500 flex justify-between border-b border-gray-100 pb-1 last:border-0';
    div.innerHTML = `
        <span><i class="fa-regular fa-clock mr-1"></i> ${time}</span>
        <span class="font-bold text-emerald-600">บันทึกแล้ว (${totalQ} คิว)</span>
    `;

    historyList.prepend(div);
}

export function renderDetected() {
    const zone = document.getElementById('detectedZone');
    const list = document.getElementById('detectedList');
    const headerTitle = document.getElementById('detectedHeaderTitle');
    const branchSelect = document.getElementById('branchInput');

    zone.classList.remove('hidden');
    list.innerHTML = '';

    const branchName = branchSelect.options[branchSelect.selectedIndex]?.text || 'ไม่ระบุสาขา';
    const totalQty = state.detectedItems.reduce((sum, item) => sum + item.que, 0);

    const dateVal = document.getElementById('dateInput').value;
    let dateDisplay = '';
    if (dateVal) {
        const [y, m, d] = dateVal.split('-');
        dateDisplay = `${d}/${m}/${Number(y) + 543}`;
    }

    const headerHtml = `<i class="fa-solid fa-robot mr-1"></i> รายการที่ตรวจพบ <br><span class="mt-2 text-lg bg-indigo-600 text-white px-3 py-1 rounded-lg shadow-md inline-block">${branchName} | ${dateDisplay} | รวม ${totalQty} คิว</span>`;

    if (!headerTitle) {
        const h3 = zone.querySelector('h3');
        h3.innerHTML = headerHtml;
        h3.id = 'detectedHeaderTitle';
        h3.className = "font-bold text-indigo-800 text-sm flex-1"; // Allow flex grow to not break layout
    } else {
        headerTitle.innerHTML = headerHtml;
    }

    state.detectedItems.forEach((item, index) => {
        // ... (Simulating the complex logic from original renderDetected regarding options generation) ...
        // Note: For brevity in this refactor, I'm assuming we need to regenerate options every time.
        // In a real app, we might optimize this.

        // This part needs access to services. We can import it from state, but usually pass it or read it.
        // Let's assume we read state.services directly.

        let catOptions = `<option value="">เลือกหมวด...</option>`;
        for (const cat in state.services) {
            const selected = item.program === cat ? 'selected' : '';
            catOptions += `<option value="${cat}" ${selected}>${cat}</option>`;
        }

        let subOptions = `<option value="">เลือกบริการ...</option>`;
        if (item.program && state.services[item.program]) {
            state.services[item.program].forEach(s => {
                const selected = (item.sub === s) ? 'selected' : '';
                subOptions += `<option value="${s}" ${selected}>${s}</option>`;
            });
        }

        const isWarning = !item.program || !item.sub;
        const isVerified = item.verified;

        let borderClass = 'border-gray-200 bg-white border-dashed';
        if (isWarning) borderClass = 'border-red-500 ring-2 ring-red-100 bg-red-50';
        else if (isVerified) borderClass = 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200';

        let verifyBtnHtml = '';
        if (isWarning) {
            verifyBtnHtml = `
                <button disabled class="w-full mt-3 py-2 rounded-lg bg-gray-200 text-gray-400 text-xs font-bold cursor-not-allowed flex items-center justify-center">
                    <i class="fa-solid fa-circle-exclamation mr-1"></i> กรุณาเลือกข้อมูลให้ครบ
                </button>
            `;
        } else if (isVerified) {
            verifyBtnHtml = `
                <button data-index="${index}" data-action="unverify" class="verify-btn w-full mt-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-bold transition-colors flex items-center justify-center">
                    <i class="fa-solid fa-check-circle mr-1"></i> ตรวจสอบแล้ว (แก้ไข)
                </button>
            `;
        } else {
            verifyBtnHtml = `
                <button data-index="${index}" data-action="verify" class="verify-btn w-full mt-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-md transform active:scale-95 text-xs font-bold transition-all flex items-center justify-center">
                    <i class="fa-regular fa-square-check mr-1"></i> ยืนยันความถูกต้อง
                </button>
            `;
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = `relative p-3 rounded-xl border-2 ${borderClass} shadow-sm text-sm transition-all hover:shadow-md mt-4`;
        itemDiv.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs text-gray-500 font-bold bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                    "${item.originalName}"
                </span>
                <button data-index="${index}" class="remove-detected-btn text-gray-400 hover:text-red-500 transition-colors"><i class="fa-solid fa-times"></i></button>
            </div>
            
            <div class="grid grid-cols-12 gap-2">
                <div class="col-span-4">
                    <select data-index="${index}" data-field="program" class="detected-input w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-none font-bold text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-sm">
                        ${catOptions}
                    </select>
                </div>
                <div class="col-span-6">
                    <select data-index="${index}" data-field="sub" class="detected-input w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-none font-bold text-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-sm">
                        ${subOptions}
                    </select>
                </div>
                <div class="col-span-2">
                    <input type="number" min="1" value="${item.que}" data-index="${index}" data-field="que" class="detected-input w-full text-center bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-sm">
                </div>
            </div>
            ${verifyBtnHtml}
        `;
        list.appendChild(itemDiv);
    });

    // --- NEW: Summary Calculation ---
    // Group by Program + Sub
    const summaryMap = {};
    let totalQue = 0;

    state.detectedItems.forEach(item => {
        const key = item.sub || item.program;
        if (!summaryMap[key]) summaryMap[key] = 0;
        summaryMap[key] += parseInt(item.que) || 0;
        totalQue += parseInt(item.que) || 0;
    });

    // Generate Summary HTML
    let summaryHtml = '';
    for (const [name, qty] of Object.entries(summaryMap)) {
        summaryHtml += `
            <div class="flex justify-between items-center text-xs text-gray-600 mb-1">
                <span>• ${name}</span>
                <span class="font-bold">x${qty}</span>
            </div>`;
    }

    if (state.detectedItems.length > 0) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'mt-4 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200';
        summaryDiv.innerHTML = `
            <h4 class="font-bold text-gray-700 text-xs mb-2 border-b border-gray-200 pb-1">สรุปรายการที่รออนุมัติ</h4>
            <div class="mb-2 max-h-32 overflow-y-auto">
                ${summaryHtml}
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-gray-200">
                <span class="font-bold text-gray-500 text-xs">รวมทั้งสิ้น</span>
                <span class="font-bold text-indigo-600 text-lg">${totalQue} คิว</span>
            </div>
        `;
        list.appendChild(summaryDiv);
    }

    // Attach Event Listeners
    attachDetectedEvents();
}

function attachDetectedEvents() {
    document.querySelectorAll('.remove-detected-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            removeDetectedItem(index);
            renderDetected();
            if (state.detectedItems.length === 0) document.getElementById('detectedZone').classList.add('hidden');
        });
    });

    document.querySelectorAll('.detected-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            const field = e.currentTarget.dataset.field;
            const value = e.currentTarget.value;

            if (field === 'program') {
                updateDetectedItem(index, 'program', value);

                // --- LEARNING TRIGGER (Program) ---
                const item = state.detectedItems[index];
                if (item && item.originalName && value) {
                    learnKeyword(item.originalName, value, item.sub); // Keep existing sub if any, or empty

                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
                    Toast.fire({ icon: 'success', title: `จำหมวดแล้ว! "${item.originalName}" = ${value}` });
                }
                // ------------------------

                renderDetected();
            } else if (field === 'sub') {
                updateDetectedItem(index, 'sub', value);

                // --- LEARNING TRIGGER (Sub) ---
                const item = state.detectedItems[index];
                if (item && item.originalName && item.program && value) {
                    learnKeyword(item.originalName, item.program, value);

                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
                    Toast.fire({ icon: 'success', title: `จำบริการแล้ว! "${item.originalName}" = ${value}` });
                }
                // ------------------------

                renderDetected();
            } else if (field === 'que') {
                updateDetectedItem(index, 'que', value);
                renderDetected();
            }
        });
    });

    document.querySelectorAll('.verify-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            const action = e.currentTarget.dataset.action;
            updateDetectedItem(index, 'verified', action === 'verify');
            renderDetected();
        });
    });
}
