export const state = {
    services: {},
    branchMap: {},
    cart: [],
    detectedItems: [],
    history: [],
    keywordMappings: JSON.parse(localStorage.getItem('keywordMappings') || '{}')
};

export function learnKeyword(keyword, category) {
    if (!keyword || !category) return;
    const cleanKey = keyword.trim().toLowerCase();
    state.keywordMappings[cleanKey] = category;
    localStorage.setItem('keywordMappings', JSON.stringify(state.keywordMappings));
    console.log(`Learned: "${cleanKey}" -> ${category}`);
}

export function setServices(newServices) {
    state.services = newServices;
}

export function setBranches(newBranches) {
    state.branchMap = newBranches;
}

export function addToCart(item) {
    state.cart.push(item);
}

export function clearCart() {
    state.cart = [];
}

export function setDetectedItems(items) {
    state.detectedItems = items;
}

export function clearDetectedItems() {
    state.detectedItems = [];
}

export function removeDetectedItem(index) {
    state.detectedItems.splice(index, 1);
}

export function updateDetectedItem(index, field, value) {
    const item = state.detectedItems[index];
    if (field === 'program') {
        item.program = value;
        item.sub = '';
        item.verified = false;
    } else if (field === 'que') {
        item.que = parseInt(value);
    } else if (field === 'sub') {
        item.sub = value;
        item.verified = false;
    } else if (field === 'verified') {
        item.verified = value;
    }
}
