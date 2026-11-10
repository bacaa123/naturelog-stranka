/* ============================ NatureLog – app.js ============================ */

const ADMIN_USERNAME = 'bacarasto';
const ADMIN_PASSWORD = '123654';

const CATEGORIES = [
    { id:'wildlife', label:'Wildlife', icon:'🦌' },
    { id:'hiking',   label:'Hiking & Trails', icon:'🥾' },
    { id:'mountains',label:'Mountains', icon:'⛰️' },
    { id:'forests',  label:'Forests', icon:'🌲' },
    { id:'water',    label:'Water', icon:'💧' },
    { id:'sky',      label:'Sky & Weather', icon:'🌤️' },
    { id:'plants',   label:'Plants & Fungi', icon:'🍄' },
    { id:'macro',    label:'Macro', icon:'🔬' }
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

/* ---------------------------- storage helpers ---------------------------- */
const DB = {
    users:   () => JSON.parse(localStorage.getItem('nl_users')   || '[]'),
    posts:   () => JSON.parse(localStorage.getItem('nl_posts')   || '[]'),
    winners: () => JSON.parse(localStorage.getItem('nl_winners') || '[]'),
    session: () => JSON.parse(localStorage.getItem('nl_session') || 'null'),
    saveUsers:   (v) => localStorage.setItem('nl_users', JSON.stringify(v)),
    savePosts:   (v) => localStorage.setItem('nl_posts', JSON.stringify(v)),
    saveWinners: (v) => localStorage.setItem('nl_winners', JSON.stringify(v)),
    saveSession: (v) => localStorage.setItem('nl_session', JSON.stringify(v)),
};

function getVisitorId() {
    let vid = localStorage.getItem('nl_visitor_id');
    if (!vid) {
        vid = 'anon_' + uid();
        localStorage.setItem('nl_visitor_id', vid);
    }
    return vid;
}

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function nowISO(){ return new Date().toISOString(); }
function fmtDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' +
        d.toLocaleTimeString('sk-SK',{hour:'2-digit',minute:'2-digit'});
}
function escapeHtml(s=''){
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function catInfo(id){ return CATEGORIES.find(c=>c.id===id) || {label:id, icon:'🌿'}; }

function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._toastT);
    window._toastT = setTimeout(()=> t.classList.remove('show'), 2600);
}

function openModal(id){ document.getElementById(id).classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }

function confirmAction(text, onYes){
    document.getElementById('confirmText').textContent = text;
    const btn = document.getElementById('confirmYesBtn');
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', ()=>{ closeModal('confirmModal'); onYes(); });
    openModal('confirmModal');
}

/* ------------------------------- auth ------------------------------- */
function currentUser(){
    const s = DB.session();
    if(!s) return null;
    return DB.users().find(u=>u.username===s.username) || null;
}
function isLoggedIn(){ return !!currentUser(); }
function isAdmin(){ const u = currentUser(); return !!(u && u.isAdmin); }

function requireLogin(){
    if(!isLoggedIn()){
        toast('Musíš byť prihlásený/á.');
        location.hash = '#/login';
        return false;
    }
    return true;
}

function register(username, password, bio){
    username = username.trim();
    if(username.length < 3) return toast('Meno musí mať aspoň 3 znaky.');
    if(password.length < 4) return toast('Heslo musí mať aspoň 4 znaky.');
    if(username.toLowerCase() === ADMIN_USERNAME) return toast('Toto meno je rezervované.');
    const users = DB.users();
    if(users.some(u=>u.username.toLowerCase()===username.toLowerCase())) return toast('Toto meno už existuje.');
    const user = {
        username, password, bio: bio||'', avatar: username.slice(0,2).toUpperCase(),
        joined: nowISO(), banned:false, isAdmin:false, savedPostIds: []
    };
    users.push(user); DB.saveUsers(users);
    DB.saveSession({username});
    toast('Registrácia úspešná! Vitaj, '+username+'.');
    location.hash = '#/home';
}

function login(username, password){
    username = username.trim();
    if(username.toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD){
        let users = DB.users();
        let admin = users.find(u=>u.username.toLowerCase()===ADMIN_USERNAME);
        if(!admin){
            admin = { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, bio:'Administrátor NatureLog',
                avatar:'AD', joined: nowISO(), banned:false, isAdmin:true, savedPostIds: [] };
            users.push(admin); DB.saveUsers(users);
        }
        DB.saveSession({username: admin.username});
        toast('Prihlásený ako administrátor.');
        location.hash = '#/home';
        return;
    }
    const users = DB.users();
    const user = users.find(u=>u.username.toLowerCase()===username.toLowerCase() && u.password===password);
    if(!user) return toast('Nesprávne meno alebo heslo.');
    if(user.banned) return toast('Tento účet bol zablokovaný.');
    DB.saveSession({username:user.username});
    toast('Vitaj späť, '+user.username+'!');
    location.hash = '#/home';
}

function logout(){
    DB.saveSession(null);
    toast('Boli ste odhlásený/á.');
    location.hash = '#/home';
}

/* ------------------------------- image processing ------------------------------- */
function processImage(file, maxDim=1280, quality=0.82){
    return new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                let {width,height} = img;
                if(width > maxDim || height > maxDim){
                    if(width > height){ height = Math.round(height * (maxDim/width)); width = maxDim; }
                    else { width = Math.round(width * (maxDim/height)); height = maxDim; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
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

function readVideoAsDataURL(file){
    return new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getVideoDuration(file){
    return new Promise((resolve)=>{
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
        v.onerror = () => resolve(0);
        v.src = url;
    });
}

/* ------------------------------- week / winners logic ------------------------------- */
function getWeekRange(d = new Date()){
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(date); monday.setHours(0,0,0,0); monday.setDate(date.getDate() - day);
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6); sunday.setHours(23,59,59,999);
    return { start: monday, end: sunday, key: monday.toISOString().slice(0,10) };
}

function computeWeekLeaders(range){
    const posts = DB.posts().filter(p=>!p.deleted && !p.hidden);
    const scored = (type) => {
        let best = []; let bestCount = 0;
        posts.filter(p=>p.type===type).forEach(p=>{
            const count = (p.likes||[]).filter(l=>{
                const t = new Date(l.at).getTime();
                return t >= range.start.getTime() && t <= range.end.getTime();
            }).length;
            if(count > 0 && count > bestCount){ bestCount = count; best = [p]; }
            else if(count > 0 && count === bestCount){ best.push(p); }
        });
        return { posts: best, count: bestCount };
    };
    return { photo: scored('photo'), video: scored('video') };
}

function simulateWeeklyEvaluation(){
    const range = getWeekRange();
    const leaders = computeWeekLeaders(range);
    const posts = DB.posts();
    [...leaders.photo.posts, ...leaders.video.posts].forEach(winnerPost=>{
        const p = posts.find(x=>x.id===winnerPost.id);
        if(!p) return;
        p.badges = p.badges || [];
        if(!p.badges.some(b=>b.week===range.key)) p.badges.push({week:range.key, type:p.type});
    });
    DB.savePosts(posts);
    const winners = DB.winners();
    const idx = winners.findIndex(w=>w.week===range.key);
    const record = {
        week: range.key,
        photoWinners: leaders.photo.posts.map(p=>p.id),
        videoWinners: leaders.video.posts.map(p=>p.id),
        evaluatedAt: nowISO()
    };
    if(idx>=0) winners[idx] = record; else winners.push(record);
    DB.saveWinners(winners);
    toast('Nedeľné vyhodnotenie prebehlo: '+(leaders.photo.posts.length+leaders.video.posts.length)+' víťazov tento týždeň.');
    router();
}

/* ------------------------------- seed demo data ------------------------------- */
function seedData(){
    if(DB.users().length === 0){
        const demoUsers = [
            { username:'lucia_wild', password:'1234', bio:'Fotografka divočiny z Tatier.', avatar:'LW', joined:nowISO(), banned:false, isAdmin:false, savedPostIds:[] },
            { username:'marek_treky', password:'1234', bio:'Turistika a krajinky.', avatar:'MT', joined:nowISO(), banned:false, isAdmin:false, savedPostIds:[] }
        ];
        DB.saveUsers(demoUsers);
    }
    if(DB.posts().length === 0){
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
            { title:'Jeleň pri východe slnka', category:'wildlife', author:'lucia_wild', species:'Jeleň lesný', tags:['jeleň','ráno','tatry'], location:'Tatranská Lomnica', device:'Canon R6' , description:'Ranné stretnutie priamo pri chate.' },
            { title:'Výstup na Rysy', category:'hiking', author:'marek_treky', species:'', tags:['túra','rysy','hory'], location:'Rysy, Vysoké Tatry', device:'iPhone 14', description:'Náročný ale krásny výstup.' },
            { title:'Hmla nad dolinou', category:'mountains', author:'lucia_wild', species:'', tags:['hmla','dolina'], location:'Tichá dolina', device:'Sony A7III', description:'Ráno plné hmly.' },
            { title:'Mach v lese', category:'forests', author:'marek_treky', species:'', tags:['les','mach'], location:'Malá Fatra', device:'Nikon D750', description:'Detail machu po daždi.' },
            { title:'Vodopád Skok', author:'lucia_wild', category:'water', species:'', tags:['vodopád'], location:'Vodopád Skok', device:'Canon R6', description:'Jarný prietok po topení snehu.' },
            { title:'Dúha po búrke', author:'marek_treky', category:'sky', species:'', tags:['dúha','búrka'], location:'Liptov', device:'iPhone 14', description:'Krátka ale intenzívna dúha.' },
            { title:'Muchotrávka červená', author:'lucia_wild', category:'plants', species:'Muchotrávka červená', tags:['huba','les'], location:'Malá Fatra', device:'Nikon D750', description:'Klasika jesenného lesa.' },
            { title:'Kvapka rosy na pavučine', author:'marek_treky', category:'macro', species:'', tags:['makro','rosa'], location:'', device:'Canon R6 + makro objektív', description:'Ranná rosa pri východe slnka.' }
        ];
        const posts = demo.map(d => ({
            id: uid(),
            author: d.author,
            title: d.title,
            category: d.category,
            location: d.location || '',
            device: d.device || '',
            species: d.species || '',
            tags: d.tags || [],
            description: d.description || '',
            type: 'photo',
            media: [{ dataUrl: photoUrls[d.category], isVideo:false }],
            visibility: 'public',
            createdAt: new Date(Date.now() - Math.random()*7*24*3600*1000).toISOString(),
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
function renderNavbar(){
    const path = (location.hash || '#/home').split('/')[1] || 'home';
    const u = currentUser();
    const nav = document.getElementById('navbar');
    const links = [
        {href:'#/home', icon:'🏡', label:'Domov', key:'home'},
        {href:'#/upload', icon:'📷', label:'Pridať', key:'upload'},
        {href:'#/saved', icon:'🔖', label:'Uložené', key:'saved'},
    ];
    nav.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <a href="#/home" class="flex items-center gap-2 font-extrabold text-xl text-forest">
        🌿 Nature<span class="text-sunset">Log</span>
      </a>
      <div class="flex items-center gap-1 flex-wrap">
        ${links.map(l=>`<a href="${l.href}" class="nav-link ${path===l.key?'active':''}">${l.icon} <span class="hidden sm:inline">${l.label}</span></a>`).join('')}
        ${u && u.isAdmin ? `<a href="#/admin" class="nav-link ${path==='admin'?'active':''}">🛠️ <span class="hidden sm:inline">Admin</span></a>` : ''}
        ${u ? `<a href="#/profile/${u.username}" class="nav-link ${path==='profile'?'active':''}">👤 <span class="hidden sm:inline">${escapeHtml(u.username)}</span></a>
               <button onclick="logout()" class="nav-link">🚪 <span class="hidden sm:inline">Odhlásiť</span></button>`
        : `<a href="#/login" class="nav-link ${path==='login'?'active':''}">🔑 <span class="hidden sm:inline">Prihlásiť</span></a>
               <a href="#/register" class="btn-primary ml-1">Registrácia</a>`}
      </div>
    </div>`;
}

/* ------------------------------- router ------------------------------- */
function parseHash(){
    const h = (location.hash || '#/home').replace(/^#\//,'');
    const parts = h.split('/');
    return { page: parts[0]||'home', param: parts[1] };
}

function router(){
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
        login: renderLogin,
        register: renderRegister,
        rules: renderRules,
        admin: renderAdmin,
    };
    const fn = pages[page] || render404;
    app.innerHTML = fn();
    window.scrollTo({top:0, behavior:'smooth'});
    afterRender(page, param);
}

function afterRender(page, param){}

/* ------------------------------- HOME ------------------------------- */
let homeFilters = { q:'', category:'', type:'', sort:'newest' };

function renderHome(){
    const u = currentUser();
    let posts = DB.posts().filter(p=>!p.deleted && !p.hidden);
    if(!u) posts = posts.filter(p=>p.visibility==='public');

    const range = getWeekRange();
    const leaders = computeWeekLeaders(range);
    const winnerCards = [...leaders.photo.posts, ...leaders.video.posts];

    const { q, category, type, sort } = homeFilters;
    let filtered = posts.filter(p=>{
        const matchesQ = !q || [p.title,p.description,p.species,p.location,...(p.tags||[])].join(' ').toLowerCase().includes(q.toLowerCase());
        const matchesCat = !category || p.category===category;
        const matchesType = !type || p.type===type;
        return matchesQ && matchesCat && matchesType;
    });
    if(sort==='newest') filtered.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
    if(sort==='liked') filtered.sort((a,b)=> b.likes.length-a.likes.length);
    if(sort==='viewed') filtered.sort((a,b)=> (b.views||0)-(a.views||0));

    return `
  <section class="rounded-3xl bg-gradient-to-br from-forest to-deepforest text-white px-6 py-14 text-center mb-8 shadow-lg">
    <h1 class="text-3xl sm:text-5xl font-extrabold mb-2">🌿 Nature<span class="text-sunset">Log</span></h1>
    <p class="text-moss text-lg mb-6 italic">Log your wild moments.</p>
    <div class="max-w-xl mx-auto">
      <input id="searchInput" value="${escapeHtml(q)}" placeholder="Hľadať podľa názvu, tagu, druhu, lokality..."
        class="w-full rounded-full px-5 py-3 text-deepforest focus:outline-none focus:ring-4 focus:ring-sunset/40">
    </div>
  </section>

  <section class="mb-6 flex flex-wrap gap-2 justify-center">
    ${CATEGORIES.map(c=>`
      <div class="chip ${category===c.id?'active':''}" onclick="setCategoryFilter('${c.id}')">${c.icon} ${c.label}</div>
    `).join('')}
  </section>

  <section class="mb-10">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xl font-bold text-forest">🏆 Tento týždeň vyhrávajú (live)</h2>
      ${isAdmin() ? `<button onclick="simulateWeeklyEvaluation()" class="btn-secondary text-sm">Simulovať nedeľné vyhodnotenie (18:00)</button>` : ''}
    </div>
    ${winnerCards.length === 0
        ? `<p class="text-deepforest/60 text-sm">Zatiaľ žiadne lajky tento týždeň. Buď prvý, kto niekoho podporí!</p>`
        : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${winnerCards.map(postCard).join('')}</div>`}
  </section>

  <section>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 class="text-xl font-bold text-forest">Najnovšie príspevky</h2>
      <div class="flex gap-2 flex-wrap">
        <select id="typeFilter" class="field w-auto text-sm">
          <option value="" ${type===''?'selected':''}>Všetky typy</option>
          <option value="photo" ${type==='photo'?'selected':''}>📷 Foto</option>
          <option value="video" ${type==='video'?'selected':''}>🎥 Video</option>
        </select>
        <select id="sortFilter" class="field w-auto text-sm">
          <option value="newest" ${sort==='newest'?'selected':''}>Najnovšie</option>
          <option value="liked" ${sort==='liked'?'selected':''}>Najviac lajkov</option>
          <option value="viewed" ${sort==='viewed'?'selected':''}>Najviac zobrazení</option>
        </select>
      </div>
    </div>
    ${filtered.length===0
        ? `<p class="text-deepforest/60">Nenašli sa žiadne príspevky.</p>`
        : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${filtered.map(postCard).join('')}</div>`}
  </section>`;
}

function setCategoryFilter(id){
    homeFilters.category = homeFilters.category===id ? '' : id;
    router();
}

function postCard(p){
    const cat = catInfo(p.category);
    const cover = p.media && p.media[0];
    const author = DB.users().find(u=>u.username===p.author);
    const winBadge = (p.badges && p.badges.length) ? `<span class="badge badge-winner">🏆 Víťaz týždňa</span>` : '';
    return `
  <a href="#/post/${p.id}" class="post-card flex flex-col">
    <div class="thumb-wrap h-40 bg-moss/30">
      ${cover ? (cover.isVideo ? `<video src="${cover.dataUrl}" muted></video>` : `<img src="${cover.dataUrl}" alt="">`) : ''}
    </div>
    <div class="p-3 flex-1 flex flex-col gap-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="badge badge-cat">${cat.icon} ${cat.label}</span>
        ${winBadge}
      </div>
      <h3 class="font-semibold text-sm text-deepforest truncate">${escapeHtml(p.title || '(bez názvu)')}</h3>
      <p class="text-xs text-deepforest/60">👤 ${escapeHtml(p.author)}${author && author.banned ? ' (zablokovaný)' : ''}</p>
      <div class="flex items-center gap-3 text-xs text-deepforest/70 mt-auto pt-1">
        <span>❤️ ${p.likes.length}</span>
        <span>💬 ${p.comments.length}</span>
        <span>👁️ ${p.views || 0}</span>
      </div>
    </div>
  </a>`;
}

/* ------------------------------- POST DETAIL ------------------------------- */
function renderPostDetail(id){
    const posts = DB.posts();
    const p = posts.find(x=>x.id===id);
    if(!p || p.deleted) return render404();
    const u = currentUser();
    if(p.hidden && !(u && u.isAdmin)) return `<div class="text-center py-20"><p class="text-xl">Tento príspevok nie je dostupný.</p></div>`;
    if(p.visibility==='members' && !u) return `<div class="text-center py-20"><p class="text-xl">Tento príspevok je len pre prihlásených používateľov. <a href="#/login" class="text-forest underline">Prihlásiť sa</a></p></div>`;

    // LOGIKA UNIKÁTNEHO ZHLIADNUTIA:
    const viewerId = u ? u.username : getVisitorId();
    p.viewedBy = p.viewedBy || [];
    if (!p.viewedBy.includes(viewerId)) {
        p.viewedBy.push(viewerId);
        p.views = p.viewedBy.length;
        DB.savePosts(posts);
    }

    const cat = catInfo(p.category);
    const author = DB.users().find(x=>x.username===p.author);
    const liked = u && p.likes.some(l=>l.username===u.username);
    const canLike = u && u.username !== p.author;
    const saved = u && u.savedPostIds && u.savedPostIds.includes(p.id);
    const mapsUrl = p.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.location)}` : '';
    const isOwner = u && u.username===p.author;

    return `
  <div class="grid md:grid-cols-5 gap-6">
    <div class="md:col-span-3">
      <div class="rounded-2xl overflow-hidden bg-deepforest/5 border border-moss/30">
        <div id="gallery" class="aspect-[4/3] bg-black/5 flex items-center justify-center overflow-hidden">
          ${p.media[0].isVideo ? `<video src="${p.media[0].dataUrl}" controls class="w-full h-full object-contain"></video>` : `<img src="${p.media[0].dataUrl}" class="w-full h-full object-contain" id="mainMedia">`}
        </div>
        ${p.media.length>1 ? `<div class="flex gap-2 p-3 overflow-x-auto">
          ${p.media.map((m,i)=>`<div class="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-forest" onclick="switchMedia('${p.id}',${i})">
            ${m.isVideo?`<video src="${m.dataUrl}" class="w-full h-full object-cover" muted></video>`:`<img src="${m.dataUrl}" class="w-full h-full object-cover">`}
          </div>`).join('')}
        </div>` : ''}
      </div>
    </div>

    <div class="md:col-span-2 space-y-4">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="badge badge-cat">${cat.icon} ${cat.label}</span>
        ${p.badges && p.badges.length ? `<span class="badge badge-winner">🏆 Víťaz týždňa ×${p.badges.length}</span>` : ''}
        ${p.visibility==='members' ? `<span class="badge bg-sunset/20 text-sunset">Len pre prihlásených</span>` : ''}
      </div>
      <h1 class="text-2xl font-bold text-deepforest">${escapeHtml(p.title || '(bez názvu)')}</h1>

      <a href="#/profile/${p.author}" class="flex items-center gap-2 group">
        <div class="w-9 h-9 rounded-full bg-forest text-white flex items-center justify-center font-bold text-sm">${author?author.avatar:'??'}</div>
        <div>
          <p class="text-sm font-semibold group-hover:text-forest">${escapeHtml(p.author)}</p>
          <p class="text-xs text-deepforest/50">${fmtDate(p.createdAt)}</p>
        </div>
      </a>

      <p class="text-sm text-deepforest/80 whitespace-pre-line">${escapeHtml(p.description)}</p>

      <div class="text-sm space-y-1 text-deepforest/70">
        ${p.species ? `<p>🐾 <strong>Druh:</strong> ${escapeHtml(p.species)}</p>` : ''}
        ${p.device ? `<p>📷 <strong>Zariadenie:</strong> ${escapeHtml(p.device)}</p>` : ''}
        ${p.location ? `<p>📍 <strong>Oblasť:</strong> ${escapeHtml(p.location)} — <a href="${mapsUrl}" target="_blank" class="text-forest underline">Zobraziť na Google Maps</a></p>` : ''}
      </div>

      ${p.tags && p.tags.length ? `<div class="flex flex-wrap gap-2">
        ${p.tags.map(t=>`<span class="chip" onclick="searchTag('${escapeHtml(t)}')">#${escapeHtml(t)}</span>`).join('')}
      </div>` : ''}

      <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-moss/30">
        <button class="icon-btn ${liked?'active':''}" onclick="toggleLike('${p.id}')" ${!canLike?'disabled title="Nemôžeš lajkovať vlastný alebo bez prihlásenia"':''}>
          ❤️ ${p.likes.length}
        </button>
        <button class="icon-btn ${saved?'active':''}" onclick="toggleSave('${p.id}')">🔖 ${saved?'Uložené':'Uložiť'}</button>
        <button class="icon-btn" onclick="sharePost('${p.id}')">🔗 Zdieľať</button>
        <button class="icon-btn" onclick="openReportModal('${p.id}')">🚩 Nahlásiť</button>
        ${isOwner ? `<a href="#/edit/${p.id}" class="icon-btn">✏️ Upraviť</a>
          <button class="icon-btn" onclick="deletePostAction('${p.id}')">🗑️ Vymazať</button>` : ''}
        <span class="icon-btn" style="cursor:default">👁️ ${p.views} zobrazení</span>
      </div>

      <div class="pt-4 border-t border-moss/30">
        <h3 class="font-semibold mb-2 text-deepforest">Komentáre (${p.comments.length})</h3>
        <div class="space-y-3 max-h-72 overflow-y-auto pr-1">
          ${p.comments.map(c=>`
            <div class="bg-moss/10 rounded-xl p-3">
              <div class="flex justify-between items-start">
                <a href="#/profile/${c.author}" class="text-sm font-semibold hover:text-forest">${escapeHtml(c.author)}</a>
                <span class="text-xs text-deepforest/40">${fmtDate(c.createdAt)}</span>
              </div>
              <p class="text-sm text-deepforest/80 mt-1">${escapeHtml(c.text)}</p>
              ${(u && (u.username===c.author || u.isAdmin)) ? `<button class="text-xs text-red-600 mt-1" onclick="deleteComment('${p.id}','${c.id}')">Vymazať</button>` : ''}
            </div>`).join('') || `<p class="text-sm text-deepforest/50">Zatiaľ žiadne komentáre.</p>`}
        </div>
        ${u ? `
          <form id="commentForm" class="mt-3 flex gap-2">
            <input id="commentInput" maxlength="500" placeholder="Napíš komentár (max 500 znakov)..." class="field flex-1">
            <button class="btn-primary" type="submit">Odoslať</button>
          </form>`
        : `<p class="text-sm text-deepforest/60 mt-3">Pre pridanie komentára sa <a href="#/login" class="text-forest underline">prihlás</a>.</p>`}
      </div>
    </div>
  </div>`;
}

function switchMedia(postId, idx){
    const p = DB.posts().find(x=>x.id===postId);
    if(!p) return;
    const m = p.media[idx];
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = m.isVideo
        ? `<video src="${m.dataUrl}" controls class="w-full h-full object-contain"></video>`
        : `<img src="${m.dataUrl}" class="w-full h-full object-contain">`;
}

function searchTag(tag){
    homeFilters.q = tag;
    location.hash = '#/home';
    setTimeout(()=>{ const i=document.getElementById('searchInput'); if(i) i.value = tag; }, 50);
}

function sharePost(id){
    const url = location.origin + location.pathname + '#/post/' + id;
    navigator.clipboard && navigator.clipboard.writeText(url);
    toast('Odkaz na príspevok bol skopírovaný do schránky.');
}

function toggleLike(id){
    if(!requireLogin()) return;
    const u = currentUser();
    const posts = DB.posts();
    const p = posts.find(x=>x.id===id);
    if(!p) return;
    if(p.author === u.username) return toast('Nemôžeš lajkovať vlastný príspevok.');
    const idx = p.likes.findIndex(l=>l.username===u.username);
    if(idx>=0) p.likes.splice(idx,1);
    else p.likes.push({username:u.username, at: nowISO()});
    DB.savePosts(posts);
    router();
}

function toggleSave(id){
    if(!requireLogin()) return;
    const u = currentUser();
    const users = DB.users();
    const user = users.find(x=>x.username===u.username);
    user.savedPostIds = user.savedPostIds || [];
    const idx = user.savedPostIds.indexOf(id);
    if(idx>=0){ user.savedPostIds.splice(idx,1); toast('Odobraté z uložených.'); }
    else { user.savedPostIds.push(id); toast('Uložené!'); }
    DB.saveUsers(users);
    router();
}

function deletePostAction(id){
    confirmAction('Naozaj chceš vymazať tento príspevok?', ()=>{
        const posts = DB.posts();
        const p = posts.find(x=>x.id===id);
        if(p){ p.deleted = true; DB.savePosts(posts); }
        toast('Príspevok vymazaný.');
        location.hash = '#/home';
    });
}

function deleteComment(postId, commentId){
    const posts = DB.posts();
    const p = posts.find(x=>x.id===postId);
    if(!p) return;
    p.comments = p.comments.filter(c=>c.id!==commentId);
    DB.savePosts(posts);
    router();
}

let reportingPostId = null;
function openReportModal(postId){
    if(!requireLogin()) return;
    reportingPostId = postId;
    document.getElementById('reportReasons').innerHTML = REPORT_REASONS.map((r,i)=>`
    <label class="flex items-center gap-2 text-sm">
      <input type="radio" name="reason" value="${escapeHtml(r)}" ${i===0?'checked':''}> ${escapeHtml(r)}
    </label>`).join('');
    document.getElementById('reportNote').value = '';
    openModal('reportModal');
}

/* ------------------------------- UPLOAD ------------------------------- */
let uploadMedia = [];
let uploadType = 'photo';

function renderUpload(){
    if(!requireLogin()) return '';
    uploadMedia = []; uploadType = 'photo';
    return `
  <div class="max-w-2xl mx-auto bg-white rounded-2xl border border-moss/30 p-6">
    <h1 class="text-2xl font-bold text-forest mb-4">📷 Pridať nový príspevok</h1>
    <form id="uploadForm" class="space-y-4">
      <div>
        <label class="lbl">Typ obsahu</label>
        <div class="flex gap-2">
          <button type="button" class="icon-btn active" id="typeBtnPhoto" onclick="setUploadType('photo')">📷 Fotky (max 15)</button>
          <button type="button" class="icon-btn" id="typeBtnVideo" onclick="setUploadType('video')">🎥 Videá (max 5, do 1 min)</button>
        </div>
      </div>

      <div>
        <label class="lbl">Nahraj súbory</label>
        <input type="file" id="mediaInput" accept="image/*" multiple class="field">
        <div id="mediaPreview" class="flex flex-wrap gap-2 mt-2"></div>
      </div>

      <div>
        <label class="lbl">Názov (nepovinné)</label>
        <input id="f_title" class="field" placeholder="Napr. Jeleň pri východe slnka">
      </div>

      <div>
        <label class="lbl">Kategória *</label>
        <select id="f_category" class="field" required>
          ${CATEGORIES.map(c=>`<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
        </select>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="lbl">Približná oblasť</label>
          <input id="f_location" class="field" placeholder="Napr. Vysoké Tatry">
        </div>
        <div>
          <label class="lbl">Zariadenie</label>
          <input id="f_device" class="field" placeholder="Napr. Canon R6">
        </div>
      </div>

      <div>
        <label class="lbl">Druh zvieraťa / rastliny (ak relevantné)</label>
        <input id="f_species" class="field" placeholder="Napr. Jeleň lesný">
      </div>

      <div>
        <label class="lbl">Tagy (oddelené čiarkou)</label>
        <input id="f_tags" class="field" placeholder="napr. jeleň, rosa, ráno">
      </div>

      <div>
        <label class="lbl">Popis príbehu alebo zážitku</label>
        <textarea id="f_desc" maxlength="2000" rows="4" class="field" placeholder="Opíš, ako vznikla táto chvíľa..."></textarea>
      </div>

      <div>
        <label class="lbl">Viditeľnosť príspevku</label>
        <select id="f_visibility" class="field">
          <option value="public">Verejné (vidí každý)</option>
          <option value="members">Len pre registrovaných</option>
        </select>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <a href="#/home" class="btn-ghost">Zrušiť</a>
        <button type="submit" class="btn-primary">Publikovať príspevok</button>
      </div>
    </form>
  </div>`;
}

function setUploadType(type){
    uploadType = type;
    uploadMedia = [];
    document.getElementById('typeBtnPhoto').className = type==='photo' ? 'icon-btn active' : 'icon-btn';
    document.getElementById('typeBtnVideo').className = type==='video' ? 'icon-btn active' : 'icon-btn';
    const input = document.getElementById('mediaInput');
    input.accept = type==='photo' ? 'image/*' : 'video/*';
    input.multiple = type==='photo';
    document.getElementById('mediaPreview').innerHTML = '';
}

/* ------------------------------- PROFILE ------------------------------- */
function renderProfile(username){
    const u = DB.users().find(x=>x.username.toLowerCase()===username.toLowerCase());
    if(!u) return render404();
    const curr = currentUser();
    const isSelf = curr && curr.username.toLowerCase()===u.username.toLowerCase();
    const posts = DB.posts().filter(p=>p.author===u.username && !p.deleted && (!p.hidden || (curr && (curr.isAdmin || isSelf))));

    return `
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="bg-white rounded-2xl border border-moss/30 p-6 flex flex-col sm:flex-row items-center gap-6">
      <div class="w-24 h-24 rounded-full bg-forest text-white flex items-center justify-center text-3xl font-bold flex-shrink-0">
        ${u.avatar || u.username.slice(0,2).toUpperCase()}
      </div>
      <div class="flex-1 text-center sm:text-left space-y-2">
        <div class="flex flex-wrap items-center justify-center sm:justify-between gap-2">
          <h1 class="text-2xl font-bold text-deepforest">${escapeHtml(u.username)} ${u.isAdmin?'<span class="badge bg-sunset text-white">Admin</span>':''} ${u.banned?'<span class="badge bg-red-600 text-white">Zablokovaný</span>':''}</h1>
          ${isSelf ? `<button onclick="openEditProfileModal()" class="btn-secondary text-sm">Upraviť profil</button>` : ''}
          ${(curr && curr.isAdmin && !isSelf) ? `<button onclick="toggleBanUser('${u.username}')" class="btn-secondary text-sm bg-red-100 text-red-700">${u.banned?'Odblokovať':'Zablokovať používateľa'}</button>` : ''}
        </div>
        <p class="text-sm text-deepforest/70">${escapeHtml(u.bio || 'Zatiaľ bez bio.')}</p>
        <p class="text-xs text-deepforest/50">Členom od: ${fmtDate(u.joined)}</p>
      </div>
    </div>

    <div>
      <h2 class="text-xl font-bold text-forest mb-4">Príspevky od používateľa (${posts.length})</h2>
      ${posts.length===0 ? `<p class="text-deepforest/60">Žiadne zverejnené príspevky.</p>` : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${posts.map(postCard).join('')}</div>`}
    </div>
  </div>`;
}

function openEditProfileModal(){
    const u = currentUser();
    if(!u) return;
    const newBio = prompt('Nové bio (krátky popis):', u.bio);
    if(newBio !== null){
        const users = DB.users();
        const user = users.find(x=>x.username===u.username);
        if(user){ user.bio = newBio.trim(); DB.saveUsers(users); toast('Profil aktualizovaný.'); router(); }
    }
}

function toggleBanUser(username){
    if(!isAdmin()) return;
    const users = DB.users();
    const u = users.find(x=>x.username===username);
    if(!u) return;
    u.banned = !u.banned;
    DB.saveUsers(users);
    toast(u.banned ? 'Používateľ zablokovaný.' : 'Používateľ odblokovaný.');
    router();
}

/* ------------------------------- SAVED ------------------------------- */
function renderSaved(){
    if(!requireLogin()) return '';
    const u = currentUser();
    const user = DB.users().find(x=>x.username===u.username);
    const savedIds = user.savedPostIds || [];
    const posts = DB.posts().filter(p=>savedIds.includes(p.id) && !p.deleted && !p.hidden);

    return `
  <div class="max-w-6xl mx-auto">
    <h1 class="text-2xl font-bold text-forest mb-4">🔖 Uložené príspevky</h1>
    ${posts.length===0 ? `<p class="text-deepforest/60">Nemáš zatiaľ uložené žiadne príspevky.</p>` : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${posts.map(postCard).join('')}</div>`}
  </div>`;
}

/* ------------------------------- EDIT POST ------------------------------- */
function renderEditPost(id){
    if(!requireLogin()) return '';
    const p = DB.posts().find(x=>x.id===id);
    const u = currentUser();
    if(!p || (p.author !== u.username && !u.isAdmin)) return render404();

    return `
  <div class="max-w-2xl mx-auto bg-white rounded-2xl border border-moss/30 p-6">
    <h1 class="text-2xl font-bold text-forest mb-4">✏️ Upraviť príspevok</h1>
    <form id="editPostForm" class="space-y-4">
      <div>
        <label class="lbl">Názov</label>
        <input id="e_title" class="field" value="${escapeHtml(p.title)}">
      </div>
      <div>
        <label class="lbl">Kategória</label>
        <select id="e_category" class="field">
          ${CATEGORIES.map(c=>`<option value="${c.id}" ${p.category===c.id?'selected':''}>${c.icon} ${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl">Oblasť</label><input id="e_location" class="field" value="${escapeHtml(p.location)}"></div>
        <div><label class="lbl">Zariadenie</label><input id="e_device" class="field" value="${escapeHtml(p.device)}"></div>
      </div>
      <div><label class="lbl">Druh</label><input id="e_species" class="field" value="${escapeHtml(p.species)}"></div>
      <div><label class="lbl">Tagy</label><input id="e_tags" class="field" value="${escapeHtml((p.tags||[]).join(', '))}"></div>
      <div><label class="lbl">Popis</label><textarea id="e_desc" rows="4" class="field">${escapeHtml(p.description)}</textarea></div>
      <div>
        <label class="lbl">Viditeľnosť</label>
        <select id="e_visibility" class="field">
          <option value="public" ${p.visibility==='public'?'selected':''}>Verejné</option>
          <option value="members" ${p.visibility==='members'?'selected':''}>Len pre prihlásených</option>
        </select>
      </div>
      <div class="flex justify-end gap-2">
        <a href="#/post/${p.id}" class="btn-ghost">Zrušiť</a>
        <button type="submit" class="btn-primary">Uložiť zmeny</button>
      </div>
    </form>
  </div>`;
}

/* ------------------------------- AUTH PAGES ------------------------------- */
function renderLogin(){
    return `
  <div class="max-w-md mx-auto bg-white rounded-2xl border border-moss/30 p-8 mt-10 shadow-sm">
    <h1 class="text-2xl font-bold text-forest mb-6 text-center">🔑 Prihlásenie do NatureLog</h1>
    <form id="loginForm" class="space-y-4">
      <div><label class="lbl">Používateľské meno</label><input id="l_user" class="field" required></div>
      <div><label class="lbl">Heslo</label><input type="password" id="l_pass" class="field" required></div>
      <button type="submit" class="btn-primary w-full py-3">Prihlásiť sa</button>
    </form>
    <p class="text-center text-sm text-deepforest/60 mt-4">Ešte nemáš účet? <a href="#/register" class="text-forest underline font-semibold">Zaregistruj sa</a></p>
  </div>`;
}

function renderRegister(){
    return `
  <div class="max-w-md mx-auto bg-white rounded-2xl border border-moss/30 p-8 mt-10 shadow-sm">
    <h1 class="text-2xl font-bold text-forest mb-6 text-center">🌿 Registrácia do NatureLog</h1>
    <form id="registerForm" class="space-y-4">
      <div><label class="lbl">Používateľské meno (min. 3 znaky)</label><input id="r_user" class="field" required></div>
      <div><label class="lbl">Heslo (min. 4 znaky)</label><input type="password" id="r_pass" class="field" required></div>
      <div><label class="lbl">Bio / O mne (nepovinné)</label><textarea id="r_bio" class="field" placeholder="Pár slov o tvojom vzťahu k prírode..."></textarea></div>
      <button type="submit" class="btn-primary w-full py-3">Zaregistrovať sa</button>
    </form>
    <p class="text-center text-sm text-deepforest/60 mt-4">Už máš účet? <a href="#/login" class="text-forest underline font-semibold">Prihlás sa</a></p>
  </div>`;
}

/* ------------------------------- RULES ------------------------------- */
function renderRules(){
    return `
  <div class="max-w-3xl mx-auto bg-white rounded-2xl border border-moss/30 p-8 space-y-4">
    <h1 class="text-2xl font-bold text-forest">📜 Pravidlá komunity NatureLog</h1>
    <p class="text-deepforest/80">Vitajte v komunite milovníkov prírody. Aby bol NatureLog príjemným miestom pre všetkých, dodržiavajte prosím nasledujúce zásady:</p>
    <ul class="list-disc pl-5 space-y-2 text-deepforest/80">
      <li><strong>Autenticita:</strong> Zdieľajte vlastné fotografie a videá z prírody. Žiadny cudzí alebo ukradnutý obsah.</li>
      <li><strong>Ochrana zvierat a prírody:</strong> Nevyzrádzajte citlivé lokality vzácnych druhov alebo hniezdisk, ak to môže ohroziť ich bezpečnosť. Prísne zakázané je týranie zvierat.</li>
      <li><strong>Slušnosť:</strong> V komentároch udržujte rešpektujúci tón, žiadne hejty či urážky.</li>
      <li><strong>Žiadny spam:</strong> Reklamné príspevky a komerčný spam budú administrátormi vymazané.</li>
    </ul>
  </div>`;
}

/* ------------------------------- ADMIN ------------------------------- */
function renderAdmin(){
    if(!isAdmin()) return `<div class="text-center py-20"><p class="text-xl">Prístup odopretý.</p></div>`;
    const posts = DB.posts().filter(p=>!p.deleted);
    const users = DB.users();
    const reportedPosts = posts.filter(p=>p.reports && p.reports.length>0);

    return `
  <div class="max-w-6xl mx-auto space-y-8">
    <h1 class="text-3xl font-bold text-forest">🛠️ Administrácia NatureLog</h1>

    <div>
      <h2 class="text-xl font-bold text-deepforest mb-3">🚩 Nahlásené príspevky (${reportedPosts.length})</h2>
      ${reportedPosts.length===0 ? `<p class="text-deepforest/60 text-sm">Žiadne nahlásené príspevky.</p>` : `
        <div class="space-y-3">
          ${reportedPosts.map(p=>`
            <div class="bg-white border border-moss/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <a href="#/post/${p.id}" class="font-bold text-forest hover:underline">${escapeHtml(p.title||'(bez názvu)')}</a>
                <p class="text-xs text-deepforest/60">Autor: ${escapeHtml(p.author)} | Hlásenia: ${p.reports.length}</p>
                <div class="text-xs text-red-600 mt-1">${p.reports.map(r=>`• ${escapeHtml(r.reason)} ${r.note?`(${escapeHtml(r.note)})`:''} od ${escapeHtml(r.by)}`).join('<br>')}</div>
              </div>
              <div class="flex gap-2">
                <button onclick="adminHidePost('${p.id}')" class="btn-secondary text-xs">${p.hidden?'Odkryť':'Skryť'}</button>
                <button onclick="adminDeletePost('${p.id}')" class="btn-secondary text-xs bg-red-100 text-red-700">Vymazať</button>
              </div>
            </div>`).join('')}
        </div>`}
    </div>

    <div>
      <h2 class="text-xl font-bold text-deepforest mb-3">👥 Správa používateľov (${users.length})</h2>
      <div class="bg-white border border-moss/30 rounded-xl overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="bg-moss/20 text-deepforest">
            <tr>
              <th class="p-3">Meno</th>
              <th class="p-3">Rola</th>
              <th class="p-3">Stav</th>
              <th class="p-3 text-right">Akcie</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u=>`
              <tr class="border-t border-moss/20">
                <td class="p-3 font-semibold"><a href="#/profile/${u.username}" class="hover:text-forest">${escapeHtml(u.username)}</a></td>
                <td class="p-3">${u.isAdmin?'Admin':'Bežný'}</td>
                <td class="p-3">${u.banned?'<span class="text-red-600 font-semibold">Zablokovaný</span>':'Aktívny'}</td>
                <td class="p-3 text-right">
                  ${!u.isAdmin ? `<button onclick="toggleBanUser('${u.username}')" class="text-xs underline text-forest">${u.banned?'Odblokovať':'Zablokovať'}</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function adminHidePost(id){
    const posts = DB.posts();
    const p = posts.find(x=>x.id===id);
    if(p){ p.hidden = !p.hidden; DB.savePosts(posts); toast('Stav príspevku zmenený.'); router(); }
}

function adminDeletePost(id){
    confirmAction('Naozaj vymazať tento príspevok ako admin?', ()=>{
        const posts = DB.posts();
        const p = posts.find(x=>x.id===id);
        if(p){ p.deleted = true; DB.savePosts(posts); toast('Príspevok vymazaný.'); router(); }
    });
}

function render404(){
    return `
  <div class="text-center py-20 space-y-4">
    <h1 class="text-4xl font-extrabold text-forest">404</h1>
    <p class="text-deepforest/70">Stránka, ktorú hľadáš, neexistuje v tejto divočine.</p>
    <a href="#/home" class="btn-inline inline-block">Návrat domov</a>
  </div>`;
}

/* ------------------------------- EVENT LISTENERS / INIT ------------------------------- */
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', ()=>{
    seedData();

    document.addEventListener('submit', async e => {
        if(e.target.id === 'loginForm'){
            e.preventDefault();
            login(document.getElementById('l_user').value, document.getElementById('l_pass').value);
        }
        if(e.target.id === 'registerForm'){
            e.preventDefault();
            register(document.getElementById('r_user').value, document.getElementById('r_pass').value, document.getElementById('r_bio').value);
        }
        if(e.target.id === 'uploadForm'){
            e.preventDefault();
            if(uploadMedia.length === 0) return toast('Nahraj aspoň jeden súbor.');
            const title = document.getElementById('f_title').value.trim();
            const category = document.getElementById('f_category').value;
            const locationStr = document.getElementById('f_location').value.trim();
            const device = document.getElementById('f_device').value.trim();
            const species = document.getElementById('f_species').value.trim();
            const tagsInput = document.getElementById('f_tags').value.trim();
            const description = document.getElementById('f_desc').value.trim();
            const visibility = document.getElementById('f_visibility').value;
            const tags = tagsInput ? tagsInput.split(',').map(t=>t.trim().replace(/^#/,'')).filter(Boolean) : [];

            const posts = DB.posts();
            const creator = currentUser();
            const newPost = {
                id: uid(),
                author: creator.username,
                title, category, location: locationStr, device, species, tags, description,
                type: uploadType,
                media: uploadMedia,
                visibility,
                createdAt: nowISO(),
                likes: [],
                views: 1,
                viewedBy: [creator.username],
                comments: [], reports: [], hidden: false, deleted: false, badges: []
            };
            posts.unshift(newPost);
            DB.savePosts(posts);
            toast('Príspevok úspešne pridaný!');
            location.hash = '#/post/' + newPost.id;
        }
        if(e.target.id === 'editPostForm'){
            e.preventDefault();
            const hashParts = location.hash.split('/');
            const id = hashParts[2];
            const posts = DB.posts();
            const p = posts.find(x=>x.id===id);
            if(!p) return;
            p.title = document.getElementById('e_title').value.trim();
            p.category = document.getElementById('e_category').value;
            p.location = document.getElementById('e_location').value.trim();
            p.device = document.getElementById('e_device').value.trim();
            p.species = document.getElementById('e_species').value.trim();
            const tagsInput = document.getElementById('e_tags').value.trim();
            p.tags = tagsInput ? tagsInput.split(',').map(t=>t.trim().replace(/^#/,'')).filter(Boolean) : [];
            p.description = document.getElementById('e_desc').value.trim();
            p.visibility = document.getElementById('e_visibility').value;
            DB.savePosts(posts);
            toast('Zmeny uložené.');
            location.hash = '#/post/' + p.id;
        }
        if(e.target.id === 'commentForm'){
            e.preventDefault();
            const input = document.getElementById('commentInput');
            const text = input.value.trim();
            if(!text) return;
            const hashParts = location.hash.split('/');
            const postId = hashParts[2];
            const posts = DB.posts();
            const p = posts.find(x=>x.id===postId);
            if(!p) return;
            p.comments.push({ id: uid(), author: currentUser().username, text, createdAt: nowISO() });
            DB.savePosts(posts);
            input.value = '';
            router();
        }
        if(e.target.id === 'reportForm'){
            e.preventDefault();
            const checkedReason = document.querySelector('input[name="reason"]:checked');
            if(!checkedReason) return toast('Vyber dôvod hlásenia.');
            const note = document.getElementById('reportNote').value.trim();
            const posts = DB.posts();
            const p = posts.find(x=>x.id===reportingPostId);
            if(p){
                p.reports = p.reports || [];
                p.reports.push({ reason: checkedReason.value, note, by: currentUser().username, at: nowISO() });
                DB.savePosts(posts);
                closeModal('reportModal');
                toast('Príspevok bol nahlásený administrátorom.');
            }
        }
    });

    document.addEventListener('change', async e => {
        if(e.target.id === 'mediaInput'){
            const files = Array.from(e.target.files);
            const preview = document.getElementById('mediaPreview');
            preview.innerHTML = '';
            uploadMedia = [];
            if(uploadType === 'photo'){
                const maxPhotos = 15;
                const chosen = files.slice(0, maxPhotos);
                for(const file of chosen){
                    try {
                        const dataUrl = await processImage(file);
                        uploadMedia.push({ dataUrl, isVideo: false });
                        const div = document.createElement('div');
                        div.className = 'w-20 h-20 rounded-lg overflow-hidden border border-moss/40 relative';
                        div.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-cover">`;
                        preview.appendChild(div);
                    } catch(err){ console.error(err); }
                }
            } else {
                const maxVideos = 5;
                const chosen = files.slice(0, maxVideos);
                for(const file of chosen){
                    const dur = await getVideoDuration(file);
                    if(dur > 62){
                        toast('Video je príliš dlhé (max 1 minúta): ' + file.name);
                        continue;
                    }
                    try {
                        const dataUrl = await readVideoAsDataURL(file);
                        uploadMedia.push({ dataUrl, isVideo: true });
                        const div = document.createElement('div');
                        div.className = 'w-20 h-20 rounded-lg overflow-hidden border border-moss/40 relative bg-black';
                        div.innerHTML = `<video src="${dataUrl}" class="w-full h-full object-cover"></video>`;
                        preview.appendChild(div);
                    } catch(err){ console.error(err); }
                }
            }
        }
    });

    document.addEventListener('input', e => {
        if(e.target.id === 'searchInput'){
            homeFilters.q = e.target.value;
        }
    });
    document.addEventListener('change', e => {
        if(e.target.id === 'typeFilter'){
            homeFilters.type = e.target.value;
            router();
        }
        if(e.target.id === 'sortFilter'){
            homeFilters.sort = e.target.value;
            router();
        }
    });

    router();
});s