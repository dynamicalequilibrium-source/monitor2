// App State
let projects = [];
let filteredProjects = [];
let activeSource = 'ALL';
let searchKeyword = '';
let visibleCount = 15;

// Sorting states
let sortBy = 'date';
let sortOrder = 'desc';

// User Profile States
let userProfiles = [];
let activeUserId = 'ALL';
let usersJsonSha = '';

// =============================================================================
// Source name mappings and accent colors
// =============================================================================
// When you add a new target site, add an entry here to customize its appearance
// in the dashboard. The key must match the "name" field in config.py's TARGET_SITES.
//
// Example:
// const sourceConfig = {
//     "예시기관": { shortName: "예시기관", color: "#14b8a6", glow: "rgba(20, 184, 166, 0.2)" },
// };
// =============================================================================
const sourceConfig = {
    "행정안전부 고시공고": { shortName: "행안부 고시공고", color: "#0284c7", glow: "rgba(2, 132, 199, 0.1)" },
    "행정안전부 보도자료": { shortName: "행안부 보도자료", color: "#0d9488", glow: "rgba(13, 148, 136, 0.1)" },
    "과학기술정보통신부 보도자료": { shortName: "과기정통부 보도자료", color: "#8b5cf6", glow: "rgba(139, 92, 246, 0.1)" }
};

// DOM Elements
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const sourceFiltersContainer = document.getElementById('source-filters');
const projectsListBody = document.getElementById('projects-list-body');
const emptyState = document.getElementById('empty-state');
const paginationContainer = document.getElementById('pagination-container');
const btnLoadMore = document.getElementById('btn-load-more');
const totalCountBadge = document.getElementById('total-count-badge');
const showingCountText = document.getElementById('showing-count');
const sortSelect = document.getElementById('sort-select');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    initAddSiteFeature();
    initUserFeature();
});

// Load CSV Data
function loadData() {
    const csvUrl = `/data/support_projects.csv?t=${new Date().getTime()}`;
    
    showLoader();
    
    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            hideLoader();
            
            if (results.errors.length > 0 && results.data.length === 0) {
                console.error("CSV Parsing Errors:", results.errors);
                showEmptyState("데이터 파일을 불러오지 못했습니다. 시스템 관리자에게 문의해 주세요.");
                return;
            }
            
            // Clean and parse projects
            projects = results.data
                .filter(item => item.title && item.link)
                .map(item => {
                    const normalizedSource = cleanSourceName(item.source);
                    return {
                        id: parseInt(item.id) || 0,
                        source: normalizedSource,
                        title: item.title,
                        link: item.link,
                        post_date: item.post_date || "",
                        collected_at: item.collected_at || ""
                    };
                });
                
            totalCountBadge.textContent = `수집 정보: ${projects.length}건`;
            
            generateSourceFilters();
            applyFilters();
        },
        error: function(err) {
            hideLoader();
            console.error("Failed to load CSV:", err);
            showEmptyState("아직 수집된 데이터가 없습니다. 자동 수집이 실행된 후 다시 확인해 주세요.");
        }
    });
}

function cleanSourceName(sourceStr) {
    if (!sourceStr) return "기타";
    return sourceStr.replace(/[^\x00-\x7Fㄱ-힣\s\(\)]/g, "").trim();
}

// Show/Hide Loader
function showLoader() {
    projectsListBody.innerHTML = `
        <tr id="grid-loader">
            <td colspan="5" class="table-loader-cell">
                <div class="spinner"></div>
                <p>데이터 로딩 중...</p>
            </td>
        </tr>
    `;
    emptyState.style.display = 'none';
    paginationContainer.style.display = 'none';
}

function hideLoader() {
    const loader = document.getElementById('grid-loader');
    if (loader) loader.remove();
}

// Setup Event Listeners
function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        searchKeyword = e.target.value.trim().toLowerCase();
        btnClearSearch.style.display = searchKeyword ? 'flex' : 'none';
        applyFilters();
    });
    
    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchKeyword = '';
        btnClearSearch.style.display = 'none';
        applyFilters();
    });
    
    btnLoadMore.addEventListener('click', () => {
        visibleCount += 15;
        renderGrid();
    });
    
    sortSelect.addEventListener('change', (e) => {
        const parts = e.target.value.split('-');
        sortBy = parts[0];
        sortOrder = parts[1];
        applyFilters();
    });
    
    // Detail Modal closing
    const detailModal = document.getElementById('project-detail-modal');
    const btnCloseDetail = document.getElementById('btn-close-detail');
    const btnDetailCloseBottom = document.getElementById('btn-detail-close-bottom');
    
    if (btnCloseDetail && detailModal) {
        btnCloseDetail.addEventListener('click', () => {
            detailModal.style.display = 'none';
        });
    }
    if (btnDetailCloseBottom && detailModal) {
        btnDetailCloseBottom.addEventListener('click', () => {
            detailModal.style.display = 'none';
        });
    }
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.style.display = 'none';
            }
        });
    }
}

// Generate Source Filter Chips
function generateSourceFilters() {
    const counts = {};
    projects.forEach(p => {
        counts[p.source] = (counts[p.source] || 0) + 1;
    });
    
    sourceFiltersContainer.innerHTML = `<button class="chip ${activeSource === 'ALL' ? 'active' : ''}" data-source="ALL">전체보기 (${projects.length})</button>`;
    
    Object.keys(counts).sort().forEach(src => {
        const conf = sourceConfig[src] || { shortName: src };
        const chip = document.createElement('button');
        chip.className = `chip ${activeSource === src ? 'active' : ''}`;
        chip.setAttribute('data-source', src);
        chip.textContent = `${conf.shortName} (${counts[src]})`;
        sourceFiltersContainer.appendChild(chip);
    });
    
    const chips = sourceFiltersContainer.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeSource = chip.getAttribute('data-source');
            visibleCount = 15;
            applyFilters();
        });
    });
}

// Sort in-memory list
function sortData() {
    filteredProjects.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'id') {
            valA = a.id;
            valB = b.id;
        } else if (sortBy === 'source') {
            valA = a.source.toLowerCase();
            valB = b.source.toLowerCase();
        } else if (sortBy === 'title') {
            valA = a.title.toLowerCase();
            valB = b.title.toLowerCase();
        } else if (sortBy === 'date') {
            const hasA = a.post_date && a.post_date.trim();
            const hasB = b.post_date && b.post_date.trim();
            if (!hasA && hasB) return 1;
            if (hasA && !hasB) return -1;
            if (!hasA && !hasB) {
                valA = a.collected_at;
                valB = b.collected_at;
            } else {
                valA = a.post_date.trim();
                valB = b.post_date.trim();
            }
        }
        
        if (valA === valB) return 0;
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        return sortOrder === 'asc' ? 1 : -1;
    });
}

// Apply Search, Filters, and Sorting
function applyFilters() {
    const activeUser = activeUserId === 'ALL' ? null : userProfiles.find(u => u.id === activeUserId);
    
    filteredProjects = projects.filter(p => {
        const matchesSource = activeSource === 'ALL' || p.source === activeSource;
        const matchesSearch = !searchKeyword || 
            p.title.toLowerCase().includes(searchKeyword) || 
            p.source.toLowerCase().includes(searchKeyword);
            
        let matchesUser = true;
        if (activeUser) {
            const matchesUserSource = activeUser.subscribed_sources && activeUser.subscribed_sources.includes(p.source);
            const matchesUserKeywords = !activeUser.keywords || activeUser.keywords.length === 0 || 
                activeUser.keywords.some(kw => p.title.toLowerCase().includes(kw.toLowerCase()));
            matchesUser = matchesUserSource && matchesUserKeywords;
        }
        
        return matchesSource && matchesSearch && matchesUser;
    });
    
    // Update active user filter description banner
    const filterDesc = document.getElementById('user-active-filter-desc');
    const filterText = document.getElementById('user-filter-text');
    if (filterDesc && filterText) {
        if (activeUser) {
            const kwStr = activeUser.keywords && activeUser.keywords.length > 0 ? activeUser.keywords.join(', ') : '전체 키워드';
            const srcCount = activeUser.subscribed_sources ? activeUser.subscribed_sources.length : 0;
            filterText.textContent = `[${activeUser.name}] 맞춤 필터 적용 중 (구독 기관: ${srcCount}개, 관심 키워드: ${kwStr})`;
            filterDesc.style.display = 'inline-flex';
        } else {
            filterDesc.style.display = 'none';
        }
    }
    
    sortData();
    renderGrid();
}

// Render Bulletin Board Rows
function renderGrid() {
    projectsListBody.innerHTML = '';
    
    if (filteredProjects.length === 0) {
        showEmptyState("검색 조건에 맞는 보도자료 공고가 없습니다.");
        showingCountText.textContent = "조건에 부합하는 수집 정보가 없습니다.";
        return;
    }
    
    emptyState.style.display = 'none';
    
    const itemsToRender = filteredProjects.slice(0, visibleCount);
    
    itemsToRender.forEach((p, idx) => {
        const conf = sourceConfig[p.source] || { shortName: p.source, color: "var(--color-fallback)", glow: "rgba(255,255,255,0.05)" };
        
        const regDate = p.post_date ? p.post_date.trim() : "";
        const colDate = p.collected_at ? p.collected_at.trim() : "";
        const displayColDate = colDate.split(' ')[0] || "";
        
        const tr = document.createElement('tr');
        tr.className = 'project-row';
        const tagColor = conf.color.startsWith('#') ? conf.color : "#64748b";
        tr.style.setProperty('--source-color', conf.color);
        tr.style.setProperty('--source-bg-color', tagColor + "15"); // 8% opacity
        tr.style.setProperty('--source-border-color', tagColor + "30"); // 18% opacity
        
        tr.innerHTML = `
            <td style="color: var(--text-secondary); font-weight: 500;">${idx + 1}</td>
            <td><span class="table-source-tag">${conf.shortName}</span></td>
            <td>
                <a href="#" class="table-title-link btn-show-detail" data-id="${p.id}" title="${escapeHtml(p.title)}">
                    ${escapeHtml(p.title)}
                </a>
            </td>
            <td class="table-date-cell">${escapeHtml(regDate)}</td>
            <td class="table-date-cell">${escapeHtml(displayColDate)}</td>
        `;
        projectsListBody.appendChild(tr);
    });
    
    // Add event listeners to detail buttons
    const btnShowDetails = projectsListBody.querySelectorAll('.btn-show-detail');
    btnShowDetails.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = parseInt(btn.getAttribute('data-id'));
            showProjectDetail(id);
        });
    });
    
    showingCountText.textContent = `전체 ${filteredProjects.length}건 중 ${itemsToRender.length}건 표시 중`;
    
    if (filteredProjects.length > visibleCount) {
        paginationContainer.style.display = 'flex';
    } else {
        paginationContainer.style.display = 'none';
    }
    
    lucide.createIcons();
}

// Show Project Detail Modal
function showProjectDetail(id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    
    const detailModal = document.getElementById('project-detail-modal');
    const detailSource = document.getElementById('detail-source');
    const detailTitle = document.getElementById('detail-title');
    const detailRegDate = document.getElementById('detail-reg-date');
    const detailColDate = document.getElementById('detail-col-date');
    const detailAiSummary = document.getElementById('detail-ai-summary');
    const detailAiTags = document.getElementById('detail-ai-tags');
    const detailVisitLink = document.getElementById('detail-visit-link');
    
    if (!detailModal) return;
    
    // Set text contents
    detailSource.textContent = project.source;
    detailTitle.textContent = project.title;
    detailRegDate.textContent = project.post_date || "미표기";
    detailColDate.textContent = project.collected_at ? project.collected_at.split(' ')[0] : "미표기";
    detailVisitLink.href = project.link;
    
    // Customize source colors dynamically
    const conf = sourceConfig[project.source] || { color: "var(--primary-color)" };
    detailSource.style.backgroundColor = conf.color + "20"; // 12% opacity
    detailSource.style.color = conf.color;
    detailSource.style.borderColor = conf.color + "40";
    
    // Generate dynamic AI Summary based on title keywords
    let summaryText = "";
    let tags = [];
    
    const title = project.title.toLowerCase();
    
    // Clean prefix tags like [보도자료] or [공고]
    const cleanTitle = project.title.replace(/^\[[^\]]+\]\s*/, '');
    
    if (title.includes("인공지능") || title.includes("ai")) {
        summaryText = `행정안전부에서 인공지능(AI) 기술 및 인프라 활성화를 위해 발표한 '${cleanTitle}' 관련 공고입니다. AI 혁신 및 공공 서비스 품질 향상을 위한 내용이 담겨 있습니다.`;
        tags.push("인공지능", "AI 혁신");
    } else if (title.includes("재난") || title.includes("안전") || title.includes("호우") || title.includes("대처")) {
        summaryText = `행정안전부의 국민 안전 관리 및 재난 대책 관련 공고인 '${cleanTitle}'입니다. 재난 발생 예방과 시설물 점검, 신속한 현장 대응 지침 등을 핵심으로 다루고 있습니다.`;
        tags.push("재난안전", "국민보호");
    } else if (title.includes("지원") || title.includes("공모")) {
        summaryText = `새로운 성장 동력을 마련하기 위해 정부 부처에서 주관하는 지원 사업 공고인 '${cleanTitle}'입니다. 조건에 부합하는 대상자 및 기관은 원본 링크를 통해 사업비 지원 혜택 및 공모 절차를 확인해 보시기 바랍니다.`;
        tags.push("정부지원", "공모사업");
    } else {
        summaryText = `정부 부처에서 발표한 정책 공고인 '${cleanTitle}'입니다. 관련 분야의 최신 고시 사항과 행정 지침을 담고 있으며, 자세한 조건 및 혜택은 원본 사이트 공고문을 참조해 주시기 바랍니다.`;
        tags.push("정부정책", "행정공고");
    }
    
    detailAiSummary.textContent = summaryText;
    
    // Generate tag elements
    detailAiTags.innerHTML = "";
    tags.forEach(tag => {
        const span = document.createElement('span');
        span.style.cssText = "font-size: 11px; padding: 2px 8px; border-radius: 6px; background-color: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-secondary);";
        span.textContent = "#" + tag;
        detailAiTags.appendChild(span);
    });
    
    // Display modal
    detailModal.style.display = 'flex';
    
    // Initialize icons in modal
    lucide.createIcons();
}

function showEmptyState(msg) {
    projectsListBody.innerHTML = '';
    emptyState.style.display = 'flex';
    emptyState.querySelector('p').textContent = msg;
    paginationContainer.style.display = 'none';
}

// Utility: HTML Escaping
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Add Site feature logic
function initAddSiteFeature() {
    const btnAddSite = document.getElementById('btn-add-site');
    const btnClosePanel = document.getElementById('btn-close-panel');
    const addSiteModal = document.getElementById('add-site-modal');
    const addSiteForm = document.getElementById('add-site-form');
    const requestedSitesList = document.getElementById('requested-sites-list');
    const requestedSitesCount = document.getElementById('requested-sites-count');
    const requestedSitesActions = document.getElementById('requested-sites-actions');
    const btnCopyConfig = document.getElementById('btn-copy-config');
    const btnClearRequested = document.getElementById('btn-clear-requested');
    
    const GITHUB_REPO = 'dynamicalequilibrium-source/monitor2';
    
    // Open Modal
    if (btnAddSite && addSiteModal) {
        btnAddSite.addEventListener('click', () => {
            addSiteModal.style.display = 'flex';
            
            // Pre-fill requester name if an active user profile is selected
            const requesterInput = document.getElementById('new-site-requester');
            if (requesterInput) {
                if (activeUserId !== 'ALL') {
                    const activeUser = userProfiles.find(u => u.id === activeUserId);
                    requesterInput.value = activeUser ? activeUser.name : '';
                } else {
                    requesterInput.value = '';
                }
            }
            
            renderRequestedSites();
        });
    }
    
    // Close Modal via Button
    if (btnClosePanel && addSiteModal) {
        btnClosePanel.addEventListener('click', () => {
            addSiteModal.style.display = 'none';
        });
    }
    
    // Close Modal via Backdrop Click
    if (addSiteModal) {
        addSiteModal.addEventListener('click', (e) => {
            if (e.target === addSiteModal) {
                addSiteModal.style.display = 'none';
            }
        });
    }
    
    // Form Submit
    if (addSiteForm) {
        addSiteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const requesterInput = document.getElementById('new-site-requester');
            const nameInput = document.getElementById('new-site-name');
            const urlInput = document.getElementById('new-site-url');
            const descInput = document.getElementById('new-site-desc');
            
            const requester = requesterInput ? requesterInput.value.trim() : '';
            const name = nameInput.value.trim();
            const url = urlInput.value.trim();
            const desc = descInput ? descInput.value.trim() : '';
            
            if (name && url && requester) {
                const btnSubmit = addSiteForm.querySelector('button[type="submit"]');
                const originalBtnText = btnSubmit.innerHTML;
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<div class="spinner" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:6px;"></div>등록 중...`;
                
                const binUrl = `/api/shared-store?type=requests`;
                
                // Fetch current list, append, and PUT
                fetch(binUrl)
                    .then(res => res.json())
                    .then(data => {
                        const list = Array.isArray(data) ? data : [];
                        const newReq = {
                            id: `req_${Date.now()}`,
                            name: name,
                            url: url,
                            requester: requester,
                            desc: desc || '없음',
                            date: new Date().toLocaleDateString('ko-KR')
                        };
                        list.push(newReq);
                        
                        return fetch(binUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(list)
                        });
                    })
                    .then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = originalBtnText;
                        
                        // Clear form inputs
                        if (requesterInput) requesterInput.value = '';
                        nameInput.value = '';
                        urlInput.value = '';
                        if (descInput) descInput.value = '';
                        
                        alert('💾 성공적으로 수집 요청이 등록되어 실시간으로 반영되었습니다!');
                        renderRequestedSites();
                    })
                    .catch(err => {
                        console.error("Failed to save site request:", err);
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = originalBtnText;
                        alert("등록 실패: 인터넷 연결 및 API 서버 상태를 확인해 주세요.");
                    });
            }
        });
    }
    
    // Copy all requested sites details
    if (btnCopyConfig) {
        btnCopyConfig.addEventListener('click', () => {
            const items = requestedSitesList.querySelectorAll('.requested-site-item');
            if (items.length === 0 || items[0].textContent.includes('등록된 요청') || items[0].textContent.includes('로딩 중')) return;
            
            let formatted = '## 📌 모니터링 희망 사이트 요청 목록\n\n';
            items.forEach((item, idx) => {
                const name = item.querySelector('.site-name-text').firstChild.textContent.trim();
                const url = item.querySelector('.site-url-text').getAttribute('href');
                formatted += `${idx + 1}. **${name}**: ${url}\n`;
            });
            
            navigator.clipboard.writeText(formatted).then(() => {
                const originalText = btnCopyConfig.querySelector('span').textContent;
                btnCopyConfig.querySelector('span').textContent = '복사 완료!';
                btnCopyConfig.style.borderColor = 'var(--primary-color)';
                btnCopyConfig.style.color = 'var(--primary-color)';
                
                setTimeout(() => {
                    btnCopyConfig.querySelector('span').textContent = originalText;
                    btnCopyConfig.style.borderColor = '';
                    btnCopyConfig.style.color = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert('복사에 실패했습니다. 아래 텍스트를 직접 복사해 주세요:\n\n' + formatted);
            });
        });
    }
    
    // Fetch and Render requested sites from ExtendsClass JSON Bin (Collaborative, token-free)
    function renderRequestedSites() {
        if (!requestedSitesList) return;
        
        requestedSitesList.innerHTML = `<li style="color: var(--text-muted); font-size: 13px; padding: 16px 0; text-align: center;"><div class="spinner" style="width:20px; height:20px; margin: 0 auto 8px auto;"></div>로딩 중...</li>`;
        requestedSitesCount.textContent = '...';
        
        if (requestedSitesActions) requestedSitesActions.style.display = 'none';
        
        const binUrl = `/api/shared-store?type=requests`;
        
        fetch(binUrl)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error (Status: ${res.status})`);
                return res.json();
            })
            .then(data => {
                requestedSitesList.innerHTML = '';
                const requests = Array.isArray(data) ? data : [];
                requestedSitesCount.textContent = requests.length;
                
                if (requests.length === 0) {
                    requestedSitesList.innerHTML = `<li style="color: var(--text-muted); font-size: 13px; padding: 16px 0; text-align: center;">등록된 요청 사이트가 없습니다.</li>`;
                    return;
                }
                
                if (requestedSitesActions) {
                    requestedSitesActions.style.display = 'flex';
                }
                
                requests.forEach(site => {
                    const li = document.createElement('li');
                    li.className = 'requested-site-item';
                    li.innerHTML = `
                        <div class="site-info">
                            <span class="site-name-text">
                                ${escapeHtml(site.name)}
                                ${site.requester ? `<span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background-color: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-secondary); margin-left: 6px; font-weight: normal; vertical-align: middle;">${escapeHtml(site.requester)}</span>` : ''}
                            </span>
                            <a href="${escapeHtml(site.url)}" target="_blank" class="site-url-text">${escapeHtml(site.url)}</a>
                        </div>
                        <button class="btn-secondary btn-sm btn-delete-site-request" data-id="${site.id}" title="요청 삭제" style="margin-left: 10px; background-color: var(--bg-main); border: 1px solid var(--border-color); color: #ef4444; width: 32px; height: 32px; border-radius: 8px; padding:0; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    `;
                    requestedSitesList.appendChild(li);
                });
                
                // Attach delete event listeners
                requestedSitesList.querySelectorAll('.btn-delete-site-request').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.getAttribute('data-id');
                        if (confirm('이 수집 요청을 정말로 삭제하시겠습니까?')) {
                            deleteRequestedSite(id);
                        }
                    });
                });
                
                lucide.createIcons();
            })
            .catch(err => {
                console.error('Failed to fetch requested sites from shared bin:', err);
                requestedSitesList.innerHTML = `<li style="color: var(--text-muted); font-size: 13px; padding: 16px 0; text-align: center;">요청 목록을 불러오지 못했습니다.</li>`;
            });
    }

    function deleteRequestedSite(id) {
        const binUrl = `/api/shared-store?type=requests`;
        
        fetch(binUrl)
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data) ? data : [];
                const updatedList = list.filter(item => item.id !== id);
                
                return fetch(binUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedList)
                });
            })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                renderRequestedSites();
            })
            .catch(err => {
                console.error("Failed to delete request from shared bin:", err);
                alert("삭제 처리에 실패했습니다. 인터넷 연결을 확인해 주세요.");
            });
    }
}

// =============================================================================
// User Profiles & Custom Subscriptions Feature
// =============================================================================
function initUserFeature() {
    const userChipsContainer = document.getElementById('user-chips');
    const btnManageUsers = document.getElementById('btn-manage-users');
    const userManageModal = document.getElementById('user-manage-modal');
    const btnCloseUsers = document.getElementById('btn-close-users');
    const userForm = document.getElementById('user-form');
    const userFormId = document.getElementById('user-form-id');
    const userFormName = document.getElementById('user-form-name');
    const userFormSources = document.getElementById('user-form-sources');
    const userFormKeywords = document.getElementById('user-form-keywords');
    const btnUserCancel = document.getElementById('btn-user-cancel');
    const userList = document.getElementById('user-list');
    
    // Load profiles from shared ExtendsClass JSON bin (collaborative, realtime)
    loadUserProfiles();
    
    // Fetch live users.json from shared JSON bin
    function loadUserProfiles() {
        const binUrl = `/api/shared-store?type=users`;
        
        fetch(binUrl)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
                return res.json();
            })
            .then(data => {
                userProfiles = Array.isArray(data) ? data : [];
                localStorage.setItem('dashboard_user_profiles', JSON.stringify(userProfiles));
                renderUserChips();
                if (userManageModal && userManageModal.style.display === 'flex') {
                    renderUserList();
                }
            })
            .catch(err => {
                console.warn("Failed to fetch live users from shared bin, falling back to local cache:", err);
                const localProfiles = localStorage.getItem('dashboard_user_profiles');
                if (localProfiles) {
                    userProfiles = JSON.parse(localProfiles);
                    renderUserChips();
                } else {
                    // Fetch Netlify local json file as ultimate fallback
                    fetch(`/data/users.json?t=${new Date().getTime()}`)
                        .then(res => res.json())
                        .then(data => {
                            userProfiles = data;
                            localStorage.setItem('dashboard_user_profiles', JSON.stringify(userProfiles));
                            renderUserChips();
                        })
                        .catch(fallbackErr => {
                            console.error("All user profile load strategies failed:", fallbackErr);
                            userProfiles = [];
                            renderUserChips();
                        });
                }
            });
    }
    
    // Open management modal
    if (btnManageUsers && userManageModal) {
        btnManageUsers.addEventListener('click', () => {
            userManageModal.style.display = 'flex';
            populateFormSources();
            renderUserList();
            resetUserForm();
        });
    }
    
    // Close modal
    if (btnCloseUsers && userManageModal) {
        btnCloseUsers.addEventListener('click', () => {
            userManageModal.style.display = 'none';
        });
    }
    
    if (userManageModal) {
        userManageModal.addEventListener('click', (e) => {
            if (e.target === userManageModal) {
                userManageModal.style.display = 'none';
            }
        });
    }
    
    // Cancel editing
    if (btnUserCancel) {
        btnUserCancel.addEventListener('click', () => {
            resetUserForm();
        });
    }
    
    // Form submission (Add / Edit)
    if (userForm) {
        userForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = userFormName.value.trim();
            const id = userFormId.value;
            
            // Collect checked sources
            const checkedSources = [];
            const checkboxes = userFormSources.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (cb.checked) checkedSources.push(cb.value);
            });
            
            // Parse keywords
            const kwVal = userFormKeywords.value.trim();
            const keywords = kwVal ? kwVal.split(',').map(s => s.trim()).filter(Boolean) : [];
            
            if (!name) return;
            
            if (id) {
                // Edit existing
                const idx = userProfiles.findIndex(u => u.id === id);
                if (idx !== -1) {
                    userProfiles[idx].name = name;
                    userProfiles[idx].subscribed_sources = checkedSources;
                    userProfiles[idx].keywords = keywords;
                }
            } else {
                // Add new
                const newId = `user_${Date.now()}`;
                userProfiles.push({
                    id: newId,
                    name: name,
                    subscribed_sources: checkedSources,
                    keywords: keywords
                });
            }
            
            // Save & Sync
            saveUserProfiles();
        });
    }
    
    // Commits userProfiles array to shared ExtendsClass JSON bin
    function saveUserProfiles() {
        // Save to local cache first
        localStorage.setItem('dashboard_user_profiles', JSON.stringify(userProfiles));
        
        const btnSubmit = document.getElementById('btn-user-submit');
        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<div class="spinner" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:6px;"></div>저장 중...`;
        
        const binUrl = `/api/shared-store?type=users`;
        
        fetch(binUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userProfiles)
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnText;
            
            renderUserChips();
            renderUserList();
            resetUserForm();
            applyFilters();
            
            alert('💾 설정 내용이 성공적으로 저장되어 모든 사용자에게 실시간 반영되었습니다!');
        })
        .catch(err => {
            console.error("Failed to sync user profiles to shared bin:", err);
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnText;
            
            alert(`⚠️ 저장 실패: ${err.message}\n인터넷 연결 상태를 확인해 주세요.`);
            
            renderUserChips();
            renderUserList();
            resetUserForm();
            applyFilters();
        });
    }
    
    // Render chips in main panel
    function renderUserChips() {
        if (!userChipsContainer) return;
        
        userChipsContainer.innerHTML = `<button class="user-chip ${activeUserId === 'ALL' ? 'active' : ''}" data-user-id="ALL"><i data-lucide="globe" style="width:13px; height:13px;"></i>전체보기</button>`;
        
        userProfiles.forEach(user => {
            const btn = document.createElement('button');
            btn.className = `user-chip ${activeUserId === user.id ? 'active' : ''}`;
            btn.setAttribute('data-user-id', user.id);
            btn.innerHTML = `<i data-lucide="user" style="width:13px; height:13px;"></i>${escapeHtml(user.name)}`;
            userChipsContainer.appendChild(btn);
        });
        
        // Add click handlers
        userChipsContainer.querySelectorAll('.user-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                userChipsContainer.querySelectorAll('.user-chip').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                activeUserId = btn.getAttribute('data-user-id');
                visibleCount = 15;
                applyFilters();
            });
        });
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    // Render user list inside modal
    function renderUserList() {
        if (!userList) return;
        
        if (userProfiles.length === 0) {
            userList.innerHTML = `<li style="color: var(--text-muted); font-size:13px; padding:16px 0; text-align:center;">등록된 사용자가 없습니다.</li>`;
            return;
        }
        
        userList.innerHTML = '';
        userProfiles.forEach(user => {
            const li = document.createElement('li');
            li.className = 'requested-site-item';
            
            const kwStr = user.keywords && user.keywords.length > 0 ? user.keywords.join(', ') : '전체 키워드';
            const srcCount = user.subscribed_sources ? user.subscribed_sources.length : 0;
            
            li.innerHTML = `
                <div class="site-info">
                    <span class="site-name-text"><i data-lucide="user" style="width:13px; height:13px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>${escapeHtml(user.name)}</span>
                    <span style="font-size:11px; color:var(--text-secondary); margin-top:2px;">구독 기관: ${srcCount}개 | 키워드: ${escapeHtml(kwStr)}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-secondary btn-sm btn-edit-user" data-id="${user.id}" style="padding: 4px 8px; font-size:11px; margin:0;"><i data-lucide="edit-2" style="width:12px; height:12px;"></i></button>
                    <button class="btn-secondary btn-sm btn-delete-user" data-id="${user.id}" style="padding: 4px 8px; font-size:11px; color:#ef4444; margin:0;"><i data-lucide="trash-2" style="width:12px; height:12px;"></i></button>
                </div>
            `;
            userList.appendChild(li);
        });
        
        // Attach list button handlers
        userList.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const user = userProfiles.find(u => u.id === id);
                if (user) {
                    userFormId.value = user.id;
                    userFormName.value = user.name;
                    userFormKeywords.value = user.keywords ? user.keywords.join(', ') : '';
                    
                    // Check checkboxes
                    const checkboxes = userFormSources.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(cb => {
                        cb.checked = user.subscribed_sources && user.subscribed_sources.includes(cb.value);
                    });
                    
                    btnUserCancel.style.display = 'block';
                    document.getElementById('btn-user-submit').innerHTML = `<i data-lucide="check" style="width:14px; height:14px;"></i>수정 완료`;
                    userFormName.focus();
                    if (window.lucide) window.lucide.createIcons();
                }
            });
        });
        
        userList.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const user = userProfiles.find(u => u.id === id);
                if (user && confirm(`'${user.name}' 사용자를 삭제하시겠습니까?`)) {
                    userProfiles = userProfiles.filter(u => u.id !== id);
                    saveUserProfiles(); // Save & Sync
                }
            });
        });
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    // Populate form source checkboxes based on actual target sites in dashboard config
    function populateFormSources() {
        if (!userFormSources) return;
        
        // Get all unique sources currently available in dashboard
        const uniqueSources = new Set();
        projects.forEach(p => {
            if (p.source) uniqueSources.add(p.source);
        });
        
        // If empty (e.g. before data loaded), use keys from sourceConfig or preseed configs
        if (uniqueSources.size === 0) {
            Object.keys(sourceConfig).forEach(src => uniqueSources.add(src));
        }
        
        userFormSources.innerHTML = '';
        Array.from(uniqueSources).sort().forEach(src => {
            const conf = sourceConfig[src] || { shortName: src };
            const label = document.createElement('label');
            label.className = 'source-checkbox-label';
            label.innerHTML = `<input type="checkbox" value="${escapeHtml(src)}"> <span>${escapeHtml(conf.shortName)}</span>`;
            userFormSources.appendChild(label);
        });
    }
    
    // Reset User form fields
    function resetUserForm() {
        if (!userForm) return;
        userFormId.value = '';
        userFormName.value = '';
        userFormKeywords.value = '';
        
        const checkboxes = userFormSources.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        
        if (btnUserCancel) btnUserCancel.style.display = 'none';
        document.getElementById('btn-user-submit').innerHTML = `<i data-lucide="check" style="width:14px; height:14px;"></i>저장하기`;
        if (window.lucide) window.lucide.createIcons();
    }
}
