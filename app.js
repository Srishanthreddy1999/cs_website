const STORAGE_KEY = "checksheet-portal-data-v1";
const SESSION_KEY = "checksheet-portal-session-v1";
const { jsPDF } = window.jspdf;

let appState = loadState();
let currentUser = loadSession();

seedDemoData();
updateClock();
setInterval(updateClock, 1000);
setupEvents();
renderApp();

function seedDemoData() {
  if (appState.seeded) {
    return;
  }

  appState = {
    seeded: true,
    users: [
      {
        id: "u-admin",
        employeeId: "ADMIN001",
        name: "Main Admin",
        dob: "1990-01-01",
        password: "admin123",
        department: "Administration",
        reportingPerson: "Management",
        role: "admin",
        createdOn: new Date().toISOString()
      },
      {
        id: "u-emp-1",
        employeeId: "EMP001",
        name: "Ravi Kumar",
        dob: "1998-06-15",
        password: "emp123",
        department: "Quality",
        reportingPerson: "Suresh",
        role: "employee",
        createdOn: new Date().toISOString()
      }
    ],
    templates: [
      {
        id: "tpl-1",
        moduleName: "Motor Housing Inspection",
        partNo: "MH-1001",
        level: "IPQC",
        createdOn: new Date().toISOString(),
        checkpoints: [
          "Surface condition",
          "Part number marking",
          "Dimension alignment"
        ],
        fileName: "motor-housing.xlsx"
      }
    ],
    entries: []
  };

  persistState();
}

function resetDemoData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
  appState = loadState();
  currentUser = null;
  seedDemoData();
  renderApp();
  showToast("Demo data has been reset.");
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
      seeded: false,
      users: [],
      templates: [],
      entries: []
    };
  } catch (error) {
    return {
      seeded: false,
      users: [],
      templates: [],
      entries: []
    };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (error) {
    return null;
  }
}

function persistSession() {
  if (currentUser) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function setupEvents() {
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("logoutButton").addEventListener("click", handleLogout);
  document.getElementById("resetSeedButton").addEventListener("click", resetDemoData);
  document.getElementById("employeeForm").addEventListener("submit", handleEmployeeCreate);
  document.getElementById("templateForm").addEventListener("submit", handleTemplateCreate);
  document.getElementById("templateSearch").addEventListener("input", renderTemplatesTable);
  document.getElementById("entryTemplateSelect").addEventListener("change", renderEntryTemplate);
  document.getElementById("entryForm").addEventListener("submit", handleEntrySubmit);
  document.getElementById("clearEntryButton").addEventListener("click", clearEntryForm);
  document.getElementById("dashboardSearchButton").addEventListener("click", renderDashboardSearch);
  document.getElementById("dashboardSearchClearButton").addEventListener("click", clearDashboardSearch);

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", () => openPage(button.dataset.page));
  });
}

function handleLogin(event) {
  event.preventDefault();

  const employeeId = document.getElementById("loginEmployeeId").value.trim();
  const password = document.getElementById("loginPassword").value;

  const matchedUser = appState.users.find((user) => (
    user.employeeId.toLowerCase() === employeeId.toLowerCase() && user.password === password
  ));

  if (!matchedUser) {
    showToast("Invalid employee ID or password.", true);
    return;
  }

  currentUser = {
    id: matchedUser.id,
    employeeId: matchedUser.employeeId,
    name: matchedUser.name,
    department: matchedUser.department,
    role: matchedUser.role,
    reportingPerson: matchedUser.reportingPerson,
    dob: matchedUser.dob
  };

  persistSession();
  document.getElementById("loginForm").reset();
  renderApp();
  showToast("Signed in successfully.");
}

function handleLogout() {
  currentUser = null;
  persistSession();
  renderApp();
}

function renderApp() {
  const loginView = document.getElementById("loginView");
  const appView = document.getElementById("appView");

  if (!currentUser) {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    return;
  }

  loginView.classList.add("hidden");
  appView.classList.remove("hidden");

  document.getElementById("sidebarName").textContent = currentUser.name;
  document.getElementById("sidebarRole").textContent = currentUser.role.toUpperCase();
  document.getElementById("sidebarDepartment").textContent = currentUser.department;
  document.getElementById("topbarUser").textContent = currentUser.name + " | " + currentUser.employeeId;

  const adminOnlyButtons = document.querySelectorAll("[data-admin-only='true']");
  adminOnlyButtons.forEach((button) => {
    button.classList.toggle("hidden", currentUser.role !== "admin");
  });

  if (currentUser.role !== "admin" && ["usersPage", "templatesPage"].includes(getActivePageId())) {
    openPage("dashboardPage");
  } else {
    refreshCurrentPage();
  }
}

function getActivePageId() {
  const active = document.querySelector(".page.active");
  return active ? active.id : "dashboardPage";
}

function openPage(pageId) {
  if (currentUser.role !== "admin" && ["usersPage", "templatesPage"].includes(pageId)) {
    showToast("Employees have only data entry and profile access.", true);
    return;
  }

  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });

  const pageMap = {
    dashboardPage: {
      title: "Dashboard",
      subtitle: "Overview of modules, users, templates, and recent entries."
    },
    usersPage: {
      title: "Users",
      subtitle: "Create and view employee accounts."
    },
    templatesPage: {
      title: "Templates",
      subtitle: "Create module templates from uploaded Excel checkpoints."
    },
    entryPage: {
      title: "Daily Data Entry",
      subtitle: "Fill check sheets using the templates created by admin."
    },
    profilePage: {
      title: "Profile",
      subtitle: "Employee account details and basic role information."
    }
  };

  document.getElementById("pageTitle").textContent = pageMap[pageId].title;
  document.getElementById("pageSubtitle").textContent = pageMap[pageId].subtitle;
  refreshCurrentPage();
}

function refreshCurrentPage() {
  renderDashboard();
  renderUsers();
  renderTemplates();
  renderEntryTemplateOptions();
  renderProfile();
}

function renderDashboard() {
  document.getElementById("totalModulesMetric").textContent = getModuleCount();
  document.getElementById("totalUsersMetric").textContent = appState.users.length;
  document.getElementById("totalTemplatesMetric").textContent = appState.templates.length;
  renderRecentEntries();
  renderDashboardSearch();
}

function getModuleCount() {
  return new Set(appState.templates.map((template) => template.moduleName)).size;
}

function renderRecentEntries() {
  const wrap = document.getElementById("recentEntriesWrap");
  let entries = [...appState.entries].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  if (currentUser.role !== "admin") {
    entries = entries.filter((entry) => entry.inspectedById === currentUser.employeeId);
  }

  entries = entries.slice(0, 5);

  if (!entries.length) {
    wrap.innerHTML = '<div class="empty-state">No recently entered data yet.</div>';
    return;
  }

  wrap.innerHTML = renderTable(
    ["S.No", "Part No", "Module", "Date", "Inspected By", "Verified By", "Download"],
    entries.map((entry, index) => [
      index + 1,
      entry.partNo,
      entry.moduleName,
      formatDateTime(entry.savedAt).date,
      entry.inspectedBy,
      entry.verifiedBy,
      `<button class="ghost-btn" type="button" onclick="downloadEntryPdf('${entry.id}')">Download</button>`
    ])
  );
}

function renderDashboardSearch() {
  const searchValue = document.getElementById("dashboardSearchPart").value.trim().toLowerCase();
  const resultsWrap = document.getElementById("dashboardSearchResults");

  let entries = [...appState.entries];
  if (currentUser.role !== "admin") {
    entries = entries.filter((entry) => entry.inspectedById === currentUser.employeeId);
  }

  if (searchValue) {
    entries = entries.filter((entry) => entry.partNo.toLowerCase().includes(searchValue));
  }

  if (!entries.length) {
    resultsWrap.innerHTML = '<div class="empty-state">No previous check sheet found for this search.</div>';
    return;
  }

  resultsWrap.innerHTML = renderTable(
    ["S.No", "Part No", "Module", "Saved On", "Inspected By", "Download"],
    entries.map((entry, index) => [
      index + 1,
      entry.partNo,
      entry.moduleName,
      formatDateTime(entry.savedAt).full,
      entry.inspectedBy,
      `<button class="ghost-btn" type="button" onclick="downloadEntryPdf('${entry.id}')">Download PDF</button>`
    ])
  );
}

function clearDashboardSearch() {
  document.getElementById("dashboardSearchPart").value = "";
  renderDashboardSearch();
}

function handleEmployeeCreate(event) {
  event.preventDefault();

  if (currentUser.role !== "admin") {
    showToast("Only admin can create employee accounts.", true);
    return;
  }

  const employeeId = document.getElementById("employeeCode").value.trim();
  const alreadyExists = appState.users.some((user) => user.employeeId.toLowerCase() === employeeId.toLowerCase());

  if (alreadyExists) {
    showToast("Employee ID already exists.", true);
    return;
  }

  const newUser = {
    id: "u-" + Date.now(),
    employeeId,
    name: document.getElementById("employeeName").value.trim(),
    dob: document.getElementById("employeeDob").value,
    password: document.getElementById("employeePassword").value,
    department: document.getElementById("employeeDepartment").value.trim(),
    reportingPerson: document.getElementById("employeeReporting").value.trim(),
    role: "employee",
    createdOn: new Date().toISOString()
  };

  appState.users.push(newUser);
  persistState();
  document.getElementById("employeeForm").reset();
  refreshCurrentPage();
  showToast("Employee account created.");
}

function renderUsers() {
  const usersWrap = document.getElementById("usersTableWrap");
  const employees = appState.users.filter((user) => user.role === "employee");

  document.getElementById("employeeCountMetric").textContent = employees.length;
  document.getElementById("userSummaryState").textContent = employees.length
    ? "Employees listed below can sign in using employee ID and password."
    : "No employee accounts created yet.";

  if (currentUser.role !== "admin") {
    usersWrap.innerHTML = '<div class="empty-state">Users page is available only for admin.</div>';
    return;
  }

  usersWrap.innerHTML = employees.length
    ? renderTable(
        ["S.No", "Name", "ID", "Department"],
        employees.map((user, index) => [index + 1, user.name, user.employeeId, user.department])
      )
    : '<div class="empty-state">No employee users available yet.</div>';
}

async function handleTemplateCreate(event) {
  event.preventDefault();

  if (currentUser.role !== "admin") {
    showToast("Only admin can create templates.", true);
    return;
  }

  const partNo = document.getElementById("templatePartNo").value.trim();
  const duplicate = appState.templates.some((template) => template.partNo.toLowerCase() === partNo.toLowerCase());

  if (duplicate) {
    showToast("Template with this part number already exists.", true);
    return;
  }

  const fileInput = document.getElementById("templateFile");
  const file = fileInput.files[0];

  if (!file) {
    showToast("Please upload an Excel file.", true);
    return;
  }

  try {
    const checkpoints = await readCheckpointsFromExcel(file);

    if (!checkpoints.length) {
      showToast("No checkpoints found in the uploaded file.", true);
      return;
    }

    appState.templates.push({
      id: "tpl-" + Date.now(),
      moduleName: document.getElementById("templateModuleName").value.trim(),
      partNo,
      level: document.getElementById("templateLevel").value,
      createdOn: new Date().toISOString(),
      checkpoints,
      fileName: file.name
    });

    persistState();
    document.getElementById("templateForm").reset();
    refreshCurrentPage();
    showToast("Template created successfully.");
  } catch (error) {
    showToast("Excel file could not be read. Please check the format.", true);
  }
}

function readCheckpointsFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const checkpoints = rows
          .map((row) => Array.isArray(row) ? String(row[0] || "").trim() : "")
          .filter((value) => value && value.toLowerCase() !== "checkpoint");

        resolve(checkpoints);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function renderTemplates() {
  renderTemplatesTable();
}

function renderTemplatesTable() {
  const wrap = document.getElementById("templatesTableWrap");
  const searchValue = document.getElementById("templateSearch").value.trim().toLowerCase();

  let templates = [...appState.templates].sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
  if (searchValue) {
    templates = templates.filter((template) => (
      template.partNo.toLowerCase().includes(searchValue) ||
      template.moduleName.toLowerCase().includes(searchValue)
    ));
  }

  if (currentUser.role !== "admin") {
    wrap.innerHTML = '<div class="empty-state">Templates page is available only for admin.</div>';
    return;
  }

  wrap.innerHTML = templates.length
    ? renderTable(
        ["S.No", "Part No", "Name of Module", "Level", "Created On", "Check Sheet Download"],
        templates.map((template, index) => [
          index + 1,
          template.partNo,
          template.moduleName,
          template.level,
          formatDateTime(template.createdOn).date,
          `<button class="ghost-btn" type="button" onclick="downloadTemplateCheckpoints('${template.id}')">Download</button>`
        ])
      )
    : '<div class="empty-state">No templates available yet.</div>';
}

function renderEntryTemplateOptions() {
  const select = document.getElementById("entryTemplateSelect");
  const templates = appState.templates;

  const currentValue = select.value;
  select.innerHTML = '<option value="">Select Module</option>' + templates.map((template) => (
    `<option value="${template.id}">${template.moduleName} | ${template.partNo}</option>`
  )).join("");

  if (templates.some((template) => template.id === currentValue)) {
    select.value = currentValue;
  }

  document.getElementById("entryDate").value = formatDateTime(new Date().toISOString()).date;
  document.getElementById("entryTime").value = formatDateTime(new Date().toISOString()).time;
  document.getElementById("entryInspectedBy").value = currentUser.name;
  renderEntryTemplate();
}

function renderEntryTemplate() {
  const templateId = document.getElementById("entryTemplateSelect").value;
  const template = appState.templates.find((item) => item.id === templateId);
  const meta = document.getElementById("entryTemplateMeta");
  const form = document.getElementById("entryForm");
  const emptyState = document.getElementById("entryEmptyState");
  const checkpointRows = document.getElementById("checkpointRows");
  const verifiedField = document.getElementById("entryVerifiedBy");

  verifiedField.value = currentUser.reportingPerson || "";

  if (!template) {
    meta.classList.add("hidden");
    form.classList.add("hidden");
    emptyState.classList.remove("hidden");
    checkpointRows.innerHTML = "";
    return;
  }

  meta.classList.remove("hidden");
  form.classList.remove("hidden");
  emptyState.classList.add("hidden");

  meta.innerHTML = `
    <div class="card-header">
      <div>
        <h3>Selected Template</h3>
        <p>Uploaded checkpoint list loaded for daily entry.</p>
      </div>
    </div>
    <div class="template-summary">
      <div class="mini-card"><strong>Module</strong>${template.moduleName}</div>
      <div class="mini-card"><strong>Part Number</strong>${template.partNo}</div>
      <div class="mini-card"><strong>Level</strong>${template.level}</div>
      <div class="mini-card"><strong>Uploaded File</strong>${template.fileName}</div>
    </div>
  `;

  checkpointRows.innerHTML = template.checkpoints.map((checkpoint, index) => `
    <div class="check-row">
      <div class="field">
        <label>Serial No</label>
        <input type="text" data-field="serial" data-index="${index}" placeholder="Enter serial no" required />
      </div>
      <div>
        <strong>${index + 1}. ${checkpoint}</strong>
      </div>
      <div class="radio-pair">
        <label class="radio-pill">
          <input type="radio" name="status-${index}" value="OK" required />
          OK
        </label>
        <label class="radio-pill">
          <input type="radio" name="status-${index}" value="Not OK" required />
          Not OK
        </label>
      </div>
    </div>
  `).join("");
}

function clearEntryForm() {
  const templateId = document.getElementById("entryTemplateSelect").value;
  document.getElementById("entryRemarks").value = "";
  document.getElementById("entryGeneralSerial").value = "";
  document.getElementById("entryVerifiedBy").value = currentUser.reportingPerson || "";

  if (templateId) {
    renderEntryTemplate();
  }
}

function handleEntrySubmit(event) {
  event.preventDefault();

  const templateId = document.getElementById("entryTemplateSelect").value;
  const template = appState.templates.find((item) => item.id === templateId);

  if (!template) {
    showToast("Please select a module first.", true);
    return;
  }

  const rows = template.checkpoints.map((checkpoint, index) => {
    const serial = document.querySelector(`[data-field="serial"][data-index="${index}"]`).value.trim();
    const checkedStatus = document.querySelector(`input[name="status-${index}"]:checked`);
    return {
      checkpoint,
      serialNo: serial,
      status: checkedStatus ? checkedStatus.value : ""
    };
  });

  const missing = rows.some((row) => !row.serialNo || !row.status);
  if (missing) {
    showToast("Please enter serial number and status for all checkpoints.", true);
    return;
  }

  const entry = {
    id: "entry-" + Date.now(),
    templateId: template.id,
    moduleName: template.moduleName,
    partNo: template.partNo,
    level: template.level,
    date: document.getElementById("entryDate").value,
    time: document.getElementById("entryTime").value,
    inspectedBy: currentUser.name,
    inspectedById: currentUser.employeeId,
    verifiedBy: document.getElementById("entryVerifiedBy").value.trim(),
    serialPrefix: document.getElementById("entryGeneralSerial").value.trim(),
    remarks: document.getElementById("entryRemarks").value.trim(),
    checkpoints: rows,
    savedAt: new Date().toISOString()
  };

  if (!entry.verifiedBy) {
    showToast("Please enter verified by name.", true);
    return;
  }

  appState.entries.push(entry);
  persistState();
  downloadEntryPdf(entry.id);
  refreshCurrentPage();
  clearEntryForm();
  showToast("Entry saved and PDF downloaded.");
}

function renderProfile() {
  const profileWrap = document.getElementById("profileDetails");
  profileWrap.innerHTML = `
    <div class="mini-card"><strong>Employee Code</strong>${currentUser.employeeId}</div>
    <div class="mini-card"><strong>Name</strong>${currentUser.name}</div>
    <div class="mini-card"><strong>Role</strong>${currentUser.role}</div>
    <div class="mini-card"><strong>Department</strong>${currentUser.department}</div>
    <div class="mini-card"><strong>Date of Birth</strong>${currentUser.dob || "-"}</div>
    <div class="mini-card"><strong>Reporting Person</strong>${currentUser.reportingPerson || "-"}</div>
  `;
}

function renderTable(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function updateClock() {
  const now = new Date();
  const parts = formatDateTime(now.toISOString());
  const topbarDate = document.getElementById("topbarDate");
  if (topbarDate) {
    topbarDate.textContent = parts.full;
  }

  const entryDate = document.getElementById("entryDate");
  const entryTime = document.getElementById("entryTime");
  if (entryDate) {
    entryDate.value = parts.date;
  }
  if (entryTime) {
    entryTime.value = parts.time;
  }
}

function formatDateTime(value) {
  const date = new Date(value);
  const optionsDate = { day: "2-digit", month: "short", year: "numeric" };
  const optionsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit" };
  return {
    date: date.toLocaleDateString("en-GB", optionsDate),
    time: date.toLocaleTimeString("en-GB", optionsTime),
    full: date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  };
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.background = isError ? "#a53d37" : "#1f4f32";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function findTemplateById(templateId) {
  return appState.templates.find((template) => template.id === templateId);
}

window.downloadTemplateCheckpoints = function downloadTemplateCheckpoints(templateId) {
  const template = findTemplateById(templateId);
  if (!template) {
    showToast("Template not found.", true);
    return;
  }

  const csvLines = ["Checkpoint", ...template.checkpoints].join("\n");
  downloadTextFile(`${template.partNo}-checkpoints.csv`, csvLines, "text/csv");
};

window.downloadEntryPdf = function downloadEntryPdf(entryId) {
  const entry = appState.entries.find((item) => item.id === entryId);
  if (!entry) {
    showToast("Entry not found.", true);
    return;
  }

  const doc = new jsPDF();
  const left = 14;
  let y = 16;

  doc.setFontSize(18);
  doc.text("Daily Check Sheet Report", left, y);
  y += 10;

  doc.setFontSize(11);
  doc.text(`Module: ${entry.moduleName}`, left, y);
  y += 7;
  doc.text(`Part No: ${entry.partNo}`, left, y);
  y += 7;
  doc.text(`Level: ${entry.level}`, left, y);
  y += 7;
  doc.text(`Date: ${entry.date}`, left, y);
  y += 7;
  doc.text(`Time: ${entry.time}`, left, y);
  y += 7;
  doc.text(`Inspected By: ${entry.inspectedBy}`, left, y);
  y += 7;
  doc.text(`Verified By: ${entry.verifiedBy}`, left, y);
  y += 10;

  doc.setFontSize(10);
  entry.checkpoints.forEach((row, index) => {
    if (y > 255) {
      doc.addPage();
      y = 18;
    }

    const line = `${index + 1}. ${row.checkpoint} | Serial No: ${row.serialNo} | Status: ${row.status}`;
    doc.text(line, left, y);
    y += 8;
  });

  if (entry.remarks) {
    y += 4;
    doc.text(`Remarks: ${entry.remarks}`, left, y);
  }

  doc.setFontSize(11);
  doc.text(`${entry.inspectedBy}    ${entry.date}`, left, 280);
  doc.text(`${entry.verifiedBy}    ${entry.date}`, 120, 280);
  doc.text("Inspected By", left, 286);
  doc.text("Verified By", 120, 286);

  doc.save(`${entry.partNo}-${entry.date.replace(/\s/g, "-")}.pdf`);
};

function downloadTextFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
