// App State
let projects = [];
let filteredProjects = [];
let activeSource = 'ALL';
let searchKeyword = '';
let visibleCount = 15;

// Sorting states
let sortBy = 'id';
let sortOrder = 'desc';

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
const sourceConfig = {};

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
    filteredProjects = projects.filter(p => {
        const matchesSource = activeSource === 'ALL' || p.source === activeSource;
        const matchesSearch = !searchKeyword || 
            p.title.toLowerCase().includes(searchKeyword) || 
            p.source.toLowerCase().includes(searchKeyword);
        return matchesSource && matchesSearch;
    });
    
    sortData();
    renderGrid();
}

// Render Bulletin Board Rows
function renderGrid() {
    projectsListBody.innerHTML = '';
    
    if (filteredProjects.length === 0) {
        showEmptyState("검색 조건에 맞는 지원사업 공고가 없습니다.");
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
        tr.style.setProperty('--source-color', conf.color);
        
        tr.innerHTML = `
            <td style="color: var(--text-secondary); font-weight: 500;">${idx + 1}</td>
            <td><span class="table-source-tag">${conf.shortName}</span></td>
            <td>
                <a href="${escapeHtml(p.link)}" target="_blank" class="table-title-link" title="${escapeHtml(p.title)}">
                    ${escapeHtml(p.title)}
                </a>
            </td>
            <td class="table-date-cell">${escapeHtml(regDate)}</td>
            <td class="table-date-cell">${escapeHtml(displayColDate)}</td>
        `;
        projectsListBody.appendChild(tr);
    });
    
    showingCountText.textContent = `전체 ${filteredProjects.length}건 중 ${itemsToRender.length}건 표시 중`;
    
    if (filteredProjects.length > visibleCount) {
        paginationContainer.style.display = 'flex';
    } else {
        paginationContainer.style.display = 'none';
    }
    
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
