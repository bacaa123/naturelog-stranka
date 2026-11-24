/* ============================ NatureLog – app.js ============================ */

const ADMIN_USERNAME = 'bacarasto';
const ADMIN_PASSWORD = '123654';

const CATEGORIES = [
    { id: 'wildlife',  label: 'Wildlife',         icon: '🦌' },
    { id: 'hiking',    label: 'Hiking & Trails',  icon: '🥾' },
    { id: 'mountains', label: 'Mountains',        icon: '⛰️' },
    { id: 'forests',   label: 'Forests',          icon: '🌲' },
    { id: 'water',     label: 'Water',            icon: '💧' },
    { id: 'sky',       label: 'Sky & Weather',    icon: '🌤️' },
    { id: 'plants',    label: 'Plants & Fungi',   icon: '🍄' },
    { id: 'macro',     label: 'Macro',            icon: '🔬' }
];

const SEASONS = [
    { id: 'spring', label: 'Jar', icon: '🌱' },
    { id: 'summer', label: 'Leto', icon: '☀️' },
    { id: 'autumn', label: 'Jeseň', icon: '🍂' },
    { id: 'winter', label: 'Zima', icon: '❄️' }
];

const TIMES_OF_DAY = [
    { id: 'sunrise', label: 'Východ slnka', icon: '🌅' },
    { id: 'day',     label: 'Deň',           icon: '🌞' },
    { id: 'sunset',  label: 'Západ slnka',   icon: '🌇' },
    { id: 'night',   label: 'Noc',           icon: '🌙' }
];

const REPORT_REASONS = [
    'Cudzie dielo (ukradnutý obsah)',
    'Týranie zvierat',
    'Reklama / spam',
    'Nevhodný obsah',
    'Nenávistný prejav',
    'Prezradená citlivá poloha',
    'Iné'
];

/* ---------------------------- IndexedDB media store ---------------------------- */
const MediaStore = {
    db: null,
    async open() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('NatureLogMediaDB', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('media')) {
                    db.createObjectStore('media', { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    },
    async put(id, dataUrl, isVideo) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('media', 'readwrite');
            tx.objectStore('media').put({ id, dataUrl, isVideo });
            tx.oncomplete = () => resolve(id);
            tx.onerror = (e) => reject(e.target.error);
        });
    },
    async get(id) {
        if (!id) return null;
        if (typeof id === 'string' && (id.startsWith('data:') || id.startsWith('http'))) {
            return { id, dataUrl: id, isVideo: id.startsWith('data:video') };
        }
        const db = await this.open();
        return new Promise((resolve) => {
            const tx = db.transaction('media', 'readonly');
            const req = tx.objectStore('media').get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }
};

/* ---------------------------- storage helpers ---------------------------- */
const DB = {
    users:         () => JSON.parse(localStorage.getItem('nl_users')         || '[]'),
    posts:         () => JSON.parse(localStorage.getItem('nl_posts')         || '[]'),
    winners:       () => JSON.parse(localStorage.getItem('nl_winners')       || '[]'),
    session:       () => JSON.parse(localStorage.getItem('nl_session')       || 'null'),
    notifications: () => JSON.parse(localStorage.getItem('nl_notifications') || '[]'),
    theme:         () => localStorage.getItem('nl_theme') || 'light',
    saveUsers:         (v) => localStorage.setItem('nl_users', JSON.stringify(v)),
    savePosts:         (v) => localStorage.setItem('nl_posts', JSON.stringify(v)),
    saveWinners:       (v) => localStorage.setItem('nl_winners', JSON.stringify(v)),
    saveSession:       (v) => localStorage.setItem('nl_session', JSON.stringify(v)),
    saveNotifications: (v) => localStorage.setItem('nl_notifications', JSON.stringify(v)),
    saveTheme:         (v) => localStorage.setItem('nl_theme', v)
};

function applyTheme(mode) {
    const html = document.documentElement;
    if (mode === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    DB.saveTheme(mode);
}

function toggleTheme() {
    const next = DB.theme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    renderNavbar();
    toast(next === 'dark' ? 'Nočný režim zapnutý 🌙' : 'Denný režim zapnutý ☀️');
}

function getVisitorId() {
    let vid = localStorage.getItem('nl_visitor_id');
    if (!vid) {
        vid = 'anon_' + uid();
        localStorage.setItem('nl_visitor_id', vid);
    }
    return vid;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function nowISO() { return new Date().toISOString(); }
function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
        d.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}
function catInfo(id) { return CATEGORIES.find(c => c.id === id) || { id, label: id || 'Príroda', icon: '🌿' }; }
function seasonInfo(id) { return SEASONS.find(s => s.id === id) || null; }
function timeOfDayInfo(id) { return TIMES_OF_DAY.find(t => t.id === id) || null; }

function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._toastT);
    window._toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function confirmAction(text, onYes) {
    document.getElementById('confirmText').textContent = text;
    const btn = document.getElementById('confirmYesBtn');
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', () => { closeModal('confirmModal'); onYes(); });
    openModal('confirmModal');
}

/* ---------------------------- notifications & badges ---------------------------- */
function pushNotification(recipient, text, link = '#/home') {
    if (!recipient || recipient === currentUser()?.username) return;
    const list = DB.notifications();
    list.unshift({
        id: uid(),
        to: recipient,
        text,
        link,
        read: false,
        createdAt: nowISO()
    });
    DB.saveNotifications(list.slice(0, 150));
}

function getUserBadges(username) {
    const posts = DB.posts().filter(p => p.author === username && !p.deleted);
    const totalLikes = posts.reduce((acc, p) => acc + (p.likes?.length || 0), 0);
    const distinctCats = new Set(posts.map(p => p.category)).size;
    const hasWinner = posts.some(p => p.badges && p.badges.length > 0);
    const u = DB.users().find(x => x.username === username);
    const followersCount = u?.followers?.length || 0;

    return [
        { id: 'first_post', icon: '🌱', title: 'Prvý úlovok', desc: 'Zverejnil aspoň 1 príspevok', unlocked: posts.length >= 1 },
        { id: 'explorer', icon: '🧭', title: 'Prieskumník', desc: 'Príspevky v 4+ kategóriách', unlocked: distinctCats >= 4 },
        { id: 'popular', icon: '💚', title: 'Obľúbený autor', desc: 'Získal spolu 10+ lajkov', unlocked: totalLikes >= 10 },
        { id: 'community', icon: '🤝', title: 'Komunitný sprievodca', desc: 'Má 3+ sledovateľov', unlocked: followersCount >= 3 },
        { id: 'winner', icon: '🏆', title: 'Víťaz týždňa', desc: 'Vyhral týždennú súťaž', unlocked: hasWinner }
    ];
}

/* ---------------------------- Instagram follow system ---------------------------- */
function isFollowing(targetUsername, viewerUsername = currentUser()?.username) {
    if (!viewerUsername || !targetUsername) return false;
    const target = DB.users().find(u => u.username === targetUsername);
    return !!(target && (target.followers || []).includes(viewerUsername));
}

function hasRequestedFollow(targetUsername, viewerUsername = currentUser()?.username) {
    if (!viewerUsername || !targetUsername) return false;
    const target = DB.users().find(u => u.username === targetUsername);
    return !!(target && (target.followRequests || []).includes(viewerUsername));
}

function toggleFollow(targetUsername) {
    if (!requireLogin()) return;
    const me = currentUser().username;
    if (me === targetUsername) return toast('Nemôžeš sledovať sám seba.');

    const users = DB.users();
    const target = users.find(u => u.username === targetUsername);
    const actor = users.find(u => u.username === me);
    if (!target || !actor) return;

    target.followers = target.followers || [];
    target.followRequests = target.followRequests || [];
    actor.following = actor.following || [];

    if (target.followers.includes(me)) {
        target.followers = target.followers.filter(x => x !== me);
        actor.following = actor.following.filter(x => x !== targetUsername);
        toast(`Prestali ste sledovať @${targetUsername}.`);
    } else if (target.followRequests.includes(me)) {
        target.followRequests = target.followRequests.filter(x => x !== me);
        toast('Žiadosť o sledovanie bola zrušená.');
    } else if (target.isPrivate) {
        target.followRequests.push(me);
        pushNotification(targetUsername, `@${me} žiada o sledovanie tvojho profilu.`, `#/profile/${targetUsername}`);
        toast('Žiadosť o sledovanie bola odoslaná.');
    } else {
        target.followers.push(me);
        actor.following.push(targetUsername);
        pushNotification(targetUsername, `@${me} ťa začal sledovať.`, `#/profile/${me}`);
        toast(`Začali ste sledovať @${targetUsername}.`);
    }

    DB.saveUsers(users);
    router();
}

function respondFollowRequest(requesterUsername, accept) {
    if (!requireLogin()) return;
    const me = currentUser().username;
    const users = DB.users();
    const mine = users.find(u => u.username === me);
    const reqUser = users.find(u => u.username === requesterUsername);
    if (!mine || !reqUser) return;

    mine.followRequests = (mine.followRequests || []).filter(x => x !== requesterUsername);
    mine.followers = mine.followers || [];
    reqUser.following = reqUser.following || [];

    if (accept) {
        if (!mine.followers.includes(requesterUsername)) mine.followers.push(requesterUsername);
        if (!reqUser.following.includes(me)) reqUser.following.push(me);
        pushNotification(requesterUsername, `@${me} prijal tvoju žiadosť o sledovanie.`, `#/profile/${me}`);
        toast(`Schválili ste sledovanie pre @${requesterUsername}.`);
    } else {
        toast(`Žiadosť od @${requesterUsername} bola zamietnutá.`);
    }

    DB.saveUsers(users);
    router();
}

/* ---------------------------- visibility & Snapchat shortcut ---------------------------- */
function canViewPost(post, user = currentUser()) {
    if (!post || post.deleted) return false;
    if (post.hidden && !(user && user.isAdmin)) return false;
    if (user && (user.username === post.author || user.isAdmin)) return true;

    const vis = post.visibility || 'public';
    if (vis === 'public') return true;
    if (!user) return false;
    if (vis === 'members') return true;
    if (vis === 'followers') return isFollowing(post.author, user.username);
    if (vis === 'shortcut') return Array.isArray(post.allowedUsers) && post.allowedUsers.includes(user.username);
    return false;
}

/* ------------------------------- auth ------------------------------- */
function currentUser() {
    const s = DB.session();
    if (!s) return null;
    return DB.users().find(u => u.username === s.username) || null;
}
function isLoggedIn() { return !!currentUser(); }
function isAdmin() { const u = currentUser(); return !!(u && u.isAdmin); }

function requireLogin() {
    if (!isLoggedIn()) {
        toast('Musíš byť prihlásený/á.');
        location.hash = '#/login';
        return false;
    }
    return true;
}

function register(username, password, bio, isPrivate = false) {
    username = username.trim();
    if (username.length < 3) return toast('Meno musí mať aspoň 3 znaky.');
    if (password.length < 4) return toast('Heslo musí mať aspoň 4 znaky.');
    if (username.toLowerCase() === ADMIN_USERNAME) return toast('Toto meno je rezervované.');
    const users = DB.users();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) return toast('Toto meno už existuje.');

    const user = {
        username,
        password,
        bio: bio || '',
        avatar: username.slice(0, 2).toUpperCase(),
        joined: nowISO(),
        banned: false,
        isAdmin: false,
        isPrivate: !!isPrivate,
        savedPostIds: [],
        followers: [],
        following: [],
        followRequests: [],
        shortcutGroup: []
    };
    users.push(user);
    DB.saveUsers(users);
    DB.saveSession({ username });
    toast('Registrácia úspešná! Vitaj, ' + username + '.');
    location.hash = '#/home';
}

function login(username, password) {
    username = username.trim();
    if (username.toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        let users = DB.users();
        let admin = users.find(u => u.username.toLowerCase() === ADMIN_USERNAME);
        if (!admin) {
            admin = {
                username: ADMIN_USERNAME,
                password: ADMIN_PASSWORD,
                bio: 'Administrátor NatureLog',
                avatar: 'AD',
                joined: nowISO(),
                banned: false,
                isAdmin: true,
                isPrivate: false,
                savedPostIds: [],
                followers: [],
                following: [],
                followRequests: [],
                shortcutGroup: []
            };
            users.push(admin);
            DB.saveUsers(users);
        }
        DB.saveSession({ username: admin.username });
        toast('Prihlásený ako administrátor.');
        location.hash = '#/home';
        return;
    }
    const users = DB.users();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) return toast('Nesprávne meno alebo heslo.');
    if (user.banned) return toast('Tento účet bol zablokovaný.');
    DB.saveSession({ username: user.username });
    toast('Vitaj späť, ' + user.username + '!');
    location.hash = '#/home';
}

function logout() {
    DB.saveSession(null);
    toast('Boli ste odhlásený/á.');
    location.hash = '#/home';
}

/* ------------------------------- image & video processing ------------------------------- */
function processImage(file, maxDim = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round(height * (maxDim / width));
                        width = maxDim;
                    } else {
                        width = Math.round(width * (maxDim / height));
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function readVideoAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getVideoDuration(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
        v.onerror = () => resolve(0);
        v.src = url;
    });
}

async function resolveMediaList(media = []) {
    const out = [];
    for (const m of (media || [])) {
        if (typeof m === 'string') {
            const rec = await MediaStore.get(m);
            if (rec) out.push(rec);
        } else if (m && m.mediaId) {
            const rec = await MediaStore.get(m.mediaId);
            if (rec) out.push({ ...rec, isVideo: m.isVideo ?? rec.isVideo });
            else if (m.dataUrl) out.push(m);
        } else if (m && m.dataUrl) {
            out.push(m);
        }
    }
    return out;
}

/* ------------------------------- week / winners logic ------------------------------- */
function getWeekRange(d = new Date()) {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7;
    const monday = new Date(date); monday.setHours(0, 0, 0, 0); monday.setDate(date.getDate() - day);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday, key: monday.toISOString().slice(0, 10) };
}

function computeWeekLeaders(range) {
    const posts = DB.posts().filter(p => !p.deleted && !p.hidden && (p.visibility || 'public') === 'public');
    const scored = (type) => {
        let best = [];
        let bestCount = 0;
        posts.filter(p => p.type === type).forEach(p => {
            const count = (p.likes || []).filter(l => {
                const t = new Date(l.at).getTime();
                return t >= range.start.getTime() && t <= range.end.getTime();
            }).length;
            if (count > 0 && count > bestCount) { bestCount = count; best = [p]; }
            else if (count > 0 && count === bestCount) { best.push(p); }
        });
        return { posts: best, count: bestCount };
    };
    return { photo: scored('photo'), video: scored('video') };
}

function simulateWeeklyEvaluation() {
    const range = getWeekRange();
    const leaders = computeWeekLeaders(range);
    const posts = DB.posts();
    [...leaders.photo.posts, ...leaders.video.posts].forEach(winnerPost => {
        const p = posts.find(x => x.id === winnerPost.id);
        if (!p) return;
        p.badges = p.badges || [];
        if (!p.badges.some(b => b.week === range.key)) {
            p.badges.push({ week: range.key, type: p.type });
            pushNotification(p.author, `Gratulujeme! Tvoj príspevok „${p.title}“ získal titul Víťaz týždňa 🏆`, `#/post/${p.id}`);
        }
    });
    DB.savePosts(posts);

    const winners = DB.winners();
    const idx = winners.findIndex(w => w.week === range.key);
    const record = {
        week: range.key,
        photoWinners: leaders.photo.posts.map(p => p.id),
        videoWinners: leaders.video.posts.map(p => p.id),
        evaluatedAt: nowISO()
    };
    if (idx >= 0) winners[idx] = record;
    else winners.push(record);
    DB.saveWinners(winners);

    toast('Nedeľné vyhodnotenie prebehlo: ' + (leaders.photo.posts.length + leaders.video.posts.length) + ' víťazov tento týždeň.');
    router();
}

/* ------------------------------- seed demo data ------------------------------- */
function seedData() {
    if (DB.users().length === 0) {
        const demoUsers = [
            {
                username: 'lucia_wild', password: '1234', bio: 'Fotografka divočiny z Tatier.',
                avatar: 'LW', joined: nowISO(), banned: false, isAdmin: false, isPrivate: false,
                savedPostIds: [], followers: ['marek_treky'], following: ['marek_treky'], followRequests: [], shortcutGroup: ['marek_treky']
            },
            {
                username: 'marek_treky', password: '1234', bio: 'Turistika, hory a ranné svetlo.',
                avatar: 'MT', joined: nowISO(), banned: false, isAdmin: false, isPrivate: false,
                savedPostIds: [], followers: ['lucia_wild'], following: ['lucia_wild'], followRequests: [], shortcutGroup: ['lucia_wild']
            }
        ];
        DB.saveUsers(demoUsers);
    }

    if (DB.posts().length === 0) {
        const photoUrls = {
            wildlife:  'https://images.unsplash.com/photo-1484406566174-9da000fda645?w=900&q=80',
            hiking:    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=80',
            mountains: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=80',
            forests:   'https://images.unsplash.com/photo-1511497584788-876760111969?w=900&q=80',
            water:     'https://images.unsplash.com/photo-1467890947394-8171244e5410?w=900&q=80',
            sky:       'https://images.unsplash.com/photo-1495195129352-aeb325a55b65?w=900&q=80',
            plants:    'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=900&q=80',
            macro:     'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=900&q=80'
        };
        const demo = [
            { title: 'Jeleň pri východe slnka', category: 'wildlife', author: 'lucia_wild', species: 'Jeleň lesný', tags: ['jeleň', 'ráno', 'tatry'], location: 'Tatranská Lomnica', device: 'Canon R6', cameraSettings: '200mm · f/4 · 1/640s · ISO 800', season: 'autumn', timeOfDay: 'sunrise', sensitiveLocation: false, description: 'Ranné stretnutie priamo pri chate.' },
            { title: 'Výstup na Rysy', category: 'hiking', author: 'marek_treky', species: '', tags: ['túra', 'rysy', 'hory'], location: 'Rysy, Vysoké Tatry', device: 'iPhone 14', cameraSettings: '24mm · f/1.8', season: 'summer', timeOfDay: 'day', sensitiveLocation: false, description: 'Náročný ale krásny výstup.' },
            { title: 'Hmla nad dolinou', category: 'mountains', author: 'lucia_wild', species: '', tags: ['hmla', 'dolina'], location: 'Tichá dolina', device: 'Sony A7III', cameraSettings: '35mm · f/8 · 1/250s · ISO 200', season: 'autumn', timeOfDay: 'sunrise', sensitiveLocation: false, description: 'Ráno plné hmly.' },
            { title: 'Mach v lese', category: 'forests', author: 'marek_treky', species: '', tags: ['les', 'mach'], location: 'Malá Fatra', device: 'Nikon D750', cameraSettings: '50mm · f/2.8 · 1/125s · ISO 400', season: 'spring', timeOfDay: 'day', sensitiveLocation: false, description: 'Detail machu po daždi.' },
            { title: 'Vodopád Skok', category: 'water', author: 'lucia_wild', species: '', tags: ['vodopád', 'tatry'], location: 'Vodopád Skok', device: 'Canon R6', cameraSettings: '24mm · f/11 · 0.6s · ISO 100', season: 'spring', timeOfDay: 'day', sensitiveLocation: false, description: 'Jarný prietok po topení snehu.' },
            { title: 'Dúha po búrke', category: 'sky', author: 'marek_treky', species: '', tags: ['dúha', 'búrka'], location: 'Liptov', device: 'iPhone 14', cameraSettings: '13mm · f/2.2', season: 'summer', timeOfDay: 'sunset', sensitiveLocation: false, description: 'Krátka ale intenzívna dúha.' },
            { title: 'Muchotrávka červená', category: 'plants', author: 'lucia_wild', species: 'Muchotrávka červená', tags: ['huba', 'les'], location: 'Malá Fatra', device: 'Nikon D750', cameraSettings: '85mm · f/5.6 · 1/200s · ISO 320', season: 'autumn', timeOfDay: 'day', sensitiveLocation: false, description: 'Klasika jesenného lesa.' },
            { title: 'Kvapka rosy na pavučine', category: 'macro', author: 'marek_treky', species: '', tags: ['makro', 'rosa'], location: '', device: 'Canon R6 + makro objektív', cameraSettings: '100mm · f/8 · 1/400s · ISO 640', season: 'summer', timeOfDay: 'sunrise', sensitiveLocation: false, description: 'Ranná rosa pri východe slnka.' }
        ];

        const posts = demo.map(d => ({
            id: uid(),
            author: d.author,
            title: d.title,
            category: d.category,
            location: d.location || '',
            device: d.device || '',
            cameraSettings: d.cameraSettings || '',
            season: d.season || '',
            timeOfDay: d.timeOfDay || '',
            sensitiveLocation: !!d.sensitiveLocation,
            species: d.species || '',
            tags: d.tags || [],
            description: d.description || '',
            type: 'photo',
            media: [{ dataUrl: photoUrls[d.category], isVideo: false }],
            visibility: 'public',
            allowedUsers: [],
            createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000).toISOString(),
            likes: [],
            views: 0,
            viewedBy: [],
            comments: [],
            reports: [],
            hidden: false,
            deleted: false,
            badges: []
        }));
        DB.savePosts(posts);
    }
}

/* ------------------------------- navbar ------------------------------- */
let notifOpen = false;

function toggleNotifications() {
    notifOpen = !notifOpen;
    renderNavbar();
}

function markAllNotificationsRead() {
    const u = currentUser();
    if (!u) return;
    const list = DB.notifications().map(n => n.to === u.username ? { ...n, read: true } : n);
    DB.saveNotifications(list);
    renderNavbar();
}

function renderNavbar() {
    const path = (location.hash || '#/home').split('/')[1] || 'home';
    const u = currentUser();
    const isDark = DB.theme() === 'dark';
    const nav = document.getElementById('navbar');

    const myNotifs = u ? DB.notifications().filter(n => n.to === u.username) : [];
    const unreadCount = myNotifs.filter(n => !n.read).length;
    const reqCount = u?.followRequests?.length || 0;

    const links = [
        { href: '#/home', icon: '🏡', label: 'Domov', key: 'home' },
        { href: '#/upload', icon: '📷', label: 'Pridať', key: 'upload' },
        { href: '#/saved', icon: '🔖', label: 'Uložené', key: 'saved' },
        { href: '#/winners', icon: '🏆', label: 'Sieň slávy', key: 'winners' }
    ];

    nav.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <a href="#/home" class="flex items-center gap-2 font-extrabold text-xl text-forest dark:text-moss">
        🌿 Nature<span class="text-sunset">Log</span>
      </a>
      <div class="flex items-center gap-1 flex-wrap relative">
        ${links.map(l => `<a href="${l.href}" class="nav-link ${path === l.key ? 'active' : ''}">${l.icon} <span class="hidden md:inline">${l.label}</span></a>`).join('')}
        ${u && u.isAdmin ? `<a href="#/admin" class="nav-link ${path === 'admin' ? 'active' : ''}">🛠️ <span class="hidden md:inline">Admin</span></a>` : ''}

        <button onclick="toggleTheme()" class="nav-link" title="Prepínač nočného režimu">
          ${isDark ? '☀️' : '🌙'} <span class="hidden lg:inline">${isDark ? 'Deň' : 'Noc'}</span>
        </button>

        ${u ? `
          <div class="relative">
            <button onclick="toggleNotifications()" class="nav-link" title="Notifikácie">
              🔔 ${unreadCount > 0 ? `<span class="bg-sunset text-white text-xs font-bold px-1.5 py-0.5 rounded-full">${unreadCount}</span>` : ''}
            </button>
            ${notifOpen ? `
              <div class="absolute right-0 mt-2 w-80 surface-card shadow-xl p-3 z-50">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold text-sm">Upozornenia</span>
                  <button onclick="markAllNotificationsRead()" class="text-xs text-forest dark:text-moss underline">Označiť ako prečítané</button>
                </div>
                <div class="max-h-64 overflow-y-auto space-y-2">
                  ${myNotifs.length === 0
        ? `<p class="text-xs opacity-60 py-3 text-center">Žiadne upozornenia.</p>`
        : myNotifs.slice(0, 15).map(n => `
                      <a href="${n.link}" onclick="notifOpen=false" class="block p-2 rounded-lg text-xs ${n.read ? 'opacity-70' : 'bg-moss/20 dark:bg-moss/10 font-medium'}">
                        <div>${escapeHtml(n.text)}</div>
                        <div class="text-[10px] opacity-60 mt-0.5">${fmtDate(n.createdAt)}</div>
                      </a>
                    `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <a href="#/profile/${encodeURIComponent(u.username)}" class="nav-link ${path === 'profile' ? 'active' : ''}">
            👤 <span class="hidden sm:inline">${escapeHtml(u.username)}</span>
            ${reqCount > 0 ? `<span class="bg-sunset text-white text-xs font-bold px-1.5 py-0.5 rounded-full">${reqCount}</span>` : ''}
          </a>
          <button onclick="logout()" class="nav-link">🚪 <span class="hidden sm:inline">Odhlásiť</span></button>
        ` : `
          <a href="#/login" class="nav-link ${path === 'login' ? 'active' : ''}">🔑 <span class="hidden sm:inline">Prihlásiť</span></a>
          <a href="#/register" class="btn-primary ml-1">Registrácia</a>
        `}
      </div>
    </div>`;
}

/* ------------------------------- router ------------------------------- */
function parseHash() {
    const h = (location.hash || '#/home').replace(/^#\//, '');
    const parts = h.split('/');
    return { page: parts[0] || 'home', param: parts[1] };
}

function router() {
    renderNavbar();
    const { page, param } = parseHash();
    const app = document.getElementById('app');
    const pages = {
        home: renderHome,
        post: () => renderPostDetail(param),
        upload: renderUpload,
        profile: () => renderProfile(param),
        saved: renderSaved,
        edit: () => renderEditPost(param),
        winners: renderWinners,
        login: renderLogin,
        register: renderRegister,
        rules: renderRules,
        admin: renderAdmin
    };
    const fn = pages[page] || render404;
    app.innerHTML = fn();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    afterRender(page, param);
}

function afterRender(page, param) {
    if (page === 'home') {
        const sInp = document.getElementById('searchInput');
        if (sInp) {
            sInp.addEventListener('input', (e) => {
                homeFilters.q = e.target.value;
                renderHomeFeedOnly();
            });
        }
        const tSel = document.getElementById('typeFilter');
        if (tSel) {
            tSel.addEventListener('change', (e) => {
                homeFilters.type = e.target.value;
                renderHomeFeedOnly();
            });
        }
        const sSel = document.getElementById('sortFilter');
        if (sSel) {
            sSel.addEventListener('change', (e) => {
                homeFilters.sort = e.target.value;
                renderHomeFeedOnly();
            });
        }
        const seSel = document.getElementById('seasonFilter');
        if (seSel) {
            seSel.addEventListener('change', (e) => {
                homeFilters.season = e.target.value;
                renderHomeFeedOnly();
            });
        }
        const todSel = document.getElementById('timeOfDayFilter');
        if (todSel) {
            todSel.addEventListener('change', (e) => {
                homeFilters.timeOfDay = e.target.value;
                renderHomeFeedOnly();
            });
        }
        hydrateCardMedia();
    }

    if (page === 'post') {
        hydratePostMedia(param);
        const cForm = document.getElementById('commentForm');
        if (cForm) {
            cForm.addEventListener('submit', (e) => {
                e.preventDefault();
                addComment(param);
            });
        }
    }

    if (page === 'saved' || page === 'profile' || page === 'winners' || page === 'admin') {
        hydrateCardMedia();
    }

    if (page === 'upload') {
        setupUploadForm();
    }

    if (page === 'edit') {
        setupEditForm(param);
    }

    if (page === 'login') {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            login(document.getElementById('loginUser').value, document.getElementById('loginPass').value);
        });
    }

    if (page === 'register') {
        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            register(
                document.getElementById('regUser').value,
                document.getElementById('regPass').value,
                document.getElementById('regBio').value,
                document.getElementById('regPrivate').checked
            );
        });
    }
}

/* ------------------------------- LIGHTBOX ------------------------------- */
let lightboxState = { items: [], index: 0, caption: '' };

function openLightbox(items, index = 0, caption = '') {
    if (!items || !items.length) return;
    lightboxState = { items, index, caption };
    const modal = document.getElementById('lightboxModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderLightboxSlide();
}

function renderLightboxSlide() {
    const { items, index, caption } = lightboxState;
    const item = items[index];
    if (!item) return;
    const box = document.getElementById('lbContent');
    box.innerHTML = item.isVideo
        ? `<video src="${item.dataUrl}" controls autoplay class="max-h-[80vh] max-w-full rounded-xl"></video>`
        : `<img src="${item.dataUrl}" class="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl" alt="">`;
    document.getElementById('lbCaption').textContent = `${caption ? caption + ' · ' : ''}${index + 1} / ${items.length}`;
    document.getElementById('lbPrev').classList.toggle('hidden', items.length <= 1);
    document.getElementById('lbNext').classList.toggle('hidden', items.length <= 1);
}

function stepLightbox(dir) {
    const len = lightboxState.items.length;
    if (!len) return;
    lightboxState.index = (lightboxState.index + dir + len) % len;
    renderLightboxSlide();
}

function closeLightbox() {
    const modal = document.getElementById('lightboxModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('lbContent').innerHTML = '';
}

document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('lightboxModal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
});

/* ------------------------------- HOME ------------------------------- */
let homeFilters = { q: '', category: '', type: '', sort: 'newest', feed: 'all', season: '', timeOfDay: '' };

function getFilteredHomePosts() {
    const u = currentUser();
    let posts = DB.posts().filter(p => canViewPost(p, u));

    const { q, category, type, sort, feed, season, timeOfDay } = homeFilters;
    if (feed === 'following' && u) {
        const followingSet = new Set(u.following || []);
        posts = posts.filter(p => followingSet.has(p.author));
    }

    let filtered = posts.filter(p => {
        const matchesQ = !q || [p.title, p.description, p.species, p.location, p.author, ...(p.tags || [])]
            .join(' ').toLowerCase().includes(q.toLowerCase());
        const matchesCat = !category || p.category === category;
        const matchesType = !type || p.type === type;
        const matchesSeason = !season || p.season === season;
        const matchesTod = !timeOfDay || p.timeOfDay === timeOfDay;
        return matchesQ && matchesCat && matchesType && matchesSeason && matchesTod;
    });

    if (sort === 'newest') filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === 'liked') filtered.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
    if (sort === 'viewed') filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    return filtered;
}

function renderHomeFeedOnly() {
    const container = document.getElementById('homeFeedContainer');
    if (!container) return;
    const filtered = getFilteredHomePosts();
    container.innerHTML = filtered.length === 0
        ? `<p class="opacity-60 py-6 text-center">Nenašli sa žiadne príspevky podľa zvolených filtrov.</p>`
        : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${filtered.map(postCard).join('')}</div>`;
    hydrateCardMedia();
}

function renderHome() {
    const u = currentUser();
    const range = getWeekRange();
    const leaders = computeWeekLeaders(range);
    const winnerCards = [...leaders.photo.posts, ...leaders.video.posts];
    const filtered = getFilteredHomePosts();
    const { category, type, sort, feed, season, timeOfDay } = homeFilters;

    return `
  <section class="hero-banner rounded-3xl text-white px-6 py-12 text-center mb-8">
    <h1 class="text-3xl sm:text-5xl font-extrabold mb-2 tracking-tight">🌿 Nature<span class="text-amber-300">Log</span></h1>
    <p class="text-emerald-100/90 text-lg mb-6 italic">Log your wild moments.</p>
    <div class="max-w-xl mx-auto">
      <input id="searchInput" value="${escapeHtml(homeFilters.q)}" placeholder="Hľadať podľa názvu, #tagu, druhu, autora alebo lokality..."
        class="w-full rounded-full px-5 py-3 text-deepforest bg-white/95 shadow-lg focus:outline-none focus:ring-4 focus:ring-amber-300/60">
    </div>
  </section>

  <section class="mb-6 flex flex-wrap gap-2 justify-center">
    ${CATEGORIES.map(c => `
      <div class="chip ${category === c.id ? 'active' : ''}" onclick="setCategoryFilter('${c.id}')">${c.icon} ${c.label}</div>
    `).join('')}
  </section>

  <section class="mb-10">
    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
      <h2 class="text-xl font-bold text-forest dark:text-moss">🏆 Tento týždeň vyhrávajú (live)</h2>
      <div class="flex gap-2">
        <a href="#/winners" class="btn-ghost text-xs">Sieň slávy</a>
        ${isAdmin() ? `<button onclick="simulateWeeklyEvaluation()" class="btn-secondary text-xs">Simulovať nedeľu (18:00)</button>` : ''}
      </div>
    </div>
    ${winnerCards.length === 0
        ? `<p class="opacity-60 text-sm">Zatiaľ žiadne lajky tento týždeň. Buď prvý, kto niekoho podporí!</p>`
        : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${winnerCards.map(postCard).join('')}</div>`}
  </section>

  <section>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2 flex-wrap">
        <h2 class="text-xl font-bold text-forest dark:text-moss">Príspevky</h2>
        ${u ? `
          <button onclick="setFeedMode('all')" class="chip ${feed === 'all' ? 'active' : ''}">🌍 Všetky</button>
          <button onclick="setFeedMode('following')" class="chip ${feed === 'following' ? 'active' : ''}">💚 Sledovaní (${(u.following || []).length})</button>
        ` : ''}
      </div>
      <div class="flex gap-2 flex-wrap">
        <select id="seasonFilter" class="field w-auto text-sm">
          <option value="" ${season === '' ? 'selected' : ''}>Všetky obdobia</option>
          ${SEASONS.map(s => `<option value="${s.id}" ${season === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
        </select>
        <select id="timeOfDayFilter" class="field w-auto text-sm">
          <option value="" ${timeOfDay === '' ? 'selected' : ''}>Kedykoľvek</option>
          ${TIMES_OF_DAY.map(t => `<option value="${t.id}" ${timeOfDay === t.id ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
        </select>
        <select id="typeFilter" class="field w-auto text-sm">
          <option value="" ${type === '' ? 'selected' : ''}>Všetky typy</option>
          <option value="photo" ${type === 'photo' ? 'selected' : ''}>📷 Foto</option>
          <option value="video" ${type === 'video' ? 'selected' : ''}>🎥 Video</option>
        </select>
        <select id="sortFilter" class="field w-auto text-sm">
          <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Najnovšie</option>
          <option value="liked" ${sort === 'liked' ? 'selected' : ''}>Najviac lajkov</option>
          <option value="viewed" ${sort === 'viewed' ? 'selected' : ''}>Najviac zobrazení</option>
        </select>
      </div>
    </div>

    <div id="homeFeedContainer">
      ${filtered.length === 0
        ? `<p class="opacity-60 py-6 text-center">Nenašli sa žiadne príspevky.</p>`
        : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${filtered.map(postCard).join('')}</div>`}
    </div>
  </section>`;
}

function setCategoryFilter(id) {
    homeFilters.category = homeFilters.category === id ? '' : id;
    router();
}

function setFeedMode(mode) {
    homeFilters.feed = mode;
    router();
}

function searchByTag(tag) {
    homeFilters.q = tag.replace(/^#/, '');
    homeFilters.category = '';
    homeFilters.feed = 'all';
    location.hash = '#/home';
    router();
}

function postCard(p) {
    const cat = catInfo(p.category);
    const author = DB.users().find(u => u.username === p.author);
    const winBadge = (p.badges && p.badges.length) ? `<span class="badge badge-winner">🏆 Víťaz</span>` : '';
    const shortcutBadge = p.visibility === 'shortcut'
        ? `<span class="badge badge-shortcut">⚡ Shortcut</span>`
        : p.visibility === 'followers'
            ? `<span class="badge badge-cat">💚 Sledovatelia</span>`
            : '';

    return `
  <a href="#/post/${p.id}" class="post-card flex flex-col">
    <div class="thumb-wrap h-40 bg-moss/25 dark:bg-nightbg flex items-center justify-center" data-media-post="${p.id}">
      <span class="text-xs opacity-50">Načítavam…</span>
    </div>
    <div class="p-3 flex-1 flex flex-col gap-1">
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="badge badge-cat">${cat.icon} ${cat.label}</span>
        ${winBadge}
        ${shortcutBadge}
      </div>
      <h3 class="font-semibold text-sm truncate">${escapeHtml(p.title || '(bez názvu)')}</h3>
      <p class="text-xs opacity-65">👤 ${escapeHtml(p.author)}${author && author.banned ? ' (zablokovaný)' : ''}</p>
      <div class="flex items-center gap-3 text-xs opacity-75 mt-auto pt-1">
        <span>❤️ ${p.likes?.length || 0}</span>
        <span>💬 ${p.comments?.length || 0}</span>
        <span>👁️ ${p.views || 0}</span>
      </div>
    </div>
  </a>`;
}

async function hydrateCardMedia() {
    const posts = DB.posts();
    const wraps = document.querySelectorAll('[data-media-post]');
    for (const el of wraps) {
        const pid = el.getAttribute('data-media-post');
        const p = posts.find(x => x.id === pid);
        if (!p || !p.media || !p.media[0]) continue;
        const resolved = await resolveMediaList([p.media[0]]);
        const first = resolved[0];
        if (!first) continue;
        el.innerHTML = first.isVideo
            ? `<video src="${first.dataUrl}" muted playsinline preload="metadata" class="w-full h-full object-cover"></video>`
            : `<img src="${first.dataUrl}" alt="${escapeHtml(p.title || '')}" class="w-full h-full object-cover">`;
    }
}

/* ------------------------------- POST DETAIL ------------------------------- */
let currentDetailMedia = [];
let currentDetailTitle = '';

function renderPostDetail(id) {
    const posts = DB.posts();
    const p = posts.find(x => x.id === id);
    if (!p || p.deleted) return render404();
    const u = currentUser();

    if (!canViewPost(p, u)) {
        if (p.visibility === 'shortcut') {
            return `<div class="text-center py-20 space-y-3">
              <p class="text-xl font-bold">⚡ Tento príspevok je zdieľaný len pre vybraných používateľov (Shortcut).</p>
              <a href="#/home" class="btn-primary">Späť na domov</a>
            </div>`;
        }
        if (p.visibility === 'followers') {
            return `<div class="text-center py-20 space-y-3">
              <p class="text-xl font-bold">💚 Tento príspevok je len pre sledovateľov autora @${escapeHtml(p.author)}.</p>
              <a href="#/profile/${encodeURIComponent(p.author)}" class="btn-primary">Zobraziť profil autora</a>
            </div>`;
        }
        if ((p.visibility === 'members') && !u) {
            return `<div class="text-center py-20 space-y-3">
              <p class="text-xl">Tento príspevok je len pre prihlásených používateľov.</p>
              <a href="#/login" class="btn-primary">Prihlásiť sa</a>
            </div>`;
        }
        return `<div class="text-center py-20"><p class="text-xl">Tento príspevok nie je dostupný.</p></div>`;
    }

    const viewerId = u ? u.username : getVisitorId();
    p.viewedBy = p.viewedBy || [];
    if (!p.viewedBy.includes(viewerId)) {
        p.viewedBy.push(viewerId);
        p.views = p.viewedBy.length;
        DB.savePosts(posts);
    }

    const cat = catInfo(p.category);
    const season = seasonInfo(p.season);
    const tod = timeOfDayInfo(p.timeOfDay);
    const liked = u && (p.likes || []).some(l => l.username === u.username);
    const canLike = u && u.username !== p.author;
    const saved = u && Array.isArray(u.savedPostIds) && u.savedPostIds.includes(p.id);
    const isOwner = u && u.username === p.author;
    const followingAuthor = u && !isOwner && isFollowing(p.author, u.username);
    const requestedAuthor = u && !isOwner && hasRequestedFollow(p.author, u.username);

    const mapsUrl = p.location && !p.sensitiveLocation
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.location)}`
        : '';

    return `
  <div class="grid md:grid-cols-5 gap-6">
    <div class="md:col-span-3">
      <div class="rounded-2xl overflow-hidden surface-card">
        <div id="gallery" class="aspect-[4/3] bg-black/10 flex items-center justify-center overflow-hidden cursor-zoom-in" onclick="openLightbox(currentDetailMedia, 0, currentDetailTitle)">
          <span class="text-sm opacity-60">Načítavam médium…</span>
        </div>
        <div id="galleryThumbs" class="flex gap-2 p-3 overflow-x-auto"></div>
      </div>
      <p class="text-xs opacity-60 mt-2">Kliknutím na fotku alebo video otvoríš zväčšenie na celú obrazovku.</p>
    </div>

    <div class="md:col-span-2 space-y-4">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="badge badge-cat">${cat.icon} ${cat.label}</span>
        ${season ? `<span class="badge badge-cat">${season.icon} ${season.label}</span>` : ''}
        ${tod ? `<span class="badge badge-cat">${tod.icon} ${tod.label}</span>` : ''}
        ${p.badges && p.badges.length ? `<span class="badge badge-winner">🏆 Víťaz týždňa</span>` : ''}
        ${p.visibility === 'shortcut' ? `<span class="badge badge-shortcut">⚡ Shortcut</span>` : ''}
      </div>

      <h1 class="text-2xl font-extrabold">${escapeHtml(p.title || '(bez názvu)')}</h1>

      <div class="flex items-center justify-between gap-2 flex-wrap surface-card p-3">
        <a href="#/profile/${encodeURIComponent(p.author)}" class="font-semibold text-forest dark:text-moss hover:underline">
          👤 ${escapeHtml(p.author)}
        </a>
        ${u && !isOwner ? `
          <button onclick="toggleFollow('${escapeHtml(p.author)}')" class="${followingAuthor ? 'btn-ghost text-xs py-1.5 px-3' : 'btn-primary text-xs py-1.5 px-3'}">
            ${followingAuthor ? '✓ Sledujem' : requestedAuthor ? '⏳ Požiadané' : '+ Sledovať'}
          </button>
        ` : ''}
      </div>

      ${p.description ? `<p class="text-sm leading-relaxed opacity-90">${escapeHtml(p.description)}</p>` : ''}

      <div class="surface-card p-3.5 space-y-1.5 text-sm">
        ${p.species ? `<div>🌿 <strong>Druh:</strong> ${escapeHtml(p.species)}</div>` : ''}
        ${p.sensitiveLocation
        ? `<div class="p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-950/50 border border-amber-400/50 text-amber-900 dark:text-amber-200 text-xs">
                 ⚠️ <strong>Citlivá lokalita:</strong> Presná poloha je z dôvodu ochrany prírody skrytá${p.location ? ` (Širšia oblasť: ${escapeHtml(p.location.split(',')[0])})` : ''}.
               </div>`
        : (p.location ? `<div>📍 <strong>Lokalita:</strong> ${escapeHtml(p.location)} ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" class="text-forest dark:text-moss underline ml-1">Mapa ↗</a>` : ''}</div>` : '')}
        ${p.device ? `<div>📷 <strong>Zariadenie:</strong> ${escapeHtml(p.device)}</div>` : ''}
        ${p.cameraSettings ? `<div>⚙️ <strong>Nastavenia:</strong> ${escapeHtml(p.cameraSettings)}</div>` : ''}
        ${p.visibility === 'shortcut' && (p.allowedUsers || []).length ? `<div>⚡ <strong>Zdieľané pre:</strong> ${(p.allowedUsers || []).map(x => '@' + escapeHtml(x)).join(', ')}</div>` : ''}
        <div class="text-xs opacity-60 pt-1">Publikované: ${fmtDate(p.createdAt)}</div>
      </div>

      ${(p.tags || []).length ? `
        <div class="flex flex-wrap gap-1.5">
          ${p.tags.map(t => `<button type="button" onclick="searchByTag('${escapeHtml(t)}')" class="chip text-xs py-1 px-2.5">#${escapeHtml(t)}</button>`).join('')}
        </div>
      ` : ''}

      <div class="flex items-center gap-2 flex-wrap pt-1">
        <button onclick="toggleLike('${p.id}')" class="icon-btn ${liked ? 'active' : ''}" ${!canLike ? 'disabled title="Vlastný príspevok nemožno lajkovať"' : ''}>
          ❤️ <span>${p.likes?.length || 0}</span>
        </button>
        <button onclick="toggleSave('${p.id}')" class="icon-btn ${saved ? 'active' : ''}">
          🔖 <span>${saved ? 'Uložené' : 'Uložiť'}</span>
        </button>
        <span class="icon-btn cursor-default">👁️ <span>${p.views || 0}</span></span>
        ${u && !isOwner ? `<button onclick="openReportModal('${p.id}')" class="icon-btn">🚩 Nahlásiť</button>` : ''}
        ${isOwner ? `<a href="#/edit/${p.id}" class="icon-btn">✏️ Upraviť</a>` : ''}
        ${isOwner || isAdmin() ? `<button onclick="deletePost('${p.id}')" class="icon-btn text-red-600">🗑️ Zmazať</button>` : ''}
      </div>

      <div class="surface-card p-4 space-y-3">
        <h3 class="font-bold text-sm">💬 Komentáre (${p.comments?.length || 0})</h3>
        ${u ? `
          <form id="commentForm" class="flex gap-2">
            <input id="commentInput" required maxlength="400" placeholder="Napíš komentár..." class="field text-sm">
            <button type="submit" class="btn-primary text-sm">Odoslať</button>
          </form>
        ` : `<p class="text-xs opacity-65"><a href="#/login" class="underline text-forest dark:text-moss">Prihlás sa</a> pre pridanie komentára.</p>`}
        <div class="space-y-2 max-h-64 overflow-y-auto">
          ${(p.comments || []).length === 0
        ? `<p class="text-xs opacity-60">Zatiaľ žiadne komentáre.</p>`
        : (p.comments || []).map(c => `
                <div class="p-2.5 rounded-xl bg-cream/70 dark:bg-nightbg text-xs">
                  <div class="flex justify-between font-semibold mb-0.5">
                    <a href="#/profile/${encodeURIComponent(c.author)}" class="text-forest dark:text-moss">@${escapeHtml(c.author)}</a>
                    <span class="opacity-50 font-normal">${fmtDate(c.createdAt)}</span>
                  </div>
                  <p>${escapeHtml(c.text)}</p>
                </div>
              `).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

async function hydratePostMedia(postId) {
    const p = DB.posts().find(x => x.id === postId);
    if (!p) return;
    currentDetailMedia = await resolveMediaList(p.media || []);
    currentDetailTitle = p.title || '';
    const gallery = document.getElementById('gallery');
    const thumbs = document.getElementById('galleryThumbs');
    if (!gallery) return;

    if (!currentDetailMedia.length) {
        gallery.innerHTML = `<span class="opacity-60">Žiadne médium</span>`;
        return;
    }

    renderDetailMainSlide(0);
    if (thumbs && currentDetailMedia.length > 1) {
        thumbs.innerHTML = currentDetailMedia.map((m, i) => `
          <div onclick="event.stopPropagation(); renderDetailMainSlide(${i})"
               class="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-forest">
            ${m.isVideo
            ? `<video src="${m.dataUrl}" class="w-full h-full object-cover" muted></video>`
            : `<img src="${m.dataUrl}" class="w-full h-full object-cover" alt="">`}
          </div>
        `).join('');
    }
}

function renderDetailMainSlide(index) {
    const gallery = document.getElementById('gallery');
    const item = currentDetailMedia[index];
    if (!gallery || !item) return;
    gallery.onclick = () => openLightbox(currentDetailMedia, index, currentDetailTitle);
    gallery.innerHTML = item.isVideo
        ? `<video src="${item.dataUrl}" controls class="w-full h-full object-contain" onclick="event.stopPropagation()"></video>`
        : `<img src="${item.dataUrl}" class="w-full h-full object-contain" alt="">`;
}

function toggleLike(postId) {
    if (!requireLogin()) return;
    const u = currentUser();
    const posts = DB.posts();
    const p = posts.find(x => x.id === postId);
    if (!p || p.author === u.username) return;
    p.likes = p.likes || [];
    const idx = p.likes.findIndex(l => l.username === u.username);
    if (idx >= 0) {
        p.likes.splice(idx, 1);
    } else {
        p.likes.push({ username: u.username, at: nowISO() });
        pushNotification(p.author, `@${u.username} označil/a „${p.title}“ ako páči sa mi ❤️`, `#/post/${p.id}`);
    }
    DB.savePosts(posts);
    router();
}

function toggleSave(postId) {
    if (!requireLogin()) return;
    const u = currentUser();
    const users = DB.users();
    const target = users.find(x => x.username === u.username);
    target.savedPostIds = target.savedPostIds || [];
    const idx = target.savedPostIds.indexOf(postId);
    if (idx >= 0) {
        target.savedPostIds.splice(idx, 1);
        toast('Odstránené z uložených.');
    } else {
        target.savedPostIds.push(postId);
        toast('Uložené do záložiek.');
    }
    DB.saveUsers(users);
    router();
}

function addComment(postId) {
    if (!requireLogin()) return;
    const inp = document.getElementById('commentInput');
    const text = inp.value.trim();
    if (!text) return;
    const u = currentUser();
    const posts = DB.posts();
    const p = posts.find(x => x.id === postId);
    if (!p) return;
    p.comments = p.comments || [];
    p.comments.push({ id: uid(), author: u.username, text, createdAt: nowISO() });
    DB.savePosts(posts);
    pushNotification(p.author, `@${u.username} okomentoval/a „${p.title}“ 💬`, `#/post/${p.id}`);
    toast('Komentár pridaný.');
    router();
}

function deletePost(postId) {
    confirmAction('Naozaj chceš zmazať tento príspevok?', () => {
        const posts = DB.posts();
        const p = posts.find(x => x.id === postId);
        if (!p) return;
        p.deleted = true;
        DB.savePosts(posts);
        toast('Príspevok bol zmazaný.');
        location.hash = '#/home';
    });
}

/* ------------------------------- REPORT MODAL ------------------------------- */
let reportingPostId = null;

function openReportModal(postId) {
    if (!requireLogin()) return;
    reportingPostId = postId;
    document.getElementById('reportReasons').innerHTML = REPORT_REASONS.map((r, i) => `
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="radio" name="repReason" value="${escapeHtml(r)}" ${i === 0 ? 'checked' : ''}>
        <span>${escapeHtml(r)}</span>
      </label>
    `).join('');
    document.getElementById('reportNote').value = '';
    openModal('reportModal');
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme(DB.theme());
    seedData();
    router();

    document.getElementById('reportForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!reportingPostId || !requireLogin()) return;
        const reason = document.querySelector('input[name="repReason"]:checked')?.value || 'Iné';
        const note = document.getElementById('reportNote').value.trim();
        const posts = DB.posts();
        const p = posts.find(x => x.id === reportingPostId);
        if (p) {
            p.reports = p.reports || [];
            p.reports.push({
                id: uid(),
                by: currentUser().username,
                reason,
                note,
                createdAt: nowISO()
            });
            DB.savePosts(posts);
        }
        closeModal('reportModal');
        toast('Hlásenie bolo odoslané administrátorovi.');
    });
});

window.addEventListener('hashchange', router);

/* ------------------------------- UPLOAD & EDIT ------------------------------- */
let pendingMedia = [];

function renderVisibilityAndShortcutPicker(selectedVis = 'public', selectedUsers = []) {
    const u = currentUser();
    const otherUsers = DB.users().filter(x => x.username !== u.username && !x.banned);
    const shortcutPreset = u.shortcutGroup || [];

    return `
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="lbl">Viditeľnosť príspevku</label>
          <select id="postVisibility" onchange="toggleShortcutBox()" class="field">
            <option value="public" ${selectedVis === 'public' ? 'selected' : ''}>🌍 Verejné (všetci)</option>
            <option value="members" ${selectedVis === 'members' ? 'selected' : ''}>🔐 Len prihlásení</option>
            <option value="followers" ${selectedVis === 'followers' ? 'selected' : ''}>💚 Len sledovatelia</option>
            <option value="shortcut" ${selectedVis === 'shortcut' ? 'selected' : ''}>⚡ Shortcut (iba vybraní ľudia)</option>
          </select>
        </div>
        <div id="shortcutQuickBtnWrap" class="${selectedVis === 'shortcut' ? '' : 'hidden'} flex items-end">
          <button type="button" onclick="applySavedShortcutGroup()" class="btn-ghost text-xs w-full">
            ⚡ Použiť môj uložený Shortcut zoznam (${shortcutPreset.length})
          </button>
        </div>
      </div>

      <div id="shortcutUsersBox" class="${selectedVis === 'shortcut' ? '' : 'hidden'} surface-card p-3.5 space-y-2">
        <label class="lbl">Vyber používateľov (Snapchat Shortcut):</label>
        <div class="flex flex-wrap gap-2">
          ${otherUsers.length === 0
        ? `<p class="text-xs opacity-60">Zatiaľ nie sú zaregistrovaní žiadni ďalší používatelia.</p>`
        : otherUsers.map(ou => {
            const checked = selectedUsers.includes(ou.username);
            return `
                    <label class="chip text-xs ${checked ? 'active' : ''}">
                      <input type="checkbox" name="shortcutUser" value="${escapeHtml(ou.username)}" ${checked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('active', this.checked)" class="hidden">
                      <span>@${escapeHtml(ou.username)}</span>
                    </label>
                  `;
        }).join('')}
        </div>
      </div>
    `;
}

function toggleShortcutBox() {
    const vis = document.getElementById('postVisibility')?.value;
    const box = document.getElementById('shortcutUsersBox');
    const quick = document.getElementById('shortcutQuickBtnWrap');
    if (box) box.classList.toggle('hidden', vis !== 'shortcut');
    if (quick) quick.classList.toggle('hidden', vis !== 'shortcut');
}

function applySavedShortcutGroup() {
    const u = currentUser();
    const group = u?.shortcutGroup || [];
    document.querySelectorAll('input[name="shortcutUser"]').forEach(cb => {
        cb.checked = group.includes(cb.value);
        cb.parentElement.classList.toggle('active', cb.checked);
    });
    toast('Načítaný uložený Shortcut zoznam.');
}

function renderUpload() {
    if (!isLoggedIn()) {
        return `<div class="text-center py-16 space-y-3">
          <p class="text-lg">Pre pridanie príspevku sa musíš prihlásiť.</p>
          <a href="#/login" class="btn-primary">Prihlásiť sa</a>
        </div>`;
    }
    pendingMedia = [];

    return `
  <div class="max-w-2xl mx-auto surface-card p-6">
    <h1 class="text-2xl font-extrabold text-forest dark:text-moss mb-5">📷 Pridať nový záznam z prírody</h1>
    <form id="uploadForm" class="space-y-4">
      <div>
        <label class="lbl">Názov *</label>
        <input id="upTitle" required maxlength="120" placeholder="napr. Hmla na hrebeni Roháčov" class="field">
      </div>

      <div class="grid sm:grid-cols-3 gap-3">
        <div>
          <label class="lbl">Kategória *</label>
          <select id="upCategory" class="field">
            ${CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="lbl">Ročné obdobie</label>
          <select id="upSeason" class="field">
            <option value="">—</option>
            ${SEASONS.map(s => `<option value="${s.id}">${s.icon} ${s.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="lbl">Denná doba</label>
          <select id="upTod" class="field">
            <option value="">—</option>
            ${TIMES_OF_DAY.map(t => `<option value="${t.id}">${t.icon} ${t.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div>
        <label class="lbl">Fotky alebo krátke video (max. 20s)</label>
        <input id="upFiles" type="file" accept="image/*,video/*" multiple class="field">
        <div id="upPreview" class="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3"></div>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="lbl">Druh / rastlina / živočích</label>
          <input id="upSpecies" maxlength="100" placeholder="napr. Kamzík vrchovský" class="field">
        </div>
        <div>
          <label class="lbl">Lokalita</label>
          <input id="upLocation" maxlength="120" placeholder="napr. Západné Tatry" class="field">
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input id="upSensitive" type="checkbox" class="rounded">
        <span>⚠️ <strong>Citlivá lokalita</strong> (skryť presnú polohu kvôli ochrane prírody)</span>
      </label>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="lbl">Zariadenie</label>
          <input id="upDevice" maxlength="100" placeholder="napr. Sony A7IV / iPhone 15" class="field">
        </div>
        <div>
          <label class="lbl">EXIF / Nastavenia</label>
          <input id="upExif" maxlength="120" placeholder="napr. 70mm · f/5.6 · 1/500s · ISO 400" class="field">
        </div>
      </div>

      <div>
        <label class="lbl">Tagy (oddelené čiarkou alebo medzerou)</label>
        <input id="upTags" placeholder="napr. tatry, hmla, turistika" class="field">
      </div>

      <div>
        <label class="lbl">Popis príbehu</label>
        <textarea id="upDesc" rows="3" maxlength="1000" placeholder="Ako vznikol tento moment?" class="field"></textarea>
      </div>

      ${renderVisibilityAndShortcutPicker('public', [])}

      <div class="pt-2 flex justify-end gap-2">
        <a href="#/home" class="btn-ghost">Zrušiť</a>
        <button id="upSubmitBtn" type="submit" class="btn-primary">Zverejniť</button>
      </div>
    </form>
  </div>`;
}

function setupUploadForm() {
    const fileInp = document.getElementById('upFiles');
    if (fileInp) {
        fileInp.addEventListener('change', async () => {
            for (const file of Array.from(fileInp.files || [])) {
                if (file.type.startsWith('video/')) {
                    const dur = await getVideoDuration(file);
                    if (dur > 21) {
                        toast('Video môže mať maximálne 20 sekúnd.');
                        continue;
                    }
                    const dataUrl = await readVideoAsDataURL(file);
                    pendingMedia.push({ dataUrl, isVideo: true });
                } else if (file.type.startsWith('image/')) {
                    const dataUrl = await processImage(file);
                    pendingMedia.push({ dataUrl, isVideo: false });
                }
            }
            renderUploadPreview();
            fileInp.value = '';
        });
    }

    document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('upSubmitBtn');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Ukladám…`;

        const title = document.getElementById('upTitle').value.trim();
        const category = document.getElementById('upCategory').value;
        const season = document.getElementById('upSeason').value;
        const timeOfDay = document.getElementById('upTod').value;
        const species = document.getElementById('upSpecies').value.trim();
        const locationVal = document.getElementById('upLocation').value.trim();
        const sensitiveLocation = document.getElementById('upSensitive').checked;
        const device = document.getElementById('upDevice').value.trim();
        const cameraSettings = document.getElementById('upExif').value.trim();
        const tags = document.getElementById('upTags').value
            .split(/[\s,#]+/)
            .map(t => t.trim().toLowerCase())
            .filter(Boolean);
        const description = document.getElementById('upDesc').value.trim();
        const visibility = document.getElementById('postVisibility').value;
        const allowedUsers = Array.from(document.querySelectorAll('input[name="shortcutUser"]:checked')).map(cb => cb.value);

        if (visibility === 'shortcut' && allowedUsers.length === 0) {
            btn.disabled = false;
            btn.textContent = 'Zverejniť';
            return toast('Pri režime Shortcut vyber aspoň jedného používateľa.');
        }

        const storedMedia = [];
        for (const m of pendingMedia) {
            const mediaId = 'm_' + uid();
            await MediaStore.put(mediaId, m.dataUrl, m.isVideo);
            storedMedia.push({ mediaId, isVideo: m.isVideo });
        }

        const author = currentUser().username;
        const newPost = {
            id: uid(),
            author,
            title,
            category,
            season,
            timeOfDay,
            species,
            location: locationVal,
            sensitiveLocation,
            device,
            cameraSettings,
            tags,
            description,
            type: storedMedia.some(x => x.isVideo) ? 'video' : 'photo',
            media: storedMedia,
            visibility,
            allowedUsers,
            createdAt: nowISO(),
            likes: [],
            views: 0,
            viewedBy: [],
            comments: [],
            reports: [],
            hidden: false,
            deleted: false,
            badges: []
        };

        const posts = DB.posts();
        posts.unshift(newPost);
        DB.savePosts(posts);

        if (visibility === 'shortcut') {
            allowedUsers.forEach(targetUser => {
                pushNotification(targetUser, `@${author} s tebou zdieľal/a súkromný Shortcut príspevok „${title}“ ⚡`, `#/post/${newPost.id}`);
            });
        }

        pendingMedia = [];
        toast('Príspevok bol zverejnený!');
        location.hash = `#/post/${newPost.id}`;
    });
}

function renderUploadPreview() {
    const box = document.getElementById('upPreview');
    if (!box) return;
    box.innerHTML = pendingMedia.map((m, idx) => `
      <div class="thumb-wrap h-24 rounded-xl overflow-hidden border border-moss/40">
        ${m.isVideo ? `<video src="${m.dataUrl}" muted></video>` : `<img src="${m.dataUrl}" alt="">`}
        <button type="button" onclick="removePendingMedia(${idx})" class="thumb-remove">✕</button>
      </div>
    `).join('');
}

function removePendingMedia(idx) {
    pendingMedia.splice(idx, 1);
    renderUploadPreview();
}

function renderEditPost(id) {
    const u = currentUser();
    const p = DB.posts().find(x => x.id === id);
    if (!p || !u || (u.username !== p.author && !u.isAdmin)) return render404();

    return `
  <div class="max-w-xl mx-auto surface-card p-6">
    <h1 class="text-2xl font-extrabold text-forest dark:text-moss mb-4">✏️ Upraviť príspevok</h1>
    <form id="editForm" class="space-y-4">
      <div>
        <label class="lbl">Názov</label>
        <input id="edTitle" required value="${escapeHtml(p.title)}" class="field">
      </div>
      <div>
        <label class="lbl">Kategória</label>
        <select id="edCat" class="field">
          ${CATEGORIES.map(c => `<option value="${c.id}" ${p.category === c.id ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="lbl">Lokalita</label>
        <input id="edLoc" value="${escapeHtml(p.location || '')}" class="field">
      </div>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input id="edSensitive" type="checkbox" ${p.sensitiveLocation ? 'checked' : ''}>
        <span>⚠️ Citlivá lokalita</span>
      </label>
      <div>
        <label class="lbl">Tagy</label>
        <input id="edTags" value="${escapeHtml((p.tags || []).join(', '))}" class="field">
      </div>
      <div>
        <label class="lbl">Popis</label>
        <textarea id="edDesc" rows="3" class="field">${escapeHtml(p.description || '')}</textarea>
      </div>
      ${renderVisibilityAndShortcutPicker(p.visibility || 'public', p.allowedUsers || [])}
      <div class="flex justify-end gap-2">
        <a href="#/post/${p.id}" class="btn-ghost">Zrušiť</a>
        <button type="submit" class="btn-primary">Uložiť zmeny</button>
      </div>
    </form>
  </div>`;
}

function setupEditForm(id) {
    document.getElementById('editForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const posts = DB.posts();
        const p = posts.find(x => x.id === id);
        if (!p) return;
        p.title = document.getElementById('edTitle').value.trim();
        p.category = document.getElementById('edCat').value;
        p.location = document.getElementById('edLoc').value.trim();
        p.sensitiveLocation = document.getElementById('edSensitive').checked;
        p.tags = document.getElementById('edTags').value.split(/[\s,#]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
        p.description = document.getElementById('edDesc').value.trim();
        p.visibility = document.getElementById('postVisibility').value;
        p.allowedUsers = Array.from(document.querySelectorAll('input[name="shortcutUser"]:checked')).map(cb => cb.value);
        DB.savePosts(posts);
        toast('Zmeny uložené.');
        location.hash = `#/post/${p.id}`;
    });
}

/* ------------------------------- PROFILE & SAVED ------------------------------- */
function renderProfile(username) {
    const targetName = decodeURIComponent(username || currentUser()?.username || '');
    const user = DB.users().find(u => u.username === targetName);
    if (!user) return render404();

    const me = currentUser();
    const isMe = me && me.username === user.username;
    const posts = DB.posts().filter(p => p.author === user.username && canViewPost(p, me));
    const badges = getUserBadges(user.username);
    const followers = user.followers || [];
    const following = user.following || [];
    const requests = isMe ? (user.followRequests || []) : [];
    const allOtherUsers = DB.users().filter(x => x.username !== user.username && !x.banned);

    return `
  <div class="space-y-6">
    <section class="surface-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-forest text-white flex items-center justify-center font-extrabold text-xl">
          ${escapeHtml(user.avatar || user.username.slice(0, 2).toUpperCase())}
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-2xl font-extrabold">@${escapeHtml(user.username)}</h1>
            ${user.isPrivate ? `<span class="badge badge-cat">🔒 Súkromný profil</span>` : `<span class="badge badge-cat">🌍 Verejný profil</span>`}
            ${user.banned ? `<span class="badge bg-red-600 text-white">Zablokovaný</span>` : ''}
          </div>
          <p class="text-sm opacity-80 mt-1">${escapeHtml(user.bio || 'Milovník prírody a outdooru.')}</p>
          <div class="flex gap-4 text-xs font-semibold mt-2">
            <span><strong>${posts.length}</strong> príspevkov</span>
            <span><strong>${followers.length}</strong> sledovateľov</span>
            <span><strong>${following.length}</strong> sleduje</span>
          </div>
        </div>
      </div>

      <div class="flex gap-2 flex-wrap">
        ${me && !isMe ? `
          <button onclick="toggleFollow('${escapeHtml(user.username)}')" class="${isFollowing(user.username, me.username) ? 'btn-ghost' : 'btn-primary'}">
            ${isFollowing(user.username, me.username) ? '✓ Sledujem' : hasRequestedFollow(user.username, me.username) ? '⏳ Požiadané' : '+ Sledovať'}
          </button>
        ` : ''}
      </div>
    </section>

    ${isMe && requests.length > 0 ? `
      <section class="surface-card p-4 space-y-2">
        <h2 class="font-bold text-sm text-forest dark:text-moss">📩 Žiadosti o sledovanie (${requests.length})</h2>
        <div class="flex flex-wrap gap-2">
          ${requests.map(reqUser => `
            <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-cream dark:bg-nightbg text-xs">
              <span class="font-semibold">@${escapeHtml(reqUser)}</span>
              <button onclick="respondFollowRequest('${escapeHtml(reqUser)}', true)" class="btn-primary py-1 px-2.5 text-xs">Prijať</button>
              <button onclick="respondFollowRequest('${escapeHtml(reqUser)}', false)" class="btn-ghost py-1 px-2.5 text-xs">Zamietnuť</button>
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}

    ${isMe ? `
      <section class="grid md:grid-cols-2 gap-4">
        <form id="profileSettingsForm" class="surface-card p-5 space-y-3">
          <h2 class="font-bold text-forest dark:text-moss">⚙️ Nastavenia profilu</h2>
          <div>
            <label class="lbl">Bio</label>
            <textarea id="profBio" rows="2" class="field text-sm">${escapeHtml(user.bio || '')}</textarea>
          </div>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input id="profPrivate" type="checkbox" ${user.isPrivate ? 'checked' : ''}>
            <span>🔒 Súkromný účet (nových sledovateľov musím schváliť)</span>
          </label>
          <button type="submit" class="btn-primary text-sm">Uložiť nastavenia</button>
        </form>

        <form id="shortcutPresetForm" class="surface-card p-5 space-y-3">
          <h2 class="font-bold text-forest dark:text-moss">⚡ Môj Snapchat Shortcut zoznam</h2>
          <p class="text-xs opacity-70">Vyber ľudí, ktorým chceš rýchlo zdieľať exkluzívne príspevky.</p>
          <div class="flex flex-wrap gap-1.5">
            ${allOtherUsers.map(ou => {
        const checked = (user.shortcutGroup || []).includes(ou.username);
        return `
                  <label class="chip text-xs ${checked ? 'active' : ''}">
                    <input type="checkbox" name="presetShortcut" value="${escapeHtml(ou.username)}" ${checked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('active', this.checked)" class="hidden">
                    <span>@${escapeHtml(ou.username)}</span>
                  </label>
                `;
    }).join('')}
          </div>
          <button type="submit" class="btn-secondary text-sm">Uložiť Shortcut skupinu</button>
        </form>
      </section>
    ` : ''}

    <section class="surface-card p-5">
      <h2 class="font-bold text-forest dark:text-moss mb-3">🏅 Odznaky</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        ${badges.map(b => `
          <div class="p-3 rounded-xl border ${b.unlocked ? 'border-moss bg-moss/15 dark:bg-moss/10' : 'border-dashed opacity-45'}">
            <div class="text-2xl mb-1">${b.icon}</div>
            <div class="font-bold text-xs">${b.title}</div>
            <div class="text-[11px] opacity-75">${b.desc}</div>
          </div>
        `).join('')}
      </div>
    </section>

    <section>
      <h2 class="text-xl font-bold text-forest dark:text-moss mb-3">Príspevky používateľa</h2>
      ${posts.length === 0
        ? `<p class="opacity-60 text-sm">Zatiaľ žiadne viditeľné príspevky.</p>`
        : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${posts.map(postCard).join('')}</div>`}
    </section>
  </div>`;
}

function renderSaved() {
    if (!isLoggedIn()) {
        return `<div class="text-center py-16 space-y-3">
          <p class="text-lg">Pre zobrazenie uložených príspevkov sa prihlás.</p>
          <a href="#/login" class="btn-primary">Prihlásiť sa</a>
        </div>`;
    }
    const u = currentUser();
    const savedIds = u.savedPostIds || [];
    const posts = DB.posts().filter(p => savedIds.includes(p.id) && canViewPost(p, u));

    return `
  <div>
    <h1 class="text-2xl font-extrabold text-forest dark:text-moss mb-4">🔖 Uložené príspevky</h1>
    ${posts.length === 0
        ? `<p class="opacity-60">Zatiaľ nemáš uložené žiadne príspevky.</p>`
        : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${posts.map(postCard).join('')}</div>`}
  </div>`;
}

/* ------------------------------- WINNERS HALL ------------------------------- */
function renderWinners() {
    const winners = DB.winners().slice().sort((a, b) => b.week.localeCompare(a.week));
    const posts = DB.posts();

    return `
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 class="text-2xl font-extrabold text-forest dark:text-moss">🏆 Sieň slávy – Víťazi týždňa</h1>
        <p class="text-sm opacity-75">História týždenných vyhodnotení fotografií a videí.</p>
      </div>
      ${isAdmin() ? `<button onclick="simulateWeeklyEvaluation()" class="btn-secondary text-sm">Simulovať nedeľné vyhodnotenie</button>` : ''}
    </div>

    ${winners.length === 0
        ? `<div class="surface-card p-8 text-center opacity-70">Zatiaľ neprebehlo žiadne uzavreté týždenné vyhodnotenie.</div>`
        : winners.map(w => {
            const ids = [...(w.photoWinners || []), ...(w.videoWinners || [])];
            const wPosts = posts.filter(p => ids.includes(p.id) && !p.deleted);
            return `
              <section class="surface-card p-5 space-y-3">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <h2 class="font-bold text-lg">Týždeň od ${escapeHtml(w.week)}</h2>
                  <span class="text-xs opacity-60">Vyhodnotené: ${fmtDate(w.evaluatedAt)}</span>
                </div>
                ${wPosts.length === 0
                ? `<p class="text-xs opacity-60">Žiadne víťazné príspevky.</p>`
                : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${wPosts.map(postCard).join('')}</div>`}
              </section>
            `;
        }).join('')}
  </div>`;
}

/* ------------------------------- AUTH & RULES & ADMIN ------------------------------- */
function renderLogin() {
    return `
  <div class="max-w-md mx-auto surface-card p-6">
    <h1 class="text-2xl font-extrabold text-forest dark:text-moss mb-4">🔑 Prihlásenie</h1>
    <form id="loginForm" class="space-y-4">
      <div>
        <label class="lbl">Používateľské meno</label>
        <input id="loginUser" required class="field">
      </div>
      <div>
        <label class="lbl">Heslo</label>
        <input id="loginPass" type="password" required class="field">
      </div>
      <button type="submit" class="btn-primary w-full">Prihlásiť sa</button>
    </form>
    <p class="text-xs opacity-70 mt-4">Demo účty: <code>lucia_wild</code> alebo <code>marek_treky</code> (heslo <code>1234</code>).</p>
  </div>`;
}

function renderRegister() {
    return `
  <div class="max-w-md mx-auto surface-card p-6">
    <h1 class="text-2xl font-extrabold text-forest dark:text-moss mb-4">🌿 Registrácia</h1>
    <form id="registerForm" class="space-y-4">
      <div>
        <label class="lbl">Používateľské meno</label>
        <input id="regUser" required minlength="3" class="field">
      </div>
      <div>
        <label class="lbl">Heslo</label>
        <input id="regPass" type="password" required minlength="4" class="field">
      </div>
      <div>
        <label class="lbl">Bio</label>
        <textarea id="regBio" rows="2" class="field"></textarea>
      </div>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input id="regPrivate" type="checkbox">
        <span>🔒 Súkromný účet (schvaľovanie žiadostí o sledovanie)</span>
      </label>
      <button type="submit" class="btn-primary w-full">Vytvoriť účet</button>
    </form>
  </div>`;
}

function renderRules() {
    return `
  <div class="max-w-2xl mx-auto surface-card p-6 space-y-3">
    <h1 class="text-2xl font-extrabold text-forest dark:text-moss">📜 Pravidlá komunity NatureLog</h1>
    <ul class="list-disc pl-5 space-y-2 text-sm">
      <li>Zverejňuj iba vlastné fotografie a videá z prírody.</li>
      <li>Chráň citlivé lokality (hniezda, brlohy, vzácne rastliny) – použi prepínač <strong>Citlivá lokalita</strong>.</li>
      <li>Žiadne týranie zvierat, nenávistné prejavy ani spam.</li>
      <li>Rešpektuj súkromie ostatných členov (vrátane príspevkov zdieľaných cez Shortcut).</li>
    </ul>
  </div>`;
}

function renderAdmin() {
    if (!isAdmin()) return render404();
    const posts = DB.posts().filter(p => !p.deleted);
    const reported = posts.filter(p => (p.reports || []).length > 0);
    const users = DB.users().filter(u => !u.isAdmin);

    return `
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h1 class="text-2xl font-extrabold text-forest dark:text-moss">🛠️ Admin panel</h1>
      <button onclick="simulateWeeklyEvaluation()" class="btn-secondary text-sm">Spustiť týždenné vyhodnotenie</button>
    </div>

    <section class="surface-card p-5 space-y-3">
      <h2 class="font-bold text-lg">🚩 Nahlásené príspevky (${reported.length})</h2>
      ${reported.length === 0
        ? `<p class="text-sm opacity-60">Žiadne nahlásené príspevky.</p>`
        : reported.map(p => `
            <div class="p-3 rounded-xl bg-cream dark:bg-nightbg flex items-center justify-between gap-3 flex-wrap text-sm">
              <div>
                <a href="#/post/${p.id}" class="font-bold underline">${escapeHtml(p.title)}</a>
                <span class="text-xs opacity-70">od @${escapeHtml(p.author)} · Hlásení: ${p.reports.length}</span>
                <div class="text-xs text-red-600 dark:text-red-400 mt-1">
                  ${p.reports.map(r => `${escapeHtml(r.reason)}${r.note ? ` (${escapeHtml(r.note)})` : ''}`).join(' | ')}
                </div>
              </div>
              <div class="flex gap-2">
                <button onclick="adminToggleHide('${p.id}')" class="btn-ghost text-xs">${p.hidden ? 'Odkryť' : 'Skryť'}</button>
                <button onclick="deletePost('${p.id}')" class="btn-primary bg-red-600 hover:bg-red-700 text-xs">Zmazať</button>
              </div>
            </div>
          `).join('')}
    </section>

    <section class="surface-card p-5 space-y-3">
      <h2 class="font-bold text-lg">👥 Používatelia (${users.length})</h2>
      <div class="space-y-2">
        ${users.map(u => `
          <div class="p-3 rounded-xl bg-cream dark:bg-nightbg flex items-center justify-between gap-2 text-sm">
            <div>
              <strong>@${escapeHtml(u.username)}</strong>
              <span class="text-xs opacity-65 ml-2">${u.banned ? 'Zablokovaný' : 'Aktívny'}</span>
            </div>
            <button onclick="adminToggleBan('${escapeHtml(u.username)}')" class="btn-ghost text-xs">
              ${u.banned ? 'Odblokovať' : 'Zablokovať'}
            </button>
          </div>
        `).join('')}
      </div>
    </section>
  </div>`;
}

function adminToggleHide(postId) {
    const posts = DB.posts();
    const p = posts.find(x => x.id === postId);
    if (!p) return;
    p.hidden = !p.hidden;
    DB.savePosts(posts);
    toast(p.hidden ? 'Príspevok skrytý.' : 'Príspevok odkrytý.');
    router();
}

function adminToggleBan(username) {
    const users = DB.users();
    const u = users.find(x => x.username === username);
    if (!u) return;
    u.banned = !u.banned;
    DB.saveUsers(users);
    toast(u.banned ? `Používateľ @${username} zablokovaný.` : `Používateľ @${username} odblokovaný.`);
    router();
}

function render404() {
    return `<div class="text-center py-20 space-y-3">
      <h1 class="text-3xl font-extrabold">404</h1>
      <p class="opacity-70">Požadovaná stránka sa nenašla.</p>
      <a href="#/home" class="btn-primary">Späť na domov</a>
    </div>`;
}

document.addEventListener('submit', (e) => {
    if (e.target.id === 'profileSettingsForm') {
        e.preventDefault();
        const me = currentUser();
        if (!me) return;
        const users = DB.users();
        const target = users.find(x => x.username === me.username);
        target.bio = document.getElementById('profBio').value.trim();
        target.isPrivate = document.getElementById('profPrivate').checked;
        DB.saveUsers(users);
        toast('Nastavenia profilu uložené.');
        router();
    }
    if (e.target.id === 'shortcutPresetForm') {
        e.preventDefault();
        const me = currentUser();
        if (!me) return;
        const users = DB.users();
        const target = users.find(x => x.username === me.username);
        target.shortcutGroup = Array.from(document.querySelectorAll('input[name="presetShortcut"]:checked')).map(cb => cb.value);
        DB.saveUsers(users);
        toast('Shortcut skupina uložená.');
        router();
    }
});