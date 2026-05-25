/**
 * WebSocket handler for real-time monitoring
 */

const { getSystemStats, getServiceStatuses } = require('./cli');

function setupWebSocket(wss) {
    const clients = new Set();

    wss.on('connection', (ws, req) => {
        clients.add(ws);

        ws.on('close', () => {
            clients.delete(ws);
        });

        ws.on('error', () => {
            clients.delete(ws);
        });

        // Send initial stats
        sendStats(ws);
    });

    // Broadcast stats every 5 seconds
    setInterval(async () => {
        if (clients.size === 0) return;

        try {
            const [stats, services] = await Promise.all([
                getSystemStats(),
                getServiceStatuses()
            ]);

            const data = JSON.stringify({
                type: 'stats',
                data: { ...stats, services },
                timestamp: new Date().toISOString()
            });

            clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(data);
                }
            });
        } catch (e) {
            // Ignore monitoring errors
        }
    }, 5000);
}

async function sendStats(ws) {
    try {
        const [stats, services] = await Promise.all([
            getSystemStats(),
            getServiceStatuses()
        ]);

        ws.send(JSON.stringify({
            type: 'stats',
            data: { ...stats, services },
            timestamp: new Date().toISOString()
        }));
    } catch (e) {
        // Ignore
    }
}

module.exports = { setupWebSocket };
