
// 操作锁工具（防止并发操作）
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
        // 检查是否可以执行操作
        canOperate(opType) {
            if (this.isOperating) {
                alert('上一次操作尚未完成，请稍后重试');
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
                alert('操作失败：' + e.message);
            } finally { 
                opLock.hide();
            }
        };
    }
    
    // USE_SUPABASE is declared in admin_db.js - do not redeclare here to avoid SyntaxError
    let currentUser = null;
    let isSuperAdmin = false;

    function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'); }
    function nextId(arr) { return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1; }
    function formatDate(str) { if (!str) return ''; return new Date(str).toLocaleString(); }
    
    // 文件读取辅助函数 - 支持 UTF-8/GBK 自动识别
    function readTextFileWithEncoding(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const buffer = e.target.result;
                try {
                    // 先尝试 UTF-8 解码（strict 模式，含 BOM 自动跳过）
                    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
                    resolve(text);
                } catch (utf8Err) {
                    // UTF-8 解码失败，回退到 GBK
                    try {
                        const text = new TextDecoder('gbk').decode(buffer);
                        resolve(text);
                    } catch (gbkErr) {
                        reject(new Error('文件编码无法识别，请保存为 UTF-8 格式'));
                    }
                }
            };
            reader.onerror = function() {
                reject(new Error('文件读取失败，请检查文件是否损坏'));
            };
            reader.readAsArrayBuffer(file);
        });
    }
    
    // CSV解析辅助函数 - 处理带引号的字段
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

    // 批量选择辅助函数
    function getSelectedIds(prefix) {
        const checkboxes = document.querySelectorAll(`#${prefix}List .item-checkbox:checked`);
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }
    
    function toggleSelectAll(prefix, masterCheckbox) {
        const checkboxes = document.querySelectorAll(`#${prefix}List .item-checkbox`);
        checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    }

    // ========== 数据库操作 ==========
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
        // 初始化默认账号（如果不存在）
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

    // ========== 导出功能 ==========
    function exportData(data, filename, columns) {
        if (!data || data.length === 0) { alert('没有数据可导出'); return; }
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

    // ========== 模态框工具 ==========
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

    // ========== 面板渲染 ==========
    async function renderAnnouncementsPanel() {
        const container = document.getElementById('panelAnnouncements');
        if (!container) return;
        let items = await getAllAnnouncements();
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-bullhorn"></i> 公告管理 <button class="export-btn" onclick="exportAnnouncements()"><i class="fas fa-download"></i> 导出</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 批量导入</h4>
                    <p>选择 CSV/TXT 文件或粘贴内容 → 点击导入</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('annFileInput').click()"><i class="fas fa-file-upload"></i> 选择文件</button>
                        <button class="btn-sm primary" onclick="downloadAnnouncementTemplate()"><i class="fas fa-file-csv"></i> 下载模板</button>
                    </div>
                    <input type="file" id="annFileInput" accept=".csv,.txt" style="display:none" onchange="handleAnnFileSelect(this)">
                    <div id="annFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="annImportData" placeholder="粘贴 CSV 数据（首行为标题,日期,内容）" style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importAnnouncements()"><i class="fas fa-upload"></i> 导入数据</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('ann', this)"> 全选</label>
                    <button class="btn-sm danger" onclick="deleteSelectedAnnouncements()"><i class="fas fa-trash-alt"></i> 删除所选</button>
                </div>
                <div class="item-list" id="annList"><div class="loading">加载中...</div></div>
                <div class="add-form">
                    <input type="text" id="annTitle" placeholder="标题">
                    <input type="date" id="annDate" value="${new Date().toISOString().slice(0,10)}">
                    <textarea id="annContent" rows="1" placeholder="内容" style="border-radius:16px;"></textarea>
                    <button onclick="addAnnouncement()">➕ 新增</button>
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
            </div>`).join('') || '<p class="loading">暂无公告</p>';
    }
    window.deleteAnnouncement = async (id) => {
            opLock.show();
            try {
                if (!confirm('确定删除？')) return; if (USE_SUPABASE) await db.announcements.delete(id); else { let a = JSON.parse(localStorage.getItem('yayehui_announcements')||'[]').filter(i=>i.id!==id); localStorage.setItem('yayehui_announcements',JSON.stringify(a)); } renderAnnouncementList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedAnnouncements = async () => {
        const ids = getSelectedIds('ann');
        if (ids.length === 0) return alert('请先选择要删除的项');
        if (!confirm('确定删除选中的 ' + ids.length + ' 项？')) return;
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
                const t=document.getElementById('annTitle')?.value.trim(), d=document.getElementById('annDate')?.value, c=document.getElementById('annContent')?.value.trim(); if(!t||!c) return alert('请填写标题和内容'); const data={title:t,date:d,content:c}; if(USE_SUPABASE) await db.announcements.create(data); else { let a=JSON.parse(localStorage.getItem('yayehui_announcements')||'[]'); data.id=nextId(a); a.push(data); localStorage.setItem('yayehui_announcements',JSON.stringify(a)); } ['annTitle','annContent'].forEach(id=>document.getElementById(id).value=''); renderAnnouncementList();
            } finally {
                opLock.hide();
            }
        };
    window.editAnnouncement = async (id) => {
            opLock.show();
            try {
                const items=await getAllAnnouncements(); const it=items.find(i=>i.id===id); const nt=prompt('标题',it?.title); const nc=prompt('内容',it?.content); if(nt&&nc) { if(USE_SUPABASE) await db.announcements.update(id,{title:nt,content:nc}); else { let a=JSON.parse(localStorage.getItem('yayehui_announcements')||'[]'); const r=a.find(i=>i.id===id); if(r){r.title=nt;r.content=nc;localStorage.setItem('yayehui_announcements',JSON.stringify(a));} } renderAnnouncementList(); }
            } finally {
                opLock.hide();
            }
        };
    window.exportAnnouncements = async () => { const items=await getAllAnnouncements(); exportData(items,'公告数据',[{key:'title',label:'标题'},{key:'date',label:'日期'},{key:'content',label:'内容'}]); };
    window.downloadAnnouncementTemplate = () => downloadTemplate([{key:'title',label:'标题'},{key:'date',label:'日期'},{key:'content',label:'内容'}],'公告');
    window.handleAnnFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('annFileName').textContent = '已选择: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('annImportData').value = text;
        }).catch(err => {
            alert('文件读取失败: ' + err.message);
        });
    };
    window.importAnnouncements = async () => {
            opLock.show();
            try {
                const text=document.getElementById('annImportData').value.trim(); if(!text) return alert('请粘贴数据'); const lines=text.split('\n').filter(l=>l.trim()); if(lines.length<2) return alert('数据格式错误，至少需要标题行和数据行'); for(let i=1;i<lines.length;i++){const parts=parseCSVLine(lines[i]); if(parts.length>=2){const data={title:parts[0],date:parts[1]||new Date().toISOString().slice(0,10),content:parts[2]||''}; if(USE_SUPABASE) await db.announcements.create(data); else { let a=JSON.parse(localStorage.getItem('yayehui_announcements')||'[]'); data.id=nextId(a); a.push(data); localStorage.setItem('yayehui_announcements',JSON.stringify(a)); } } } alert('导入成功！'); document.getElementById('annImportData').value=''; renderAnnouncementList();
            } finally {
                opLock.hide();
            }
        };

    async function renderDynamicsPanel() {
        const container = document.getElementById('panelDynamics');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-chart-line"></i> 工作动态管理 <button class="export-btn" onclick="exportDynamics()"><i class="fas fa-download"></i> 导出</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 批量导入</h4>
                    <p>选择 CSV/TXT 文件或粘贴内容 → 点击导入</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('dynFileInput').click()"><i class="fas fa-file-upload"></i> 选择文件</button>
                        <button class="btn-sm primary" onclick="downloadDynamicsTemplate()"><i class="fas fa-file-csv"></i> 下载模板</button>
                    </div>
                    <input type="file" id="dynFileInput" accept=".csv,.txt" style="display:none" onchange="handleDynFileSelect(this)">
                    <div id="dynFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="dynImportData" placeholder="粘贴 CSV 数据（标题,日期,摘要,详细内容）" style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importDynamics()"><i class="fas fa-upload"></i> 导入数据</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('dyn', this)"> 全选</label>
                    <button class="btn-sm danger" onclick="deleteSelectedDynamics()"><i class="fas fa-trash-alt"></i> 删除所选</button>
                </div>
                <div class="item-list" id="dynList"><div class="loading">加载中...</div></div>
                <div class="add-form">
                    <input type="text" id="dynTitle" placeholder="标题">
                    <input type="date" id="dynDate" value="${new Date().toISOString().slice(0,10)}">
                    <input type="text" id="dynSummary" placeholder="摘要">
                    <textarea id="dynContent" rows="1" placeholder="详细内容" style="border-radius:16px;"></textarea>
                    <button onclick="addDynamic()">➕ 新增</button>
                </div>
            </div>`;
        renderDynamicList();
    }
    async function renderDynamicList() {
        const list = document.getElementById('dynList');
        if (!list) return;
        const items = await getAllDynamics();
        list.innerHTML = items.map(item => `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${item.id}"></div><div class="item-info"><strong>${escapeHtml(item.title)}</strong><small> ${item.date||''}</small><div>${escapeHtml(item.summary||'')}</div></div><div class="item-actions"><button class="btn-sm" onclick="editDynamic(${item.id})"><i class="fas fa-edit"></i></button><button class="btn-sm danger" onclick="deleteDynamic(${item.id})"><i class="fas fa-trash-alt"></i></button></div></div>`).join('') || '<p class="loading">暂无动态</p>';
    }
    window.deleteDynamic = async (id) => {
            opLock.show();
            try {
                if(!confirm('确定删除？'))return; if(USE_SUPABASE) await db.dynamics.delete(id); else{let a=JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]').filter(i=>i.id!==id);localStorage.setItem('yayehui_dynamics',JSON.stringify(a));} renderDynamicList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedDynamics = async () => {
        const ids = getSelectedIds('dyn');
        if (ids.length === 0) return alert('请先选择要删除的项');
        if (!confirm('确定删除选中的 ' + ids.length + ' 项？')) return;
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
                const t=document.getElementById('dynTitle')?.value.trim(), d=document.getElementById('dynDate')?.value, s=document.getElementById('dynSummary')?.value.trim(), c=document.getElementById('dynContent')?.value.trim(); if(!t||!s) return alert('请填写标题和摘要'); const data={title:t,date:d,summary:s,content:c}; if(USE_SUPABASE) await db.dynamics.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_dynamics',JSON.stringify(a));} ['dynTitle','dynSummary','dynContent'].forEach(id=>document.getElementById(id).value='');renderDynamicList();
            } finally {
                opLock.hide();
            }
        };
    window.editDynamic = async (id) => {
            opLock.show();
            try {
                const items=await getAllDynamics();const it=items.find(i=>i.id===id);const nt=prompt('标题',it?.title);const ns=prompt('摘要',it?.summary);if(nt&&ns){if(USE_SUPABASE)await db.dynamics.update(id,{title:nt,summary:ns});else{let a=JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]');const r=a.find(i=>i.id===id);if(r){r.title=nt;r.summary=ns;localStorage.setItem('yayehui_dynamics',JSON.stringify(a));}}renderDynamicList();}
            } finally {
                opLock.hide();
            }
        };
    window.exportDynamics = async () => { const items=await getAllDynamics(); exportData(items,'工作动态',[{key:'title',label:'标题'},{key:'date',label:'日期'},{key:'summary',label:'摘要'},{key:'content',label:'内容'}]); };
    window.downloadDynamicsTemplate = () => downloadTemplate([{key:'title',label:'标题'},{key:'date',label:'日期'},{key:'summary',label:'摘要'},{key:'content',label:'内容'}],'工作动态');
    window.handleDynFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('dynFileName').textContent = '已选择: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('dynImportData').value = text;
        }).catch(err => {
            alert('文件读取失败: ' + err.message);
        });
    };
    window.importDynamics = async () => {
            opLock.show();
            try {
                const text=document.getElementById('dynImportData').value.trim(); if(!text)return;const lines=text.split('\n').filter(l=>l.trim()); for(let i=1;i<lines.length;i++){const p=parseCSVLine(lines[i]); if(p.length>=2){const data={title:p[0],date:p[1]||new Date().toISOString().slice(0,10),summary:p[2]||'',content:p[3]||''}; if(USE_SUPABASE)await db.dynamics.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_dynamics')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_dynamics',JSON.stringify(a));}} } alert('导入成功！');document.getElementById('dynImportData').value='';renderDynamicList();
            } finally {
                opLock.hide();
            }
        };

    async function renderMembersPanel() {
        const container = document.getElementById('panelMembers');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-users"></i> 业委会成员管理 <button class="export-btn" onclick="exportMembers()"><i class="fas fa-download"></i> 导出</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 批量导入</h4>
                    <p>选择 CSV/TXT 文件或粘贴内容 → 点击导入</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('memFileInput').click()"><i class="fas fa-file-upload"></i> 选择文件</button>
                        <button class="btn-sm primary" onclick="downloadMembersTemplate()"><i class="fas fa-file-csv"></i> 下载模板</button>
                    </div>
                    <input type="file" id="memFileInput" accept=".csv,.txt" style="display:none" onchange="handleMemFileSelect(this)">
                    <div id="memFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="memImportData" placeholder="粘贴 CSV（姓名,职务,职责描述）" style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importMembers()"><i class="fas fa-upload"></i> 导入数据</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('mem', this)"> 全选</label>
                    <button class="btn-sm danger" onclick="deleteSelectedMembers()"><i class="fas fa-trash-alt"></i> 删除所选</button>
                </div>
                <div class="item-list" id="memList"><div class="loading">加载中...</div></div>
                <div class="add-form">
                    <input type="text" id="memberName" placeholder="姓名">
                    <input type="text" id="memberRole" placeholder="职务">
                    <input type="text" id="memberDesc" placeholder="职责描述">
                    <button onclick="addMember()">➕ 新增成员</button>
                </div>
            </div>`;
        renderMemberList();
    }
    async function renderMemberList() {
        const list = document.getElementById('memList');
        if (!list) return;
        const items = await getAllMembers();
        list.innerHTML = items.map(item => `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${item.id}"></div><div class="item-info"><strong>${escapeHtml(item.name)}</strong><br><small>${escapeHtml(item.role||'')}</small><div>${escapeHtml(item.description||'')}</div></div><div class="item-actions"><button class="btn-sm" onclick="editMember(${item.id})"><i class="fas fa-edit"></i></button><button class="btn-sm danger" onclick="deleteMember(${item.id})"><i class="fas fa-trash-alt"></i></button></div></div>`).join('') || '<p class="loading">暂无成员</p>';
    }
    window.deleteMember = async (id) => {
            opLock.show();
            try {
                if(!confirm('确定删除？'))return; if(USE_SUPABASE)await db.members.delete(id); else{let a=JSON.parse(localStorage.getItem('yayehui_members')||'[]').filter(i=>i.id!==id);localStorage.setItem('yayehui_members',JSON.stringify(a));} renderMemberList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedMembers = async () => {
        const ids = getSelectedIds('mem');
        if (ids.length === 0) return alert('请先选择要删除的项');
        if (!confirm('确定删除选中的 ' + ids.length + ' 项？')) return;
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
                const n=document.getElementById('memberName')?.value.trim(),r=document.getElementById('memberRole')?.value.trim(),d=document.getElementById('memberDesc')?.value.trim(); if(!n||!r)return alert('请填写姓名和职务'); const data={name:n,role:r,description:d,avatar_icon:'fas fa-user-circle'}; if(USE_SUPABASE)await db.members.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_members')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_members',JSON.stringify(a));} ['memberName','memberRole','memberDesc'].forEach(id=>document.getElementById(id).value='');renderMemberList();
            } finally {
                opLock.hide();
            }
        };
    window.editMember = async (id) => {
            opLock.show();
            try {
                const items=await getAllMembers();const it=items.find(i=>i.id===id);const nn=prompt('姓名',it?.name);const nr=prompt('职务',it?.role);if(nn&&nr){if(USE_SUPABASE)await db.members.update(id,{name:nn,role:nr});else{let a=JSON.parse(localStorage.getItem('yayehui_members')||'[]');const r=a.find(i=>i.id===id);if(r){r.name=nn;r.role=nr;localStorage.setItem('yayehui_members',JSON.stringify(a));}}renderMemberList();}
            } finally {
                opLock.hide();
            }
        };
    window.exportMembers = async () => { const items=await getAllMembers(); exportData(items,'业委会成员',[{key:'name',label:'姓名'},{key:'role',label:'职务'},{key:'description',label:'职责描述'}]); };
    window.downloadMembersTemplate = () => downloadTemplate([{key:'name',label:'姓名'},{key:'role',label:'职务'},{key:'description',label:'职责描述'}],'业委会成员');
    window.handleMemFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('memFileName').textContent = '已选择: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('memImportData').value = text;
        }).catch(err => {
            alert('文件读取失败: ' + err.message);
        });
    };
    window.importMembers = async () => {
            opLock.show();
            try {
                const text=document.getElementById('memImportData').value.trim(); if(!text)return; const lines=text.split('\n').filter(l=>l.trim()); for(let i=1;i<lines.length;i++){const p=parseCSVLine(lines[i]); if(p.length>=1){const data={name:p[0],role:p[1]||'',description:p[2]||'',avatar_icon:'fas fa-user-circle'}; if(USE_SUPABASE)await db.members.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_members')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_members',JSON.stringify(a));}} } alert('导入成功！');document.getElementById('memImportData').value='';renderMemberList();
            } finally {
                opLock.hide();
            }
        };

    async function renderPollsPanel() {
        const container = document.getElementById('panelPolls');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-vote-yea"></i> 投票管理 <button class="export-btn" onclick="exportPolls()"><i class="fas fa-download"></i> 导出</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 批量导入投票选项</h4>
                    <p>选择 CSV/TXT 文件或粘贴内容 → 点击导入</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('pollFileInput').click()"><i class="fas fa-file-upload"></i> 选择文件</button>
                        <button class="btn-sm primary" onclick="downloadPollsTemplate()"><i class="fas fa-file-csv"></i> 下载模板</button>
                    </div>
                    <input type="file" id="pollFileInput" accept=".csv,.txt" style="display:none" onchange="handlePollFileSelect(this)">
                    <div id="pollFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="pollImportData" placeholder="粘贴 CSV（投票标题,描述,开始日期,结束日期,选项1,选项2,选项3...）" style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importPolls()"><i class="fas fa-upload"></i> 导入数据</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('poll', this)"> 全选</label>
                    <button class="btn-sm danger" onclick="deleteSelectedPolls()"><i class="fas fa-trash-alt"></i> 删除所选</button>
                </div>
                <div class="item-list" id="pollList"><div class="loading">加载中...</div></div>
                <div class="add-form">
                    <input type="text" id="pollTitle" placeholder="投票标题">
                    <textarea id="pollDesc" rows="1" placeholder="描述" style="border-radius:16px;"></textarea>
                    <input type="date" id="pollStart">
                    <input type="date" id="pollEnd">
                    <input type="text" id="pollOptionsStr" placeholder="选项（逗号分隔）">
                    <button onclick="addPoll()">➕ 新增投票</button>
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
            return `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${poll.id}"></div><div class="item-info"><strong>${escapeHtml(poll.title)}</strong><br><small>${poll.start_date||''} ~ ${poll.end_date||''}</small><br><span style="font-size:0.8rem;">参与: ${totalVotes}人</span><div>选项: ${pollOpts.map(o=>o.option_text).join(', ')}</div></div><div class="item-actions"><button class="btn-sm" onclick="viewPollResult(${poll.id})"><i class="fas fa-chart-bar"></i></button><button class="btn-sm danger" onclick="deletePoll(${poll.id})"><i class="fas fa-trash-alt"></i></button></div></div>`;
        }).join('') || '<p class="loading">暂无投票</p>';
    }
    window.deletePoll = async (id) => {
            opLock.show();
            try {
                if(!confirm('确定删除？'))return; if(USE_SUPABASE){await db.pollOptions.delete(id);await db.polls.delete(id);} else{let p=JSON.parse(localStorage.getItem('yayehui_polls')||'[]').filter(p=>p.id!==id);let o=JSON.parse(localStorage.getItem('yayehui_poll_options')||'[]').filter(o=>o.poll_id!==id);localStorage.setItem('yayehui_polls',JSON.stringify(p));localStorage.setItem('yayehui_poll_options',JSON.stringify(o));let v=JSON.parse(localStorage.getItem('yayehui_votes')||'[]').filter(v=>v.poll_id!==id);localStorage.setItem('yayehui_votes',JSON.stringify(v));} renderPollList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedPolls = async () => {
        const ids = getSelectedIds('poll');
        if (ids.length === 0) return alert('请先选择要删除的项');
        if (!confirm('确定删除选中的 ' + ids.length + ' 项？')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) { for (const id of ids) { await db.pollOptions.delete(id); await db.polls.delete(id); } }
            else { let p = JSON.parse(localStorage.getItem('yayehui_polls')||'[]').filter(p => !ids.includes(p.id)); let o = JSON.parse(localStorage.getItem('yayehui_poll_options')||'[]').filter(o => !ids.includes(o.poll_id)); localStorage.setItem('yayehui_polls',JSON.stringify(p)); localStorage.setItem('yayehui_poll_options',JSON.stringify(o)); let v=JSON.parse(localStorage.getItem('yayehui_votes')||'[]').filter(v=>!ids.includes(v.poll_id));localStorage.setItem('yayehui_votes',JSON.stringify(v)); }
            renderPollList();
        } finally { opLock.hide(); }
    };
    window.viewPollResult = async (pollId) => { const options=await getAllPollOptions();const votes=await getAllVotes();const pollOpts=options.filter(o=>o.poll_id===pollId);const result=pollOpts.map(o=>({text:o.option_text,count:votes.filter(v=>v.option_id===o.id).length})); alert('投票结果：\n'+result.map(r=>`${r.text}: ${r.count}票`).join('\n')); };
    window.addPoll = async () => {
            opLock.show();
            try {
                const t=document.getElementById('pollTitle')?.value.trim(),desc=document.getElementById('pollDesc')?.value.trim(),s=document.getElementById('pollStart')?.value,e=document.getElementById('pollEnd')?.value,opts=document.getElementById('pollOptionsStr')?.value.trim(); if(!t||!s||!e||!opts)return alert('请填写完整'); const pollData={title:t,description:desc,start_date:s,end_date:e,is_active:true}; if(USE_SUPABASE){await db.polls.create(pollData);const polls=await getAllPolls();const np=polls.find(p=>p.title===t);if(np){let optArr=opts.split(/[,，]+/).map(x=>x.trim()).filter(x=>x);for(const opt of optArr)await db.pollOptions.create({poll_id:np.id,option_text:opt});}} else{let p=JSON.parse(localStorage.getItem('yayehui_polls')||'[]');const nid=nextId(p);pollData.id=nid;p.push(pollData);localStorage.setItem('yayehui_polls',JSON.stringify(p));let o=JSON.parse(localStorage.getItem('yayehui_poll_options')||'[]');opts.split(/[,，]+/).map(x=>x.trim()).filter(x=>x).forEach(opt=>{o.push({id:nextId(o),poll_id:nid,option_text:opt});});localStorage.setItem('yayehui_poll_options',JSON.stringify(o));} ['pollTitle','pollDesc','pollOptionsStr'].forEach(id=>document.getElementById(id).value='');renderPollList();
            } finally {
                opLock.hide();
            }
        };
    window.exportPolls = async () => { const polls=await getAllPolls(); const options=await getAllPollOptions(); const votes=await getAllVotes(); const data=polls.map(p=>{const opts=options.filter(o=>o.poll_id===p.id);const optCounts=opts.map(o=>`${o.option_text}${votes.filter(v=>v.option_id===o.id).length}`).join('；');const totalVotes=votes.filter(v=>opts.some(o=>o.id===v.option_id)).length;return{...p,options:opts.map(o=>o.option_text).join(';'),vote_counts:totalVotes>0?`${optCounts}，共${totalVotes}票`:'暂无投票'};}); if(data.length===0){alert('暂无投票数据可导出，请先新增或导入投票');return;} exportData(data,'投票数据',[{key:'title',label:'标题'},{key:'description',label:'描述'},{key:'start_date',label:'开始日期'},{key:'end_date',label:'结束日期'},{key:'options',label:'选项'},{key:'vote_counts',label:'投票统计'}]);
        
        // 导出投票明细
        if(votes.length > 0) {
            const voteDetails = votes.map(v => {
                const poll = polls.find(p => p.id === v.poll_id);
                const opt = options.find(o => o.id === v.option_id);
                return { poll_title:poll?.title||'', option_text:opt?.option_text||'', voter_name:v.voter_name||'', property_address:v.property_address||'', vote_time:v.vote_time||'' };
            });
            exportData(voteDetails,'投票明细',[{key:'poll_title',label:'投票标题'},{key:'option_text',label:'投票选项'},{key:'voter_name',label:'投票人'},{key:'property_address',label:'房产地址'},{key:'vote_time',label:'投票时间'}]);
        }
    };
    window.downloadPollsTemplate = () => downloadTemplate([{key:'title',label:'标题'},{key:'description',label:'描述'},{key:'start_date',label:'开始日期'},{key:'end_date',label:'结束日期'},{key:'options',label:'选项（逗号分隔）'}],'投票');
    window.handlePollFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('pollFileName').textContent = '已选择: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('pollImportData').value = text;
        }).catch(err => {
            alert('文件读取失败: ' + err.message);
        });
    };
    window.importPolls = async () => {
            opLock.show();
            try {
                const text=document.getElementById('pollImportData').value.trim(); if(!text)return; const lines=text.split('\n').filter(l=>l.trim()); for(let i=1;i<lines.length;i++){const p=parseCSVLine(lines[i]); if(p.length>=4){const pollData={title:p[0],description:p[1],start_date:p[2],end_date:p[3],is_active:true};
                // 解析选项：支持两种格式
                // 格式1（模板格式）：选项在单个字段中，用逗号/中文逗号分隔
                // 格式2（多字段格式）：每个选项单独一个CSV字段
                let optionTexts = [];
                if (p.length === 5 && p[4]) {
                    // 模板格式：第5个字段包含所有选项，用逗号分隔
                    optionTexts = p[4].split(/[,，]+/).map(x => x.trim()).filter(x => x);
                } else {
                    // 多字段格式：从索引4开始每个字段是一个选项
                    for (let j = 4; j < p.length; j++) {
                        if (p[j]) optionTexts.push(p[j]);
                    }
                }
                if(USE_SUPABASE){await db.polls.create(pollData);const polls=await getAllPolls();const np=polls.find(pl=>pl.title===p[0]);if(np){for(const opt of optionTexts)await db.pollOptions.create({poll_id:np.id,option_text:opt});}} else{let pl=JSON.parse(localStorage.getItem('yayehui_polls')||'[]');const nid=nextId(pl);pollData.id=nid;pl.push(pollData);localStorage.setItem('yayehui_polls',JSON.stringify(pl));let o=JSON.parse(localStorage.getItem('yayehui_poll_options')||'[]');for(const opt of optionTexts)o.push({id:nextId(o),poll_id:nid,option_text:opt});localStorage.setItem('yayehui_poll_options',JSON.stringify(o));}} } alert('导入成功！');document.getElementById('pollImportData').value='';renderPollList();
            } finally {
                opLock.hide();
            }
        };

    async function renderExpensesPanel() {
        const container = document.getElementById('panelExpenses');
        if (!container) return;
        
        // 获取统计数据
        let allExpenses = [];
        if (USE_SUPABASE) allExpenses = await db.expenses.getAll() || [];
        else allExpenses = JSON.parse(localStorage.getItem('yayehui_expenses') || '[]');
        
        let totalIncome = 0, totalExpense = 0;
        allExpenses.forEach(e => { if (e.category === '收入') totalIncome += parseFloat(e.amount || 0); else totalExpense += parseFloat(e.amount || 0); });
        const balance = totalIncome - totalExpense;
        
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-chart-pie"></i> 费用公示管理 
                    <button class="export-btn" onclick="exportExpenses()"><i class="fas fa-download"></i> 导出</button>
                </h3>
                <div class="stats-row" style="margin-bottom:16px;">
                    <div class="stat-card" style="background:linear-gradient(135deg,#10b981,#34d399);">
                        <div class="num">¥${totalIncome.toFixed(2)}</div>
                        <div class="label">总收入</div>
                    </div>
                    <div class="stat-card" style="background:linear-gradient(135deg,#ef4444,#f87171);">
                        <div class="num">¥${totalExpense.toFixed(2)}</div>
                        <div class="label">总支出</div>
                    </div>
                    <div class="stat-card" style="background:linear-gradient(135deg,#2c6e49,#4c9f70);">
                        <div class="num">¥${balance.toFixed(2)}</div>
                        <div class="label">结余</div>
                    </div>
                </div>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 批量导入</h4>
                    <p>选择 CSV/TXT 文件或粘贴内容 → 点击导入</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('expFileInput').click()"><i class="fas fa-file-upload"></i> 选择文件</button>
                        <button class="btn-sm primary" onclick="downloadExpensesTemplate()"><i class="fas fa-file-csv"></i> 下载模板</button>
                    </div>
                    <input type="file" id="expFileInput" accept=".csv,.txt" style="display:none" onchange="handleExpFileSelect(this)">
                    <div id="expFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="expImportData" placeholder="粘贴 CSV（项目名称,类别(收入/支出),金额,日期,备注）" style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importExpenses()"><i class="fas fa-upload"></i> 导入数据</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('exp', this)"> 全选</label>
                    <button class="btn-sm danger" onclick="deleteSelectedExpenses()"><i class="fas fa-trash-alt"></i> 删除所选</button>
                </div>
                <div class="item-list" id="expList"><div class="loading">加载中...</div></div>
                <div class="add-form">
                    <input type="text" id="expItem" placeholder="项目名称">
                    <select id="expCategory" style="padding:8px 12px;border-radius:30px;border:1px solid #cfdfd3;"><option value="收入">收入</option><option value="支出">支出</option></select>
                    <input type="number" id="expAmount" placeholder="金额">
                    <input type="date" id="expDate">
                    <input type="text" id="expRemark" placeholder="备注">
                    <button onclick="addExpense()">➕ 新增</button>
                </div>
            </div>`;
        renderExpenseList();
    }
    async function renderExpenseList() {
        const list = document.getElementById('expList');
        if (!list) return;
        const items = await getAllExpenses();
        list.innerHTML = items.map(item => `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${item.id}"></div><div class="item-info"><strong>${escapeHtml(item.item_name)}</strong> | ${item.category||''} | ¥${parseFloat(item.amount||0).toFixed(2)} | ${item.date||''}<div>${escapeHtml(item.remark||'')}</div></div><div class="item-actions"><button class="btn-sm" onclick="editExpense(${item.id})"><i class="fas fa-edit"></i></button><button class="btn-sm danger" onclick="deleteExpense(${item.id})"><i class="fas fa-trash-alt"></i></button></div></div>`).join('') || '<p class="loading">暂无费用</p>';
    }
    window.deleteExpense = async (id) => {
            opLock.show();
            try {
                if(!confirm('确定删除？'))return; if(USE_SUPABASE)await db.expenses.delete(id); else{let a=JSON.parse(localStorage.getItem('yayehui_expenses')||'[]').filter(i=>i.id!==id);localStorage.setItem('yayehui_expenses',JSON.stringify(a));} renderExpenseList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedExpenses = async () => {
        const ids = getSelectedIds('exp');
        if (ids.length === 0) return alert('请先选择要删除的项');
        if (!confirm('确定删除选中的 ' + ids.length + ' 项？')) return;
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
                const item=document.getElementById('expItem')?.value.trim(),cat=document.getElementById('expCategory')?.value,amt=parseFloat(document.getElementById('expAmount')?.value),dt=document.getElementById('expDate')?.value,rm=document.getElementById('expRemark')?.value.trim(); if(!item||isNaN(amt)||!dt)return alert('请填写完整'); const data={category:cat,item_name:item,amount:amt,date:dt,remark:rm}; if(USE_SUPABASE)await db.expenses.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_expenses')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_expenses',JSON.stringify(a));} ['expItem','expAmount','expRemark'].forEach(id=>document.getElementById(id).value='');renderExpenseList();
            } finally {
                opLock.hide();
            }
        };
    window.editExpense = async (id) => {
            opLock.show();
            try {
                const items=await getAllExpenses();const it=items.find(i=>i.id===id);const nn=prompt('项目名称',it?.item_name);const na=parseFloat(prompt('金额',it?.amount));if(nn&&!isNaN(na)){if(USE_SUPABASE)await db.expenses.update(id,{item_name:nn,amount:na});else{let a=JSON.parse(localStorage.getItem('yayehui_expenses')||'[]');const r=a.find(i=>i.id===id);if(r){r.item_name=nn;r.amount=na;localStorage.setItem('yayehui_expenses',JSON.stringify(a));}}renderExpenseList();}
            } finally {
                opLock.hide();
            }
        };
    window.exportExpenses = async () => { const items=await getAllExpenses(); exportData(items,'费用公示',[{key:'category',label:'类别'},{key:'item_name',label:'项目名称'},{key:'amount',label:'金额'},{key:'date',label:'日期'},{key:'remark',label:'备注'}]); };
    window.downloadExpensesTemplate = () => downloadTemplate([{key:'category',label:'类别'},{key:'item_name',label:'项目名称'},{key:'amount',label:'金额'},{key:'date',label:'日期'},{key:'remark',label:'备注'}],'费用公示');
    window.handleExpFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('expFileName').textContent = '已选择: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('expImportData').value = text;
        }).catch(err => {
            alert('文件读取失败: ' + err.message);
        });
    };
    window.importExpenses = async () => {
            opLock.show();
            try {
                const text=document.getElementById('expImportData').value.trim(); if(!text)return; const lines=text.split('\n').filter(l=>l.trim()); for(let i=1;i<lines.length;i++){const p=parseCSVLine(lines[i]); if(p.length>=2){const data={category:p[0]||'支出',item_name:p[1],amount:parseFloat(p[2])||0,date:p[3]||new Date().toISOString().slice(0,10),remark:p[4]||''}; if(USE_SUPABASE)await db.expenses.create(data); else{let a=JSON.parse(localStorage.getItem('yayehui_expenses')||'[]');data.id=nextId(a);a.push(data);localStorage.setItem('yayehui_expenses',JSON.stringify(a));}} } alert('导入成功！');document.getElementById('expImportData').value='';renderExpenseList();
            } finally {
                opLock.hide();
            }
        };

    async function renderTopicsPanel() {
        const container = document.getElementById('panelTopics');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-comments"></i> 业主心声管理（不支持批量导入）<button class="export-btn" onclick="exportTopics()"><i class="fas fa-download"></i> 导出</button></h3>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('topics', this)"> 全选</label>
                    <button class="btn-sm danger" onclick="deleteSelectedTopics()"><i class="fas fa-trash-alt"></i> 删除所选</button>
                </div>
                <div class="item-list" id="topicsList"><div class="loading">加载中...</div></div>
                <div class="add-form">
                    <input type="text" id="newTopicTitle" placeholder="标题">
                    <textarea id="newTopicContent" rows="1" placeholder="内容" style="border-radius:16px;"></textarea>
                    <input type="text" id="newTopicAuthor" placeholder="作者昵称">
                    <button onclick="addTopicFromAdmin()">➕ 发布帖子</button>
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
            return `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${topic.id}"></div><div class="item-info"><strong>${escapeHtml(topic.title)}</strong><br><small>作者: ${escapeHtml(topic.author||'')} | 浏览 ${topic.view_count||0} | 回复 ${rc}</small><div>${escapeHtml((topic.content||'').substring(0,60))}</div></div><div class="item-actions"><button class="btn-sm" onclick="viewTopicReplies(${topic.id})"><i class="fas fa-comments"></i></button><button class="btn-sm danger" onclick="deleteTopic(${topic.id})"><i class="fas fa-trash-alt"></i></button></div></div>`;
        }).join('') || '<p class="loading">暂无帖子</p>';
    }
    window.deleteTopic = async (id) => {
            opLock.show();
            try {
                if(!confirm('确定删除？'))return; if(USE_SUPABASE)await db.topics.delete(id); else{let t=JSON.parse(localStorage.getItem('yayehui_topics')||'[]').filter(t=>t.id!==id);let r=JSON.parse(localStorage.getItem('yayehui_replies')||'[]').filter(r=>r.topic_id!==id);localStorage.setItem('yayehui_topics',JSON.stringify(t));localStorage.setItem('yayehui_replies',JSON.stringify(r));} renderTopicsList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedTopics = async () => {
        const ids = getSelectedIds('topics');
        if (ids.length === 0) return alert('请先选择要删除的项');
        if (!confirm('确定删除选中的 ' + ids.length + ' 项？')) return;
        opLock.show();
        try {
            if (USE_SUPABASE) { for (const id of ids) await db.topics.delete(id); }
            else { let t = JSON.parse(localStorage.getItem('yayehui_topics')||'[]').filter(t => !ids.includes(t.id)); let r = JSON.parse(localStorage.getItem('yayehui_replies')||'[]').filter(r => !ids.includes(r.topic_id)); localStorage.setItem('yayehui_topics',JSON.stringify(t)); localStorage.setItem('yayehui_replies',JSON.stringify(r)); }
            renderTopicsList();
        } finally { opLock.hide(); }
    };
    window.viewTopicReplies = async (id) => { const topics=await getAllTopics();const topic=topics.find(t=>t.id===id);const replies=await getAllReplies();const trs=replies.filter(r=>r.topic_id===id); const html=`<span style="float:right;cursor:pointer;font-size:24px;" onclick="closeModal()">&times;</span><h3>${escapeHtml(topic?.title||'')} 的跟帖</h3>${trs.map(r=>`<div class="reply-item"><div class="reply-meta">${escapeHtml(r.author||'')} · ${formatDate(r.created_at)}</div><div>${escapeHtml(r.content||'')}</div><button class="btn-sm danger" style="margin-top:6px;" onclick="deleteReplyAdmin(${r.id},${id})">删除</button></div>`).join('')}${trs.length===0?'<p style="color:#6c7a91;text-align:center;padding:20px;">暂无跟帖</p>':''}<div class="modal-footer"><button class="modal-btn cancel" onclick="closeModal()">关闭</button></div>`; showModal(html); };
    window.deleteReplyAdmin = async (replyId, topicId) => {
            opLock.show();
            try {
                if(!confirm('确定删除该跟帖？'))return; if(USE_SUPABASE)await db.replies.delete(replyId); else{let r=JSON.parse(localStorage.getItem('yayehui_replies')||'[]').filter(r=>r.id!==replyId);localStorage.setItem('yayehui_replies',JSON.stringify(r));} viewTopicReplies(topicId);
            } finally {
                opLock.hide();
            }
        };
    window.addTopicFromAdmin = async () => {
            opLock.show();
            try {
                const t=document.getElementById('newTopicTitle')?.value.trim(),c=document.getElementById('newTopicContent')?.value.trim(),a=document.getElementById('newTopicAuthor')?.value.trim(); if(!t||!c||!a)return alert('请填写完整'); const data={title:t,content:c,author:a,view_count:0,reply_count:0,created_at:new Date().toISOString()}; if(USE_SUPABASE)await db.topics.create(data); else{let topics=JSON.parse(localStorage.getItem('yayehui_topics')||'[]');data.id=nextId(topics);topics.push(data);localStorage.setItem('yayehui_topics',JSON.stringify(topics));} ['newTopicTitle','newTopicContent','newTopicAuthor'].forEach(id=>document.getElementById(id).value='');renderTopicsList();
            } finally {
                opLock.hide();
            }
        };
    window.exportTopics = async () => { const topics=await getAllTopics(); exportData(topics,'业主心声',[{key:'title',label:'标题'},{key:'content',label:'内容'},{key:'author',label:'作者'},{key:'view_count',label:'浏览量'},{key:'reply_count',label:'回复数'},{key:'created_at',label:'发布时间'}]); };

    // 注册用户管理
    async function renderUsersPanel() {
        const container = document.getElementById('panelUsers');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-user-check"></i> 用户注册信息 <button class="export-btn" onclick="exportUsers()"><i class="fas fa-download"></i> 导出</button></h3>
                <div class="stats-row" id="userStatsRow">
                    <div class="stat-card"><div class="num" id="statTotalUsers">-</div><div class="label">注册用户总数</div></div>
                </div>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 批量导入</h4>
                    <p>选择 CSV/TXT 文件或粘贴内容 → 点击导入</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('userFileInput').click()"><i class="fas fa-file-upload"></i> 选择文件</button>
                        <button class="btn-sm primary" onclick="downloadUsersTemplate()"><i class="fas fa-file-csv"></i> 下载模板</button>
                    </div>
                    <input type="file" id="userFileInput" accept=".csv,.txt" style="display:none" onchange="handleUserFileSelect(this)">
                    <div id="userFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <textarea id="userImportData" placeholder="粘贴 CSV（用户名称,手机号码,房产地址）" style="margin-top:8px;width:100%;height:80px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="importUsers()"><i class="fas fa-upload"></i> 导入数据</button>
                </div>
                <div class="add-form">
                    <input type="text" id="newUserName" placeholder="用户名称">
                    <input type="text" id="newUserPhone" placeholder="手机号码">
                    <input type="text" id="newUserAddress" placeholder="房产地址">
                    <button onclick="addRegisteredUser()">➕ 新增用户</button>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('users', this)"> 全选</label>
                    <button class="btn-sm danger" onclick="deleteSelectedUsers()"><i class="fas fa-trash-alt"></i> 删除所选</button>
                </div>
                <div class="item-list" id="usersList"><div class="loading">加载中...</div></div>
            </div>`;
        renderUsersList();
    }
    async function renderUsersList() {
        const list = document.getElementById('usersList');
        if (!list) return;
        const users = await getAllRegisteredUsers();
        document.getElementById('statTotalUsers').textContent = users.length;
        list.innerHTML = users.map(u => `<div class="user-reg-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${u.id}"></div><div><strong>${escapeHtml(u.user_name||'')}</strong><br><small>手机: ${escapeHtml(u.phone||'')} | 地址: ${escapeHtml(u.property_address||'')} | 注册: ${formatDate(u.created_at)}</small></div><button class="btn-sm danger" onclick="deleteUser(${u.id})"><i class="fas fa-trash-alt"></i></button></div>`).join('') || '<p class="loading">暂无注册用户</p>';
    }
    window.deleteUser = async (id) => {
            opLock.show();
            try {
                if(!confirm('确定删除该用户？'))return;
                // 获取被删除用户的地址，用于同步更新房产地址注册状态
                let deletedUserAddress = null;
                if (USE_SUPABASE) {
                    try {
                        const user = await db.registeredUsers.getById(id);
                        if (user) deletedUserAddress = user.property_address;
                    } catch(e) { console.warn('Failed to get user before delete:', e); }
                } else {
                    const users = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]');
                    const user = users.find(u => u.id === id);
                    if (user) deletedUserAddress = user.property_address;
                }
                if(USE_SUPABASE)await db.registeredUsers.delete(id); else{let u=JSON.parse(localStorage.getItem('yayehui_registered_users')||'[]').filter(u=>u.id!==id);localStorage.setItem('yayehui_registered_users',JSON.stringify(u));}
                // 同步更新房产地址：如果该地址不再有注册用户，设为未注册
                if (deletedUserAddress) {
                    if (USE_SUPABASE) {
                        try {
                            const remainingUsers = await db.registeredUsers.getAll() || [];
                            const stillRegistered = remainingUsers.some(u => u.property_address === deletedUserAddress);
                            if (!stillRegistered) {
                                await db.propertyAddresses.markUnregistered(deletedUserAddress);
                            }
                        } catch(e) { console.warn('Failed to unregister address:', e); }
                    } else {
                        const remainingUsers = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]');
                        const stillRegistered = remainingUsers.some(u => u.property_address === deletedUserAddress);
                        if (!stillRegistered) {
                            let addrs = JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]');
                            const match = addrs.find(a => a.address === deletedUserAddress);
                            if (match) {
                                match.is_registered = false;
                                localStorage.setItem('yayehui_property_addresses', JSON.stringify(addrs));
                            }
                        }
                    }
                }
                renderUsersList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedUsers = async () => {
        const ids = getSelectedIds('users');
        if (ids.length === 0) return alert('请先选择要删除的用户');
        if (!confirm('确定删除选中的 ' + ids.length + ' 个用户？')) return;
        opLock.show();
        try {
            // 收集被删除用户的地址
            let deletedAddresses = [];
            if (USE_SUPABASE) {
                for (const id of ids) {
                    try {
                        const user = await db.registeredUsers.getById(id);
                        if (user && user.property_address) deletedAddresses.push(user.property_address);
                    } catch(e) {}
                }
            } else {
                const users = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]');
                deletedAddresses = users.filter(u => ids.includes(u.id)).map(u => u.property_address).filter(a => a);
            }
            if (USE_SUPABASE) {
                for (const id of ids) await db.registeredUsers.delete(id);
            } else {
                let u = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]');
                u = u.filter(user => !ids.includes(user.id));
                localStorage.setItem('yayehui_registered_users', JSON.stringify(u));
            }
            // 同步更新房产地址注册状态
            if (deletedAddresses.length > 0) {
                if (USE_SUPABASE) {
                    const remainingUsers = await db.registeredUsers.getAll() || [];
                    for (const delAddr of deletedAddresses) {
                        const stillRegistered = remainingUsers.some(u => u.property_address === delAddr);
                        if (!stillRegistered) {
                            try { await db.propertyAddresses.markUnregistered(delAddr); } catch(e) { console.warn('markUnregistered failed:', e); }
                        }
                    }
                } else {
                    const remainingUsers = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]');
                    let addrs = JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]');
                    let updated = false;
                    for (const delAddr of deletedAddresses) {
                        const stillRegistered = remainingUsers.some(u => u.property_address === delAddr);
                        if (!stillRegistered) {
                            const match = addrs.find(a => a.address === delAddr);
                            if (match && match.is_registered) {
                                match.is_registered = false;
                                updated = true;
                            }
                        }
                    }
                    if (updated) {
                        localStorage.setItem('yayehui_property_addresses', JSON.stringify(addrs));
                    }
                }
            }
            renderUsersList();
        } finally {
            opLock.hide();
        }
    };
    window.exportUsers = async () => { const users=await getAllRegisteredUsers(); exportData(users,'注册用户',[{key:'user_name',label:'用户名称'},{key:'phone',label:'手机号码'},{key:'property_address',label:'房产地址'},{key:'created_at',label:'注册时间'}]); };
    window.downloadUsersTemplate = () => downloadTemplate([{key:'user_name',label:'用户名称'},{key:'phone',label:'手机号码'},{key:'property_address',label:'房产地址'}],'注册用户');
    window.handleUserFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('userFileName').textContent = '已选择: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('userImportData').value = text;
        }).catch(err => {
            alert('文件读取失败: ' + err.message);
        });
    };
    window.importUsers = async () => {
        opLock.show();
        try {
            const text = document.getElementById('userImportData').value.trim();
            if (!text) return alert('请粘贴数据');
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) return alert('数据格式错误，至少需要标题行和数据行');
            // 预检：检查导入数据中的地址是否在存量注册用户中已存在（排除CSV内部重复）
            const existingUsers = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]');
            const existingAddrSet = new Set(existingUsers.map(u => u.property_address).filter(Boolean));
            const seenInCSV = new Set();
            const duplicates = [];
            for (let i = 1; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i]);
                const addr = (parts[2] || '').trim();
                if (!addr) continue;
                // 跳过CSV文件内部的重复行
                if (seenInCSV.has(addr)) continue;
                seenInCSV.add(addr);
                if (existingAddrSet.has(addr)) {
                    duplicates.push(addr);
                }
            }
            if (duplicates.length > 0) {
                alert('以下地址已被其他注册用户占用，请先处理重复地址后再导入：\n' + duplicates.join('\n'));
                return;
            }
            const importedAddresses = []; // 收集导入的地址
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
            // 同步更新房产地址的注册状态
            if (importedAddresses.length > 0) {
                if (USE_SUPABASE) {
                    for (const importedAddr of importedAddresses) {
                        try { await db.propertyAddresses.markRegistered(importedAddr); } catch(e) { console.warn('markRegistered failed for', importedAddr, e); }
                    }
                } else {
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
            }
            alert('导入成功！');
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
        if (!name) return alert('请输入用户名称');
        opLock.show();
        try {
            const data = { user_name: name, phone: phone, property_address: address, created_at: new Date().toISOString() };
            if (USE_SUPABASE) {
                await db.registeredUsers.create(data);
                // 同步更新房产地址的注册状态
                if (address) {
                    try { await db.propertyAddresses.markRegistered(address); } catch(e) { console.warn('markRegistered failed:', e); }
                }
            } else {
                let a = JSON.parse(localStorage.getItem('yayehui_registered_users') || '[]'); data.id = nextId(a); a.push(data); localStorage.setItem('yayehui_registered_users', JSON.stringify(a));
                // 同步更新房产地址的注册状态
                if (address) {
                    let addrs = JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]');
                    const match = addrs.find(a => a.address === address);
                    if (match && !match.is_registered) {
                        match.is_registered = true;
                        localStorage.setItem('yayehui_property_addresses', JSON.stringify(addrs));
                    }
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

    // 房产地址导入
    async function renderPropertyPanel() {
        const container = document.getElementById('panelProperty');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-map-marked-alt"></i> 房产地址管理 <button class="export-btn" onclick="exportPropertyAddresses()"><i class="fas fa-download"></i> 导出</button></h3>
                <div class="import-section">
                    <h4><i class="fas fa-file-import"></i> 批量导入</h4>
                    <p>选择 CSV/TXT 文件或粘贴内容 → 点击导入</p>
                    <div class="template-btns">
                        <button class="btn-sm primary" onclick="document.getElementById('addrFileInput').click()"><i class="fas fa-file-upload"></i> 选择文件</button>
                        <button class="btn-sm primary" onclick="downloadAddrTemplate()"><i class="fas fa-file-csv"></i> 下载模板</button>
                    </div>
                    <input type="file" id="addrFileInput" accept=".csv,.txt" style="display:none" onchange="handleAddrFileSelect(this)">
                    <div id="addrFileName" style="font-size:0.8rem;color:#2c6e49;margin:6px 0;"></div>
                    <p style="color:#6c7a91;font-size:0.85rem;margin-bottom:10px;">CSV 格式：房产地址<br>或每行一个地址，格式示例：<br>1座1楼101<br>2座2楼201<br>7座7楼701</p>
                    <textarea id="addrImportText" placeholder="粘贴 CSV 数据或每行一个地址" style="width:100%;height:160px;border-radius:16px;border:1px solid #cfdfd3;padding:10px;font-family:inherit;resize:vertical;"></textarea>
                    <div style="margin-top:12px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        <button class="btn-sm success" onclick="importPropertyAddresses()"><i class="fas fa-upload"></i> 导入地址</button>
                    </div>
                </div>
                <div class="batch-actions" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" onchange="toggleSelectAll('addr', this)"> 全选</label>
                    <button class="btn-sm danger" onclick="deleteSelectedAddresses()"><i class="fas fa-trash-alt"></i> 删除所选</button>
                </div>
                <div class="item-list" id="addrList" style="margin-top:16px;"><div class="loading">加载中...</div></div>
            </div>`;
        renderAddrList();
    }
    // Auto-sync property_addresses.is_registered with registered_users
    async function syncPropertyAddressStatus() {
        if (!USE_SUPABASE) return;
        try {
            const users = await db.registeredUsers.getAll() || [];
            const addrs = await db.propertyAddresses.getAll() || [];
            const registeredAddrSet = new Set(users.map(u => u.property_address).filter(Boolean));
            for (const addr of addrs) {
                const shouldBeRegistered = registeredAddrSet.has(addr.address);
                if (!!addr.is_registered !== shouldBeRegistered) {
                    await db.propertyAddresses.update(addr.id, { is_registered: shouldBeRegistered });
                }
            }
        } catch(e) { console.warn('Sync property status failed:', e); }
    }

    async function renderAddrList() {
        const list = document.getElementById('addrList');
        if (!list) return;
        await syncPropertyAddressStatus();
        const addrs = await getAllPropertyAddresses();
        list.innerHTML = addrs.map(a => `<div class="admin-item"><div class="item-checkbox-wrap"><input type="checkbox" class="item-checkbox" value="${a.id}"></div><div class="item-info"><strong>${escapeHtml(a.address||'')}</strong><br><small>栋: ${escapeHtml(a.building||'')} | 楼层: ${escapeHtml(a.floor||'')} | 房号: ${escapeHtml(a.unit||'')}</small><br><small>导入: ${formatDate(a.imported_at)} | ${a.is_registered?'<span style="color:#c2410c;">已注册</span>':'<span style="color:#2c6e49;">未注册</span>'}</small></div><div class="item-actions"><button class="btn-sm danger" onclick="deleteAddr(${a.id})"><i class="fas fa-trash-alt"></i></button></div></div>`).join('') || '<p class="loading">暂无地址</p>';
    }
    window.importPropertyAddresses = async () => {
        opLock.show();
        try {
            const text = document.getElementById('addrImportText').value.trim();
            if (!text) return alert('请输入地址');
            const lines = text.split('\n').filter(l => l.trim());
            // 跳过表头行（如果第一行看起来像表头）
            let startIdx = 0;
            if (lines.length > 1) {
                const firstLine = lines[0].toLowerCase().replace(/[""\s]/g, '');
                if (firstLine.includes('地址') || firstLine.includes('房产') || firstLine.includes('address') || firstLine.includes('栋') || firstLine.includes('楼')) {
                    startIdx = 1;
                }
            }
            // 预检：收集导入地址并检查是否与存量重复（排除CSV内部重复）
            const existingAddrs = JSON.parse(localStorage.getItem('yayehui_property_addresses') || '[]');
            const existingAddrSet = new Set(existingAddrs.map(a => a.address));
            const seenInCSV = new Set();
            const importAddrs = [];
            const duplicates = [];
            for (let i = startIdx; i < lines.length; i++) {
                const addr = lines[i];
                let clean = addr.trim();
                if (!clean) continue;
                const csvParts = parseCSVLine(clean);
                if (clean.includes(',')) {
                    clean = csvParts[0];
                } else {
                    clean = csvParts[0];
                }
                if (!clean) continue;
                if (/^[\u4e00-\u9fa5]+$/.test(clean) && !/\d/.test(clean) && clean.length <= 10) continue;
                // 跳过CSV文件内部的重复行
                if (seenInCSV.has(clean)) continue;
                seenInCSV.add(clean);
                if (existingAddrSet.has(clean)) {
                    duplicates.push(clean);
                }
                importAddrs.push(clean);
            }
            if (duplicates.length > 0) {
                alert('以下地址与存量地址重复，请先处理重复地址后再导入：\n' + duplicates.join('\n'));
                return;
            }
            let importedCount = 0;
            for (const clean of importAddrs) {
                const parts = clean.match(/(\d+)座(\d+)楼(\d+)/);
                const data = {
                    address: clean,
                    imported_at: new Date().toISOString(),
                    is_registered: false
                };
                if (parts) {
                    data.building = parts[1] + '座';
                    data.floor = parts[2] + '楼';
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
            alert(`成功导入 ${importedCount} 个地址！`);
            document.getElementById('addrImportText').value = '';
            renderAddrList();
        } finally {
            opLock.hide();
        }
    };
    window.deleteAddr = async (id) => {
            opLock.show();
            try {
                if(!confirm('确定删除？'))return; if(USE_SUPABASE)await db.propertyAddresses.delete(id); else{let a=JSON.parse(localStorage.getItem('yayehui_property_addresses')||'[]').filter(i=>i.id!==id);localStorage.setItem('yayehui_property_addresses',JSON.stringify(a));} renderAddrList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteSelectedAddresses = async () => {
        const ids = getSelectedIds('addr');
        if (ids.length === 0) return alert('请先选择要删除的项');
        if (!confirm('确定删除选中的 ' + ids.length + ' 项？')) return;
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
    window.exportPropertyAddresses = async () => { const addrs=await getAllPropertyAddresses(); exportData(addrs,'房产地址',[{key:'address',label:'房产地址'},{key:'building',label:'栋'},{key:'floor',label:'楼层'},{key:'unit',label:'房号'},{key:'is_registered',label:'是否已注册'}]); };
    window.downloadAddrTemplate = () => downloadTemplate([{key:'address',label:'房产地址'}],'房产地址');
    window.handleAddrFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('addrFileName').textContent = '已选择: ' + file.name;
        readTextFileWithEncoding(file).then(text => {
            document.getElementById('addrImportText').value = text;
        }).catch(err => {
            alert('文件读取失败: ' + err.message);
        });
    };

    // 站点设置
    async function renderSiteSettingsPanel() {
        const container = document.getElementById('panelSiteSettings');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-cog"></i> 站点内容设置</h3>
                <div id="siteSettingsList" style="margin-bottom:20px;"><div class="loading">加载中...</div></div>
            </div>`;
        renderSiteSettingsList();
    }
    async function renderSiteSettingsList() {
        const list = document.getElementById('siteSettingsList');
        if (!list) return;
        let settings = [];
        // 从 localStorage 读取站点设置
        if (USE_SUPABASE) { settings = await db.siteSettings.getAll() || []; } else { settings = JSON.parse(localStorage.getItem('yayehui_site_settings')||'[]'); }
        
        // 如果没有设置，加载默认值
        if (settings.length === 0) {
            settings = [
                { setting_key: 'nav_menu_left_text', setting_value: '雅业会' },
                { setting_key: 'nav_menu_left_subtext', setting_value: '雅居·共治·美好' },
                { setting_key: 'footer_banner_text', setting_value: '公开·信任·共建美好社区' },
                { setting_key: 'footer_address', setting_value: '雅居花园 · 业委会办公室' },
                { setting_key: 'footer_copyright', setting_value: '© 2025 雅业会业主委员会平台 | 携手共创宜居家园' },
                { setting_key: 'hero_title', setting_value: '共建·共治·共享' },
                { setting_key: 'hero_subtitle', setting_value: '雅业会与您携手' },
                { setting_key: 'hero_desc', setting_value: '业委会透明服务，智慧小区管理，让家园更温暖。业主沟通零距离，共创宜居环境。' },
                { setting_key: 'hero_stat_1', setting_value: '12+' },
                { setting_key: 'hero_stat_1_label', setting_value: '年度议题' },
                { setting_key: 'hero_stat_2', setting_value: '98%' },
                { setting_key: 'hero_stat_2_label', setting_value: '业主满意度' },
                { setting_key: 'hero_stat_3', setting_value: '24h' },
                { setting_key: 'hero_stat_3_label', setting_value: '快速响应' },
                { setting_key: 'contact_content', setting_value: '联系电话：xxx\nEmail：xxx' }
            ];
        }
        
        const keyMap = {
            nav_menu_left_text: '导航菜单左侧主标题（显示在"雅业会"左侧）',
            nav_menu_left_subtext: '导航菜单左侧副标题（显示在"雅居·共治·美好"位置）',
            footer_banner_left_text: '底部横幅左侧文字（显示在"雅业会"位置）',
            footer_banner_text: '底部横幅中间文字',
            footer_address: '底部地址',
            footer_copyright: '底部版权信息',
            hero_title: '首页横幅主标题',
            hero_subtitle: '首页横幅副标题',
            hero_desc: '首页横幅描述',
            hero_stat_1: '统计项1数字',
            hero_stat_1_label: '统计项1标签',
            hero_stat_2: '统计项2数字',
            hero_stat_2_label: '统计项2标签',
            hero_stat_3: '统计项3数字',
            hero_stat_3_label: '统计项3标签',
            contact_content: '联系我们弹窗内容（支持换行）'
        };
        let html = '';
        const keys = Object.keys(keyMap);
        keys.forEach(key => {
            const existing = settings.find(s => s.setting_key === key);
            const val = existing?.setting_value || '';
            html += `<div class="settings-item">
                <label>${keyMap[key]}</label>
                <input type="text" id="setting_${key}" value="${escapeHtml(val)}" placeholder="请输入">
                <button class="btn-sm primary" onclick="saveSetting('${key}')"><i class="fas fa-save"></i> 保存</button>
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
        alert('保存成功！');
            } finally {
                opLock.hide();
            }
        };

    // 超级管理员面板
    async function renderSuperAdminPanel() {
        const container = document.getElementById('panelSuperAdmin');
        if (!container) return;
        container.innerHTML = `
            <div class="card-panel">
                <h3><i class="fas fa-shield-alt"></i> 超级管理员 <span class="tag tag-super">Super Admin</span></h3>
                <div class="import-section">
                    <h4><i class="fas fa-user-cog"></i> 管理员账号管理</h4>
                    <div class="item-list" id="adminAccountsList"><div class="loading">加载中...</div></div>
                    <button class="btn-sm success" style="margin-top:8px;" onclick="showAddAdminModal()"><i class="fas fa-user-plus"></i> 新增管理员账号</button>
                </div>
                <div class="import-section" style="margin-top:16px;">
                    <h4><i class="fas fa-history"></i> 登录日志</h4>
                    <div class="item-list" id="loginLogsList" style="max-height:280px;"><div class="loading">加载中...</div></div>
                    <button class="btn-sm" style="margin-top:8px;" onclick="clearLoginLogs()"><i class="fas fa-trash-alt"></i> 清空日志</button>
                </div>
            </div>`;
        renderAdminAccountsList();
        renderLoginLogs();
    }
    async function renderAdminAccountsList() {
        const list = document.getElementById('adminAccountsList');
        if (!list) return;
        const accounts = await getAllAdminAccounts();
        list.innerHTML = accounts.map(a => `<div class="admin-item"><div class="item-info"><strong>${escapeHtml(a.username)}</strong> <span class="tag ${a.role==='super_admin'?'tag-super':'tag-admin'}">${a.role==='super_admin'?'超级管理员':'管理员'}</span><br><small>创建: ${formatDate(a.created_at)}</small></div><div class="item-actions"><button class="btn-sm" onclick="resetAdminPwd('${a.username}')"><i class="fas fa-key"></i> 重置密码</button><button class="btn-sm" onclick="showAdminPwd('${a.username}')"><i class="fas fa-eye"></i> 查看密码</button>${a.username!=='superadmin'?`<button class="btn-sm danger" onclick="deleteAdminAccount('${a.username}')"><i class="fas fa-trash-alt"></i></button>`:''}</div></div>`).join('') || '<p class="loading">暂无账号</p>';
    }
    async function renderLoginLogs() {
        const list = document.getElementById('loginLogsList');
        if (!list) return;
        const logs = await getAllLoginLogs();
        list.innerHTML = logs.map(l => `<div class="admin-item"><div class="item-info"><strong>${escapeHtml(l.username)}</strong><br><small>${formatDate(l.login_time)}</small><br><small>IP: ${escapeHtml(l.ip_address||'未知')}</small></div></div>`).join('') || '<p class="loading">暂无登录记录</p>';
    }
    window.showAddAdminModal = () => {
        showModal(`<span style="float:right;cursor:pointer;font-size:24px;" onclick="closeModal()">&times;</span>
            <h3><i class="fas fa-user-plus"></i> 新增管理员账号</h3>
            <label>用户名</label><input type="text" id="newAdminUsername" placeholder="输入用户名">
            <label>密码</label><input type="password" id="newAdminPwd" placeholder="输入密码">
            <label>角色</label><select id="newAdminRole"><option value="admin">管理员</option><option value="super_admin">超级管理员</option></select>
            <div class="modal-footer"><button class="modal-btn cancel" onclick="closeModal()">取消</button><button class="modal-btn save" onclick="addAdminAccount()">创建账号</button></div>`);
    };
    window.addAdminAccount = async () => {
            opLock.show();
            try {
                const u = document.getElementById('newAdminUsername')?.value.trim();
        const p = document.getElementById('newAdminPwd')?.value;
        const r = document.getElementById('newAdminRole')?.value;
        if (!u || !p) return alert('请填写用户名和密码');
        const data = { username: u, password: p, role: r || 'admin' };
        if (USE_SUPABASE) {
            const existing = await getAllAdminAccounts();
            if (existing.find(a => a.username === u)) return alert('用户名已存在');
            await db.adminAccounts.create(data);
        } else {
            let accounts = JSON.parse(localStorage.getItem('yayehui_admin_accounts') || '[]');
            if (accounts.find(a => a.username === u)) return alert('用户名已存在');
            data.id = nextId(accounts);
            accounts.push(data);
            localStorage.setItem('yayehui_admin_accounts', JSON.stringify(accounts));
        }
        closeModal();
        alert('账号创建成功！');
        renderAdminAccountsList();
            } finally {
                opLock.hide();
            }
        };
    window.deleteAdminAccount = async (username) => {
            opLock.show();
            try {
                if(!confirm(`确定删除管理员账号「${username}」？`))return; if(USE_SUPABASE)await db.adminAccounts.delete(username); else{let a=JSON.parse(localStorage.getItem('yayehui_admin_accounts')||'[]').filter(i=>i.username!==username);localStorage.setItem('yayehui_admin_accounts',JSON.stringify(a));} renderAdminAccountsList();
            } finally {
                opLock.hide();
            }
        };
    window.resetAdminPwd = async (username) => {
            opLock.show();
            try {
                const newPwd = prompt(`为「${username}」设置新密码：`); if(!newPwd||!newPwd.trim())return; if(USE_SUPABASE)await db.adminAccounts.updatePwd(username,newPwd); else{let a=JSON.parse(localStorage.getItem('yayehui_admin_accounts')||'[]');const r=a.find(i=>i.username===username);if(r){r.password=newPwd;localStorage.setItem('yayehui_admin_accounts',JSON.stringify(a));}} alert(`「${username}」密码已重置为：${newPwd}`);
            } finally {
                opLock.hide();
            }
        };
    window.showAdminPwd = async (username) => { const accounts = await getAllAdminAccounts(); const acc = accounts.find(a=>a.username===username); alert(`「${username}」的密码是：${acc?.password||'未知'}`); };
    window.clearLoginLogs = async () => {
            opLock.show();
            try {
                if(!confirm('确定清空登录日志？'))return; if(USE_SUPABASE){const logs=await getAllLoginLogs();for(const l of logs)await db.adminLoginLogs.delete(l.id);} else localStorage.setItem('yayehui_login_logs','[]'); renderLoginLogs();
            } finally {
                opLock.hide();
            }
        };

    // 标签切换
    window.showPanel = function(panelId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const btn = document.querySelector(`.tab-btn[data-panel="${panelId}"]`);
        if (btn) btn.classList.add('active');
        const panel = document.getElementById('panel' + panelId);
        if (panel) panel.classList.add('active');
        // 保存当前面板到 sessionStorage
        sessionStorage.setItem('yayehui_current_panel', panelId);
        // 延迟渲染以确保 DOM 显示
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

    // 登录逻辑
    async function doLogin(username, password) {
        if (USE_SUPABASE) {
            const accounts = await db.adminAccounts.getAll() || [];
            const acc = accounts.find(a => a.username === username && a.password === password);
            if (acc) {
                currentUser = username;
                isSuperAdmin = acc.role === 'super_admin';
                // 保存登录会话
                saveSession();
                // 记录登录日志
                await db.adminLoginLogs.create({ username, login_time: new Date().toISOString(), ip_address: '' });
                showAdminPanel();
                return true;
            }
        }
        // 回退
        const localAccounts = JSON.parse(localStorage.getItem('yayehui_admin_accounts') || '[{"username":"admin","password":"yayehui2025","role":"admin"},{"username":"superadmin","password":"super2025","role":"super_admin"}]');
        const acc = localAccounts.find(a => a.username === username && a.password === password);
        if (acc) {
            currentUser = username;
            isSuperAdmin = acc.role === 'super_admin';
            // 保存登录会话
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
            <h2>雅业会 管理后台</h2>
            <input type="text" id="loginUsername" placeholder="用户名" autocomplete="off">
            <input type="password" id="loginPassword" placeholder="密码">
            <button id="doLoginBtn">登录系统</button>
            <p style="margin-top:16px;font-size:0.8rem;color:#6c7a91;">初始账号: admin / yayehui2025</p>
        </div></div>`;
        document.getElementById('doLoginBtn').onclick = async () => {
            const u = document.getElementById('loginUsername').value.trim();
            const p = document.getElementById('loginPassword').value;
            const ok = await doLogin(u, p);
            if (!ok) alert('用户名或密码错误');
        };
        document.getElementById('loginPassword').addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const u = document.getElementById('loginUsername').value.trim();
                const p = document.getElementById('loginPassword').value;
                const ok = await doLogin(u, p);
                if (!ok) alert('用户名或密码错误');
            }
        });
    }
    
    // 检查保存的登录会话
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
    
    // 保存登录会话
    function saveSession() {
        localStorage.setItem('yayehui_admin_session', JSON.stringify({
            username: currentUser,
            isSuperAdmin: isSuperAdmin
        }));
    }
    
    // 清除登录会话
    function clearSession() {
        localStorage.removeItem('yayehui_admin_session');
    }

    function showAdminPanel() {
        const superAdminTab = isSuperAdmin ? `<button class="tab-btn" data-panel="SuperAdmin" onclick="showPanel('SuperAdmin')"><i class="fas fa-shield-alt"></i> 超级管理</button>` : '';
        document.getElementById('app').innerHTML = `<div class="admin-container">
            <div class="admin-header">
                <h1><i class="fas fa-tree"></i> 雅业会 · 管理后台 <small style="font-size:0.7rem;color:#6c7a91;font-weight:normal;">(${currentUser})</small></h1>
                <div class="header-buttons">
                    ${superAdminTab}
                    <button class="btn-outline" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> 退出</button>
                </div>
            </div>
            <div class="tab-bar">
                <button class="tab-btn active" data-panel="Announcements" onclick="showPanel('Announcements')"><i class="fas fa-bullhorn"></i> 公告</button>
                <button class="tab-btn" data-panel="Dynamics" onclick="showPanel('Dynamics')"><i class="fas fa-chart-line"></i> 动态</button>
                <button class="tab-btn" data-panel="Members" onclick="showPanel('Members')"><i class="fas fa-users"></i> 成员</button>
                <button class="tab-btn" data-panel="Polls" onclick="showPanel('Polls')"><i class="fas fa-vote-yea"></i> 投票</button>
                <button class="tab-btn" data-panel="Expenses" onclick="showPanel('Expenses')"><i class="fas fa-chart-pie"></i> 费用</button>
                <button class="tab-btn" data-panel="Topics" onclick="showPanel('Topics')"><i class="fas fa-comments"></i> 心声</button>
                <button class="tab-btn" data-panel="Users" onclick="showPanel('Users')"><i class="fas fa-user-check"></i> 注册用户</button>
                <button class="tab-btn" data-panel="Property" onclick="showPanel('Property')"><i class="fas fa-map-marked-alt"></i> 房产地址</button>
                <button class="tab-btn" data-panel="SiteSettings" onclick="showPanel('SiteSettings')"><i class="fas fa-cog"></i> 站点设置</button>
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
            sessionStorage.removeItem('yayehui_current_panel');
            showLogin(); 
        };
        // 加载上次保存的面板，如果没有则默认公告栏
        const savedPanel = sessionStorage.getItem('yayehui_current_panel') || 'Announcements';
        setTimeout(() => showPanel(savedPanel), 50);
    }
    
    // 启动时检查会话
    if (checkSavedSession()) {
        showAdminPanel();
    } else {
        showLogin();
    }
