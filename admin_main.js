
// 鎿嶄綔閿佸伐鍏凤紙闃叉骞跺彂鎿嶄綔锛?
    const opLock = {
        isOperating: false,
        pendingOp: null,
        show() { 
            this.isOperating = true;
            const el = document.getElementById('opLockOverlay'); 
            if (el) el.classList.add('active'); 
        },
        hide() { 
            this.isOperating = false;
            this.pendingOp = null;
            const el = document.getElementById('opLockOverlay'); 
            if (el) el.classList.remove('active'); 
        },
        // 妫€鏌ユ槸鍚﹀彲浠ユ墽琛屾搷浣?
        canOperate(opType) {
            if (this.isOperating) {
                alert('涓婁竴娆℃搷浣滃皻鏈畬鎴愶紝璇风◢鍚庨噸璇?);
                return false;
            }
            this.pendingOp = opType;
            return true;
        }
    };
    
    function withLock(fn, opType) {
        return async function(...args) {
            if (!opLock.canOperate(opType)) return;
            opLock.show();
            try { 
                return await fn.apply(this, args); 
            } catch(e) {
                alert('鎿嶄綔澶辫触锛? + e.message);
            } finally { 
                opLock.hide();
            }
        };
    }
    
    const USE_SUPABASE = false;
    let currentUser = null;
    let isSuperAdmin = false;

    function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'); }
    function nextId(arr) { return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1; }
    function formatDate(str) { if (!str) return ''; return new Date(str).toLocaleString(); }
    
    // 鏂囦欢璇诲彇杈呭姪鍑芥暟 - 鏀寔 UTF-8/GBK 鑷姩璇嗗埆
    function readTextFileWithEncoding(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const buffer = e.target.result;
                try {
                    // 鍏堝皾璇?UTF-8 瑙ｇ爜锛坰trict 妯″紡锛屽惈 BOM 鑷姩璺宠繃锛?
                    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
                    resolve(text);
                } catch (utf8Err) {
                    // UTF-8 瑙ｇ爜澶辫触锛屽洖閫€鍒?GBK
                    try {
                        const text = new TextDecoder('gbk').decode(buffer);
                        resolve(text);
                    } catch (gbkErr) {
                        reject(new Error('鏂囦欢缂栫爜鏃犳硶璇嗗埆锛岃淇濆瓨涓?UTF-8 鏍煎紡'));
                    }
                }
            };
            reader.onerror = function() {
                reject(new Error('鏂囦欢璇诲彇澶辫触锛岃妫€鏌ユ枃浠舵槸鍚︽崯鍧?));
            };
            reader.readAsArrayBuffer(file);
        });
    }
    
    // CSV瑙ｆ瀽杈呭姪鍑芥暟 - 澶勭悊甯﹀紩鍙风殑瀛楁
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
    }

    // 鎵归噺閫夋嫨杈呭姪鍑芥暟
    function getSelectedIds(prefix) {
        const checkboxes = document.querySelectorAll(`#${prefix}List .item-checkbox:checked`);
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }
    
    function toggleSelectAll(prefix, masterCheckbox) {
        const checkboxes = document.querySelectorAll(`#${prefix}List .item-checkbox`);
        checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    }

    // ========== 鏁版嵁搴撴搷浣?==========
    async function getAllAnnouncements() { if (USE_SUPABASE) return await db.announcements.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_announcements') || '[]'); }
    async function getAllDynamics() { if (USE_SUPABASE) return await db.dynamics.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_dynamics') || '[]'); }
    async function getAllMembers() { if (USE_SUPABASE) return await db.members.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_members') || '[]'); }
    async function getAllPolls() { if (USE_SUPABASE) return await db.polls.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_polls') || '[]'); }
    async function getAllPollOptions() {
        if (USE_SUPABASE) { const polls = await db.polls.getAll() || []; let all = []; for (const p of polls) { const o = await db.pollOptions.getByPollId(p.id) || []; all.push(...o); } return all; }
        return JSON.parse(localStorage.getItem('yayehui_poll_options') || '[]');
    }
    async function getAllVotes() {
        if (USE_SUPABASE) { const polls = await db.polls.getAll() || []; let all = []; for (const p of polls) { const v = await db.votes.getByPollId(p.id) || []; all.push(...v); } return all; }
        return JSON.parse(localStorage.getItem('yayehui_votes') || '[]');
    }
    async function getAllExpenses() { if (USE_SUPABASE) return await db.expenses.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_expenses') || '[]'); }
    async function getAllTopics() { if (USE_SUPABASE) return await db.topics.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_topics') || '[]'); }
    async function getAllReplies() {
        if (USE_SUPABASE) { const topics = await db.topics.getAll() || []; let all = []; for (const t of topics) { const r = await db.replies.getByTopicId(t.id) || []; all.push(...r); } return all; }
        return JSON.parse(localStorage.getItem('yayehui_replies') || '[]');
    }
    async function getAllRegisteredUsers() { if (USE_SUPABASE) return await db.registeredUsers.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]'); }
    async function getAllPropertyAddresses() { if (USE_SUPABASE) return await db.propertyAddresses.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]'); }
    async function getAllAdminAccounts() { 
        if (USE_SUPABASE) return await db.adminAccounts.getAll() || []; 
        // 鍒濆鍖栭粯璁よ处鍙凤紙濡傛灉涓嶅瓨鍦級
        if (!localStorage.getItem('yayehui_admin_accounts')) {
            const defaultAccounts = [
                {username: 'admin', password: 'yayehui2025', role: 'admin', created_at: new Date().toISOString()},
                {username: 'superadmin', password: 'super2025', role: 'super_admin', created_at: new Date().toISOString()}
            ];
            localStorage.setItem('yayehui_admin_accounts', JSON.stringify(defaultAccounts));
        }
        return JSON.parse(localStorage.getItem('yayehui_admin_accounts') || '[]'); 
    }
    async function getAllLoginLogs() { if (USE_SUPABASE) return await db.adminLoginLogs.getAll() || []; return JSON.parse(localStorage.getItem('yayehui_login_logs') || '[]'); }

    // ========== 瀵煎嚭鍔熻兘 ==========
    function exportData(data, filename, columns) {
        if (!data || data.length === 0) { alert('娌℃湁鏁版嵁鍙鍑?); return; }
        let csv = columns.map(c => c.label).join(',') + '\n';
        data.forEach(row => {
            csv += columns.map(c => {
                let val = row[c.key] !== undefined ? row[c.key] : '';
                if (typeof val === 'string') val = '"' + val.replace(/"/g, '""') + '"';
                return val;
            }).join(',') + '\n';
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click();
        URL.revokeObjectURL(url);
    }

    function downloadTemplate(columns, filename) {
        let csv = columns.map(c => c.label).join(',') + '\n';
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename + '_template.csv'; a.click();
        URL.revokeObjectURL(url);
    }

    // ========== 妯℃€佹宸ュ叿 ==========
    function showModal(html) {
        const existing = document.getElementById('customModal');
        if (existing) existing.remove();
        const div = document.createElement('div'); div.id = 'customModal'; div.className = 'modal';
        div.style.display = 'flex';
        div.innerHTML = `<div class="modal-content">${html}</div>`;
        document.body.appendChild(div);
        return div;
    }
    function closeModal() { document.getElementById('customModal')?.remove(); }

    // ========== 闈㈡澘娓叉煋 ==========
    async function renderAnnouncementsPanel() {
        const container = document.getElementById('panelAnnouncements');
        if (!container) return;
        let items = await getAllAnnouncements();
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-bullhorn"></i> 鍏憡绠＄悊 <button class="export-btn" onclick="exportAnnouncements()"><i class="fas fa-download"></i> 瀵煎嚭</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 鎵归噺瀵煎叆</h4>
                    <p>閫夋嫨 CSV/TXT 鏂囦欢鎴栫矘璐村唴瀹?鈫?鐐瑰嚮瀵煎叆</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('annFileInput').click()"><i class="fas fa-file-upload"></i> 閫夋嫨鏂囦欢</button>
                        <button class="btn-sm primary" onclick="downloadAnnouncementTemplate()"><i class="fas fa-file-csv"></i> 涓嬭浇妯℃澘</button>
                    </div>
                    <input type="file" id="annFileInput" accept=".csv,.txt" style="display:none" onchange="handleAnnFileSelect(this)">
                    <div id="annFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="annImportData" placeholder="绮樿创 CSV 鏁版嵁锛堥琛屼负鏍囬,鏃ユ湡,鍐呭锛? style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importAnnouncements()"><i class="fas fa-upload"></i> 瀵煎叆鏁版嵁</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('ann', this)"> 鍏ㄩ€?/label>
                    <button class="btn-sm danger" onclick="deleteSelectedAnnouncements()"><i class="fas fa-trash-alt"></i> 鍒犻櫎鎵€閫?/button>
                </div>
                <div class="item-list" id="annList"><div class="loading">鍔犺浇涓?..</div></div>
                <div class="add-form">
                    <input type="text" id="annTitle" placeholder="鏍囬">
                    <input type="date" id="annDate" value="${new Date().toISOString().slice(0,10)}">
                    <textarea id="annContent" rows="1" placeholder="鍐呭" style="border-radius:16px;"></textarea>
                    <button onclick="addAnnouncement()">鉃?鏂板</button>
                </div>
            </div>`;
        renderAnnouncementList();
    }
    async function renderAnnouncementList() {
        const list = document.getElementById('annList');
        if (!list) return;
        const items = await getAllAnnouncements();
        list.innerHTML = items.map(item => `
            <div class="admin-item">
                <div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${item.id}"></div>
                <div class="item-info"><strong>${escapeHtml(item.title)}</strong><small> ${item.date || ''}</small><div>${escapeHtml((item.content||'').substring(0,60))}</div></div>
                <div class="item-actions">
                    <button class="btn-sm" onclick="editAnnouncement(${item.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-sm danger" onclick="deleteAnnouncement(${item.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>`).join('') || '<p class="loading">鏆傛棤鍏憡</p>';
    }
    window.deleteAnnouncement = async (id) => {
            opLock.show();
            try {
                if (!confirm('纭畾鍒犻櫎锛?)) return; if (USE_SUPABASE) await db.announcements.delete(id); else { let a = JSON.parse(localStorage.getItem('yayehui_announcements')||'[]').filter(i=>i.id!==id); localStorage.setItem('yayehui_announcements',JSON.stringify(a)); } renderAnnouncementList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedAnnouncements = async () => {
        const ids = getSelectedIds('ann');
        if (ids.length === 0) return alert('璇峰厛閫夋嫨瑕佸垹闄ょ殑椤?);
        if (!confirm('纭畾鍒犻櫎閫変腑鐨?' + ids.length + ' 椤癸紵')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) {
                for (const id of ids) await db.announcements.delete(id);
            } else {
                let a = JSON.parse(localStorage.getItem('yayehui_announcements')||'[]');
                a = a.filter(i => !ids.includes(i.id));
                localStorage.setItem('yayehui_announcements',JSON.stringify(a));
            }
            renderAnnouncementList();
        } finally {
            opLock.hide();
        }
    };
    window.addAnnouncement = async () => {
            opLock.show();
            try {
                const t=document.getElementById('annTitle')?.value.trim(), d=document.getElementById('annDate')?.value, c=document.getElementById('annContent')?.value.trim(); if(!t||!c) return alert('璇峰～鍐欐爣棰樺拰鍐呭'); const data={title:t,date:d,content:c}; if(USE_SUPABASE) await db.announcements.create(data); else { let a=JSON.parse(localStorage.getItem('yayehui_announcements')||'[]'); data.id=nextId(a); a.push(data); localStorage.setItem('yayehui_announcements',JSON.stringify(a)); } ['annTitle','annContent'].forEach(id=>document.getElementById(id).value=''); renderAnnouncementList();
            } finally {
                opLock.hide();
            }
        };
    window.editAnnouncement = async (id) => {
            opLock.show();
            try {
                const items=await getAllAnnouncements(); const it=items.find(i=>i.id===id); const nt=prompt('鏍囬',it?.title); const nc=prompt('鍐呭',it?.content); if(nt&&nc) { if(USE_SUPABASE) await db.announcements.update(id,{title:nt,content:nc}); else { let a=JSON.parse(localStorage.getItem('yayehui_announcements')||'[]'); const r=a.find(i=>i.id===id); if(r){r.title=nt;r.content=nc;localStorage.setItem('yayehui_announcements',JSON.stringify(a));} } renderAnnouncementList(); }
            } finally {
                opLock.hide();
            }
        };
    window.exportAnnouncements = async () => { const items=await getAllAnnouncements(); exportData(items,'鍏憡鏁版嵁',[{key:'title',label:'鏍囬'},{key:'date',label:'鏃ユ湡'},{key:'content',label:'鍐呭'}]); };
    window.downloadAnnouncementTemplate = () => downloadTemplate([{key:'title',label:'鏍囬'},{key:'date',label:'鏃ユ湡'},{key:'content',label:'鍐呭'}],'鍏憡');
    window.handleAnnFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('annFileName').textContent = '宸查€夋嫨: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('annImportData').value = text;
        }).catch(err => {
            alert('鏂囦欢璇诲彇澶辫触: ' + err.message);
        });
    };
    window.importAnnouncements = async () => {
            opLock.show();
            try {
                const text=document.getElementById('annImportData').value.trim(); if(!text) return alert('璇风矘璐存暟鎹?); const lines=text.split('\n').filter(l=>l.trim()); if(lines.length<2) return alert('鏁版嵁鏍煎紡閿欒锛岃嚦灏戦渶瑕佹爣棰樿鍜屾暟鎹'); for(let i=1;i<lines.length;i++){const parts=parseCSVLine(lines[i]); if(parts.length>=2){const data={title:parts[0],date:parts[1]||new Date().toISOString().slice(0,10),content:parts[2]||''}; if(USE_SUPABASE) await db.announcements.create(data); else { let a=JSON.parse(localStorage.getItem('yayehui_announcements')||'[]'); data.id=nextId(a); a.push(data); localStorage.setItem('yayehui_announcements',JSON.stringify(a)); } } } alert('瀵煎叆鎴愬姛锛?); document.getElementById('annImportData').value=''; renderAnnouncementList();
            } finally {
                opLock.hide();
            }
        };

    async function renderDynamicsPanel() {
        const container = document.getElementById('panelDynamics');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-chart-line"></i> 宸ヤ綔鍔ㄦ€佺鐞?<button class="export-btn" onclick="exportDynamics()"><i class="fas fa-download"></i> 瀵煎嚭</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 鎵归噺瀵煎叆</h4>
                    <p>閫夋嫨 CSV/TXT 鏂囦欢鎴栫矘璐村唴瀹?鈫?鐐瑰嚮瀵煎叆</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('dynFileInput').click()"><i class="fas fa-file-upload"></i> 閫夋嫨鏂囦欢</button>
                        <button class="btn-sm primary" onclick="downloadDynamicsTemplate()"><i class="fas fa-file-csv"></i> 涓嬭浇妯℃澘</button>
                    </div>
                    <input type="file" id="dynFileInput" accept=".csv,.txt" style="display:none" onchange="handleDynFileSelect(this)">
                    <div id="dynFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="dynImportData" placeholder="绮樿创 CSV 鏁版嵁锛堟爣棰?鏃ユ湡,鎽樿,璇︾粏鍐呭锛? style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importDynamics()"><i class="fas fa-upload"></i> 瀵煎叆鏁版嵁</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('dyn', this)"> 鍏ㄩ€?/label>
                    <button class="btn-sm danger" onclick="deleteSelectedDynamics()"><i class="fas fa-trash-alt"></i> 鍒犻櫎鎵€閫?/button>
                </div>
                <div class="item-list" id="dynList"><div class="loading">鍔犺浇涓?..</div></div>
                <div class="add-form">
                    <input type="text" id="dynTitle" placeholder="鏍囬">
                    <input type="date" id="dynDate" value="${new Date().toISOString().slice(0,10)}">
                    <input type="text" id="dynSummary" placeholder="鎽樿">
                    <textarea id="dynContent" rows="1" placeholder="璇︾粏鍐呭" style="border-radius:16px;"></textarea>
                    <button onclick="addDynamic()">鉃?鏂板</button>
                </div>
            </div>`;
        renderDynamicList();
    }
    async function renderDynamicList() {
        const list = document.getElementById('dynList');
        if (!list) return;
        const items = await getAllDynamics();
        list.innerHTML = items.map(item => `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${item.id}"></div><div class="item-info"><strong>${escapeHtml(item.title)}</strong><small> ${item.date||''}</small><div>${escapeHtml(item.summary||'')}</div></div><div class="item-actions"><button class="btn-sm" onclick="editDynamic(${item.id})"><i class="fas fa-edit"></i></button><button class="btn-sm danger" onclick="deleteDynamic(${item.id})"><i class="fas fa-trash-alt"></i></button></div></div>`).join('') || '<p class="loading">鏆傛棤鍔ㄦ€?/p>';
    }
    window.deleteDynamic = async (id) => {
            opLock.show();
            try {
                if(!confirm('纭畾鍒犻櫎锛?))return; if(USE_SUPABASE) await db.dynamics.delete(id); else{let a=JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]').filter(i=>i.id!==id);localStorage.setItem('yayehui_dynamics',JSON.stringify(a));} renderDynamicList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedDynamics = async () => {
        const ids = getSelectedIds('dyn');
        if (ids.length === 0) return alert('璇峰厛閫夋嫨瑕佸垹闄ょ殑椤?);
        if (!confirm('纭畾鍒犻櫎閫変腑鐨?' + ids.length + ' 椤癸紵')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) { for (const id of ids) await db.dynamics.delete(id); }
            else { let a = JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]'); a = a.filter(i => !ids.includes(i.id)); localStorage.setItem('yayehui_dynamics',JSON.stringify(a)); }
            renderDynamicList();
        } finally { opLock.hide(); }
    };
    window.addDynamic = async () => {
            opLock.show();
            try {
                const t=document.getElementById('dynTitle')?.value.trim(), d=document.getElementById('dynDate')?.value, s=document.getElementById('dynSummary')?.value.trim(), c=document.getElementById('dynContent')?.value.trim(); if(!t||!s) return alert('璇峰～鍐欐爣棰樺拰鎽樿'); const data={title:t,date:d,summary:s,content:c}; if(USE_SUPABASE) await db.dynamics.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_dynamics',JSON.stringify(a));} ['dynTitle','dynSummary','dynContent'].forEach(id=>document.getElementById(id).value='');renderDynamicList();
            } finally {
                opLock.hide();
            }
        };
    window.editDynamic = async (id) => {
            opLock.show();
            try {
                const items=await getAllDynamics();const it=items.find(i=>i.id===id);const nt=prompt('鏍囬',it?.title);const ns=prompt('鎽樿',it?.summary);if(nt&&ns){if(USE_SUPABASE)await db.dynamics.update(id,{title:nt,summary:ns});else{let a=JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]');const r=a.find(i=>i.id===id);if(r){r.title=nt;r.summary=ns;localStorage.setItem('yayehui_dynamics',JSON.stringify(a));}}renderDynamicList();}
            } finally {
                opLock.hide();
            }
        };
    window.exportDynamics = async () => { const items=await getAllDynamics(); exportData(items,'宸ヤ綔鍔ㄦ€?,[{key:'title',label:'鏍囬'},{key:'date',label:'鏃ユ湡'},{key:'summary',label:'鎽樿'},{key:'content',label:'鍐呭'}]); };
    window.downloadDynamicsTemplate = () => downloadTemplate([{key:'title',label:'鏍囬'},{key:'date',label:'鏃ユ湡'},{key:'summary',label:'鎽樿'},{key:'content',label:'鍐呭'}],'宸ヤ綔鍔ㄦ€?);
    window.handleDynFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('dynFileName').textContent = '宸查€夋嫨: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('dynImportData').value = text;
        }).catch(err => {
            alert('鏂囦欢璇诲彇澶辫触: ' + err.message);
        });
    };
    window.importDynamics = async () => {
            opLock.show();
            try {
                const text=document.getElementById('dynImportData').value.trim(); if(!text)return;const lines=text.split('\n').filter(l=>l.trim()); for(let i=1;i<lines.length;i++){const p=parseCSVLine(lines[i]); if(p.length>=2){const data={title:p[0],date:p[1]||new Date().toISOString().slice(0,10),summary:p[2]||'',content:p[3]||''}; if(USE_SUPABASE)await db.dynamics.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_dynamics',JSON.stringify(a));}} } alert('瀵煎叆鎴愬姛锛?);document.getElementById('dynImportData').value='';renderDynamicList();
            } finally {
                opLock.hide();
            }
        };

    async function renderMembersPanel() {
        const container = document.getElementById('panelMembers');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-users"></i> 涓氬浼氭垚鍛樼鐞?<button class="export-btn" onclick="exportMembers()"><i class="fas fa-download"></i> 瀵煎嚭</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 鎵归噺瀵煎叆</h4>
                    <p>閫夋嫨 CSV/TXT 鏂囦欢鎴栫矘璐村唴瀹?鈫?鐐瑰嚮瀵煎叆</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('memFileInput').click()"><i class="fas fa-file-upload"></i> 閫夋嫨鏂囦欢</button>
                        <button class="btn-sm primary" onclick="downloadMembersTemplate()"><i class="fas fa-file-csv"></i> 涓嬭浇妯℃澘</button>
                    </div>
                    <input type="file" id="memFileInput" accept=".csv,.txt" style="display:none" onchange="handleMemFileSelect(this)">
                    <div id="memFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="memImportData" placeholder="绮樿创 CSV锛堝鍚?鑱屽姟,鑱岃矗鎻忚堪锛? style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importMembers()"><i class="fas fa-upload"></i> 瀵煎叆鏁版嵁</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('mem', this)"> 鍏ㄩ€?/label>
                    <button class="btn-sm danger" onclick="deleteSelectedMembers()"><i class="fas fa-trash-alt"></i> 鍒犻櫎鎵€閫?/button>
                </div>
                <div class="item-list" id="memList"><div class="loading">鍔犺浇涓?..</div></div>
                <div class="add-form">
                    <input type="text" id="memberName" placeholder="濮撳悕">
                    <input type="text" id="memberRole" placeholder="鑱屽姟">
                    <input type="text" id="memberDesc" placeholder="鑱岃矗鎻忚堪">
                    <button onclick="addMember()">鉃?鏂板鎴愬憳</button>
                </div>
            </div>`;
        renderMemberList();
    }
    async function renderMemberList() {
        const list = document.getElementById('memList');
        if (!list) return;
        const items = await getAllMembers();
        list.innerHTML = items.map(item => `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${item.id}"></div><div class="item-info"><strong>${escapeHtml(item.name)}</strong><br><small>${escapeHtml(item.role||'')}</small><div>${escapeHtml(item.description||'')}</div></div><div class="item-actions"><button class="btn-sm" onclick="editMember(${item.id})"><i class="fas fa-edit"></i></button><button class="btn-sm danger" onclick="deleteMember(${item.id})"><i class="fas fa-trash-alt"></i></button></div></div>`).join('') || '<p class="loading">鏆傛棤鎴愬憳</p>';
    }
    window.deleteMember = async (id) => {
            opLock.show();
            try {
                if(!confirm('纭畾鍒犻櫎锛?))return; if(USE_SUPABASE)await db.members.delete(id); else{let a=JSON.parse(localStorage.getItem('yayehui_members')||'[]').filter(i=>i.id!==id);localStorage.setItem('yayehui_members',JSON.stringify(a));} renderMemberList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedMembers = async () => {
        const ids = getSelectedIds('mem');
        if (ids.length === 0) return alert('璇峰厛閫夋嫨瑕佸垹闄ょ殑椤?);
        if (!confirm('纭畾鍒犻櫎閫変腑鐨?' + ids.length + ' 椤癸紵')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) { for (const id of ids) await db.members.delete(id); }
            else { let a = JSON.parse(localStorage.getItem('yayehui_members')||'[]'); a = a.filter(i => !ids.includes(i.id)); localStorage.setItem('yayehui_members',JSON.stringify(a)); }
            renderMemberList();
        } finally { opLock.hide(); }
    };
    window.addMember = async () => {
            opLock.show();
            try {
                const n=document.getElementById('memberName')?.value.trim(),r=document.getElementById('memberRole')?.value.trim(),d=document.getElementById('memberDesc')?.value.trim(); if(!n||!r)return alert('璇峰～鍐欏鍚嶅拰鑱屽姟'); const data={name:n,role:r,description:d,avatar_icon:'fas fa-user-circle'}; if(USE_SUPABASE)await db.members.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_members')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_members',JSON.stringify(a));} ['memberName','memberRole','memberDesc'].forEach(id=>document.getElementById(id).value='');renderMemberList();
            } finally {
                opLock.hide();
            }
        };
    window.editMember = async (id) => {
            opLock.show();
            try {
                const items=await getAllMembers();const it=items.find(i=>i.id===id);const nn=prompt('濮撳悕',it?.name);const nr=prompt('鑱屽姟',it?.role);if(nn&&nr){if(USE_SUPABASE)await db.members.update(id,{name:nn,role:nr});else{let a=JSON.parse(localStorage.getItem('yayehui_members')||'[]');const r=a.find(i=>i.id===id);if(r){r.name=nn;r.role=nr;localStorage.setItem('yayehui_members',JSON.stringify(a));}}renderMemberList();}
            } finally {
                opLock.hide();
            }
        };
    window.exportMembers = async () => { const items=await getAllMembers(); exportData(items,'涓氬浼氭垚鍛?,[{key:'name',label:'濮撳悕'},{key:'role',label:'鑱屽姟'},{key:'description',label:'鑱岃矗鎻忚堪'}]); };
    window.downloadMembersTemplate = () => downloadTemplate([{key:'name',label:'濮撳悕'},{key:'role',label:'鑱屽姟'},{key:'description',label:'鑱岃矗鎻忚堪'}],'涓氬浼氭垚鍛?);
    window.handleMemFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('memFileName').textContent = '宸查€夋嫨: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('memImportData').value = text;
        }).catch(err => {
            alert('鏂囦欢璇诲彇澶辫触: ' + err.message);
        });
    };
    window.importMembers = async () => {
            opLock.show();
            try {
                const text=document.getElementById('memImportData').value.trim(); if(!text)return; const lines=text.split('\n').filter(l=>l.trim()); for(let i=1;i<lines.length;i++){const p=parseCSVLine(lines[i]); if(p.length>=1){const data={name:p[0],role:p[1]||'',description:p[2]||'',avatar_icon:'fas fa-user-circle'}; if(USE_SUPABASE)await db.members.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_members')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_members',JSON.stringify(a));}} } alert('瀵煎叆鎴愬姛锛?);document.getElementById('memImportData').value='';renderMemberList();
            } finally {
                opLock.hide();
            }
        };

    async function renderPollsPanel() {
        const container = document.getElementById('panelPolls');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-vote-yea"></i> 鎶曠エ绠＄悊 <button class="export-btn" onclick="exportPolls()"><i class="fas fa-download"></i> 瀵煎嚭</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 鎵归噺瀵煎叆鎶曠エ閫夐」</h4>
                    <p>閫夋嫨 CSV/TXT 鏂囦欢鎴栫矘璐村唴瀹?鈫?鐐瑰嚮瀵煎叆</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('pollFileInput').click()"><i class="fas fa-file-upload"></i> 閫夋嫨鏂囦欢</button>
                        <button class="btn-sm primary" onclick="downloadPollsTemplate()"><i class="fas fa-file-csv"></i> 涓嬭浇妯℃澘</button>
                    </div>
                    <input type="file" id="pollFileInput" accept=".csv,.txt" style="display:none" onchange="handlePollFileSelect(this)">
                    <div id="pollFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="pollImportData" placeholder="绮樿创 CSV锛堟姇绁ㄦ爣棰?鎻忚堪,寮€濮嬫棩鏈?缁撴潫鏃ユ湡,閫夐」1,閫夐」2,閫夐」3...锛? style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importPolls()"><i class="fas fa-upload"></i> 瀵煎叆鏁版嵁</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('poll', this)"> 鍏ㄩ€?/label>
                    <button class="btn-sm danger" onclick="deleteSelectedPolls()"><i class="fas fa-trash-alt"></i> 鍒犻櫎鎵€閫?/button>
                </div>
                <div class="item-list" id="pollList"><div class="loading">鍔犺浇涓?..</div></div>
                <div class="add-form">
                    <input type="text" id="pollTitle" placeholder="鎶曠エ鏍囬">
                    <textarea id="pollDesc" rows="1" placeholder="鎻忚堪" style="border-radius:16px;"></textarea>
                    <input type="date" id="pollStart">
                    <input type="date" id="pollEnd">
                    <input type="text" id="pollOptionsStr" placeholder="閫夐」锛堥€楀彿鍒嗛殧锛?>
                    <button onclick="addPoll()">鉃?鏂板鎶曠エ</button>
                </div>
            </div>`;
        renderPollList();
    }
    async function renderPollList() {
        const list = document.getElementById('pollList');
        if (!list) return;
        const polls = await getAllPolls();
        const options = await getAllPollOptions();
        const votes = await getAllVotes();
        list.innerHTML = polls.map(poll => {
            const pollOpts = options.filter(o => o.poll_id === poll.id);
            const totalVotes = votes.filter(v => pollOpts.some(po => po.id === v.option_id)).length;
            return `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${poll.id}"></div><div class="item-info"><strong>${escapeHtml(poll.title)}</strong><br><small>${poll.start_date||''} ~ ${poll.end_date||''}</small><br><span style="font-size:0.8rem;">鍙備笌: ${totalVotes}浜?/span><div>閫夐」: ${pollOpts.map(o=>o.option_text).join(', ')}</div></div><div class="item-actions"><button class="btn-sm" onclick="viewPollResult(${poll.id})"><i class="fas fa-chart-bar"></i></button><button class="btn-sm danger" onclick="deletePoll(${poll.id})"><i class="fas fa-trash-alt"></i></button></div></div>`;
        }).join('') || '<p class="loading">鏆傛棤鎶曠エ</p>';
    }
    window.deletePoll = async (id) => {
            opLock.show();
            try {
                if(!confirm('纭畾鍒犻櫎锛?))return; if(USE_SUPABASE){await db.pollOptions.delete(id);await db.polls.delete(id);} else{let p=JSON.parse(localStorage.getItem('yayehui_polls')||'[]').filter(p=>p.id!==id);let o=JSON.parse(localStorage.getItem('yayehui_poll_options')||'[]').filter(o=>o.poll_id!==id);localStorage.setItem('yayehui_polls',JSON.stringify(p));localStorage.setItem('yayehui_poll_options',JSON.stringify(o));} renderPollList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedPolls = async () => {
        const ids = getSelectedIds('poll');
        if (ids.length === 0) return alert('璇峰厛閫夋嫨瑕佸垹闄ょ殑椤?);
        if (!confirm('纭畾鍒犻櫎閫変腑鐨?' + ids.length + ' 椤癸紵')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) { for (const id of ids) { await db.pollOptions.delete(id); await db.polls.delete(id); } }
            else { let p = JSON.parse(localStorage.getItem('yayehui_polls')||'[]').filter(p => !ids.includes(p.id)); let o = JSON.parse(localStorage.getItem('yayehui_poll_options')||'[]').filter(o => !ids.includes(o.poll_id)); localStorage.setItem('yayehui_polls',JSON.stringify(p)); localStorage.setItem('yayehui_poll_options',JSON.stringify(o)); }
            renderPollList();
        } finally { opLock.hide(); }
    };
    window.viewPollResult = async (pollId) => { const options=await getAllPollOptions();const votes=await getAllVotes();const pollOpts=options.filter(o=>o.poll_id===pollId);const result=pollOpts.map(o=>({text:o.option_text,count:votes.filter(v=>v.option_id===o.id).length})); alert('鎶曠エ缁撴灉锛歕n'+result.map(r=>`${r.text}: ${r.count}绁╜).join('\n')); };
    window.addPoll = async () => {
            opLock.show();
            try {
                const t=document.getElementById('pollTitle')?.value.trim(),desc=document.getElementById('pollDesc')?.value.trim(),s=document.getElementById('pollStart')?.value,e=document.getElementById('pollEnd')?.value,opts=document.getElementById('pollOptionsStr')?.value.trim(); if(!t||!s||!e||!opts)return alert('璇峰～鍐欏畬鏁?); const pollData={title:t,description:desc,start_date:s,end_date:e,is_active:true}; if(USE_SUPABASE){await db.polls.create(pollData);const polls=await getAllPolls();const np=polls.find(p=>p.title===t);if(np){let optArr=opts.split(/[,锛宂+/).map(x=>x.trim()).filter(x=>x);for(const opt of optArr)await db.pollOptions.create({poll_id:np.id,option_text:opt});}} else{let p=JSON.parse(localStorage.getItem('yayehui_polls')||'[]');const nid=nextId(p);pollData.id=nid;p.push(pollData);localStorage.setItem('yayehui_polls',JSON.stringify(p));let o=JSON.parse(localStorage.getItem('yayehui_poll_options')||'[]');opts.split(/[,锛宂+/).map(x=>x.trim()).filter(x=>x).forEach(opt=>{o.push({id:nextId(o),poll_id:nid,option_text:opt});});localStorage.setItem('yayehui_poll_options',JSON.stringify(o));} ['pollTitle','pollDesc','pollOptionsStr'].forEach(id=>document.getElementById(id).value='');renderPollList();
            } finally {
                opLock.hide();
            }
        };
    window.exportPolls = async () => { const polls=await getAllPolls(); const options=await getAllPollOptions(); const votes=await getAllVotes(); const data=polls.map(p=>{const opts=options.filter(o=>o.poll_id===p.id);const optCounts=opts.map(o=>`${o.option_text}${votes.filter(v=>v.option_id===o.id).length}`).join('锛?);const totalVotes=votes.filter(v=>opts.some(o=>o.id===v.option_id)).length;return{...p,options:opts.map(o=>o.option_text).join(';'),vote_counts:totalVotes>0?`${optCounts}锛屽叡${totalVotes}绁╜:'鏆傛棤鎶曠エ'};}); if(data.length===0){alert('鏆傛棤鎶曠エ鏁版嵁鍙鍑猴紝璇峰厛鏂板鎴栧鍏ユ姇绁?);return;} exportData(data,'鎶曠エ鏁版嵁',[{key:'title',label:'鏍囬'},{key:'description',label:'鎻忚堪'},{key:'start_date',label:'寮€濮嬫棩鏈?},{key:'end_date',label:'缁撴潫鏃ユ湡'},{key:'options',label:'閫夐」'},{key:'vote_counts',label:'鎶曠エ缁熻'}]);
        
        // 瀵煎嚭鎶曠エ鏄庣粏
        if(votes.length > 0) {
            const voteDetails = votes.map(v => {
                const poll = polls.find(p => p.id === v.poll_id);
                const opt = options.find(o => o.id === v.option_id);
                return { poll_title:poll?.title||'', option_text:opt?.option_text||'', voter_name:v.voter_name||'', property_address:v.property_address||'', vote_time:v.vote_time||'' };
            });
            exportData(voteDetails,'鎶曠エ鏄庣粏',[{key:'poll_title',label:'鎶曠エ鏍囬'},{key:'option_text',label:'鎶曠エ閫夐」'},{key:'voter_name',label:'鎶曠エ浜?},{key:'property_address',label:'鎴夸骇鍦板潃'},{key:'vote_time',label:'鎶曠エ鏃堕棿'}]);
        }
    };
    window.downloadPollsTemplate = () => downloadTemplate([{key:'title',label:'鏍囬'},{key:'description',label:'鎻忚堪'},{key:'start_date',label:'寮€濮嬫棩鏈?},{key:'end_date',label:'缁撴潫鏃ユ湡'},{key:'options',label:'閫夐」锛堥€楀彿鍒嗛殧锛?}],'鎶曠エ');
    window.handlePollFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('pollFileName').textContent = '宸查€夋嫨: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('pollImportData').value = text;
        }).catch(err => {
            alert('鏂囦欢璇诲彇澶辫触: ' + err.message);
        });
    };
    window.importPolls = async () => {
            opLock.show();
            try {
                const text=document.getElementById('pollImportData').value.trim(); if(!text)return; const lines=text.split('\n').filter(l=>l.trim()); for(let i=1;i<lines.length;i++){const p=parseCSVLine(lines[i]); if(p.length>=4){const pollData={title:p[0],description:p[1],start_date:p[2],end_date:p[3],is_active:true};
                // 瑙ｆ瀽閫夐」锛氭敮鎸佷袱绉嶆牸寮?
                // 鏍煎紡1锛堟ā鏉挎牸寮忥級锛氶€夐」鍦ㄥ崟涓瓧娈典腑锛岀敤閫楀彿/涓枃閫楀彿鍒嗛殧
                // 鏍煎紡2锛堝瀛楁鏍煎紡锛夛細姣忎釜閫夐」鍗曠嫭涓€涓狢SV瀛楁
                let optionTexts = [];
                if (p.length === 5 && p[4]) {
                    // 妯℃澘鏍煎紡锛氱5涓瓧娈靛寘鍚墍鏈夐€夐」锛岀敤閫楀彿鍒嗛殧
                    optionTexts = p[4].split(/[,锛宂+/).map(x => x.trim()).filter(x => x);
                } else {
                    // 澶氬瓧娈垫牸寮忥細浠庣储寮?寮€濮嬫瘡涓瓧娈垫槸涓€涓€夐」
                    for (let j = 4; j < p.length; j++) {
                        if (p[j]) optionTexts.push(p[j]);
                    }
                }
                if(USE_SUPABASE){await db.polls.create(pollData);const polls=await getAllPolls();const np=polls.find(pl=>pl.title===p[0]);if(np){for(const opt of optionTexts)await db.pollOptions.create({poll_id:np.id,option_text:opt});}} else{let pl=JSON.parse(localStorage.getItem('yayehui_polls')||'[]');const nid=nextId(pl);pollData.id=nid;pl.push(pollData);localStorage.setItem('yayehui_polls',JSON.stringify(pl));let o=JSON.parse(localStorage.getItem('yayehui_poll_options')||'[]');for(const opt of optionTexts)o.push({id:nextId(o),poll_id:nid,option_text:opt});localStorage.setItem('yayehui_poll_options',JSON.stringify(o));}} } alert('瀵煎叆鎴愬姛锛?);document.getElementById('pollImportData').value='';renderPollList();
            } finally {
                opLock.hide();
            }
        };

    async function renderExpensesPanel() {
        const container = document.getElementById('panelExpenses');
        if (!container) return;
        
        // 鑾峰彇缁熻鏁版嵁
        let allExpenses = [];
        if (USE_SUPABASE) allExpenses = await db.expenses.getAll() || [];
        else allExpenses = JSON.parse(localStorage.getItem('yayehui_expenses') || '[]');
        
        let totalIncome = 0, totalExpense = 0;
        allExpenses.forEach(e => { if (e.category === '鏀跺叆') totalIncome += parseFloat(e.amount || 0); else totalExpense += parseFloat(e.amount || 0); });
        const balance = totalIncome - totalExpense;
        
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-chart-pie"></i> 璐圭敤鍏ず绠＄悊 
                    <button class="export-btn" onclick="exportExpenses()"><i class="fas fa-download"></i> 瀵煎嚭</button>
                </h3>
                <div class="stats-row" style="margin-bottom:16px;">
                    <div class="stat-card" style="background:linear-gradient(135deg,#10b981,#34d399);">
                        <div class="num">楼${totalIncome.toFixed(2)}</div>
                        <div class="label">鎬绘敹鍏?/div>
                    </div>
                    <div class="stat-card" style="background:linear-gradient(135deg,#ef4444,#f87171);">
                        <div class="num">楼${totalExpense.toFixed(2)}</div>
                        <div class="label">鎬绘敮鍑?/div>
                    </div>
                    <div class="stat-card" style="background:linear-gradient(135deg,#2c6e49,#4c9f70);">
                        <div class="num">楼${balance.toFixed(2)}</div>
                        <div class="label">缁撲綑</div>
                    </div>
                </div>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 鎵归噺瀵煎叆</h4>
                    <p>閫夋嫨 CSV/TXT 鏂囦欢鎴栫矘璐村唴瀹?鈫?鐐瑰嚮瀵煎叆</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('expFileInput').click()"><i class="fas fa-file-upload"></i> 閫夋嫨鏂囦欢</button>
                        <button class="btn-sm primary" onclick="downloadExpensesTemplate()"><i class="fas fa-file-csv"></i> 涓嬭浇妯℃澘</button>
                    </div>
                    <input type="file" id="expFileInput" accept=".csv,.txt" style="display:none" onchange="handleExpFileSelect(this)">
                    <div id="expFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="expImportData" placeholder="绮樿创 CSV锛堥」鐩悕绉?绫诲埆(鏀跺叆/鏀嚭),閲戦,鏃ユ湡,澶囨敞锛? style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importExpenses()"><i class="fas fa-upload"></i> 瀵煎叆鏁版嵁</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('exp', this)"> 鍏ㄩ€?/label>
                    <button class="btn-sm danger" onclick="deleteSelectedExpenses()"><i class="fas fa-trash-alt"></i> 鍒犻櫎鎵€閫?/button>
                </div>
                <div class="item-list" id="expList"><div class="loading">鍔犺浇涓?..</div></div>
                <div class="add-form">
                    <input type="text" id="expItem" placeholder="椤圭洰鍚嶇О">
                    <select id="expCategory" style="padding:8px 12px;border-radius:30px;border:1px solid #cfdfd3;"><option value="鏀跺叆">鏀跺叆</option><option value="鏀嚭">鏀嚭</option></select>
                    <input type="number" id="expAmount" placeholder="閲戦">
                    <input type="date" id="expDate">
                    <input type="text" id="expRemark" placeholder="澶囨敞">
                    <button onclick="addExpense()">鉃?鏂板</button>
                </div>
            </div>`;
        renderExpenseList();
    }
    async function renderExpenseList() {
        const list = document.getElementById('expList');
        if (!list) return;
        const items = await getAllExpenses();
        list.innerHTML = items.map(item => `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${item.id}"></div><div class="item-info"><strong>${escapeHtml(item.item_name)}</strong> | ${item.category||''} | 楼${parseFloat(item.amount||0).toFixed(2)} | ${item.date||''}<div>${escapeHtml(item.remark||'')}</div></div><div class="item-actions"><button class="btn-sm" onclick="editExpense(${item.id})"><i class="fas fa-edit"></i></button><button class="btn-sm danger" onclick="deleteExpense(${item.id})"><i class="fas fa-trash-alt"></i></button></div></div>`).join('') || '<p class="loading">鏆傛棤璐圭敤</p>';
    }
    window.deleteExpense = async (id) => {
            opLock.show();
            try {
                if(!confirm('纭畾鍒犻櫎锛?))return; if(USE_SUPABASE)await db.expenses.delete(id); else{let a=JSON.parse(localStorage.getItem('yayehui_expenses')||'[]').filter(i=>i.id!==id);localStorage.setItem('yayehui_expenses',JSON.stringify(a));} renderExpenseList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedExpenses = async () => {
        const ids = getSelectedIds('exp');
        if (ids.length === 0) return alert('璇峰厛閫夋嫨瑕佸垹闄ょ殑椤?);
        if (!confirm('纭畾鍒犻櫎閫変腑鐨?' + ids.length + ' 椤癸紵')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) { for (const id of ids) await db.expenses.delete(id); }
            else { let a = JSON.parse(localStorage.getItem('yayehui_expenses')||'[]'); a = a.filter(i => !ids.includes(i.id)); localStorage.setItem('yayehui_expenses',JSON.stringify(a)); }
            renderExpenseList();
        } finally { opLock.hide(); }
    };
    window.addExpense = async () => {
            opLock.show();
            try {
                const item=document.getElementById('expItem')?.value.trim(),cat=document.getElementById('expCategory')?.value,amt=parseFloat(document.getElementById('expAmount')?.value),dt=document.getElementById('expDate')?.value,rm=document.getElementById('expRemark')?.value.trim(); if(!item||isNaN(amt)||!dt)return alert('璇峰～鍐欏畬鏁?); const data={category:cat,item_name:item,amount:amt,date:dt,remark:rm}; if(USE_SUPABASE)await db.expenses.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_expenses')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_expenses',JSON.stringify(a));} ['expItem','expAmount','expRemark'].forEach(id=>document.getElementById(id).value='');renderExpenseList();
            } finally {
                opLock.hide();
            }
        };
    window.editExpense = async (id) => {
            opLock.show();
            try {
                const items=await getAllExpenses();const it=items.find(i=>i.id===id);const nn=prompt('椤圭洰鍚嶇О',it?.item_name);const na=parseFloat(prompt('閲戦',it?.amount));if(nn&&!isNaN(na)){if(USE_SUPABASE)await db.expenses.update(id,{item_name:nn,amount:na});else{let a=JSON.parse(localStorage.getItem('yayehui_expenses')||'[]');const r=a.find(i=>i.id===id);if(r){r.item_name=nn;r.amount=na;localStorage.setItem('yayehui_expenses',JSON.stringify(a));}}renderExpenseList();}
            } finally {
                opLock.hide();
            }
        };
    window.exportExpenses = async () => { const items=await getAllExpenses(); exportData(items,'璐圭敤鍏ず',[{key:'category',label:'绫诲埆'},{key:'item_name',label:'椤圭洰鍚嶇О'},{key:'amount',label:'閲戦'},{key:'date',label:'鏃ユ湡'},{key:'remark',label:'澶囨敞'}]); };
    window.downloadExpensesTemplate = () => downloadTemplate([{key:'category',label:'绫诲埆'},{key:'item_name',label:'椤圭洰鍚嶇О'},{key:'amount',label:'閲戦'},{key:'date',label:'鏃ユ湡'},{key:'remark',label:'澶囨敞'}],'璐圭敤鍏ず');
    window.handleExpFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('expFileName').textContent = '宸查€夋嫨: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('expImportData').value = text;
        }).catch(err => {
            alert('鏂囦欢璇诲彇澶辫触: ' + err.message);
        });
    };
    window.importExpenses = async () => {
            opLock.show();
            try {
                const text=document.getElementById('expImportData').value.trim(); if(!text)return; const lines=text.split('\n').filter(l=>l.trim()); for(let i=1;i<lines.length;i++){const p=parseCSVLine(lines[i]); if(p.length>=2){const data={category:p[0]||'鏀嚭',item_name:p[1],amount:parseFloat(p[2])||0,date:p[3]||new Date().toISOString().slice(0,10),remark:p[4]||''}; if(USE_SUPABASE)await db.expenses.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_expenses')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_expenses',JSON.stringify(a));}} } alert('瀵煎叆鎴愬姛锛?);document.getElementById('expImportData').value='';renderExpenseList();
            } finally {
                opLock.hide();
            }
        };

    async function renderTopicsPanel() {
        const container = document.getElementById('panelTopics');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-comments"></i> 涓氫富蹇冨０绠＄悊锛堜笉鏀寔鎵归噺瀵煎叆锛?button class="export-btn" onclick="exportTopics()"><i class="fas fa-download"></i> 瀵煎嚭</button></h3>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('topics', this)"> 鍏ㄩ€?/label>
                    <button class="btn-sm danger" onclick="deleteSelectedTopics()"><i class="fas fa-trash-alt"></i> 鍒犻櫎鎵€閫?/button>
                </div>
                <div class="item-list" id="topicsList"><div class="loading">鍔犺浇涓?..</div></div>
                <div class="add-form">
                    <input type="text" id="newTopicTitle" placeholder="鏍囬">
                    <textarea id="newTopicContent" rows="1" placeholder="鍐呭" style="border-radius:16px;"></textarea>
                    <input type="text" id="newTopicAuthor" placeholder="浣滆€呮樀绉?>
                    <button onclick="addTopicFromAdmin()">鉃?鍙戝竷甯栧瓙</button>
                </div>
            </div>`;
        renderTopicsList();
    }
    async function renderTopicsList() {
        const list = document.getElementById('topicsList');
        if (!list) return;
        const topics = await getAllTopics();
        const replies = await getAllReplies();
        list.innerHTML = topics.map(topic => {
            const rc = replies.filter(r => r.topic_id === topic.id).length;
            return `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${topic.id}"></div><div class="item-info"><strong>${escapeHtml(topic.title)}</strong><br><small>浣滆€? ${escapeHtml(topic.author||'')} | 娴忚 ${topic.view_count||0} | 鍥炲 ${rc}</small><div>${escapeHtml((topic.content||'').substring(0,60))}</div></div><div class="item-actions"><button class="btn-sm" onclick="viewTopicReplies(${topic.id})"><i class="fas fa-comments"></i></button><button class="btn-sm danger" onclick="deleteTopic(${topic.id})"><i class="fas fa-trash-alt"></i></button></div></div>`;
        }).join('') || '<p class="loading">鏆傛棤甯栧瓙</p>';
    }
    window.deleteTopic = async (id) => {
            opLock.show();
            try {
                if(!confirm('纭畾鍒犻櫎锛?))return; if(USE_SUPABASE)await db.topics.delete(id); else{let t=JSON.parse(localStorage.getItem('yayehui_topics')||'[]').filter(t=>t.id!==id);let r=JSON.parse(localStorage.getItem('yayehui_replies')||'[]').filter(r=>r.topic_id!==id);localStorage.setItem('yayehui_topics',JSON.stringify(t));localStorage.setItem('yayehui_replies',JSON.stringify(r));} renderTopicsList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedTopics = async () => {
        const ids = getSelectedIds('topics');
        if (ids.length === 0) return alert('璇峰厛閫夋嫨瑕佸垹闄ょ殑椤?);
        if (!confirm('纭畾鍒犻櫎閫変腑鐨?' + ids.length + ' 椤癸紵')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) { for (const id of ids) await db.topics.delete(id); }
            else { let t = JSON.parse(localStorage.getItem('yayehui_topics')||'[]').filter(t => !ids.includes(t.id)); let r = JSON.parse(localStorage.getItem('yayehui_replies')||'[]').filter(r => !ids.includes(r.topic_id)); localStorage.setItem('yayehui_topics',JSON.stringify(t)); localStorage.setItem('yayehui_replies',JSON.stringify(r)); }
            renderTopicsList();
        } finally { opLock.hide(); }
    };
    window.viewTopicReplies = async (id) => { const topics=await getAllTopics();const topic=topics.find(t=>t.id===id);const replies=await getAllReplies();const trs=replies.filter(r=>r.topic_id===id); const html=`<span style="float:right;cursor:pointer;font-size:24px;" onclick="closeModal()">&times;</span><h3>${escapeHtml(topic?.title||'')} 鐨勮窡甯?/h3>${trs.map(r=>`<div class="reply-item"><div class="reply-meta">${escapeHtml(r.author||'')} 路 ${formatDate(r.created_at)}</div><div>${escapeHtml(r.content||'')}</div><button class="btn-sm danger" style="margin-top:6px;" onclick="deleteReplyAdmin(${r.id},${id})">鍒犻櫎</button></div>`).join('')}${trs.length===0?'<p style="color:#6c7a91;text-align:center;padding:20px;">鏆傛棤璺熷笘</p>':''}<div class="modal-footer"><button class="modal-btn cancel" onclick="closeModal()">鍏抽棴</button></div>`; showModal(html); };
    window.deleteReplyAdmin = async (replyId, topicId) => {
            opLock.show();
            try {
                if(!confirm('纭畾鍒犻櫎璇ヨ窡甯栵紵'))return; if(USE_SUPABASE)await db.replies.delete(replyId); else{let r=JSON.parse(localStorage.getItem('yayehui_replies')||'[]').filter(r=>r.id!==replyId);localStorage.setItem('yayehui_replies',JSON.stringify(r));} viewTopicReplies(topicId);
            } finally {
                opLock.hide();
            }
        };
    window.addTopicFromAdmin = async () => {
            opLock.show();
            try {
                const t=document.getElementById('newTopicTitle')?.value.trim(),c=document.getElementById('newTopicContent')?.value.trim(),a=document.getElementById('newTopicAuthor')?.value.trim(); if(!t||!c||!a)return alert('璇峰～鍐欏畬鏁?); const data={title:t,content:c,author:a,view_count:0,reply_count:0,created_at:new Date().toISOString()}; if(USE_SUPABASE)await db.topics.create(data); else{let topics=JSON.parse(localStorage.getItem('yayehui_topics')||'[]');data.id=nextId(topics);topics.push(data);localStorage.setItem('yayehui_topics',JSON.stringify(topics));} ['newTopicTitle','newTopicContent','newTopicAuthor'].forEach(id=>document.getElementById(id).value='');renderTopicsList();
            } finally {
                opLock.hide();
            }
        };
    window.exportTopics = async () => { const topics=await getAllTopics(); exportData(topics,'涓氫富蹇冨０',[{key:'title',label:'鏍囬'},{key:'content',label:'鍐呭'},{key:'author',label:'浣滆€?},{key:'view_count',label:'娴忚閲?},{key:'reply_count',label:'鍥炲鏁?},{key:'created_at',label:'鍙戝竷鏃堕棿'}]); };

    // 娉ㄥ唽鐢ㄦ埛绠＄悊
    async function renderUsersPanel() {
        const container = document.getElementById('panelUsers');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-user-check"></i> 鐢ㄦ埛娉ㄥ唽淇℃伅 <button class="export-btn" onclick="exportUsers()"><i class="fas fa-download"></i> 瀵煎嚭</button></h3>
                <div class="stats-row" id="userStatsRow">
                    <div class="stat-card"><div class="num" id="statTotalUsers">-</div><div class="label">娉ㄥ唽鐢ㄦ埛鎬绘暟</div></div>
                </div>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 鎵归噺瀵煎叆</h4>
                    <p>閫夋嫨 CSV/TXT 鏂囦欢鎴栫矘璐村唴瀹?鈫?鐐瑰嚮瀵煎叆</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('userFileInput').click()"><i class="fas fa-file-upload"></i> 閫夋嫨鏂囦欢</button>
                        <button class="btn-sm primary" onclick="downloadUsersTemplate()"><i class="fas fa-file-csv"></i> 涓嬭浇妯℃澘</button>
                    </div>
                    <input type="file" id="userFileInput" accept=".csv,.txt" style="display:none" onchange="handleUserFileSelect(this)">
                    <div id="userFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="userImportData" placeholder="绮樿创 CSV锛堢敤鎴峰悕绉?鎵嬫満鍙风爜,鎴夸骇鍦板潃锛? style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importUsers()"><i class="fas fa-upload"></i> 瀵煎叆鏁版嵁</button>
                </div>
                <div class="add-form">
                    <input type="text" id="newUserName" placeholder="鐢ㄦ埛鍚嶇О">
                    <input type="text" id="newUserPhone" placeholder="鎵嬫満鍙风爜">
                    <input type="text" id="newUserAddress" placeholder="鎴夸骇鍦板潃">
                    <button onclick="addRegisteredUser()">鉃?鏂板鐢ㄦ埛</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('users', this)"> 鍏ㄩ€?/label>
                    <button class="btn-sm danger" onclick="deleteSelectedUsers()"><i class="fas fa-trash-alt"></i> 鍒犻櫎鎵€閫?/button>
                </div>
                <div class="item-list" id="usersList"><div class="loading">鍔犺浇涓?..</div></div>
            </div>`;
        renderUsersList();
    }
    async function renderUsersList() {
        const list = document.getElementById('usersList');
        if (!list) return;
        const users = await getAllRegisteredUsers();
        document.getElementById('statTotalUsers').textContent = users.length;
        list.innerHTML = users.map(u => `<div class="user-reg-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${u.id}"></div><div><strong>${escapeHtml(u.user_name||'')}</strong><br><small>鎵嬫満: ${escapeHtml(u.phone||'')} | 鍦板潃: ${escapeHtml(u.property_address||'')} | 娉ㄥ唽: ${formatDate(u.created_at)}</small></div><button class="btn-sm danger" onclick="deleteUser(${u.id})"><i class="fas fa-trash-alt"></i></button></div>`).join('') || '<p class="loading">鏆傛棤娉ㄥ唽鐢ㄦ埛</p>';
    }
    window.deleteUser = async (id) => {
            opLock.show();
            try {
                if(!confirm('纭畾鍒犻櫎璇ョ敤鎴凤紵'))return; if(USE_SUPABASE)await db.registeredUsers.delete(id); else{let u=JSON.parse(localStorage.getItem('yayehui_registered_users')||'[]').filter(u=>u.id!==id);localStorage.setItem('yayehui_registered_users',JSON.stringify(u));} renderUsersList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedUsers = async () => {
        const ids = getSelectedIds('users');
        if (ids.length === 0) return alert('璇峰厛閫夋嫨瑕佸垹闄ょ殑鐢ㄦ埛');
        if (!confirm('纭畾鍒犻櫎閫変腑鐨?' + ids.length + ' 涓敤鎴凤紵')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) {
                for (const id of ids) await db.registeredUsers.delete(id);
            } else {
                let u = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]');
                u = u.filter(user => !ids.includes(user.id));
                localStorage.setItem('yayehui_registered_users', JSON.stringify(u));
            }
            renderUsersList();
        } finally {
            opLock.hide();
        }
    };
    window.exportUsers = async () => { const users=await getAllRegisteredUsers(); exportData(users,'娉ㄥ唽鐢ㄦ埛',[{key:'user_name',label:'鐢ㄦ埛鍚嶇О'},{key:'phone',label:'鎵嬫満鍙风爜'},{key:'property_address',label:'鎴夸骇鍦板潃'},{key:'created_at',label:'娉ㄥ唽鏃堕棿'}]); };
    window.downloadUsersTemplate = () => downloadTemplate([{key:'user_name',label:'鐢ㄦ埛鍚嶇О'},{key:'phone',label:'鎵嬫満鍙风爜'},{key:'property_address',label:'鎴夸骇鍦板潃'}],'娉ㄥ唽鐢ㄦ埛');
    window.handleUserFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('userFileName').textContent = '宸查€夋嫨: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('userImportData').value = text;
        }).catch(err => {
            alert('鏂囦欢璇诲彇澶辫触: ' + err.message);
        });
    };
    window.importUsers = async () => {
        opLock.show();
        try {
            const text = document.getElementById('userImportData').value.trim();
            if (!text) return alert('璇风矘璐存暟鎹?);
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) return alert('鏁版嵁鏍煎紡閿欒锛岃嚦灏戦渶瑕佹爣棰樿鍜屾暟鎹');
            const importedAddresses = []; // 鏀堕泦瀵煎叆鐨勫湴鍧€
            for (let i = 1; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i]);
                if (parts.length >= 1) {
                    const data = {
                        user_name: parts[0] || '',
                        phone: parts[1] || '',
                        property_address: parts[2] || '',
                        created_at: new Date().toISOString()
                    };
                    if (data.property_address) importedAddresses.push(data.property_address);
                    if (USE_SUPABASE) {
                        await db.registeredUsers.create(data);
                    } else {
                        let a = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]');
                        data.id = nextId(a);
                        a.push(data);
                        localStorage.setItem('yayehui_registered_users', JSON.stringify(a));
                    }
                }
            }
            // 鍚屾鏇存柊鎴夸骇鍦板潃鐨勬敞鍐岀姸鎬?
            if (importedAddresses.length > 0) {
                let addrs = JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]');
                let updated = false;
                for (const importedAddr of importedAddresses) {
                    const match = addrs.find(a => a.address === importedAddr);
                    if (match && !match.is_registered) {
                        match.is_registered = true;
                        updated = true;
                    }
                }
                if (updated) {
                    localStorage.setItem('yayehui_property_addresses', JSON.stringify(addrs));
                }
            }
            alert('瀵煎叆鎴愬姛锛?);
            document.getElementById('userImportData').value = '';
            renderUsersList();
        } finally {
            opLock.hide();
        }
    };
    window.addRegisteredUser = async () => {
        const name = document.getElementById('newUserName').value.trim();
        const phone = document.getElementById('newUserPhone').value.trim();
        const address = document.getElementById('newUserAddress').value.trim();
        if (!name) return alert('璇疯緭鍏ョ敤鎴峰悕绉?);
        opLock.show();
        try {
            const data = { user_name: name, phone: phone, property_address: address, created_at: new Date().toISOString() };
            if (USE_SUPABASE) { await db.registeredUsers.create(data); } else { let a = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]'); data.id = nextId(a); a.push(data); localStorage.setItem('yayehui_registered_users', JSON.stringify(a)); }
            // 鍚屾鏇存柊鎴夸骇鍦板潃鐨勬敞鍐岀姸鎬?
            if (address) {
                let addrs = JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]');
                const match = addrs.find(a => a.address === address);
                if (match && !match.is_registered) {
                    match.is_registered = true;
                    localStorage.setItem('yayehui_property_addresses', JSON.stringify(addrs));
                }
            }
            document.getElementById('newUserName').value = '';
            document.getElementById('newUserPhone').value = '';
            document.getElementById('newUserAddress').value = '';
            renderUsersList();
        } finally {
            opLock.hide();
        }
    };

    // 鎴夸骇鍦板潃瀵煎叆
    async function renderPropertyPanel() {
        const container = document.getElementById('panelProperty');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-map-marked-alt"></i> 鎴夸骇鍦板潃绠＄悊 <button class="export-btn" onclick="exportPropertyAddresses()"><i class="fas fa-download"></i> 瀵煎嚭</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 鎵归噺瀵煎叆</h4>
                    <p>閫夋嫨 CSV/TXT 鏂囦欢鎴栫矘璐村唴瀹?鈫?鐐瑰嚮瀵煎叆</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('addrFileInput').click()"><i class="fas fa-file-upload"></i> 閫夋嫨鏂囦欢</button>
                        <button class="btn-sm primary" onclick="downloadAddrTemplate()"><i class="fas fa-file-csv"></i> 涓嬭浇妯℃澘</button>
                    </div>
                    <input type="file" id="addrFileInput" accept=".csv,.txt" style="display:none" onchange="handleAddrFileSelect(this)">
                    <div id="addrFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <p style="color:#6c7a91;font-size:0.85rem;margin-bottom:10px;">CSV 鏍煎紡锛氭埧浜у湴鍧€<br>鎴栨瘡琛屼竴涓湴鍧€锛屾牸寮忕ず渚嬶細<br>1搴?妤?01<br>2搴?妤?01<br>7搴?妤?01</p>
                    <textarea id="addrImportText" placeholder="绮樿创 CSV 鏁版嵁鎴栨瘡琛屼竴涓湴鍧€" style="width:100%;height:160px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <div style="margin-top:12px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        <button class="btn-sm success" onclick="importPropertyAddresses()"><i class="fas fa-upload"></i> 瀵煎叆鍦板潃</button>
                    </div>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('addr', this)"> 鍏ㄩ€?/label>
                    <button class="btn-sm danger" onclick="deleteSelectedAddresses()"><i class="fas fa-trash-alt"></i> 鍒犻櫎鎵€閫?/button>
                </div>
                <div class="item-list" id="addrList" style="margin-top:16px;"><div class="loading">鍔犺浇涓?..</div></div>
            </div>`;
        renderAddrList();
    }
    async function renderAddrList() {
        const list = document.getElementById('addrList');
        if (!list) return;
        const addrs = await getAllPropertyAddresses();
        list.innerHTML = addrs.map(a => `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${a.id}"></div><div class="item-info"><strong>${escapeHtml(a.address||'')}</strong><br><small>鏍? ${escapeHtml(a.building||'')} | 妤煎眰: ${escapeHtml(a.floor||'')} | 鎴垮彿: ${escapeHtml(a.unit||'')}</small><br><small>瀵煎叆: ${formatDate(a.imported_at)} | ${a.is_registered?'<span style="color:#c2410c;">宸叉敞鍐?/span>':'<span style="color:#2c6e49;">鏈敞鍐?/span>'}</small></div><div class="item-actions"><button class="btn-sm danger" onclick="deleteAddr(${a.id})"><i class="fas fa-trash-alt"></i></button></div></div>`).join('') || '<p class="loading">鏆傛棤鍦板潃</p>';
    }
    window.importPropertyAddresses = async () => {
        opLock.show();
        try {
            const text = document.getElementById('addrImportText').value.trim();
            if (!text) return alert('璇疯緭鍏ュ湴鍧€');
            const lines = text.split('\n').filter(l => l.trim());
            // 璺宠繃琛ㄥご琛岋紙濡傛灉绗竴琛岀湅璧锋潵鍍忚〃澶达級
            let startIdx = 0;
            if (lines.length > 1) {
                const firstLine = lines[0].toLowerCase().replace(/[""\s]/g, '');
                if (firstLine.includes('鍦板潃') || firstLine.includes('鎴夸骇') || firstLine.includes('address') || firstLine.includes('鏍?) || firstLine.includes('妤?)) {
                    startIdx = 1;
                }
            }
            let importedCount = 0;
            for (let i = startIdx; i < lines.length; i++) {
                const addr = lines[i];
                let clean = addr.trim();
                if (!clean) continue;
                // 浣跨敤 CSV 瑙ｆ瀽鍣ㄦ纭鐞嗗彲鑳界殑澶氬瓧娈佃锛堝瀵煎嚭鐨?CSV锛?
                const csvParts = parseCSVLine(clean);
                // 濡傛灉鍖呭惈閫楀彿锛堝瀛楁 CSV锛夛紝鍙栫涓€涓瓧娈典綔涓哄湴鍧€
                // 鍚﹀垯鏁磋浣滀负鍦板潃锛堝吋瀹规瘡琛屼竴涓湴鍧€鐨勬牸寮忥級
                if (clean.includes(',')) {
                    clean = csvParts[0];
                } else {
                    clean = csvParts[0]; // parseCSVLine 澶勭悊鍗曞瓧娈典篃浼氬幓寮曞彿
                }
                if (!clean) continue;
                // 棰濆杩囨护锛氬鏋滅湅璧锋潵鍍忚〃澶达紙绾腑鏂囨弿杩帮級锛岃烦杩?
                if (/^[\u4e00-\u9fa5]+$/.test(clean) && !/\d/.test(clean) && clean.length <= 10) continue;
                const parts = clean.match(/(\d+)搴?\d+)妤?\d+)/);
                const data = {
                    address: clean,
                    imported_at: new Date().toISOString(),
                    is_registered: false
                };
                if (parts) {
                    data.building = parts[1] + '搴?;
                    data.floor = parts[2] + '妤?;
                    data.unit = parts[3];
                }
                if (USE_SUPABASE) {
                    await db.propertyAddresses.create(data);
                } else {
                    let a = JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]');
                    if (!a.find(x => x.address === clean)) {
                        data.id = nextId(a);
                        a.push(data);
                        localStorage.setItem('yayehui_property_addresses', JSON.stringify(a));
                    }
                }
                importedCount++;
            }
            alert(`鎴愬姛瀵煎叆 ${importedCount} 涓湴鍧€锛乣);
            document.getElementById('addrImportText').value = '';
            renderAddrList();
        } finally {
            opLock.hide();
        }
    };
    window.deleteAddr = async (id) => {
            opLock.show();
            try {
                if(!confirm('纭畾鍒犻櫎锛?))return; if(USE_SUPABASE)await db.propertyAddresses.delete(id); else{let a=JSON.parse(localStorage.getItem('yayehui_property_addresses')||'[]').filter(i=>i.id!==id);localStorage.setItem('yayehui_property_addresses',JSON.stringify(a));} renderAddrList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedAddresses = async () => {
        const ids = getSelectedIds('addr');
        if (ids.length === 0) return alert('璇峰厛閫夋嫨瑕佸垹闄ょ殑椤?);
        if (!confirm('纭畾鍒犻櫎閫変腑鐨?' + ids.length + ' 椤癸紵')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) {
                for (const id of ids) await db.propertyAddresses.delete(id);
            } else {
                let a = JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]');
                a = a.filter(i => !ids.includes(i.id));
                localStorage.setItem('yayehui_property_addresses', JSON.stringify(a));
            }
            renderAddrList();
        } finally {
            opLock.hide();
        }
    };
    window.exportPropertyAddresses = async () => { const addrs=await getAllPropertyAddresses(); exportData(addrs,'鎴夸骇鍦板潃',[{key:'address',label:'鎴夸骇鍦板潃'},{key:'building',label:'鏍?},{key:'floor',label:'妤煎眰'},{key:'unit',label:'鎴垮彿'},{key:'is_registered',label:'鏄惁宸叉敞鍐?}]); };
    window.downloadAddrTemplate = () => downloadTemplate([{key:'address',label:'鎴夸骇鍦板潃'}],'鎴夸骇鍦板潃');
    window.handleAddrFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('addrFileName').textContent = '宸查€夋嫨: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('addrImportText').value = text;
        }).catch(err => {
            alert('鏂囦欢璇诲彇澶辫触: ' + err.message);
        });
    };

    // 绔欑偣璁剧疆
    async function renderSiteSettingsPanel() {
        const container = document.getElementById('panelSiteSettings');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-cog"></i> 绔欑偣鍐呭璁剧疆</h3>
                <div id="siteSettingsList" style="margin-bottom:20px;"><div class="loading">鍔犺浇涓?..</div></div>
            </div>`;
        renderSiteSettingsList();
    }
    async function renderSiteSettingsList() {
        const list = document.getElementById('siteSettingsList');
        if (!list) return;
        let settings = [];
        // 浠?localStorage 璇诲彇绔欑偣璁剧疆
        if (USE_SUPABASE) { settings = await db.siteSettings.getAll() || []; } else { settings = JSON.parse(localStorage.getItem('yayehui_site_settings')||'[]'); }
        
        // 濡傛灉娌℃湁璁剧疆锛屽姞杞介粯璁ゅ€?
        if (settings.length === 0) {
            settings = [
                { setting_key: 'nav_menu_left_text', setting_value: '闆呬笟浼? },
                { setting_key: 'nav_menu_left_subtext', setting_value: '闆呭眳路鍏辨不路缇庡ソ' },
                { setting_key: 'footer_banner_text', setting_value: '鍏紑路淇′换路鍏卞缓缇庡ソ绀惧尯' },
                { setting_key: 'footer_address', setting_value: '闆呭眳鑺卞洯 路 涓氬浼氬姙鍏' },
                { setting_key: 'footer_copyright', setting_value: '漏 2025 闆呬笟浼氫笟涓诲鍛樹細骞冲彴 | 鎼烘墜鍏卞垱瀹滃眳瀹跺洯' },
                { setting_key: 'hero_title', setting_value: '鍏卞缓路鍏辨不路鍏变韩' },
                { setting_key: 'hero_subtitle', setting_value: '闆呬笟浼氫笌鎮ㄦ惡鎵? },
                { setting_key: 'hero_desc', setting_value: '涓氬浼氶€忔槑鏈嶅姟锛屾櫤鎱у皬鍖虹鐞嗭紝璁╁鍥洿娓╂殩銆備笟涓绘矡閫氶浂璺濈锛屽叡鍒涘疁灞呯幆澧冦€? },
                { setting_key: 'hero_stat_1', setting_value: '12+' },
                { setting_key: 'hero_stat_1_label', setting_value: '骞村害璁' },
                { setting_key: 'hero_stat_2', setting_value: '98%' },
                { setting_key: 'hero_stat_2_label', setting_value: '涓氫富婊℃剰搴? },
                { setting_key: 'hero_stat_3', setting_value: '24h' },
                { setting_key: 'hero_stat_3_label', setting_value: '蹇€熷搷搴? },
                { setting_key: 'contact_content', setting_value: '鑱旂郴鐢佃瘽锛歺xx\nEmail锛歺xx' }
            ];
        }
        
        const keyMap = {
            nav_menu_left_text: '瀵艰埅鑿滃崟宸︿晶涓绘爣棰橈紙鏄剧ず鍦?闆呬笟浼?宸︿晶锛?,
            nav_menu_left_subtext: '瀵艰埅鑿滃崟宸︿晶鍓爣棰橈紙鏄剧ず鍦?闆呭眳路鍏辨不路缇庡ソ"浣嶇疆锛?,
            footer_banner_left_text: '搴曢儴妯箙宸︿晶鏂囧瓧锛堟樉绀哄湪"闆呬笟浼?浣嶇疆锛?,
            footer_banner_text: '搴曢儴妯箙涓棿鏂囧瓧',
            footer_address: '搴曢儴鍦板潃',
            footer_copyright: '搴曢儴鐗堟潈淇℃伅',
            hero_title: '棣栭〉妯箙涓绘爣棰?,
            hero_subtitle: '棣栭〉妯箙鍓爣棰?,
            hero_desc: '棣栭〉妯箙鎻忚堪',
            hero_stat_1: '缁熻椤?鏁板瓧',
            hero_stat_1_label: '缁熻椤?鏍囩',
            hero_stat_2: '缁熻椤?鏁板瓧',
            hero_stat_2_label: '缁熻椤?鏍囩',
            hero_stat_3: '缁熻椤?鏁板瓧',
            hero_stat_3_label: '缁熻椤?鏍囩',
            contact_content: '鑱旂郴鎴戜滑寮圭獥鍐呭锛堟敮鎸佹崲琛岋級'
        };
        let html = '';
        const keys = Object.keys(keyMap);
        keys.forEach(key => {
            const existing = settings.find(s => s.setting_key === key);
            const val = existing?.setting_value || '';
            html += `<div class="settings-item">
                <label>${keyMap[key]}</label>
                <input type="text" id="setting_${key}" value="${escapeHtml(val)}" placeholder="璇疯緭鍏?>
                <button class="btn-sm primary" onclick="saveSetting('${key}')"><i class="fas fa-save"></i> 淇濆瓨</button>
            </div>`;
        });
        list.innerHTML = html;
    }
    window.saveSetting = async (key) => {
            opLock.show();
            try {
                const val = document.getElementById('setting_' + key)?.value.trim();
        if (USE_SUPABASE) {
            const existing = await db.siteSettings.getAll() || [];
            const match = existing.find(s => s.setting_key === key);
            if (match) await db.siteSettings.update(match.id, { setting_value: val });
            else await db.siteSettings.create({ setting_key: key, setting_value: val });
        } else {
            let settings = JSON.parse(localStorage.getItem('yayehui_site_settings') || '[]');
            const idx = settings.findIndex(s => s.setting_key === key);
            if (idx >= 0) settings[idx].setting_value = val;
            else settings.push({ setting_key: key, setting_value: val });
            localStorage.setItem('yayehui_site_settings', JSON.stringify(settings));
        }
        alert('淇濆瓨鎴愬姛锛?);
            } finally {
                opLock.hide();
            }
        };

    // 瓒呯骇绠＄悊鍛橀潰鏉?
    async function renderSuperAdminPanel() {
        const container = document.getElementById('panelSuperAdmin');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-shield-alt"></i> 瓒呯骇绠＄悊鍛?<span class="tag tag-super">Super Admin</span></h3>
                <div class="import-section">
                    <h4><i class="fas fa-user-cog"></i> 绠＄悊鍛樿处鍙风鐞?/h4>
                    <div class="item-list" id="adminAccountsList"><div class="loading">鍔犺浇涓?..</div></div>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="showAddAdminModal()"><i class="fas fa-user-plus"></i> 鏂板绠＄悊鍛樿处鍙?/button>
                </div>
                <div class="import-section" style="margin-top:16px;">
                    <h4><i class="fas fa-history"></i> 鐧诲綍鏃ュ織</h4>
                    <div class="item-list" id="loginLogsList" style="max-height:280px;"><div class="loading">鍔犺浇涓?..</div></div>
                    <button class="btn-sm" style="margin-top:8px;" onclick="clearLoginLogs()"><i class="fas fa-trash-alt"></i> 娓呯┖鏃ュ織</button>
                </div>
            </div>`;
        renderAdminAccountsList();
        renderLoginLogs();
    }
    async function renderAdminAccountsList() {
        const list = document.getElementById('adminAccountsList');
        if (!list) return;
        const accounts = await getAllAdminAccounts();
        list.innerHTML = accounts.map(a => `<div class="admin-item"><div class="item-info"><strong>${escapeHtml(a.username)}</strong> <span class="tag ${a.role==='super_admin'?'tag-super':'tag-admin'}">${a.role==='super_admin'?'瓒呯骇绠＄悊鍛?:'绠＄悊鍛?}</span><br><small>鍒涘缓: ${formatDate(a.created_at)}</small></div><div class="item-actions"><button class="btn-sm" onclick="resetAdminPwd('${a.username}')"><i class="fas fa-key"></i> 閲嶇疆瀵嗙爜</button><button class="btn-sm" onclick="showAdminPwd('${a.username}')"><i class="fas fa-eye"></i> 鏌ョ湅瀵嗙爜</button>${a.username!=='superadmin'?`<button class="btn-sm danger" onclick="deleteAdminAccount('${a.username}')"><i class="fas fa-trash-alt"></i></button>`:''}</div></div>`).join('') || '<p class="loading">鏆傛棤璐﹀彿</p>';
    }
    async function renderLoginLogs() {
        const list = document.getElementById('loginLogsList');
        if (!list) return;
        const logs = await getAllLoginLogs();
        list.innerHTML = logs.map(l => `<div class="admin-item"><div class="item-info"><strong>${escapeHtml(l.username)}</strong><br><small>${formatDate(l.login_time)}</small><br><small>IP: ${escapeHtml(l.ip_address||'鏈煡')}</small></div></div>`).join('') || '<p class="loading">鏆傛棤鐧诲綍璁板綍</p>';
    }
    window.showAddAdminModal = () => {
        showModal(`<span style="float:right;cursor:pointer;font-size:24px;" onclick="closeModal()">&times;</span>
            <h3><i class="fas fa-user-plus"></i> 鏂板绠＄悊鍛樿处鍙?/h3>
            <label>鐢ㄦ埛鍚?/label><input type="text" id="newAdminUsername" placeholder="杈撳叆鐢ㄦ埛鍚?>
            <label>瀵嗙爜</label><input type="password" id="newAdminPwd" placeholder="杈撳叆瀵嗙爜">
            <label>瑙掕壊</label><select id="newAdminRole"><option value="admin">绠＄悊鍛?/option><option value="super_admin">瓒呯骇绠＄悊鍛?/option></select>
            <div class="modal-footer"><button class="modal-btn cancel" onclick="closeModal()">鍙栨秷</button><button class="modal-btn save" onclick="addAdminAccount()">鍒涘缓璐﹀彿</button></div>`);
    };
    window.addAdminAccount = async () => {
            opLock.show();
            try {
                const u = document.getElementById('newAdminUsername')?.value.trim();
        const p = document.getElementById('newAdminPwd')?.value;
        const r = document.getElementById('newAdminRole')?.value;
        if (!u || !p) return alert('璇峰～鍐欑敤鎴峰悕鍜屽瘑鐮?);
        const data = { username: u, password: p, role: r || 'admin' };
        if (USE_SUPABASE) {
            const existing = await getAllAdminAccounts();
            if (existing.find(a => a.username === u)) return alert('鐢ㄦ埛鍚嶅凡瀛樺湪');
            await db.adminAccounts.create(data);
        } else {
            let accounts = JSON.parse(localStorage.getItem('yayehui_admin_accounts') || '[]');
            if (accounts.find(a => a.username === u)) return alert('鐢ㄦ埛鍚嶅凡瀛樺湪');
            data.id = nextId(accounts);
            accounts.push(data);
            localStorage.setItem('yayehui_admin_accounts', JSON.stringify(accounts));
        }
        closeModal();
        alert('璐﹀彿鍒涘缓鎴愬姛锛?);
        renderAdminAccountsList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteAdminAccount = async (username) => {
            opLock.show();
            try {
                if(!confirm(`纭畾鍒犻櫎绠＄悊鍛樿处鍙枫€?{username}銆嶏紵`))return; if(USE_SUPABASE)await db.adminAccounts.delete(username); else{let a=JSON.parse(localStorage.getItem('yayehui_admin_accounts')||'[]').filter(i=>i.username!==username);localStorage.setItem('yayehui_admin_accounts',JSON.stringify(a));} renderAdminAccountsList();
            } finally {
                opLock.hide();
            }
        };
    window.resetAdminPwd = async (username) => {
            opLock.show();
            try {
                const newPwd = prompt(`涓恒€?{username}銆嶈缃柊瀵嗙爜锛歚); if(!newPwd||!newPwd.trim())return; if(USE_SUPABASE)await db.adminAccounts.updatePwd(username,newPwd); else{let a=JSON.parse(localStorage.getItem('yayehui_admin_accounts')||'[]');const r=a.find(i=>i.username===username);if(r){r.password=newPwd;localStorage.setItem('yayehui_admin_accounts',JSON.stringify(a));}} alert(`銆?{username}銆嶅瘑鐮佸凡閲嶇疆涓猴細${newPwd}`);
            } finally {
                opLock.hide();
            }
        };
    window.showAdminPwd = async (username) => { const accounts = await getAllAdminAccounts(); const acc = accounts.find(a=>a.username===username); alert(`銆?{username}銆嶇殑瀵嗙爜鏄細${acc?.password||'鏈煡'}`); };
    window.clearLoginLogs = async () => {
            opLock.show();
            try {
                if(!confirm('纭畾娓呯┖鐧诲綍鏃ュ織锛?))return; if(USE_SUPABASE){const logs=await getAllLoginLogs();for(const l of logs)await db.adminLoginLogs.delete(l.id);} else localStorage.setItem('yayehui_login_logs','[]'); renderLoginLogs();
            } finally {
                opLock.hide();
            }
        };

    // 鏍囩鍒囨崲
    window.showPanel = function(panelId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const btn = document.querySelector(`.tab-btn[data-panel="${panelId}"]`);
        if (btn) btn.classList.add('active');
        const panel = document.getElementById('panel' + panelId);
        if (panel) panel.classList.add('active');
        // 淇濆瓨褰撳墠闈㈡澘鍒?sessionStorage
        sessionStorage.setItem('yayehui_current_panel', panelId);
        // 寤惰繜娓叉煋浠ョ‘淇?DOM 鏄剧ず
        setTimeout(() => {
            if (panelId === 'Announcements') renderAnnouncementsPanel();
            else if (panelId === 'Dynamics') renderDynamicsPanel();
            else if (panelId === 'Members') renderMembersPanel();
            else if (panelId === 'Polls') renderPollsPanel();
            else if (panelId === 'Expenses') renderExpensesPanel();
            else if (panelId === 'Topics') renderTopicsPanel();
            else if (panelId === 'Users') renderUsersPanel();
            else if (panelId === 'Property') renderPropertyPanel();
            else if (panelId === 'SiteSettings') renderSiteSettingsPanel();
            else if (panelId === 'SuperAdmin') renderSuperAdminPanel();
        }, 50);
    };

    // 鐧诲綍閫昏緫
    async function doLogin(username, password) {
        if (USE_SUPABASE) {
            const accounts = await db.adminAccounts.getAll() || [];
            const acc = accounts.find(a => a.username === username && a.password === password);
            if (acc) {
                currentUser = username;
                isSuperAdmin = acc.role === 'super_admin';
                // 淇濆瓨鐧诲綍浼氳瘽
                saveSession();
                // 璁板綍鐧诲綍鏃ュ織
                await db.adminLoginLogs.create({ username, login_time: new Date().toISOString(), ip_address: '' });
                showAdminPanel();
                return true;
            }
        }
        // 鍥為€€
        const localAccounts = JSON.parse(localStorage.getItem('yayehui_admin_accounts') || '[{"username":"admin","password":"yayehui2025","role":"admin"},{"username":"superadmin","password":"super2025","role":"super_admin"}]');
        const acc = localAccounts.find(a => a.username === username && a.password === password);
        if (acc) {
            currentUser = username;
            isSuperAdmin = acc.role === 'super_admin';
            // 淇濆瓨鐧诲綍浼氳瘽
            saveSession();
            let logs = JSON.parse(localStorage.getItem('yayehui_login_logs') || '[]');
            logs.unshift({ username, login_time: new Date().toISOString(), ip_address: '' });
            if (logs.length > 100) logs = logs.slice(0, 100);
            localStorage.setItem('yayehui_login_logs', JSON.stringify(logs));
            showAdminPanel();
            return true;
        }
        return false;
    }

    function showLogin() {
        document.getElementById('app').innerHTML = `<div class="login-container"><div class="login-box">
            <i class="fas fa-lock" style="font-size:48px;color:#2c6e49;"></i>
            <h2>闆呬笟浼?绠＄悊鍚庡彴</h2>
            <input type="text" id="loginUsername" placeholder="鐢ㄦ埛鍚? autocomplete="off">
            <input type="password" id="loginPassword" placeholder="瀵嗙爜">
            <button id="doLoginBtn">鐧诲綍绯荤粺</button>
            <p style="margin-top:16px;font-size:0.8rem;color:#6c7a91;">鍒濆璐﹀彿: admin / yayehui2025</p>
        </div></div>`;
        document.getElementById('doLoginBtn').onclick = async () => {
            const u = document.getElementById('loginUsername').value.trim();
            const p = document.getElementById('loginPassword').value;
            const ok = await doLogin(u, p);
            if (!ok) alert('鐢ㄦ埛鍚嶆垨瀵嗙爜閿欒');
        };
        document.getElementById('loginPassword').addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const u = document.getElementById('loginUsername').value.trim();
                const p = document.getElementById('loginPassword').value;
                const ok = await doLogin(u, p);
                if (!ok) alert('鐢ㄦ埛鍚嶆垨瀵嗙爜閿欒');
            }
        });
    }
    
    // 妫€鏌ヤ繚瀛樼殑鐧诲綍浼氳瘽
    function checkSavedSession() {
        const savedSession = localStorage.getItem('yayehui_admin_session');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (session && session.username && session.isSuperAdmin !== undefined) {
                    currentUser = session.username;
                    isSuperAdmin = session.isSuperAdmin;
                    return true;
                }
            } catch (e) {
                localStorage.removeItem('yayehui_admin_session');
            }
        }
        return false;
    }
    
    // 淇濆瓨鐧诲綍浼氳瘽
    function saveSession() {
        localStorage.setItem('yayehui_admin_session', JSON.stringify({
            username: currentUser,
            isSuperAdmin: isSuperAdmin
        }));
    }
    
    // 娓呴櫎鐧诲綍浼氳瘽
    function clearSession() {
        localStorage.removeItem('yayehui_admin_session');
    }

    function showAdminPanel() {
        const superAdminTab = isSuperAdmin ? `<button class="tab-btn" data-panel="SuperAdmin" onclick="showPanel('SuperAdmin')"><i class="fas fa-shield-alt"></i> 瓒呯骇绠＄悊</button>` : '';
        document.getElementById('app').innerHTML = `<div class="admin-container">
            <div class="admin-header">
                <h1><i class="fas fa-tree"></i> 闆呬笟浼?路 绠＄悊鍚庡彴 <small style="font-size:0.7rem;color:#6c7a91;font-weight:normal;">(${currentUser})</small></h1>
                <div class="header-buttons">
                    ${superAdminTab}
                    <button class="btn-outline" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> 閫€鍑?/button>
                </div>
            </div>
            <div class="tab-bar">
                <button class="tab-btn active" data-panel="Announcements" onclick="showPanel('Announcements')"><i class="fas fa-bullhorn"></i> 鍏憡</button>
                <button class="tab-btn" data-panel="Dynamics" onclick="showPanel('Dynamics')"><i class="fas fa-chart-line"></i> 鍔ㄦ€?/button>
                <button class="tab-btn" data-panel="Members" onclick="showPanel('Members')"><i class="fas fa-users"></i> 鎴愬憳</button>
                <button class="tab-btn" data-panel="Polls" onclick="showPanel('Polls')"><i class="fas fa-vote-yea"></i> 鎶曠エ</button>
                <button class="tab-btn" data-panel="Expenses" onclick="showPanel('Expenses')"><i class="fas fa-chart-pie"></i> 璐圭敤</button>
                <button class="tab-btn" data-panel="Topics" onclick="showPanel('Topics')"><i class="fas fa-comments"></i> 蹇冨０</button>
                <button class="tab-btn" data-panel="Users" onclick="showPanel('Users')"><i class="fas fa-user-check"></i> 娉ㄥ唽鐢ㄦ埛</button>
                <button class="tab-btn" data-panel="Property" onclick="showPanel('Property')"><i class="fas fa-map-marked-alt"></i> 鎴夸骇鍦板潃</button>
                <button class="tab-btn" data-panel="SiteSettings" onclick="showPanel('SiteSettings')"><i class="fas fa-cog"></i> 绔欑偣璁剧疆</button>
            </div>
            <div id="panelAnnouncements" class="panel active"></div>
            <div id="panelDynamics" class="panel"></div>
            <div id="panelMembers" class="panel"></div>
            <div id="panelPolls" class="panel"></div>
            <div id="panelExpenses" class="panel"></div>
            <div id="panelTopics" class="panel"></div>
            <div id="panelUsers" class="panel"></div>
            <div id="panelProperty" class="panel"></div>
            <div id="panelSiteSettings" class="panel"></div>
            <div id="panelSuperAdmin" class="panel"></div>
        </div>`;
        document.getElementById('logoutBtn').onclick = () => { 
            currentUser = null; 
            isSuperAdmin = false; 
            clearSession();
            showLogin(); 
        };
        // 鍔犺浇涓婃淇濆瓨鐨勯潰鏉匡紝濡傛灉娌℃湁鍒欓粯璁ゅ叕鍛婃爮
        const savedPanel = sessionStorage.getItem('yayehui_current_panel') || 'Announcements';
        setTimeout(() => showPanel(savedPanel), 50);
    }
    
    // 鍚姩鏃舵鏌ヤ細璇?
    if (checkSavedSession()) {
        showAdminPanel();
    } else {
        showLogin();
    }
