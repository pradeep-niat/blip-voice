// MOCK DATA storage (since backend is in-memory)
// In a real app, these would be fetched from the API
const MOCK_DATA = {
    agents: [],
    customers: [
        { id: 1, name: "John Doe", phone: "+15550101", email: "john@example.com", tags: "lead, cold" },
        { id: 2, name: "Jane Smith", phone: "+15550102", email: "jane@company.com", tags: "customer, active" }
    ],
    campaigns: []
};

// --- AUTHENTICATION & ROUTING ---

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in (mock)
    const user = localStorage.getItem('user');
    if (user) {
        showApp();
    } else {
        showAuth();
    }

    setupNavigation();
    setupAuthForms();
    setupModals();
    setupForms();

    // Initial fetch of data if logged in
    if (user) refreshData();
});

function showAuth() {
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('app-layout').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('app-layout').style.display = 'flex';
    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('welcome-text').innerText = `Welcome back, ${user.name}`;
    document.getElementById('user-name-display').innerText = user.name;
    refreshData();
}

function setupAuthForms() {
    const loginForm = document.getElementById('auth-form');
    const toggleLink = document.getElementById('toggle-auth');
    const nameGroup = document.getElementById('name-group');
    const businessGroup = document.getElementById('business-group');
    const title = document.getElementById('auth-title');
    const submitBtn = document.getElementById('auth-submit');

    let isSignup = false;

    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isSignup = !isSignup;
        if (isSignup) {
            nameGroup.style.display = 'block';
            businessGroup.style.display = 'block';
            title.innerText = 'Create your account';
            submitBtn.innerText = 'Sign Up';
            toggleLink.innerText = 'Already have an account? Login';
        } else {
            nameGroup.style.display = 'none';
            businessGroup.style.display = 'none';
            title.innerText = 'Login to Blip Voice';
            submitBtn.innerText = 'Login';
            toggleLink.innerText = "Don't have an account? Sign up";
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const name = document.getElementById('fullname').value || "User";

        // Mock Login
        const user = { name: name, email: email, business: "Demo Corp" };
        localStorage.setItem('user', JSON.stringify(user));
        showApp();
    });

    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('user');
        showAuth();
    });
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            if (!pageId) return;

            // Nav active state
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // View switching
            document.querySelectorAll('.content-view').forEach(view => {
                view.classList.remove('active');
            });
            document.getElementById(`view-${pageId}`).classList.add('active');
            document.getElementById('page-title').innerText = pageId.charAt(0).toUpperCase() + pageId.slice(1);
        });
    });
}

// --- MODALS ---

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function setupModals() {
    window.onclick = function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }
}

// --- DATA & API HANDLING ---

async function refreshData() {
    updateDashboardStats();
    renderAgents();
    renderCustomers();
    renderCampaigns();
    await fetchCalls(); // This hits the real (or proxy) endpoint
}


// 1. CALLS (Real Backend)
async function fetchCalls() {
    try {
        const response = await axios.get('/calls');
        const data = response.data;

        // Update Stats
        document.getElementById('total-calls-count').innerText = data.summary.totalCalls;
        document.getElementById('calls-success-rate').innerText = data.summary.successRate;
        document.getElementById('calls-total').innerText = data.summary.totalCalls;

        // Render Table
        const tbody = document.getElementById('calls-table-body');
        const recentBody = document.getElementById('recent-calls-body');

        tbody.innerHTML = '';
        recentBody.innerHTML = '';

        const calls = data.calls.reverse(); // Newest first

        calls.forEach((call, index) => {
            const row = `
                <tr>
                    <td>${call.customer_name || 'Guest'}</td>
                    <td>${call.number}</td>
                    <td><span class="status-badge status-${call.status === 'completed' ? 'completed' : 'active'}">${call.status}</span></td>
                    <td>${call.score !== undefined ? call.score + '/100' : '-'}</td>
                    <td>${call.duration}s</td>
                    <td>${call.recordingUrl ? `<a href="${call.recordingUrl}" target="_blank">Listen</a>` : '-'}</td>
                    <td>${call.transcript ? `<button class="btn-secondary" onclick='viewTranscript(${JSON.stringify(call.transcript)})'>View</button>` : '-'}</td>
                </tr>
            `;
            tbody.innerHTML += row;

            // Add to recent calls (dashboard) - limit 5
            if (index < 5) {
                recentBody.innerHTML += `
                    <tr>
                         <td>${call.customer_name || 'Guest'}</td>
                         <td>AI Agent</td>
                         <td><span class="status-badge status-${call.status === 'completed' ? 'completed' : 'active'}">${call.status}</span></td>
                         <td>${call.score !== undefined ? call.score : '-'}</td>
                         <td>${new Date(call.createdAt).toLocaleDateString()}</td>
                    </tr>
                `;
            }
        });

    } catch (error) {
        console.error("Error fetching calls:", error);
    }
}

window.viewTranscript = function (text) {
    document.getElementById('transcript-text').innerText = text;
    showModal('transcript-modal');
}


// --- START CALL FUNCTIONALITY ---

// Quick Test Button Handler
document.getElementById('start-test-call-btn')?.addEventListener('click', async () => {
    const phoneInput = document.getElementById('quick-test-phone');
    const phone = phoneInput.value;
    const statusMsg = document.getElementById('call-status-message');
    const btn = document.getElementById('start-test-call-btn');

    if (!phone) {
        alert("Please enter a phone number");
        return;
    }

    // Loading State
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> Calling...';
    statusMsg.innerText = "";

    try {
        // CALLING THE BACKEND ENDPOINT
        const response = await axios.post('https://blip-voice.onrender.com/start-call', {
            phone_number: phone
        });

        statusMsg.innerText = "✅ Call Initiated Successfuly!";
        statusMsg.style.color = "green";

        // Refresh calls list after a slight delay to show the queued call
        setTimeout(fetchCalls, 2000);

    } catch (error) {
        console.error("Call failed:", error);
        statusMsg.innerText = "❌ Call Failed: " + (error.response?.data?.error || error.message);
        statusMsg.style.color = "red";
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Start Test Call';
    }
});


// --- MOCK CRUD OPERATIONS ---

function renderAgents() {
    const tbody = document.getElementById('agents-table-body');
    tbody.innerHTML = '';

    // Add demo data if empty
    if (MOCK_DATA.agents.length === 0) {
        MOCK_DATA.agents.push({ name: "Sales Bot 1", role: "Sales", status: "Active", created: new Date().toLocaleDateString() });
    }

    document.getElementById('total-agents').innerText = MOCK_DATA.agents.length;

    MOCK_DATA.agents.forEach(agent => {
        tbody.innerHTML += `
            <tr>
                <td>${agent.name}</td>
                <td>${agent.role}</td>
                <td><span class="status-badge status-active">${agent.status}</span></td>
                <td>${agent.created}</td>
                <td><button class="btn-secondary">Edit</button></td>
            </tr>
        `;
    });

    // Update dropdown in campaign modal
    const select = document.getElementById('campaign-agent-select');
    select.innerHTML = '';
    MOCK_DATA.agents.forEach(agent => {
        const option = document.createElement('option');
        option.text = agent.name;
        select.add(option);
    });
}

function setupForms() {
    // Create Agent
    document.getElementById('create-agent-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const inputs = e.target.querySelectorAll('input, select');
        MOCK_DATA.agents.push({
            name: inputs[0].value,
            role: inputs[1].value,
            status: "Active",
            created: new Date().toLocaleDateString()
        });
        closeModal('create-agent-modal');
        renderAgents();
    });

    // Add Customer
    document.getElementById('add-customer-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const inputs = e.target.querySelectorAll('input');
        MOCK_DATA.customers.push({
            name: inputs[0].value,
            phone: inputs[1].value,
            email: inputs[2].value,
            tags: "new",
            created: new Date().toLocaleDateString()
        });
        closeModal('add-customer-modal');
        renderCustomers();
    });

    // Create Campaign
    document.getElementById('create-campaign-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const inputs = e.target.querySelectorAll('input, select');
        MOCK_DATA.campaigns.push({
            name: inputs[0].value,
            agent: inputs[1].value,
            status: "Draft",
            customers: 0,
            created: new Date().toLocaleDateString()
        });
        closeModal('create-campaign-modal');
        renderCampaigns();
    });
}

function renderCustomers() {
    const tbody = document.getElementById('customers-table-body');
    tbody.innerHTML = '';
    document.getElementById('total-customers').innerText = MOCK_DATA.customers.length;

    MOCK_DATA.customers.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.email}</td>
                <td>${c.tags}</td>
                <td><button class="btn-secondary">Edit</button></td>
            </tr>
        `;
    });
}

function renderCampaigns() {
    const tbody = document.getElementById('campaigns-table-body');
    tbody.innerHTML = '';
    document.getElementById('total-campaigns').innerText = MOCK_DATA.campaigns.length;

    MOCK_DATA.campaigns.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${c.name}</td>
                <td>${c.agent}</td>
                <td><span class="status-badge status-draft">${c.status}</span></td>
                <td>${c.customers}</td>
                <td>${c.created}</td>
            </tr>
        `;
    });
}

function updateDashboardStats() {
    // Simple update of counts from rendered data arrays
    // In real app, this would be a separate endpoints
}
