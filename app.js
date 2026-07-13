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
                // Construct GitHub Issue URL
                const title = encodeURIComponent(`[사이트 수집 요청] ${name} (요청자: ${requester})`);
                const body = encodeURIComponent(
                    `## 📌 사이트 수집 요청 정보\n\n` +
                    `- **요청자**: ${requester}\n` +
                    `- **사이트명**: ${name}\n` +
                    `- **URL**: ${url}\n` +
                    `- **추가정보**: ${desc || '없음'}\n` +
                    `- **요청일**: ${new Date().toLocaleDateString('ko-KR')}\n\n` +
                    `---\n*이 요청은 모니터링 대시보드를 통해 생성되었습니다. 관리자는 해당 사이트의 수집기(Way A/B)를 구현하고 이슈를 닫아주세요.*`
                );
                const labels = encodeURIComponent('site-request');
                
                const issueUrl = `https://github.com/${GITHUB_REPO}/issues/new?title=${title}&body=${body}&labels=${labels}`;
                
                // Open in a new tab
                window.open(issueUrl, '_blank');
                
                // Clear form inputs
                if (requesterInput) requesterInput.value = '';
                nameInput.value = '';
                urlInput.value = '';
                if (descInput) descInput.value = '';
                
                // Inform user and close modal
                alert('깃허브 이슈(GitHub Issue) 작성 창이 열렸습니다.\n화면에서 [Submit new issue] 버튼을 누르면 등록이 최종 완료됩니다.');
                
                addSiteModal.style.display = 'none';
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
    
    // Fetch and Render requested sites from GitHub Issues API
    function renderRequestedSites() {
        if (!requestedSitesList) return;
        
        requestedSitesList.innerHTML = `<li style="color: var(--text-muted); font-size: 13px; padding: 16px 0; text-align: center;"><div class="spinner" style="width:20px; height:20px; margin: 0 auto 8px auto;"></div>로딩 중...</li>`;
        requestedSitesCount.textContent = '...';
        
        const tokenStatusInfo = document.getElementById('token-status-info');
        if (tokenStatusInfo) tokenStatusInfo.style.display = 'none';
        if (requestedSitesActions) requestedSitesActions.style.display = 'none';
        
        const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/issues?state=open&labels=site-request&per_page=100`;
        
        const headers = {};
        const token = localStorage.getItem('monitor_github_token');
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }
        
        fetch(apiUrl, { headers: headers })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`API error (Status: ${res.status})`);
                }
                return res.json();
            })
            .then(data => {
                requestedSitesList.innerHTML = '';
                
                // Show token status if token is set
                if (token && tokenStatusInfo) {
                    tokenStatusInfo.style.display = 'block';
                    const btnDeletePat = document.getElementById('btn-delete-pat');
                    if (btnDeletePat) {
                        btnDeletePat.addEventListener('click', () => {
                            if (confirm('저장된 GitHub Access Token을 삭제하시겠습니까?')) {
                                localStorage.removeItem('monitor_github_token');
                                renderRequestedSites();
                            }
                        });
                    }
                }
                
                // Filter and map issues
                const requests = data.map(issue => {
                    // Try to parse URL from the issue body
                    let url = '';
                    const body = issue.body || '';
                    const urlMatch = body.match(/- \*\*URL\*\*:\s*([^\n]+)/i) || body.match(/URL:\s*([^\n]+)/i);
                    if (urlMatch) {
                        url = urlMatch[1].trim();
                    } else {
                        // Fallback: search for any http link in the body
                        const httpMatch = body.match(/https?:\/\/[^\s]+/);
                        url = httpMatch ? httpMatch[0] : issue.html_url;
                    }
                    
                    // Parse requester
                    let requester = '';
                    const reqMatch = body.match(/- \*\*요청자\*\*:\s*([^\n]+)/i);
                    if (reqMatch) {
                        requester = reqMatch[1].trim();
                    }
                    
                    // Clean up title
                    let name = issue.title.replace(/\[사이트\s*수집\s*요청\]/g, '').trim();
                    name = name.replace(/\(요청자:\s*[^\)]+\)/i, '').trim();
                    
                    return {
                        id: issue.id,
                        name: name || '이름 없음',
                        url: url,
                        requester: requester,
                        html_url: issue.html_url,
                        number: issue.number,
                        author: issue.user ? issue.user.login : 'unknown',
                        date: new Date(issue.created_at).toLocaleDateString('ko-KR')
                    };
                });
                
                requestedSitesCount.textContent = requests.length;
                
                if (requests.length === 0) {
                    requestedSitesList.innerHTML = `<li style="color: var(--text-muted); font-size: 13px; padding: 16px 0; text-align: center;">등록된 요청 사이트가 없습니다.</li>`;
                    if (requestedSitesActions) requestedSitesActions.style.display = 'none';
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
                                <span style="font-size:11px; font-weight:normal; color:var(--text-muted); display:inline-block; margin-left:4px;">#${site.number}</span>
                            </span>
                            <a href="${escapeHtml(site.url)}" target="_blank" class="site-url-text">${escapeHtml(site.url)}</a>
                        </div>
                        <a href="${escapeHtml(site.html_url)}" target="_blank" class="table-icon-btn" title="GitHub 이슈에서 보기/관리" style="margin-left: 10px; background-color: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-secondary); width: 32px; height: 32px; border-radius: 8px;">
                            <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                        </a>
                    `;
                    requestedSitesList.appendChild(li);
                });
                
                lucide.createIcons();
            })
            .catch(err => {
                console.error('Failed to fetch requested sites:', err);
                let errorHtml = `
                    <li style="color: #ef4444; font-size: 13px; padding: 16px 0; text-align: center;">
                        데이터를 불러오지 못했습니다.<br>오류: ${err.message}
                    </li>
                `;
                
                if (err.message.includes('404')) {
                    errorHtml += `
                        <div class="token-input-box" style="margin-top: 15px; padding: 15px; background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 12px; text-align: left;">
                            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:10px; line-height:1.5;">
                                🔒 이 저장소는 <strong>비공개(Private)</strong> 상태이거나 권한이 없습니다. 수집 요청 목록을 불러오고 새 사이트를 등록하려면 깃허브 액세스 토큰(PAT)이 필요합니다.
                            </p>
                            <div style="display:flex; gap:10px;">
                                <input type="password" id="github-pat-input" placeholder="ghp_..." style="flex:1; padding:8px 12px; border:1px solid var(--border-color); border-radius:8px; font-size:13px; background-color:var(--bg-surface); color:var(--text-primary); outline:none;">
                                <button id="btn-save-pat" class="btn-primary btn-sm" style="margin:0; height:auto; padding:8px 16px;">저장</button>
                            </div>
                            <p style="font-size:11px; color:var(--text-muted); margin-top:8px; line-height:1.4;">
                                * 입력한 토큰은 브라우저(localStorage)에만 안전하게 저장됩니다. (권한: <strong>repo</strong> 또는 <strong>issues (read/write)</strong> 권한 필요)
                            </p>
                        </div>
                    `;
                } else if (token && (err.message.includes('401') || err.message.includes('403'))) {
                    errorHtml += `
                        <div class="token-input-box" style="margin-top: 15px; padding: 15px; background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 12px; text-align: center;">
                            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:10px; line-height:1.5;">
                                🔑 저장된 토큰이 만료되었거나 권한이 없습니다. (Status 401/403)
                            </p>
                            <button id="btn-error-clear-token" class="btn-secondary btn-sm" style="margin: 0 auto;">저장된 토큰 삭제하고 재시도</button>
                        </div>
                    `;
                }
                
                requestedSitesList.innerHTML = errorHtml;
                requestedSitesCount.textContent = '0';
                
                // Attach event listener for save token button
                const btnSavePat = document.getElementById('btn-save-pat');
                if (btnSavePat) {
                    btnSavePat.addEventListener('click', () => {
                        const patInput = document.getElementById('github-pat-input');
                        if (patInput && patInput.value.trim()) {
                            localStorage.setItem('monitor_github_token', patInput.value.trim());
                            renderRequestedSites();
                        }
                    });
                }
                
                // Attach event listener for error clear token button
                const btnErrorClearToken = document.getElementById('btn-error-clear-token');
                if (btnErrorClearToken) {
                    btnErrorClearToken.addEventListener('click', () => {
                        localStorage.removeItem('monitor_github_token');
                        renderRequestedSites();
                    });
                }
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
    
    // Load preseeded profiles and local custom profiles
    const localProfiles = localStorage.getItem('dashboard_user_profiles');
    if (localProfiles) {
        userProfiles = JSON.parse(localProfiles);
        renderUserChips();
    } else {
        // Fetch users.json
        fetch(`/data/users.json?t=${new Date().getTime()}`)
            .then(res => res.json())
            .then(data => {
                userProfiles = data;
                localStorage.setItem('dashboard_user_profiles', JSON.stringify(userProfiles));
                renderUserChips();
            })
            .catch(err => {
                console.error("Failed to load users.json:", err);
                userProfiles = [];
                renderUserChips();
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
            
            // Save & re-render
            localStorage.setItem('dashboard_user_profiles', JSON.stringify(userProfiles));
            renderUserChips();
            renderUserList();
            resetUserForm();
            applyFilters();
            
            alert('사용자 정보가 성공적으로 저장되었습니다.');
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
                    localStorage.setItem('dashboard_user_profiles', JSON.stringify(userProfiles));
                    
                    if (activeUserId === id) {
                        activeUserId = 'ALL';
                    }
                    
                    renderUserChips();
                    renderUserList();
                    resetUserForm();
                    applyFilters();
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
