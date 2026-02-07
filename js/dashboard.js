import { state } from './state.js';
// import { generateMockData } from './mock.js'; // REMOVED
import { fetchDashboardData, loadConfig } from './api.js';
import { DEFAULT_API_URL } from './config.js'; // Import Default URL

let mockSubmissions = [];

export async function initDashboard() {
    // Show loading state
    const zone = document.getElementById('dashboardZone');
    zone.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-4xl text-sky-500"></i><p class="mt-4 text-gray-500">กำลังโหลดข้อมูล...</p></div>`;

    try {
        // Ensure Config is loaded for Branch Map (Critical for Missing Reports)
        if (Object.keys(state.branchMap).length === 0) {
            const apiUrl = localStorage.getItem('API_URL') || DEFAULT_API_URL;
            if (apiUrl) {
                console.log("Loading config for Dashboard...");
                await loadConfig(apiUrl);
            }
        }

        const response = await fetchDashboardData();
        console.log("Dashboard Data:", response); // Debug

        if (response && response.status === 'success' && Array.isArray(response.records)) {
            mockSubmissions = response.records;
        } else if (Array.isArray(response)) {
            mockSubmissions = response;
        } else {
            console.warn("Invalid data format or empty:", response);
            mockSubmissions = [];
        }

        renderDashboard();
    } catch (error) {
        console.error("Dashboard Load Error:", error);
        mockSubmissions = [];
        renderDashboard();

        Swal.fire({
            icon: 'error',
            title: 'เชื่อมต่อล้มเหลว',
            text: error.message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000
        });
    }
}

export function renderDashboard() {
    const zone = document.getElementById('dashboardZone');
    zone.innerHTML = `
        <div class="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button onclick="switchTab('records')" id="tab-records" class="tab-btn active px-4 py-2 rounded-lg bg-sky-600 text-white font-bold text-sm whitespace-nowrap">
                <i class="fa-solid fa-list mr-2"></i>รายการย้อนหลัง
            </button>
            <button onclick="switchTab('missing')" id="tab-missing" class="tab-btn px-4 py-2 rounded-lg bg-gray-200 text-gray-600 font-bold text-sm whitespace-nowrap">
                <i class="fa-solid fa-circle-exclamation mr-2"></i>ยังไม่ส่งยอด
            </button>
            <button onclick="switchTab('leaderboard')" id="tab-leaderboard" class="tab-btn px-4 py-2 rounded-lg bg-gray-200 text-gray-600 font-bold text-sm whitespace-nowrap">
                <i class="fa-solid fa-trophy mr-2"></i>อันดับ
            </button>
        </div>

        <div id="dashboardContent" class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 min-h-[300px]">
            <!-- Dynamic Content -->
        </div>
    `;

    // Default View
    renderRecords();
}

export function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-sky-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-600');
    });

    const activeBtn = document.getElementById(`tab-${tabName}`);
    activeBtn.classList.remove('bg-gray-200', 'text-gray-600');
    activeBtn.classList.add('bg-sky-600', 'text-white');

    if (tabName === 'records') renderRecords();
    else if (tabName === 'missing') renderMissing();
    else if (tabName === 'leaderboard') renderLeaderboard();
}

function renderRecords() {
    const today = new Date().toISOString().split('T')[0];
    const content = document.getElementById('dashboardContent');

    content.innerHTML = `
        <div class="mb-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <h3 class="font-bold text-gray-700"><i class="fa-solid fa-layer-group mr-2 text-sky-600"></i>ยอดจองแยกตามสาขา</h3>
            <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">วันที่:</span>
                <input type="date" id="recordDateFilter" value="${today}" onchange="filterRecords()" class="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-sky-500">
            </div>
        </div>
        <div id="branchGroups" class="flex flex-col gap-3 pb-20">
            <!-- Dynamic Content -->
        </div>
    `;
    filterRecords();
}

export function filterRecords() {
    const date = document.getElementById('recordDateFilter').value;
    const container = document.getElementById('branchGroups');
    container.innerHTML = '';

    // 1. Filter by Date
    // DYNAMIC FETCH: Check if we have data for this date
    const hasDataForDate = mockSubmissions.some(s => s.date === date);

    // If no data found locally, attempt to fetch from server (Specific Date)
    if (!hasDataForDate) {
        // This is sync in UI but async fetch. We need to handle this.
        // Since filterRecords is not async, we might need a loading state here.
        // Let's make filterRecords async or handle internal promise?
        // Converting filterRecords to async might break callers if they expect sync return?
        // No, callers are onclick. But we need to update UI to show loading.

        // We can't await here easily without making function async. 
        // Let's do a self-calling async logic or check if we are *already* fetching?

        // For simplicity: Show loading, call fetch, then re-call filterRecords
        container.innerHTML = `<div class="col-span-full text-center py-10"><i class="fa-solid fa-spinner fa-spin text-sky-500 text-2xl"></i><p class="text-gray-400 mt-2">กำลังโหลดข้อมูลเก่า (Server)...</p></div>`;

        const apiUrl = localStorage.getItem('API_URL') || DEFAULT_API_URL;
        if (apiUrl) {
            fetch(`${apiUrl}?action=get_dashboard&startDate=${date}&endDate=${date}`)
                .then(r => r.json())
                .then(res => {
                    if (res.status === 'success' && Array.isArray(res.records) && res.records.length > 0) {
                        const newRecords = res.records.filter(n => !mockSubmissions.some(o => o.id === n.id));
                        mockSubmissions = [...mockSubmissions, ...newRecords];
                        filterRecords(); // Recursion (Safe because now hasDataForDate will be true or records still empty meaning truly no data)
                    } else {
                        // Truly empty
                        container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                            <i class="fa-solid fa-box-open text-4xl mb-2 opacity-50"></i>
                            <p>ไม่พบข้อมูลวันที่ ${date}</p>
                        </div>`;
                    }
                })
                .catch(e => {
                    container.innerHTML = `<div class="col-span-full text-center text-red-400">Failed to load: ${e.message}</div>`;
                });
            return; // Stop execution, wait for fetch
        }
    }

    const dayRecords = mockSubmissions.filter(s => s.date === date);

    if (dayRecords.length === 0) {
        // Same empty state
        container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            <i class="fa-solid fa-box-open text-4xl mb-2 opacity-50"></i>
            <p>ยังไม่มีข้อมูลสำหรับวันที่เลือก</p>
        </div>`;
        return;
    }

    // 2. Group by Branch
    const grouped = {};
    dayRecords.forEach(record => {
        const branchCode = record.branch;
        if (!grouped[branchCode]) {
            grouped[branchCode] = {
                code: branchCode,
                name: Object.keys(state.branchMap).find(key => state.branchMap[key] === branchCode) || branchCode,
                totalQue: 0,
                records: []
            };
        }
        // Aggregate
        grouped[branchCode].totalQue += parseInt(record.totalQue) || 0;
        grouped[branchCode].records.push(record);
    });

    // 3. Render Cards (Horizontal Style)
    Object.values(grouped).sort((a, b) => b.totalQue - a.totalQue).forEach(group => {
        const card = document.createElement('div');
        // Horizontal Layout: Flex Row
        card.className = 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-row items-stretch min-h-[80px]';

        // Summary Side (Left)
        let itemsSummary = '';
        const itemCounts = {};
        group.records.forEach(rec => {
            rec.items.forEach(item => {
                const key = item.program; // Summarize by Program
                itemCounts[key] = (itemCounts[key] || 0) + parseInt(item.que);
            });
        });

        // Show top 2 programs + "..."
        const keys = Object.keys(itemCounts);
        itemsSummary = keys.slice(0, 3).map(k => `<span class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mr-1">${k} ${itemCounts[k]}</span>`).join('');
        if (keys.length > 3) itemsSummary += `<span class="text-xs text-gray-400">+${keys.length - 3}</span>`;

        card.innerHTML = `
            <!-- Left: Branch Info + Total -->
            <div class="w-1/3 min-w-[120px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-3 flex flex-col justify-center items-center text-center">
                <div class="text-3xl font-bold leading-none">${group.totalQue}</div>
                <div class="text-xs opacity-90 font-light">คิวรวม</div>
                <div class="mt-2 font-bold text-sm truncate w-full px-1">${group.name}</div>
            </div>

            <!-- Right: Details + Action -->
            <div class="flex-1 p-3 flex flex-col justify-between">
                <div>
                    <div class="text-xs text-gray-400 mb-1"><i class="fa-solid fa-tags mr-1"></i>รายการ:</div>
                    <div class="flex flex-wrap gap-y-1">
                        ${itemsSummary}
                    </div>
                </div>
                
                <button onclick="editBranchGroup('${group.code}', '${date}')" class="mt-2 w-full py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 text-xs font-bold rounded-lg border border-sky-100 transition-colors">
                    <i class="fa-solid fa-pen-to-square mr-1"></i>ดู/แก้ไข
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}


function renderMissing() {
    const today = new Date().toISOString().split('T')[0]; // Default to today, or should we default to yesterday? User said "submitted for yesterday".
    // Let's use Yesterday by default for logic "Yesterday's submission"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateVal = yesterday.toISOString().split('T')[0];

    const content = document.getElementById('dashboardContent');
    content.innerHTML = `
        <div class="mb-4 flex justify-between items-center">
            <h3 class="font-bold text-gray-700">สาขาที่ยังไม่ส่งยอด</h3>
            <input type="date" id="missingDateFilter" value="${dateVal}" onchange="filterMissing()" class="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm">
        </div>
        <div id="missingList" class="grid grid-cols-2 gap-2"></div>
    `;
    filterMissing();
}

export async function filterMissing() {
    const date = document.getElementById('missingDateFilter').value;
    const list = document.getElementById('missingList');
    list.innerHTML = '';

    // 0. Check Branches Loaded
    const allBranches = state.branchMap;
    if (Object.keys(allBranches).length === 0) {
        list.innerHTML = `<div class="col-span-2 text-center py-4 text-gray-400"><i class="fa-solid fa-sync fa-spin mr-2"></i>กำลังโหลดข้อมูลสาขา...</div>`;
        // Try to reload config if missing?
        const apiUrl = localStorage.getItem('API_URL') || DEFAULT_API_URL;
        if (apiUrl) await loadConfig(apiUrl);
        if (Object.keys(state.branchMap).length === 0) {
            list.innerHTML = `<div class="col-span-2 text-center py-4 text-red-400">ไม่พบข้อมูลสาขา (Config Error)</div>`;
            return;
        }
    }

    // 1. Dynamic Fetch: Check if we have data for this date?
    // Optimization: Check if date is "old" (older than 30 days) and not in current cache
    // Or just simple: If we find 0 records for this date, TRY fetching specific date range from server once.
    // To avoid loop, we need a flag or separate cache check.

    // For now, let's trust the user needs this date.
    // If mockSubmissions doesn't include this date, and it's not "today" (which might legitimately be empty),
    // we should fetch.

    const hasDataForDate = mockSubmissions.some(s => s.date === date);
    if (!hasDataForDate) {
        // Show loading then fetch
        list.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังดึงข้อมูลวันที่ ${date}...</div>`;

        try {
            const apiUrl = localStorage.getItem('API_URL') || DEFAULT_API_URL;
            if (apiUrl) {
                // Fetch JUST this date
                const response = await fetch(`${apiUrl}?action=get_dashboard&startDate=${date}&endDate=${date}`);
                const resData = await response.json();

                if (resData.status === 'success' && Array.isArray(resData.records)) {
                    // Merge? Or just use for this view?
                    // Let's merge into mockSubmissions so we don't fetch again
                    // But filter out duplicates just in case
                    const newRecords = resData.records.filter(n => !mockSubmissions.some(o => o.id === n.id));
                    mockSubmissions = [...mockSubmissions, ...newRecords];
                }
            }
        } catch (e) {
            console.error("Fetch specific date error:", e);
            list.innerHTML = `<div class="col-span-2 text-center py-4 text-red-400">โหลดข้อมูลไม่สำเร็จ</div>`;
            return;
        }
    }

    // 2. Re-calculate with (potentially) new data
    const submittedBranches = new Set(mockSubmissions.filter(s => s.date === date).map(s => s.branch));
    const missing = [];

    for (const [name, code] of Object.entries(state.branchMap)) {
        if (!submittedBranches.has(code)) {
            missing.push(name);
        }
    }

    if (missing.length === 0) {
        // Double check: Is it because it's a future date?
        const d = new Date(date);
        const now = new Date();
        if (d > now) {
            list.innerHTML = `<div class="col-span-2 text-center py-4 text-gray-400">ยังไม่ถึงวันดังกล่าว</div>`;
            return;
        }

        list.innerHTML = `<div class="col-span-2 text-center py-4 text-emerald-500 font-bold">🎉 ครบทุกสาขาแล้ว!</div>`;
        return;
    }

    missing.forEach(name => {
        const div = document.createElement('div');
        div.className = 'p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 font-bold text-sm flex items-center gap-2';
        div.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${name}`;
        list.appendChild(div);
    });
}

function renderLeaderboard() {
    const content = document.getElementById('dashboardContent');

    // Calculate Date Range (Last 7 Days)
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 6); // Include today + 6 days back = 7 days

    const dateStr = today.toISOString().split('T')[0];
    const pastStr = pastDate.toISOString().split('T')[0];

    content.innerHTML = `
        <div class="mb-4 flex justify-between items-center">
            <div>
                <h3 class="font-bold text-gray-700"><i class="fa-solid fa-trophy text-yellow-500 mr-2"></i>อันดับยอดจองสูงสุด</h3>
                <p class="text-xs text-gray-400">ข้อมูลย้อนหลัง 7 วัน (${pastStr} - ${dateStr})</p>
            </div>
        </div>
        <div class="space-y-2" id="leaderList"></div>
    `;
    filterLeaderboard();
}

export function filterLeaderboard() {
    const list = document.getElementById('leaderList');
    list.innerHTML = '';

    // 1. Calculate Date Range
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 7); // Last 7 days
    pastDate.setHours(0, 0, 0, 0);

    // 2. Filter & Aggregate
    const branchTotals = {};

    mockSubmissions.forEach(record => {
        const recDate = new Date(record.date);
        // Check if within range
        if (recDate >= pastDate && recDate <= today) {
            const branchCode = record.branch;
            if (!branchTotals[branchCode]) {
                branchTotals[branchCode] = {
                    code: branchCode,
                    name: Object.keys(state.branchMap).find(key => state.branchMap[key] === branchCode) || branchCode,
                    total: 0
                };
            }
            branchTotals[branchCode].total += parseInt(record.totalQue) || 0;
        }
    });

    // 3. Convert to Array and Sort
    const ranking = Object.values(branchTotals).sort((a, b) => b.total - a.total);

    if (ranking.length === 0) {
        list.innerHTML = `<div class="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <i class="fa-solid fa-chart-bar text-2xl mb-2 opacity-50"></i>
            <p>ยังไม่มีข้อมูลในรอบ 7 วัน</p>
        </div>`;
        return;
    }

    // 4. Render
    ranking.forEach((item, index) => {
        let rankClass = 'bg-white border-gray-100 shadow-sm';
        let icon = `<span class="font-bold w-6 text-center text-gray-500 text-lg">${index + 1}</span>`;
        let textClass = 'text-gray-700';

        if (index === 0) {
            rankClass = 'bg-yellow-50 border-yellow-200 shadow-sm';
            icon = '<i class="fa-solid fa-crown text-yellow-500 text-xl"></i>';
            textClass = 'text-yellow-800 font-bold';
        } else if (index === 1) {
            rankClass = 'bg-gray-50 border-gray-200';
            icon = '<span class="font-bold w-6 text-center text-gray-600 text-lg">2</span>';
        } else if (index === 2) {
            rankClass = 'bg-orange-50 border-orange-200';
            icon = '<span class="font-bold w-6 text-center text-orange-600 text-lg">3</span>';
        }

        const div = document.createElement('div');
        div.className = `p-4 rounded-xl border flex justify-between items-center transition-transform hover:scale-[1.01] ${rankClass}`;
        div.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 flex justify-center">${icon}</div>
                <div class="flex flex-col">
                    <span class="${textClass} text-lg">${item.name}</span>
                </div>
            </div>
            <div class="text-right">
                <span class="font-bold text-2xl text-sky-600">${item.total}</span>
                <span class="text-xs text-gray-400 block">คิวรวม</span>
            </div>
        `;
        list.appendChild(div);
    });
}

export function editBranchGroup(branchCode, date) {
    // Filter records for this branch and date
    const groupRecords = mockSubmissions.filter(s => s.branch === branchCode && s.date === date);
    const branchName = Object.keys(state.branchMap).find(key => state.branchMap[key] === branchCode) || branchCode;

    // Generate HTML for the modal (Editable Mode)
    let listHtml = '<div class="text-left space-y-3">';
    groupRecords.forEach((rec, recIdx) => {
        rec.items.forEach((item, itemIdx) => {
            // Unique ID for input: input-{rec.id}-{itemIdx}
            listHtml += `
            <div class="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="font-bold text-gray-800 text-sm"><i class="fa-solid fa-caret-right text-gray-400 mr-1"></i>${item.program}</div>
                        <div class="text-xs text-gray-500 ml-4">${item.sub || '-'}</div>
                    </div>
                </div>
                <div class="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span class="text-xs text-gray-500">จำนวนคิว:</span>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="adjustQue('${rec.id}', ${itemIdx}, -1)" class="w-8 h-8 rounded-full bg-white border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 shadow-sm flex items-center justify-center transition-colors"><i class="fa-solid fa-minus text-xs"></i></button>
                        <input type="number" id="input-${rec.id}-${itemIdx}" value="${item.que}" class="w-12 text-center text-lg font-bold text-gray-700 bg-transparent border-none focus:ring-0 p-0" readonly>
                        <button type="button" onclick="adjustQue('${rec.id}', ${itemIdx}, 1)" class="w-8 h-8 rounded-full bg-white border border-gray-200 text-green-500 hover:bg-green-50 hover:border-green-200 shadow-sm flex items-center justify-center transition-colors"><i class="fa-solid fa-plus text-xs"></i></button>
                    </div>
                </div>
            </div>`;
        });
    });
    listHtml += '</div>';

    Swal.fire({
        title: `<span class="text-xl font-bold text-gray-800">${branchName}</span>`,
        html: `
            <div class="flex items-center justify-center gap-2 mb-4">
                <span class="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full"><i class="fa-regular fa-calendar mr-1"></i> ${date}</span>
            </div>
            <div class="max-h-[60vh] overflow-y-auto custom-scrollbar p-1 pb-4">
                ${listHtml}
            </div>
            <div class="text-xs text-gray-400 mt-2"><i class="fa-solid fa-circle-info mr-1"></i>กดปุ่ม +/- เพื่อปรับยอด และกดบันทึก</div>
        `,
        showCloseButton: true,
        showCancelButton: true,
        confirmButtonText: 'บันทึกการเปลี่ยนแปลง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#9ca3af',
        focusConfirm: false,
        preConfirm: async () => {
            const promises = [];

            // Iterate through groups and items to find changes
            groupRecords.forEach((rec, recIdx) => {
                rec.items.forEach((item, itemIdx) => {
                    const input = document.getElementById(`input-${rec.id}-${itemIdx}`);
                    if (input) {
                        // Check dirty flag set by adjustQue
                        if (item._dirty) {
                            const newVal = parseInt(input.value);
                            const payload = {
                                action: 'update_record',
                                date: rec.date,
                                branch: rec.branch,
                                program: item.program,
                                sub: item.sub || '',
                                que: newVal
                            };

                            const apiUrl = localStorage.getItem('API_URL') || DEFAULT_API_URL;
                            const queryString = new URLSearchParams(payload).toString();
                            promises.push(
                                fetch(`${apiUrl}?${queryString}`)
                                    .then(async r => {
                                        const text = await r.text();
                                        try {
                                            return JSON.parse(text);
                                        } catch (e) {
                                            console.error("API Error (Raw Text):", text);
                                            throw new Error(`Server returned HTML instead of JSON. (Possible wrong script version?): ${text.substring(0, 100)}...`);
                                        }
                                    })
                                    .then(res => {
                                        if (res.status === 'success') {
                                            delete item._dirty; // Clear dirty flag
                                            item.que = newVal; // Confirm local update
                                        } else {
                                            throw new Error(res.message);
                                        }
                                    })
                            );
                        }
                    }
                });
            });

            if (promises.length > 0) {
                Swal.showLoading();
                try {
                    await Promise.all(promises);
                    return true;
                } catch (err) {
                    Swal.showValidationMessage(`บันทึกไม่สำเร็จ: ${err.message}`);
                    return false;
                }
            }
            return true;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            filterRecords(); // Re-render dashboard
            Swal.fire({
                icon: 'success',
                title: 'บันทึกเรียบร้อย',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            // Revert changes if cancelled? 
            // Since we modified objects in memory via adjustQue for UI, we might need to reload data.
            // Simplified: Just re-render filterRecords to show original data (if we didn't mutate deeply?)
            // Actually adjustQue mutated the objects. We should probably reload from API or clone data.
            // For now, let's just trigger initDashboard to refresh everything to be safe.
            initDashboard();
        }
    });
}

// Helper for adjusting queue count in modal
window.adjustQue = (recId, itemIdx, delta) => {
    const record = mockSubmissions.find(s => s.id === recId);
    if (record && record.items[itemIdx]) {
        let newVal = parseInt(record.items[itemIdx].que) + delta;
        if (newVal < 0) newVal = 0; // Prevent negative

        // Update Object (Mutable)
        record.items[itemIdx].que = newVal;
        record.items[itemIdx]._dirty = true; // Mark as dirty

        // Update Total for this record (Approximate, might be used by display)
        record.totalQue += delta;
        if (record.totalQue < 0) record.totalQue = 0;

        // Update Input UI
        const input = document.getElementById(`input-${recId}-${itemIdx}`);
        if (input) input.value = newVal;
    }
};

