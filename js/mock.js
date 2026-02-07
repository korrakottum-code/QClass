import { state } from './state.js';

export function generateMockData() {
    const submissions = [];
    const branches = Object.keys(state.branchMap); // Use keys (Names) or Values (Codes)? 
    // real data uses Codes likely, but let's use Codes for consistency with API.
    const branchCodes = Object.values(state.branchMap);

    // Generate for past 7 days
    const today = new Date();

    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // Randomly decide which branches submitted
        branchCodes.forEach(code => {
            // 80% chance of submission
            if (Math.random() > 0.2) {
                const hour = 17 + Math.floor(Math.random() * 6); // 17:00 - 22:59
                const min = Math.floor(Math.random() * 60);
                const timestamp = `${dateStr} ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`;

                // Random items
                const items = [];
                const itemCount = 1 + Math.floor(Math.random() * 5);
                for (let k = 0; k < itemCount; k++) {
                    items.push({
                        program: 'MockProgram',
                        sub: 'MockSubService',
                        que: 1 + Math.floor(Math.random() * 3)
                    });
                }

                submissions.push({
                    id: Math.random().toString(36).substr(2, 9),
                    date: dateStr,
                    timestamp: timestamp,
                    branch: code,
                    items: items,
                    totalQue: items.reduce((sum, item) => sum + item.que, 0)
                });
            }
        });
    }

    return submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
