class TabLockerRemote {
    constructor() {
        this.apiUrl = 'https://api.azriasolutions.com/api';
        this.connectedDevice = null;
        this.deviceCode = null;
        this.isConnected = false;
        this.initializeApp();
    }

    async initializeApp() {
        this.setupEventListeners();
        await this.checkServerConnection();
        this.loadSavedCode();
    }

    setupEventListeners() {
        // כפתור התחברות
        document.getElementById('connect-btn').addEventListener('click', () => {
            this.connectToDevice();
        });

        // שדה קוד - התחבר באנטר
        document.getElementById('device-code-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.connectToDevice();
            }
        });

        // פורמט קוד תוך כדי הקלדה
        document.getElementById('device-code-input').addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-F0-9]/g, '');
            if (value.length > 6) value = value.substr(0, 6);
            e.target.value = value;
        });

        // כפתורי פעולות
        document.getElementById('lock-tabs-btn').addEventListener('click', () => {
            this.sendCommand({ action: 'LOCK_CURRENT_TABS' });
        });

        document.getElementById('unlock-tabs-btn').addEventListener('click', () => {
            this.sendCommand({ action: 'UNLOCK_ALL_TABS' });
        });

        document.getElementById('ping-btn').addEventListener('click', () => {
            this.sendCommand({ action: 'PING' });
        });

        // כפתור הצגת טאבים נעולים
        document.getElementById('show-locked-tabs-btn').addEventListener('click', () => {
            this.sendCommand({ action: 'GET_LOCKED_TABS' });
        });

        // כפתור נעילה ידנית
        document.getElementById('manual-lock-btn').addEventListener('click', () => {
            this.showManualLockDialog();
        });
    }

    // בדיקת חיבור לשרת - תיקון
    async checkServerConnection() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 שניות timeout
            
            const response = await fetch(`https://api.azriasolutions.com/health`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'healthy') {
                    document.getElementById('connection-status').innerHTML = '✅ מחובר לשרת';
                    return true;
                }
            }
            throw new Error('Server unhealthy');
        } catch (error) {
            console.warn('Server connection check failed:', error.name);
            // לא נציג שגיאה - נדחה לבדיקה מאוחרת יותר
            document.getElementById('connection-status').innerHTML = '⏳ בודק חיבור לשרת...';
            
            // נסה שוב אחרי 3 שניות
            setTimeout(() => this.recheckServerConnection(), 3000);
            return false;
        }
    }

    async recheckServerConnection() {
        try {
            const response = await fetch(`https://api.azriasolutions.com/health`);
            if (response.ok) {
                document.getElementById('connection-status').innerHTML = '✅ מחובר לשרת';
            }
        } catch (error) {
            document.getElementById('connection-status').innerHTML = '⚠️ חיבור לשרת לא יציב';
        }
    }

    // טעינת קוד שמור
    loadSavedCode() {
        const savedCode = localStorage.getItem('tablocker_device_code');
        if (savedCode) {
            document.getElementById('device-code-input').value = savedCode;
        }
    }

    // שמירת קוד
    saveCode(code) {
        localStorage.setItem('tablocker_device_code', code);
    }

    // התחברות למכשיר
    async connectToDevice() {
        const codeInput = document.getElementById('device-code-input');
        const code = codeInput.value.trim().toUpperCase();
        
        if (!code || code.length !== 6) {
            alert('יש להזין קוד בן 6 ספרות (A-F, 0-9)');
            codeInput.focus();
            return;
        }

        // הצג שאנחנו מחפשים
        this.updateDeviceStatus('מחפש מכשיר...', 'connecting');
        this.updateConnectionButtons(false);

        try {
            const response = await fetch(`${this.apiUrl}/find-device`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceCode: code })
            });

            const result = await response.json();

            if (response.ok && result.found) {
                // התחברות מוצלחת
                this.connectedDevice = result.device;
                this.deviceCode = code;
                this.isConnected = true;
                this.saveCode(code);
                
                this.updateDeviceStatus(`✅ מחובר למכשיר ${code}`, 'connected');
                this.updateConnectionButtons(true);
                this.showResponse(`התחברות מוצלחת למכשיר ${code}`);
                
                // עדכן גם את סטטוס השרת
                document.getElementById('connection-status').innerHTML = '✅ מחובר לשרת';
                
                // התחל לקבל תגובות
                this.startResponsePolling();
                
            } else {
                // מכשיר לא נמצא
                this.updateDeviceStatus('❌ מכשיר לא נמצא או לא מחובר', 'disconnected');
                alert('מכשיר לא נמצא. ודא שהתוסף פעיל ושהקוד נכון.');
            }

        } catch (error) {
            console.error('Connection error:', error);
            this.updateDeviceStatus('❌ שגיאת חיבור', 'disconnected');
            alert('שגיאה בחיבור לשרת');
        }
    }

    // עדכון סטטוס מכשיר
    updateDeviceStatus(message, status) {
        const statusElement = document.getElementById('device-status');
        statusElement.textContent = message;
        statusElement.className = `device-status ${status}`;
    }

    // עדכון כפתורי פעולות
    updateConnectionButtons(enabled) {
        const buttons = ['lock-tabs-btn', 'unlock-tabs-btn', 'ping-btn', 'show-locked-tabs-btn', 'manual-lock-btn'];
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = !enabled;
                if (enabled) {
                    btn.classList.add('enabled');
                } else {
                    btn.classList.remove('enabled');
                }
            }
        });
    }

    // שליחת פקודה
    async sendCommand(command) {
        if (!this.isConnected || !this.deviceCode) {
            alert('יש להתחבר למכשיר תחילה');
            return;
        }

        try {
            this.showResponse(`שולח פקודה: ${command.action}...`);

            const response = await fetch(`${this.apiUrl}/send-command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceCode: this.deviceCode,
                    command: command
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showResponse(`✅ פקודה נשלחה: ${command.action}`);
            } else {
                this.showResponse(`❌ שגיאה: ${result.error || 'לא ניתן לשלוח פקודה'}`);
                
                if (response.status === 404) {
                    // מכשיר לא נמצא - נתק
                    this.disconnect();
                    alert('המכשיר לא מחובר. יש להתחבר מחדש.');
                }
            }

        } catch (error) {
            console.error('Command error:', error);
            this.showResponse(`❌ שגיאת שליחה: ${error.message}`);
        }
    }

    // דיאלוג נעילה ידנית
    showManualLockDialog() {
        const url = prompt('הזן URL או דומיין לנעילה:\n(לדוגמה: facebook.com או https://example.com)');
        if (!url) return;

        const password = prompt('הזן סיסמה לנעילה:');
        if (!password) return;

        const lockEntireDomain = confirm('לנעול את כל הדומיין?\n\nאישור = כל הדומיין\nביטול = רק URL ספציפי');

        this.sendCommand({
            action: 'MANUAL_LOCK',
            url: url,
            password: password,
            lockDomain: lockEntireDomain
        });
    }

    // התחלת קבלת תגובות
    startResponsePolling() {
        if (this.responseInterval) {
            clearInterval(this.responseInterval);
        }

        this.responseInterval = setInterval(async () => {
            if (!this.isConnected || !this.deviceCode) return;

            try {
                const response = await fetch(`${this.apiUrl}/responses/${this.deviceCode}`);
                if (response.ok) {
                    const responses = await response.json();
                    if (responses.length > 0) {
                        // הצג את התגובה האחרונה
                        const latest = responses[0];
                        if (latest.status === 'pong') {
                            this.showResponse('🟢 המכשיר מגיב - החיבור תקין');
                        } else if (latest.status === 'success') {
                            this.showResponse(`✅ פעולה הושלמה בהצלחה`);
                            if (latest.data) {
                                this.showResponse(`📊 נתונים: ${JSON.stringify(latest.data)}`);
                            }
                        } else if (latest.status === 'error') {
                            this.showResponse(`❌ שגיאה במכשיר: ${latest.message || 'לא ידוע'}`);
                        }
                    }
                }
            } catch (error) {
                console.warn('Response polling error:', error);
            }
        }, 3000); // כל 3 שניות
    }

    // הצגת תגובה
    showResponse(message) {
        const responseArea = document.getElementById('response-area');
        const responseContent = document.getElementById('response-content');
        
        const timestamp = new Date().toLocaleTimeString('he-IL');
        const newMessage = `[${timestamp}] ${message}`;
        
        // הצג את האזור אם הוא מוסתר
        responseArea.style.display = 'block';
        
        // הוסף הודעה חדשה
        const currentContent = responseContent.textContent;
        if (currentContent === 'אין תגובות עדיין...') {
            responseContent.textContent = newMessage;
        } else {
            responseContent.textContent = newMessage + '\n' + currentContent;
        }
        
        // הגבל למספר שורות
        const lines = responseContent.textContent.split('\n');
        if (lines.length > 10) {
            responseContent.textContent = lines.slice(0, 10).join('\n');
        }
    }

    // ניתוק
    disconnect() {
        this.isConnected = false;
        this.connectedDevice = null;
        this.deviceCode = null;
        
        if (this.responseInterval) {
            clearInterval(this.responseInterval);
            this.responseInterval = null;
        }
        
        this.updateDeviceStatus('❌ לא מחובר למכשיר', 'disconnected');
        this.updateConnectionButtons(false);
        
        // נקה את השדה
        document.getElementById('device-code-input').value = '';
        localStorage.removeItem('tablocker_device_code');
    }
}

// אתחול האפליקציה
document.addEventListener('DOMContentLoaded', () => {
    window.tabLockerRemote = new TabLockerRemote();
});