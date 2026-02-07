import { state } from './state.js';

export function guessCategory(name) {
    // Priority: Check exact match in services list first
    for (const cat in state.services) {
        if (state.services[cat].some(s => name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(name.toLowerCase()))) {
            return cat;
        }
    }

    // Fallback: Keywords
    const lower = name.toLowerCase();
    if (lower.includes('botox') || lower.includes('โบ')) return 'Botox';
    if (lower.includes('filler') || lower.includes('ฟิล')) return 'Filler';
    if (lower.includes('hifu') || lower.includes('ยกกระชับ') || lower.includes('ultra')) return 'Hifu';
    if (lower.includes('meso') || lower.includes('เมโส') || lower.includes('fat') || lower.includes('made') || lower.includes('chanel') || lower.includes('face') || lower.includes('หน้าใส') || lower.includes('ฝ้า')) return 'Meso';
    if (lower.includes('prp')) return 'PRP';
    if (lower.includes('laser') || lower.includes('diode') || lower.includes('ipl') || lower.includes('yag') || lower.includes('ขน')) return 'Hair';
    if (lower.includes('สิว') || lower.includes('pico') || lower.includes('acne') || lower.includes('ทรีท')) return 'Treatment';
    if (lower.includes('olagio') || lower.includes('oligio')) return 'Treatment';
    if (lower.includes('วิตามิน') || lower.includes('drip') || lower.includes('ผิว')) return 'Vitamin';
    if (lower.includes('โปร') || lower.includes('set') || lower.includes('จับคู่')) return 'Promo';
    if (lower.includes('ปรึกษา')) return 'Treatment';
    return '';
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
                detectedItems.push({
                    id: Date.now() + Math.random(),
                    program: guessCategory(name),
                    originalName: name,
                    sub: '',
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
                    detectedItems.push({
                        id: Date.now() + Math.random(),
                        program: guessCategory(name),
                        originalName: name,
                        sub: '',
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
