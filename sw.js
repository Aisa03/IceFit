// ===== Timer di recupero (compatibile con Spotify) =====
        let timerEndAt = 0;
        let wakeLock = null;
        let lastBuzzSecond = -1;
        // Predefinito su OFF così non mette mai in pausa Spotify all'apertura
        let lockScreenOn = localStorage.getItem('icefit_lockscreen') === '1';
        let keepAliveAudio = null;
        let lastMediaText = '';
        let endNotified = false;

        async function acquireWakeLock() {
            try {
                if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
                    wakeLock = await navigator.wakeLock.request('screen');
                    wakeLock.addEventListener('release', () => { wakeLock = null; });
                }
            } catch (e) { wakeLock = null; }
        }

        function releaseWakeLock() {
            try { if (wakeLock) wakeLock.release(); } catch (e) {}
            wakeLock = null;
        }

        function persistTimer() {
            try {
                if (timerEndAt) localStorage.setItem('icefit_timer_end', String(timerEndAt));
                else localStorage.removeItem('icefit_timer_end');
            } catch (e) {}
        }

        function startRestTimer(seconds) {
            timerEndAt = Date.now() + seconds * 1000;
            isAlarmRinging = false;
            isTimerRunning = true;
            lastBuzzSecond = -1;
            endNotified = false;
            persistTimer();
            askNotificationPermission();

            // Avvia l'audio silenzioso SOLO se l'utente ha attivato esplicitamente "Schermata blocco: ON"
            if (lockScreenOn) {
                startKeepAlive();
            } else {
                stopKeepAlive();
            }

            document.getElementById('timerCard').classList.remove('hidden');
            acquireWakeLock();
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(syncTimer, 500);
            syncTimer();
        }

        function startKeepAlive() {
            if (!lockScreenOn) return;
            try {
                if (!keepAliveAudio) {
                    keepAliveAudio = new Audio(makeSilentWavUrl());
                    keepAliveAudio.loop = true;
                }
                const pr = keepAliveAudio.play();
                if (pr && pr.catch) pr.catch(() => {});
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            } catch (e) {}
        }

        function stopKeepAlive() {
            try {
                if (keepAliveAudio) {
                    keepAliveAudio.pause();
                    keepAliveAudio.currentTime = 0;
                }
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'none';
                    navigator.mediaSession.metadata = null;
                }
            } catch (e) {}
            lastMediaText = '';
        }

        function toggleLockScreen() {
            lockScreenOn = !lockScreenOn;
            localStorage.setItem('icefit_lockscreen', lockScreenOn ? '1' : '0');
            updateLockToggleLabel();
            if (!lockScreenOn) {
                stopKeepAlive();
            } else if (timerEndAt) {
                startKeepAlive();
                syncTimer();
            }
        }