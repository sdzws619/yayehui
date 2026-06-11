// Supabase 鍒濆鍖?鈥?闆呬笟浼氬钩鍙?// 姝ゆ枃浠剁敱 admin.html 鍜?yayehui.html 鍏变韩

const SUPABASE_URL = 'https://wrodvjsbdrxunaiwoaml.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb2R2anNiZHJ4dW5haXdvYW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTg1OTYsImV4cCI6MjA5NTA5NDU5Nn0.fQF-gyK53zsaqyojHxXrCBR5lZ6Ioib4rNvgPZ4J4Ww';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========== 閫氱敤 Supabase CRUD 杈呭姪 ==========
function sbTable(tableName) {
    return {
        async getAll() {
            const { data, error } = await supabaseClient.from(tableName).select('*').order('id', { ascending: true });
            if (error) throw error;
            return data || [];
        },
        async getById(id) {
            const { data, error } = await supabaseClient.from(tableName).select('*').eq('id', id).single();
            if (error) throw error;
            return data;
        },
        async create(record) {
            const { data, error } = await supabaseClient.from(tableName).insert([record]).select();
            if (error) throw error;
            return data;
        },
        async update(id, updates) {
            const { data, error } = await supabaseClient.from(tableName).update(updates).eq('id', id).select();
            if (error) throw error;
            return data;
        },
        async delete(id) {
            const { error } = await supabaseClient.from(tableName).delete().eq('id', id);
            if (error) throw error;
        }
    };
}

// 杈呭姪锛氭寜闈?id 瀛楁鏌ヨ
function sbQuery(tableName) {
    return {
        async getByField(field, value) {
            const { data, error } = await supabaseClient.from(tableName).select('*').eq(field, value);
            if (error) throw error;
            return data || [];
        },
        async deleteByField(field, value) {
            const { error } = await supabaseClient.from(tableName).delete().eq(field, value);
            if (error) throw error;
        },
        async updateByField(field, value, updates) {
            const { data, error } = await supabaseClient.from(tableName).update(updates).eq(field, value).select();
            if (error) throw error;
            return data;
        }
    };
}

// ========== db 瀵硅薄 鈥?鎵€鏈夎〃鐨勫皝瑁呮柟娉?==========
const db = {
    // --- 鍏憡 announcements ---
    announcements: {
        getAll: sbTable('announcements').getAll,
        getById: sbTable('announcements').getById,
        create: sbTable('announcements').create,
        update: sbTable('announcements').update,
        delete: sbTable('announcements').delete
    },

    // --- 宸ヤ綔鍔ㄦ€?dynamics ---
    dynamics: {
        getAll: sbTable('dynamics').getAll,
        getById: sbTable('dynamics').getById,
        create: sbTable('dynamics').create,
        update: sbTable('dynamics').update,
        delete: sbTable('dynamics').delete
    },

    // --- 涓氬浼氭垚鍛?members ---
    members: {
        getAll: sbTable('members').getAll,
        getById: sbTable('members').getById,
        create: sbTable('members').create,
        update: sbTable('members').update,
        delete: sbTable('members').delete
    },

    // --- 鎶曠エ polls ---
    polls: {
        getAll: sbTable('polls').getAll,
        getById: sbTable('polls').getById,
        async getActive() {
            const { data, error } = await supabaseClient.from('polls').select('*').eq('is_active', true).order('id', { ascending: true });
            if (error) throw error;
            return data || [];
        },
        create: sbTable('polls').create,
        update: sbTable('polls').update,
        delete: sbTable('polls').delete
    },

    // --- 鎶曠エ閫夐」 poll_options ---
    pollOptions: {
        getAll: sbTable('poll_options').getAll,
        getById: sbTable('poll_options').getById,
        getByPollId: sbQuery('poll_options').getByField.bind(null, 'poll_id'),
        create: sbTable('poll_options').create,
        update: sbTable('poll_options').update,
        delete: sbTable('poll_options').delete
    },

    // --- 鎶曠エ璁板綍 votes ---
    votes: {
        getAll: sbTable('votes').getAll,
        getByPollId: sbQuery('votes').getByField.bind(null, 'poll_id'),
        create: sbTable('votes').create,
        delete: sbTable('votes').delete
    },

    // --- 璐圭敤鍏ず expenses ---
    expenses: {
        getAll: sbTable('expenses').getAll,
        getById: sbTable('expenses').getById,
        create: sbTable('expenses').create,
        update: sbTable('expenses').update,
        delete: sbTable('expenses').delete
    },

    // --- 涓氫富蹇冨０ topics ---
    topics: {
        getAll: sbTable('topics').getAll,
        getById: sbTable('topics').getById,
        create: sbTable('topics').create,
        update: sbTable('topics').update,
        delete: sbTable('topics').delete
    },

    // --- 蹇冨０鍥炲 replies ---
    replies: {
        getAll: sbTable('replies').getAll,
        getByTopicId: sbQuery('replies').getByField.bind(null, 'topic_id'),
        create: sbTable('replies').create,
        delete: sbTable('replies').delete
    },

    // --- 娉ㄥ唽鐢ㄦ埛 registered_users ---
    registeredUsers: {
        getAll: sbTable('registered_users').getAll,
        getById: sbTable('registered_users').getById,
        create: sbTable('registered_users').create,
        update: sbTable('registered_users').update,
        delete: sbTable('registered_users').delete
    },

    // --- 鎴夸骇鍦板潃 property_addresses ---
    propertyAddresses: {
        getAll: sbTable('property_addresses').getAll,
        getById: sbTable('property_addresses').getById,
        create: sbTable('property_addresses').create,
        update: sbTable('property_addresses').update,
        delete: sbTable('property_addresses').delete,
        async markRegistered(address) {
            const { data, error } = await supabaseClient.from('property_addresses')
                .update({ is_registered: true }).eq('address', address).select();
            if (error) throw error;
            return data;
        }
    },

    // --- 绔欑偣璁剧疆 site_settings ---
    siteSettings: {
        getAll: sbTable('site_settings').getAll,
        getById: sbTable('site_settings').getById,
        create: sbTable('site_settings').create,
        update: sbTable('site_settings').update,
        delete: sbTable('site_settings').delete
    },

    // --- 绠＄悊鍛樿处鍙?admin_accounts ---
    adminAccounts: {
        getAll: sbTable('admin_accounts').getAll,
        getById: sbTable('admin_accounts').getById,
        create: sbTable('admin_accounts').create,
        update: sbTable('admin_accounts').update,
        delete: sbTable('admin_accounts').delete,
        async updatePwd(username, newPassword) {
            const { data, error } = await supabaseClient.from('admin_accounts')
                .update({ password: newPassword }).eq('username', username).select();
            if (error) throw error;
            return data;
        }
    },

    // --- 鐧诲綍鏃ュ織 admin_login_logs ---
    adminLoginLogs: {
        getAll: sbTable('admin_login_logs').getAll,
        create: sbTable('admin_login_logs').create,
        delete: sbTable('admin_login_logs').delete
    }
};

// 娉ㄦ剰锛歎SE_SUPABASE 鍦?yayehui.html 鍐呰仈鑴氭湰涓篃澹版槑浜嗭紝
// 鎵€浠ヨ繖閲屼笉鑳界敤 const锛堟祻瑙堝櫒鍏ㄥ眬浣滅敤鍩熶腑閲嶅澹版槑 const 浼氭姤 SyntaxError锛?var USE_SUPABASE = true;
