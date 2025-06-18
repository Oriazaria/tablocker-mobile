class TabLockerRemote {
    constructor() {
        this.apiUrl = 'https://api.azriasolutions.com/api';
        this.selectedDevice = null;
        this.initializeApp();
    }

    async initializeApp() {
        this.setupEventListeners();
        await this.loadDevices();
        this.startPeriodicRefresh();
    }

    setupEventListeners() {
        document.getElementById('device-select').addEventListener('change', (e) => {
            this.selectedDevice = e.target.value;
        });

        document.getElementById('lock-tabs-btn').addEventListener('click', () => {
            this.sendCommand({ action: 'LOCK_CURRENT_TABS' });
        });

        document.getElementById('unlock-tabs-btn').addEventListener('click', () => {
            this.sendCommand({ action: 'UNLOCK_ALL_TABS' });
        });

        document.getElementById('ping-btn').addEventListener('click', () => {
            this.sendCommand({ action: 'PING' });
        });
    }

    async loadDevices() {
        try {
            const response = await fetch(`${this.apiUrl}/devices`);
            if (response.ok) {
                const devices = await response.json();
                this.updateDevicesList(devices.filter(d => d.type === 'chrome_extension'));
                document.getElementById('connection-status').textContent = 'מחובר ✅';
            }
        } catch (error) {
            document.getElementById('connection-status').textContent = 'שגיאת חיבור ❌';
        }
    }

    updateDevicesList(devices) {
        const select = document.getElementById('device-select');
        select.innerHTML = '<option value="">בחר מכשיר...</option>';
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = `Chrome Extension ${device.id.slice(-8)}`;
            select.appendChild(option);
        });

        document.getElementById('device-count').textContent = `מכשירים זמינים: ${devices.length}`;
    }

    async sendCommand(command) {
        if (!this.selectedDevice) {
            alert('יש לבחור מכשיר תחילה');
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/send-command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.selectedDevice,
                    command: command
                })
            });

            if (response.ok) {
                alert('הפקודה נשלחה בהצלחה!');
            }
        } catch (error) {
            alert('שגיאה בשליחת הפקודה');
        }
    }

    startPeriodicRefresh() {
        setInterval(() => this.loadDevices(), 60000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TabLockerRemote();
});