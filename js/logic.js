
import { state } from './state.js';

export function identifyItem(name) {
    const lower = name.toLowerCase().trim();

    // 1. Learned Keywords (Exact match)
    if (state.keywordMappings[lower]) {
        // Migration check: if old format (string), convert to object
        const learned = state.keywordMappings[lower];
        if (typeof learned === 'string') {
            return { program: learned, sub: '' };
        }
        return { program: learned.category, sub: learned.sub || '' };
    }

    // 2. Exact match in services list (Category & Sub)
    for (const cat in state.services) {
        // Check Category Match
        if (lower.includes(cat.toLowerCase())) {
            // If matches category name, try to find sub-service in it
            const subMatch = state.services[cat].find(s => lower.includes(s.toLowerCase()));
            return { program: cat, sub: subMatch || '' };
        }

        // Check Sub-service Match
        const subMatch = state.services[cat].find(s => lower.includes(s.toLowerCase()) || s.toLowerCase().includes(lower));
        if (subMatch) {
            return { program: cat, sub: subMatch };
        }
    }

    // 3. Heuristic / Keywords (Hardcoded)
    let program = '';
    if (lower.includes('botox') || lower.includes('โบ') || lower.includes('ริ้วรอย') || lower.includes('กราม')) program = 'Botox';
    else if (lower.includes('filler') || lower.includes('ฟิล') || lower.includes('เติม') || lower.includes('ขมับ') || lower.includes('ร่องแก้ม')) program = 'Filler';
    else if (lower.includes('hifu') || lower.includes('ยกกระชับ') || lower.includes('ultra') || lower.includes('ไฮฟุ')) program = 'Hifu';
    else if (lower.includes('meso') || lower.includes('เมโส') || lower.includes('fat') || lower.includes('แฟต') || lower.includes('made') || lower.includes('chanel') || lower.includes('face') || lower.includes('หน้าใส') || lower.includes('ฝ้า')) program = 'Meso';
    else if (lower.includes('prp') || lower.includes('เลือด')) program = 'PRP';
    else if (lower.includes('hair') || lower.includes('laser') || lower.includes('diode') || lower.includes('ipl') || lower.includes('yag') || lower.includes('ขน') || lower.includes('กำจัดขน')) program = 'Hair';
    else if (lower.includes('treatment') || lower.includes('สิว') || lower.includes('pico') || lower.includes('acne') || lower.includes('ทรีท') || lower.includes('กดสิว') || lower.includes('mounjaro')) program = 'Treatment';
    else if (lower.includes('olagio') || lower.includes('oligio')) program = 'Treatment';
    else if (lower.includes('vitamin') || lower.includes('วิตามิน') || lower.includes('drip') || lower.includes('ผิว') || lower.includes('ดริป')) program = 'Vitamin';
    else if (lower.includes('promo') || lower.includes('pro') || lower.includes('โปร') || lower.includes('set') || lower.includes('จับคู่') || lower.includes('แถม')) program = 'Promo';
    else if (lower.includes('surgery') || lower.includes('ศัลย') || lower.includes('จมูก') || lower.includes('คาง') || lower.includes('ตาสองชั้น') || lower.includes('ดูดไขมัน')) program = 'Surgery';
    else if (lower.includes('ปรึกษา')) program = 'Treatment';

    // Try to guess sub-service if program found
    let sub = '';
    if (program && state.services[program]) {
        sub = state.services[program].find(s => lower.includes(s.toLowerCase())) || '';
    }

    return { program, sub };
}

export function processSmartInput(text) {
    if (!text.trim()) return [];

    // Helper to process header (date/branch) - moved here or kept in UI? 
    // Ideally logic shouldn't update DOM directly, but for now let's return data.
    // The original code updated DOM directly in `processHeader`. 
    // We should extract data and let UI handle it, but for compatibility let's just do pattern matching here
    // and return the extracted items.

    let detectedItems = [];
    let cleanText = text.replace(/,/g, '').replace(/คน\./g, 'คน');

    const splitKey = "แชทวันที่";
    if (cleanText.includes(splitKey)) {
        cleanText = cleanText.substring(cleanText.indexOf(splitKey));
    } else if (cleanText.includes("______________")) {
        const parts = cleanText.split("______________");
        if (parts.length > 1) cleanText = parts[parts.length - 1];
    }

    const lines = cleanText.split('\n');

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.includes("สอบถาม") || line.includes("รีแชท") || line.includes("รอคอนเฟิร์ม") ||
            line.includes("ปิดจอง") || line.includes("ลูกค้า") || line.includes("ยอดหน้าเพจ") ||
            line.includes("เริ่มเวลา") || line.startsWith("รวม") || line.includes("_____")) return;

        const match = line.match(/^(.*?)\s+(\d+)(?:\s*คน)?$/i);

        if (match) {
            let name = match[1].trim();
            let qty = parseInt(match[2]);

            if (qty > 100) return;

            if (name && qty > 0) {
                const identified = identifyItem(name);
                detectedItems.push({
                    id: Date.now() + Math.random(),
                    program: identified.program,
                    originalName: name,
                    sub: identified.sub,
                    que: qty,
                    verified: false
                });
            }
        }
        else if (line.includes('=')) {
            const parts = line.split('=');
            if (parts.length === 2) {
                let name = parts[0].trim();
                let qty = parseInt(parts[1].trim());

                if (qty > 100) return;

                if (name && !isNaN(qty) && qty > 0) {
                    const identified = identifyItem(name);
                    detectedItems.push({
                        id: Date.now() + Math.random(),
                        program: identified.program,
                        originalName: name,
                        sub: identified.sub,
                        que: qty,
                        verified: false
                    });
                }
            }
        }
    });

    return detectedItems;
}

export function extractHeaderData(text) {
    const lowerText = text.toLowerCase();
    let foundBranchCode = '';
    let foundDate = '';

    // Branch logic matches original
    // Use state.branchMap
    for (const [name, code] of Object.entries(state.branchMap)) {
        if (lowerText.includes(name.toLowerCase())) {
            foundBranchCode = code;
            break;
        }
    }

    if (!foundBranchCode) {
        if (lowerText.includes('ฉะเชิงเทรา')) foundBranchCode = 'CCO';
        else if (lowerText.includes('เครือสหพัฒน์') || lowerText.includes('สหพัฒน์')) foundBranchCode = 'SPN';
        else if (lowerText.includes('อุบล')) foundBranchCode = 'UBN';
        else if (lowerText.includes('หอกาญ') || lowerText.includes('กาญจนบุรี')) foundBranchCode = 'KAN';
        else if (lowerText.includes('อุดร')) foundBranchCode = 'UDN';
        else if (lowerText.includes('ขอนแก่น') || lowerText.includes('กังสดาล')) foundBranchCode = 'KKC';
    }

    const dateMatch = text.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (dateMatch) {
        let day = dateMatch[1].padStart(2, '0');
        let month = dateMatch[2].padStart(2, '0');
        let yearStr = dateMatch[3];
        let year = parseInt(yearStr);

        if (yearStr.length === 2) {
            if (year > 50) year += 2500 - 543;
            else year += 2000;
        }
        else if (year > 2500) year -= 543;

        foundDate = `${year}-${month}-${day}`;
    }

    return { branch: foundBranchCode, date: foundDate };
}
