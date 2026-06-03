// 雅业会 Supabase 配置 V2
// 横幅/页脚后台可改、用户注册、超级管理员

const SUPABASE_CONFIG = {
    url: 'https://wrodvjsbdrxunaiwoaml.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb2R2anNiZHJ4dW5haXdvYW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTg1OTYsImV4cCI6MjA5NTA5NDU5Nn0.fQF-gyK53zsaqyojHxXrCBR5lZ6Ioib4rNvgPZ4J4Ww'
};

const STORAGE_KEYS = {
    announcements: 'yayehui_announcements',
    dynamics: 'yayehui_dynamics',
    members: 'yayehui_members',
    polls: 'yayehui_polls',
    pollOptions: 'yayehui_poll_options',
    votes: 'yayehui_votes',
    expenses: 'yayehui_expenses',
    topics: 'yayehui_topics',
    replies: 'yayehui_replies',
    password: 'yayehui_admin_password',
    registered_users: 'yayehui_registered_users',
    property_addresses: 'yayehui_property_addresses',
    admin_accounts: 'yayehui_admin_accounts',
    admin_login_logs: 'yayehui_login_logs',
    site_settings: 'yayehui_site_settings'
};

const API_URL = SUPABASE_CONFIG.url + '/rest/v1';
const API_HEADERS = {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': 'Bearer ' + SUPABASE_CONFIG.anonKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function supabaseFetch(table, options = {}) {
    const { method = 'GET', body = null, params = {} } = options;
    const url = new URL(API_URL + '/' + table);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    const headers = { ...API_HEADERS };
    if (body) headers['Prefer'] = 'return=representation';
    const fetchOptions = { method, headers };
    if (body) fetchOptions.body = JSON.stringify(body);
    const response = await fetch(url.toString(), fetchOptions);
    if (!response.ok) {
        const error = await response.text();
        console.error('Supabase Error [' + table + ']:', error);
        return null;
    }
    if (method === 'DELETE' || method === 'PATCH') return true;
    const data = await response.json();
    return data;
}

const db = {
    announcements: {
        getAll: () => supabaseFetch('announcements', { params: { order: 'date.desc' } }),
        create: (item) => supabaseFetch('announcements', { method: 'POST', body: item }),
        update: (id, item) => supabaseFetch('announcements?id=eq.' + id, { method: 'PATCH', body: item }),
        delete: (id) => supabaseFetch('announcements?id=eq.' + id, { method: 'DELETE' })
    },
    dynamics: {
        getAll: () => supabaseFetch('dynamics', { params: { order: 'date.desc' } }),
        create: (item) => supabaseFetch('dynamics', { method: 'POST', body: item }),
        update: (id, item) => supabaseFetch('dynamics?id=eq.' + id, { method: 'PATCH', body: item }),
        delete: (id) => supabaseFetch('dynamics?id=eq.' + id, { method: 'DELETE' })
    },
    members: {
        getAll: () => supabaseFetch('members'),
        create: (item) => supabaseFetch('members', { method: 'POST', body: item }),
        update: (id, item) => supabaseFetch('members?id=eq.' + id, { method: 'PATCH', body: item }),
        delete: (id) => supabaseFetch('members?id=eq.' + id, { method: 'DELETE' })
    },
    polls: {
        getAll: () => supabaseFetch('polls', { params: { order: 'created_at.desc' } }),
        getActive: () => supabaseFetch('polls', { params: { is_active: 'eq.true', order: 'created_at.desc' } }),
        create: (item) => supabaseFetch('polls', { method: 'POST', body: item }),
        update: (id, item) => supabaseFetch('polls?id=eq.' + id, { method: 'PATCH', body: item }),
        delete: (id) => supabaseFetch('polls?id=eq.' + id, { method: 'DELETE' })
    },
    pollOptions: {
        getByPollId: (pollId) => supabaseFetch('poll_options', { params: { poll_id: 'eq.' + pollId } }),
        create: (item) => supabaseFetch('poll_options', { method: 'POST', body: item }),
        delete: (pollId) => supabaseFetch('poll_options?poll_id=eq.' + pollId, { method: 'DELETE' })
    },
    votes: {
        getByPollId: (pollId) => supabaseFetch('votes', { params: { poll_id: 'eq.' + pollId } }),
        create: (item) => supabaseFetch('votes', { method: 'POST', body: item }),
        checkVoted: (pollId, voterName) => supabaseFetch('votes', { params: { poll_id: 'eq.' + pollId, voter_name: 'eq.' + voterName } })
    },
    expenses: {
        getAll: () => supabaseFetch('expenses', { params: { order: 'date.desc' } }),
        create: (item) => supabaseFetch('expenses', { method: 'POST', body: item }),
        update: (id, item) => supabaseFetch('expenses?id=eq.' + id, { method: 'PATCH', body: item }),
        delete: (id) => supabaseFetch('expenses?id=eq.' + id, { method: 'DELETE' })
    },
    topics: {
        getAll: () => supabaseFetch('topics', { params: { order: 'created_at.desc' } }),
        getById: (id) => supabaseFetch('topics?id=eq.' + id),
        create: (item) => supabaseFetch('topics', { method: 'POST', body: item }),
        update: (id, item) => supabaseFetch('topics?id=eq.' + id, { method: 'PATCH', body: item }),
        delete: (id) => supabaseFetch('topics?id=eq.' + id, { method: 'DELETE' })
    },
    replies: {
        getByTopicId: (topicId) => supabaseFetch('replies', { params: { topic_id: 'eq.' + topicId, order: 'created_at.asc' } }),
        create: (item) => supabaseFetch('replies', { method: 'POST', body: item }),
        delete: (id) => supabaseFetch('replies?id=eq.' + id, { method: 'DELETE' })
    },
    siteSettings: {
        getAll: () => supabaseFetch('site_settings', { params: { order: 'id.asc' } }),
        getByKey: (key) => supabaseFetch('site_settings', { params: { setting_key: 'eq.' + key } }),
        create: (item) => supabaseFetch('site_settings', { method: 'POST', body: item }),
        update: (id, item) => supabaseFetch('site_settings?id=eq.' + id, { method: 'PATCH', body: item }),
        upsert: async (key, value) => {
            const existing = await supabaseFetch('site_settings', { params: { setting_key: 'eq.' + key } });
            if (existing && existing.length > 0) {
                return supabaseFetch('site_settings?id=eq.' + existing[0].id, { method: 'PATCH', body: { setting_value: value } });
            } else {
                return supabaseFetch('site_settings', { method: 'POST', body: { setting_key: key, setting_value: value } });
            }
        }
    },
    registeredUsers: {
        getAll: () => supabaseFetch('registered_users', { params: { order: 'created_at.desc' } }),
        getById: (id) => supabaseFetch('registered_users?id=eq.' + id),
        create: (item) => supabaseFetch('registered_users', { method: 'POST', body: item }),
        update: (id, item) => supabaseFetch('registered_users?id=eq.' + id, { method: 'PATCH', body: item }),
        delete: (id) => supabaseFetch('registered_users?id=eq.' + id, { method: 'DELETE' })
    },
    propertyAddresses: {
        getAll: () => supabaseFetch('property_addresses', { params: { order: 'id.asc' } }),
        create: (item) => supabaseFetch('property_addresses', { method: 'POST', body: item }),
        delete: (id) => supabaseFetch('property_addresses?id=eq.' + id, { method: 'DELETE' }),
        markRegistered: (address) => supabaseFetch('property_addresses', { params: { address: 'eq.' + address }, method: 'PATCH', body: { is_registered: true } })
    },
    adminAccounts: {
        getAll: () => supabaseFetch('admin_accounts', { params: { order: 'id.asc' } }),
        create: (item) => supabaseFetch('admin_accounts', { method: 'POST', body: item }),
        delete: (username) => supabaseFetch('admin_accounts?username=eq.' + username, { method: 'DELETE' }),
        updatePwd: (username, newPwd) => supabaseFetch('admin_accounts?username=eq.' + username, { method: 'PATCH', body: { password: newPwd } })
    },
    adminLoginLogs: {
        getAll: () => supabaseFetch('admin_login_logs', { params: { order: 'login_time.desc' } }),
        create: (item) => supabaseFetch('admin_login_logs', { method: 'POST', body: item }),
        delete: (id) => supabaseFetch('admin_login_logs?id=eq.' + id, { method: 'DELETE' })
    }
};

async function checkDatabase() {
    try {
        const result = await fetch(API_URL + '/announcements', { method: 'HEAD', headers: API_HEADERS });
        return result.ok;
    } catch { return false; }
}

window.db = db;
