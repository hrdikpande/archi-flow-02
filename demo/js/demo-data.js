/* DrawingOps demo · deterministic seed data. Every number on every dashboard is computed from these
   records, so the screens always agree. All people, firms and projects are fictional. Dates are
   generated relative to the day the demo is first opened (or reset). */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});

  const PASSWORD = "Demo@2026";
  const ADMIN_TOTP = "246810";

  const ORG = {
    name: "Prasad Rao Associates", short: "PRA", tagline: "Architects and MEP engineers", address: "12, 3rd Cross, Indiranagar, Bengaluru 560038",
    timezone: "Asia/Kolkata (IST)", projectCodeFormat: "YYYY-NNN", workdays: [1, 2, 3, 4, 5], defaultCapacity: 45, digestTime: "08:30", linkDays: 30, ackDays: 5,
    sso: { provider: "microsoft", tenant: "prasadrao.example", enabled: true }, smtp: { mode: "demo", relay: "Demo mailbox (no real email is sent)" },
    revisionScheme: { series: [{ prefix: "P", label: "Preliminary" }, { prefix: "C", label: "Construction" }], digits: 2 },
    purposes: [
      { code: "FI", label: "For information", active: true }, { code: "FC", label: "For comment", active: true }, { code: "FA", label: "For approval", active: true },
      { code: "AS", label: "For authority submission", active: true }, { code: "FT", label: "For tender", active: true }, { code: "GFC", label: "Good for Construction (GFC)", active: true }, { code: "REC", label: "Record / as-built", active: true },
    ],
    suitability: [{ code: "S0", label: "Work in progress" }, { code: "S1", label: "Suitable for coordination" }, { code: "S2", label: "Suitable for information" }, { code: "S3", label: "Suitable for review and comment" }, { code: "S4", label: "Suitable for stage approval" }],
    rules: { "A-01": { days: 7, on: true }, "A-02": { escalate: 3, on: true }, "A-03": { on: true }, "A-04": { on: true }, "A-05": { over: 110, under: 50, on: true }, "A-06": { weekday: 2, time: "12:00", on: true }, "A-07": { days: 3, on: true }, "A-08": { days: 5, on: true }, "A-09": { on: true }, "A-10": { days: 2, on: true } },
    intelligence: { lateRisk: "on", forecast: "on", drawingChecks: "evaluation", historyMonths: 14, issuedRevisions: 3120, labelled: 214, precisionTarget: 0.8, precisionMeasured: 0.84 },
    billingColumns: ["project_code", "project_name", "client", "stage", "fee_pct", "fee_amount", "ready_date", "days_waiting", "approved_by", "approved_on"],
    webhook: { url: "https://accounts.prasadrao.example/hooks/drawingops", enabled: false, lastStatus: null },
  };

  const DISCIPLINES = [
    ["A", "Architecture"], ["S", "Structure"], ["C", "Civil"], ["M", "HVAC (Mechanical)"], ["E", "Electrical"], ["P", "Plumbing (PHE)"], ["F", "Fire protection"], ["X", "ELV"], ["G", "Medical gas"],
  ].map(([code, name], i) => ({ code, name, regex: `^${code}-\\d{3}$`, order: i, active: true }));

  // id, name, email, orgRole, discipline, title, capacity
  const USERS = [
    ["u_owner", "Nikhil Prasad", "owner@firm.example", "owner", "A", "Principal architect", 45],
    ["u_pl", "Priya Sharma", "lead@firm.example", "staff", "A", "Associate, project lead", 45],
    ["u_dl", "Anil Kapoor", "checker@firm.example", "staff", "A", "Discipline lead, Architecture", 45],
    ["u_des", "Rahul Kumar", "designer@firm.example", "staff", "M", "HVAC design engineer", 45],
    ["u_sr", "Sunita Rao", "senior@firm.example", "staff", "A", "Senior principal, QC", 45],
    ["u_dc", "Deepa Chandra", "dc@firm.example", "staff", "", "Document controller", 45],
    ["u_acc", "Meera Thomas", "accounts@firm.example", "accounts", "", "Accounts manager", 45],
    ["u_admin", "Asha Menon", "admin@firm.example", "admin", "", "IT and systems admin", 45],
    ["u_kar", "Karthik Iyer", "karthik.iyer@firm.example", "staff", "M", "Discipline lead, HVAC", 45],
    ["u_far", "Farhan Sheikh", "farhan.sheikh@firm.example", "staff", "E", "Discipline lead, Electrical", 45],
    ["u_lak", "Lakshmi Narayan", "lakshmi.narayan@firm.example", "staff", "P", "Discipline lead, Plumbing", 45],
    ["u_jos", "Joseph D'Souza", "joseph.dsouza@firm.example", "staff", "F", "Discipline lead, Fire", 45],
    ["u_viv", "Vivek Reddy", "vivek.reddy@firm.example", "staff", "S", "Discipline lead, Structure", 45],
    ["u_sur", "Suresh Gowda", "suresh.gowda@firm.example", "staff", "C", "Discipline lead, Civil", 45],
    ["u_meg", "Meghna Joshi", "meghna.joshi@firm.example", "staff", "A", "Architect", 45],
    ["u_arj", "Arjun Pillai", "arjun.pillai@firm.example", "staff", "A", "Architect", 45],
    ["u_sne", "Sneha Kulkarni", "sneha.kulkarni@firm.example", "staff", "A", "Architect", 45],
    ["u_tan", "Tanvi Shah", "tanvi.shah@firm.example", "staff", "A", "Architect (part-time)", 27],
    ["u_roh", "Rohan Das", "rohan.das@firm.example", "staff", "E", "Electrical design engineer", 45],
    ["u_kav", "Kavya Hegde", "kavya.hegde@firm.example", "staff", "M", "HVAC design engineer", 45],
    ["u_imr", "Imran Khan", "imran.khan@firm.example", "staff", "P", "Plumbing design engineer", 45],
    ["u_div", "Divya Menon", "divya.menon@firm.example", "staff", "X", "ELV design engineer", 45],
    ["u_ana", "Ananya Bose", "ananya.bose@firm.example", "staff", "G", "Medical gas engineer", 45],
    ["u_nit", "Nitin Verma", "nitin.verma@firm.example", "staff", "S", "Structural engineer", 45],
    ["u_fir", "Neha Arora", "neha.arora@firm.example", "staff", "F", "Fire design engineer", 45],
    ["u_sun", "Sunil Mehta", "sunil.mehta@firm.example", "staff", "A", "Associate, project lead", 45],
    ["u_adi", "Aditi Rao", "aditi.rao@firm.example", "staff", "A", "Associate, project lead", 45],
  ];

  const DEMO_ACCOUNTS = [
    { id: "u_owner", role: "Owner / Principal", sees: "Portfolio, reports, billing signals, everyone's hours" },
    { id: "u_pl", role: "Project lead", sees: "Projects, stages, issue, team, approvals" },
    { id: "u_dl", role: "Discipline lead (checker)", sees: "Register, review queue, workload, timesheet approvals" },
    { id: "u_des", role: "Designer", sees: "My work, own sheets, own timesheet" },
    { id: "u_sr", role: "Senior reviewer", sees: "Senior QC queue, AI drawing check findings" },
    { id: "u_dc", role: "Document controller", sees: "Issue composer, transmittals, client comments" },
    { id: "u_acc", role: "Accounts", sees: "Billing signals, CSV export, mark invoiced" },
    { id: "u_admin", role: "System admin (2FA)", sees: "Settings, users, integrations, audit trail" },
  ];

  const CONTACTS = [
    ["k_vn", "Dr. Vikram Nair", "vikram.nair@navjeevan.example", "Navjeevan Health Trust", "client", "+91 98450 11201"],
    ["k_sg", "Shalini Gupta", "shalini.gupta@navjeevan.example", "Navjeevan Health Trust", "client", "+91 98450 11202"],
    ["k_ra", "Ramesh Agrawal", "ramesh.agrawal@raipurcivic.example", "Raipur Civic Hospital Society", "client", "+91 94060 22310"],
    ["k_kr", "Kiran Rao", "kiran.rao@greenfieldhabitats.example", "Greenfield Habitats Pvt Ltd", "client", "+91 99001 33412"],
    ["k_sk", "Sameer Kulkarni", "sameer.k@orbitinfra.example", "Orbit Infra Parks LLP", "client", "+91 98860 44523"],
    ["k_lu", "Lalitha Urs", "lalitha@heritagestays.example", "Heritage Stays Mysuru", "client", "+91 97400 55634"],
    ["k_ps", "Dr. Prakash Shetty", "prakash.shetty@jayanagardx.example", "Jayanagar Diagnostics LLP", "client", "+91 98441 66745"],
    ["k_tm", "Fr. Thomas Mathew", "principal@hebballakeside.example", "Hebbal Lakeside Education Trust", "client", "+91 80 4110 7788"],
    ["k_ke", "Anand Bhat", "anand.bhat@kestrel.example", "Kestrel Electronics Ltd", "client", "+91 80 4120 9911"],
    ["k_bm", "Neeraj Malhotra", "neeraj@southgate-retail.example", "Southgate Retail Developers", "client", "+91 98455 77856"],
    ["k_mh", "Manoj Hegde", "manoj.hegde@kavericonstructions.example", "Kaveri Constructions Pvt Ltd", "contractor", "+91 99862 88967"],
    ["k_rp", "Ravi Prakash", "ravi.prakash@deccanmep.example", "Deccan MEP Services", "contractor", "+91 99456 99078"],
    ["k_ub", "Girish Shenoy", "girish@unnatibuilders.example", "Unnati Builders", "contractor", "+91 98804 10189"],
    ["k_ac", "Pooja Menon", "pooja@acoustica.example", "Acoustica Design (acoustic consultant)", "consultant", "+91 98451 21290"],
    ["k_sl", "Rajiv Sthapati", "rajiv@sthapatilandscape.example", "Sthapati Landscape Studio", "consultant", "+91 98860 32301"],
    ["k_sv", "Harish Kumar", "harish@sterileair.example", "Sterile Air Validation Services", "consultant", "+91 99000 43412"],
    ["k_pa", "Assistant Director (Town Planning)", "plans@cityplanning.example", "City Planning Authority (sample)", "authority", ""],
    ["k_fs", "Divisional Fire Officer", "noc@fireservices.example", "State Fire and Emergency Services (sample)", "authority", ""],
  ];

  const STAGE_NAMES = ["Concept", "Preliminary", "Approvals", "Working drawings / GFC", "Tender", "Construction", "Closure"];
  const STAGE_PCT = [10, 10, 15, 30, 5, 25, 5];

  // Project specs. cur = index of the active stage. disc = discipline mix for the working-drawing set.
  const PROJECTS = [
    { id: "p1", code: "2026-014", name: "HSR Block B", desc: "200-bed multi-speciality hospital, 2B + G + 4", type: "hospital", client: "k_vn", clientOrg: "Navjeevan Health Trust", location: "HSR Layout, Bengaluru", start: -290, end: 340, fee: 32000000, cur: 3, lead: "u_pl", cad: ["AutoCAD 2025", "Revit 2025"], levels: ["Ground Floor", "First Floor", "Second Floor", "Third Floor", "Fourth Floor", "Basement", "Terrace"], disc: { A: 1, S: 0.7, M: 1, E: 0.9, P: 0.8, F: 0.7, X: 0.6, G: 0.6, C: 0.5 }, seniorQC: [3], extra: ["k_sg", "k_sv", "k_ac"], contractor: "k_rp" },
    { id: "p2", code: "2026-009", name: "Raipur OPD Block", desc: "Outpatient department and diagnostics, G + 3", type: "hospital", client: "k_ra", clientOrg: "Raipur Civic Hospital Society", location: "Raipur, Chhattisgarh", start: -230, end: 300, fee: 11000000, cur: 2, lead: "u_sun", cad: ["AutoCAD 2024"], levels: ["Ground Floor", "First Floor", "Second Floor", "Third Floor", "Terrace"], disc: { A: 0.8, S: 0.5, M: 0.6, E: 0.6, P: 0.5, F: 0.5, X: 0.3, G: 0.4, C: 0.3 }, seniorQC: [2, 3], extra: [] },
    { id: "p3", code: "2026-021", name: "Whitefield Residences Tower C", desc: "Residential tower, 2B + G + 14, 112 apartments", type: "residential", client: "k_kr", clientOrg: "Greenfield Habitats Pvt Ltd", location: "Whitefield, Bengaluru", start: -120, end: 520, fee: 18500000, cur: 1, lead: "u_adi", cad: ["Revit 2025"], levels: ["Basement 2", "Basement 1", "Ground Floor", "Typical Floor (1-7)", "Typical Floor (8-14)", "Terrace"], disc: { A: 0.9, S: 0.6, M: 0.4, E: 0.5, P: 0.5, F: 0.4, X: 0.2, C: 0.3 }, seniorQC: [], extra: ["k_sl"] },
    { id: "p4", code: "2025-047", name: "Koramangala Tech Park Phase 2", desc: "IT office block, 3B + G + 9, 6.2 lakh sq ft", type: "commercial", client: "k_sk", clientOrg: "Orbit Infra Parks LLP", location: "Koramangala, Bengaluru", start: -520, end: 220, fee: 26000000, cur: 5, lead: "u_pl", cad: ["AutoCAD 2024", "Revit 2024", "Navisworks 2024"], levels: ["Basement", "Ground Floor", "Typical Office Floor", "Ninth Floor", "Terrace"], disc: { A: 0.9, S: 0.6, M: 0.8, E: 0.8, P: 0.6, F: 0.6, X: 0.5, C: 0.4 }, seniorQC: [3], extra: ["k_ac"], contractor: "k_mh", mep: "k_rp" },
    { id: "p5", code: "2026-003", name: "Mysuru Heritage Hotel Restoration", desc: "Adaptive reuse of a 1920s mansion, 42 keys", type: "commercial", client: "k_lu", clientOrg: "Heritage Stays Mysuru", location: "Lakshmipuram, Mysuru", start: -330, end: 260, fee: 9500000, cur: 4, lead: "u_pl", cad: ["AutoCAD 2025"], levels: ["Ground Floor", "First Floor", "Roof"], disc: { A: 1, S: 0.6, M: 0.5, E: 0.5, P: 0.5, F: 0.4, C: 0.3 }, seniorQC: [3], extra: ["k_sl"], deliverablesDone: true },
    { id: "p6", code: "2026-018", name: "Jayanagar Diagnostics Centre", desc: "Imaging and pathology centre with MRI and CT suites, G + 3", type: "hospital", client: "k_ps", clientOrg: "Jayanagar Diagnostics LLP", location: "Jayanagar 4th Block, Bengaluru", start: -170, end: 210, fee: 7800000, cur: 3, lead: "u_pl", cad: ["AutoCAD 2025", "Revit 2025"], levels: ["Ground Floor", "First Floor", "Second Floor", "Third Floor", "Terrace"], disc: { A: 0.6, S: 0.4, M: 0.6, E: 0.6, P: 0.4, F: 0.4, X: 0.4, G: 0.4 }, seniorQC: [3], extra: ["k_sv"] },
    { id: "p7", code: "2025-033", name: "Electronic City Staff Housing", desc: "Staff housing, 4 blocks of G + 7", type: "residential", client: "k_ke", clientOrg: "Kestrel Electronics Ltd", location: "Electronic City Phase 1, Bengaluru", start: -690, end: 20, fee: 12000000, cur: 6, lead: "u_adi", cad: ["AutoCAD 2023"], levels: ["Ground Floor", "Typical Floor", "Terrace"], disc: { A: 0.6, S: 0.4, M: 0.2, E: 0.4, P: 0.4, F: 0.3, C: 0.3 }, seniorQC: [], extra: [], contractor: "k_ub", closure: true },
    { id: "p8", code: "2026-026", name: "Hebbal Lakeside School", desc: "K-12 day school for 1,800 students", type: "other", client: "k_tm", clientOrg: "Hebbal Lakeside Education Trust", location: "Hebbal, Bengaluru", start: -40, end: 560, fee: 6500000, cur: 0, lead: "u_adi", cad: ["Revit 2025"], levels: ["Ground Floor", "First Floor", "Second Floor"], disc: { A: 0.4 }, seniorQC: [], extra: ["k_sl"], draftStages: true },
    { id: "p9", code: "2026-011", name: "Bannerghatta Road Retail Mall", desc: "Retail and multiplex, 3B + G + 4 (on hold by client)", type: "commercial", client: "k_bm", clientOrg: "Southgate Retail Developers", location: "Bannerghatta Road, Bengaluru", start: -260, end: 480, fee: 14000000, cur: 1, lead: "u_sun", cad: ["AutoCAD 2025"], levels: ["Basement", "Ground Floor", "First Floor", "Second Floor"], disc: { A: 0.5, S: 0.3, M: 0.3, E: 0.3 }, seniorQC: [], extra: [], onHold: true },
  ];

  // Discipline leads and designers per discipline.
  const DL_OF = { A: "u_dl", M: "u_kar", E: "u_far", P: "u_lak", F: "u_jos", S: "u_viv", C: "u_sur", X: "u_far", G: "u_kar" };
  const DESIGNERS = { A: ["u_meg", "u_arj", "u_sne", "u_tan"], M: ["u_des", "u_kav"], E: ["u_roh"], P: ["u_imr"], F: ["u_fir"], S: ["u_nit"], C: ["u_sur"], X: ["u_div"], G: ["u_ana"] };

  function families(d, type, L) {
    const occ = L.filter((l) => !/Terrace|Roof/.test(l));
    const H = type === "hospital";
    switch (d) {
      case "A": return [
        L.map((l) => `${l} Plan`),
        occ.map((l) => `Reflected Ceiling Plan - ${l}`),
        ["North and South Elevations", "East and West Elevations", "Section A-A", "Section B-B", ...(L.length > 5 ? ["Section C-C"] : [])],
        H ? ["Toilet Enlarged Plan and Details", "OT Enlarged Plan and Details", "ICU Enlarged Plan", "Staircase 1 Details", "Ramp and Entrance Canopy Details", "Facade Wall Section Details"] : type === "residential" ? ["Typical Apartment Unit Plan (2 BHK)", "Typical Apartment Unit Plan (3 BHK)", "Toilet Enlarged Plan and Details", "Kitchen Enlarged Plan and Details", "Staircase 1 Details", "Facade Wall Section Details"] : ["Toilet Enlarged Plan and Details", "Entrance Lobby Enlarged Plan", "Staircase 1 Details", "Facade Wall Section Details", "Atrium Skylight Details"],
        ["Door and Window Schedule", "Finishes Schedule", "Flooring Layout - Ground Floor"],
      ];
      case "S": return [["Foundation Plan", "Column Layout and Schedule", "Retaining Wall Details"], occ.map((l) => `Beam Layout - ${l}`), occ.slice(0, 4).map((l) => `Slab Reinforcement - ${l}`), ["Staircase Reinforcement Details", "Typical RCC Details"]];
      case "M": return [occ.map((l) => `HVAC Ductwork - ${l}`), H ? ["AHU Room Details - Basement", "Chilled Water Piping - Ground Floor", "Chilled Water Piping - First Floor", "ICU Ductwork Level 1", "OT Ductwork Level 2", "OT Ductwork Level 3", "Isolation Ward Exhaust Level 3"] : ["AHU Room Details", "Chilled Water Piping - Typical Floor", "Toilet Exhaust Layout", "Basement Ventilation Layout"], ["HVAC Schematic", "HVAC Equipment Schedule"]];
      case "E": return [occ.map((l) => `Power Layout - ${l}`), occ.map((l) => `Lighting Layout - ${l}`), ["Single Line Diagram - Main LT Panel", "Earthing and Lightning Protection", "Cable Tray Routing - Basement", "Panel Schedule"]];
      case "P": return [occ.map((l) => `Water Supply Layout - ${l}`), occ.map((l) => `Drainage Layout - ${l}`), ["Plumbing Riser Diagram", "STP and WTP Details", "Toilet Plumbing Details"]];
      case "F": return [occ.map((l) => `Sprinkler Layout - ${l}`), occ.slice(0, 4).map((l) => `Fire Alarm Layout - ${l}`), ["Fire Hydrant and Wet Riser Schematic", "Fire Pump Room Details"]];
      case "X": return [occ.map((l) => `CCTV and Access Control - ${l}`), H ? occ.slice(1, 4).map((l) => `Nurse Call Layout - ${l}`) : [], ["Structured Cabling Riser Schematic"]];
      case "G": return [occ.slice(0, 4).map((l) => `Medical Gas Layout - ${l}`), ["Manifold Room Details", "MGPS Schematic"]];
      case "C": return [["Site Grading Plan", "Storm Water Drainage Plan", "External Roads and Paving", "Site Services Coordination Plan"]];
      default: return [];
    }
  }
  const STAGE_SETS = {
    0: (t) => [["A", "Site Analysis"], ["A", "Concept Massing Options"], ["A", "Concept Ground Floor Plan"], ["A", "Concept Typical Floor Plan"], ["A", "Concept Sections"], ["A", "Area Statement"]],
    1: (t) => [["A", "Preliminary Ground Floor Plan"], ["A", "Preliminary Typical Floor Plan"], ["A", "Preliminary Sections"], ["S", "Structural System Concept"], ["M", "HVAC Concept and Plant Sizing"], ["E", "Electrical Load Estimate"], ["P", "PHE Concept Schematic"]],
    2: (t) => [["A", "Sanction Drawing - Site Plan"], ["A", "Sanction Drawing - Floor Plans"], ["A", "Sanction Drawing - Elevations and Sections"], ["A", "Setback and FAR Statement"], ["F", "Fire NOC Drawing - Escape Routes"], ["F", "Fire NOC Drawing - Fire Fighting Systems"], ["C", "Site Plan for Sanction"], ...(t === "hospital" ? [["G", "Medical Gas Statutory Layout"]] : [])],
    4: (t) => [["A", "Tender Drawing List and Index"], ["A", "Interior Finishes Tender Schedule"], ["M", "HVAC Tender Schedule"], ["E", "Electrical Tender Schedule"]],
    5: () => [["A", "Revised Lobby Ceiling (CO-03)"], ["M", "Revised AHU-3 Connections (RFI-007)"], ["E", "Revised Cable Tray at Level 4 (RFI-011)"]],
    6: () => [["A", "As-built Floor Plans"], ["P", "As-built Plumbing Layout"], ["E", "As-built Electrical Layout"]],
  };
  const PUR = { 0: "FC", 1: "FA", 2: "AS", 3: "GFC", 4: "FT", 5: "GFC", 6: "REC" };

  function generate() {
    const T = DO.today();
    DO.setCalendar(ORG.workdays, HOLIDAYS(T).map((h) => h.date));
    const r = DO.rng(20261026);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const chance = (p) => r() < p;
    const at = (date, h = 10, m = 0) => `${date}T${DO.pad(h)}:${DO.pad(m)}:00+05:30`;
    const wd = (n) => DO.addWorkingDays(T, n);
    const toWD = (d) => (DO.isWorkingDay(d) ? d : DO.addWorkingDays(d, 1));
    let seq = 0; const id = (p) => `${p}${++seq}`;

    const S = {
      version: DO.DATA_VERSION, seededOn: T, org: JSON.parse(JSON.stringify(ORG)), holidays: HOLIDAYS(T), disciplines: JSON.parse(JSON.stringify(DISCIPLINES)),
      stageTemplates: [{ id: "tpl1", name: "Council of Architecture stages", isDefault: true, items: STAGE_NAMES.map((n, i) => ({ name: n, pct: STAGE_PCT[i] })) }, { id: "tpl2", name: "Interiors fit-out (3 stages)", isDefault: false, items: [{ name: "Design development", pct: 40 }, { name: "Working drawings / GFC", pct: 40 }, { name: "Site supervision", pct: 20 }] }],
      namingRules: [
        { id: "nr1", target: "sheet_number", pattern: "^[ASCMEPFXG]-\\d{3}$", message: "Sheet number must be a discipline letter, a hyphen and three digits.", example: "A-101", scope: "org" },
        { id: "nr2", target: "file_name", pattern: "^[ASCMEPFXG]-\\d{3}(_[PC]\\d{2})?\\.pdf$", message: "File name must be the sheet number, optionally _ and the revision, then .pdf.", example: "A-101_C02.pdf", scope: "org" },
      ],
      checklists: [
        { id: "cl1", name: "Architecture GFC pre-check", discipline: "A", stage: "Working drawings / GFC", items: [{ text: "Grid lines and dimensions match the structural layout", mandatory: true }, { text: "Room names and areas match the area statement", mandatory: true }, { text: "Door tags match the door schedule", mandatory: true }, { text: "Section and detail callouts point to issued sheets", mandatory: false }, { text: "Title block complete (drawn, checked, date, scale)", mandatory: true }] },
        { id: "cl2", name: "HVAC GFC pre-check", discipline: "M", stage: "Working drawings / GFC", items: [{ text: "Duct sizes shown on every run", mandatory: true }, { text: "OT and ICU zones show HEPA terminal sizes", mandatory: true }, { text: "Clearance below beams checked against structure", mandatory: true }, { text: "Equipment tags match the schedule", mandatory: false }] },
      ],
      users: [], contacts: [], projects: [], stages: [], packages: [], sheets: [], revisions: [], reviews: [], transitions: [], transmittals: [], allocations: [], timesheets: [], leave: [],
      comments: [], approvals: [], rfis: [], submittals: [], siteReports: [], changeOrders: [], clashes: [], decisions: [], findings: [], cadProposals: [], cadEvents: [], imports: [],
      notifications: [], emails: [], audit: [], automationRuns: [], exports: [], invitations: [], tokens: [], savedViews: [], files: {}, counters: {},
    };

    USERS.forEach(([uid, name, email, orgRole, discipline, title, capacity]) => S.users.push({ id: uid, name, email, orgRole, discipline, title, capacity, active: true, canLead: ["u_pl", "u_sun", "u_adi", "u_owner", "u_sr"].includes(uid), sso: uid !== "u_admin", mfa: uid === "u_admin", lastSeen: at(DO.addDays(T, -Math.floor(r() * 3)), 9 + Math.floor(r() * 8), Math.floor(r() * 59)), prefs: {}, delegate: null }));
    CONTACTS.forEach(([cid, name, email, org, kind, phone]) => S.contacts.push({ id: cid, name, email, org, kind, phone, notes: "" }));
    S.leave.push({ id: "lv1", userId: "u_kav", from: wd(6), to: wd(10), reason: "Annual leave" }, { id: "lv2", userId: "u_arj", from: wd(-2), to: wd(-1), reason: "Sick leave" }, { id: "lv3", userId: "u_sr", from: wd(15), to: wd(19), reason: "Conference, Singapore" });

    // Workload targets (person → base hours per project per week).
    const team = {};

    for (const P of PROJECTS) {
      const start = DO.addDays(T, P.start); const end = DO.addDays(T, P.end);
      const project = { id: P.id, code: P.code, name: P.name, description: P.desc, type: P.type, clientId: P.client, client: P.clientOrg, location: P.location, start, end, fee: P.fee, cad: P.cad, state: P.onHold ? "on_hold" : "active", leadId: P.lead, members: [], letter: P.id === "p8" ? null : { name: `${P.code} Appointment letter.pdf`, size: 482113, uploadedAt: at(DO.addDays(start, 3)), by: P.lead }, projectEmail: `p-${P.code}@in.drawingops.example`, createdAt: at(DO.addDays(start, -5), 11), recipients: [P.client, ...(P.extra || []), ...(P.contractor ? [P.contractor] : [])], siteToken: `site-${P.code}-${Math.floor(r() * 1e6).toString(36)}` };
      S.projects.push(project);
      const add = (userId, role, discipline) => { if (!project.members.some((m) => m.userId === userId && m.role === role && m.discipline === discipline)) project.members.push({ userId, role, discipline: discipline || "" }); };
      add(P.lead, "PL");
      add("u_dc", "DC");
      if (P.id === "p1" || P.id === "p4" || P.id === "p6") add("u_sr", "SR");
      if (P.id === "p2" || P.id === "p5") add("u_sr", "SR");
      if (!["p1", "p4", "p5", "p6"].includes(P.id)) add("u_pl", "Viewer");

      // Stages: spread across the project period.
      // Stage windows: the active stage straddles today; earlier stages share the time before it, later ones the time after.
      const span = DO.diffDays(start, end); const weights = [0.06, 0.08, 0.12, 0.26, 0.06, 0.36, 0.06];
      const curLen = Math.max(28, Math.round(span * weights[P.cur]));
      const elapsed = P.deliverablesDone || P.closure ? 1.06 : P.cur === 0 ? 0.45 : 0.62;
      const curStart = DO.addDays(T, -Math.round(curLen * elapsed)); const curEnd = DO.addDays(curStart, curLen);
      const pastDays = Math.max(P.cur * 21, DO.diffDays(start, curStart)); const futDays = Math.max((6 - P.cur) * 30, DO.diffDays(curEnd, end));
      const pastW = DO.sum(weights.slice(0, P.cur)) || 1; const futW = DO.sum(weights.slice(P.cur + 1)) || 1;
      const lens = weights.map((w, i) => (i < P.cur ? Math.round((pastDays * w) / pastW) : i === P.cur ? curLen : Math.round((futDays * w) / futW)));
      let cursor = DO.addDays(curStart, -DO.sum(lens.slice(0, P.cur)) - P.cur);
      project.start = cursor < start ? cursor : start;
      STAGE_NAMES.forEach((name, i) => {
        const len = lens[i];
        const ps = cursor; const pe = DO.addDays(cursor, len); cursor = DO.addDays(pe, 1);
        if (i === 6 && pe > project.end) project.end = pe;
        let state = i < P.cur ? "invoiced" : i === P.cur ? "active" : "planned";
        const st = { id: id("st"), projectId: P.id, seq: i + 1, name, pct: STAGE_PCT[i], plannedStart: ps, plannedEnd: pe, actualStart: i <= P.cur ? DO.addDays(ps, Math.floor(r() * 6)) : null, actualEnd: i < P.cur ? DO.addDays(pe, Math.floor(r() * 12) - 3) : null, state, requiredPurposes: i === 2 ? ["AS", "FA"] : i === 3 || i === 5 ? ["GFC"] : i === 4 ? ["FT"] : i === 6 ? ["REC"] : ["FA", "FC"], seniorQC: (P.seniorQC || []).includes(i), final: !P.draftStages, readySince: null, invoicedAt: i < P.cur ? at(DO.addDays(pe, 18 + Math.floor(r() * 20)), 15) : null, invoiceRef: i < P.cur ? `INV/${P.code.slice(2, 4)}-${P.code.slice(5)}/${String(i + 1).padStart(2, "0")}` : null };
        if (P.onHold && i === P.cur) st.state = "on_hold";
        if (P.draftStages) st.pct = [10, 10, 15, 25, 5, 25, 5][i];
        S.stages.push(st);
      });
      const stages = S.stages.filter((s) => s.projectId === P.id);
      // Billing story: HSR Approvals is ready to invoice 9 days; Electronic City closure ready 3 days; Mysuru tender waits for client approval.
      if (P.id === "p1") { const s = stages[2]; s.state = "ready_to_invoice"; s.invoicedAt = null; s.invoiceRef = null; s.readySince = at(wd(-9), 11, 20); S.approvals.push({ id: id("ap"), projectId: P.id, stageId: s.id, by: "k_vn", date: wd(-9), evidence: "Navjeevan approval letter - sanction set.pdf", note: "Approval of the sanction drawing set at the steering committee.", recordedBy: "u_pl", at: at(wd(-9), 11, 18) }); }
      if (P.id === "p4") { const s = stages[4]; s.state = "invoiced"; }
      if (P.id === "p7") { const s = stages[6]; s.state = "ready_to_invoice"; s.actualEnd = wd(-4); s.readySince = at(wd(-3), 16, 5); S.approvals.push({ id: id("ap"), projectId: P.id, stageId: s.id, by: "k_ke", date: wd(-3), evidence: "Kestrel handover acceptance.pdf", note: "Handover accepted; as-built set received.", recordedBy: "u_adi", at: at(wd(-3), 16, 2) }); }
      if (P.id === "p5") { const s = stages[4]; s.state = "deliverables_issued"; s.actualEnd = wd(-6); }
      if (P.id === "p2") { const s = stages[1]; s.state = "client_approved"; s.invoicedAt = null; s.invoiceRef = null; S.approvals.push({ id: id("ap"), projectId: P.id, stageId: s.id, by: "k_ra", date: wd(-40), evidence: "Society resolution 14.pdf", note: "Preliminary design approved by the society.", recordedBy: "u_sun", at: at(wd(-40), 12) }); s.state = "invoiced"; s.invoicedAt = at(wd(-22), 15); s.invoiceRef = `INV/26-009/02`; }

      // Packages per discipline for the working-drawing set.
      const wdStage = stages[3];
      const pkgs = {};
      Object.keys(P.disc).forEach((d) => {
        if (P.cur < 3 && d !== "A") return;
        const label = { A: "Arch GFC set", S: "Structure GFC set", M: "HVAC GFC set", E: "Electrical GFC set", P: "PHE GFC set", F: "Fire GFC set", X: "ELV GFC set", G: "Medical gas GFC set", C: "Civil GFC set" }[d];
        const pk = { id: id("pk"), projectId: P.id, name: label, discipline: d, date: toWD(DO.addDays(wdStage.plannedEnd, -Math.floor(r() * 25))) };
        S.packages.push(pk); pkgs[d] = pk;
      });

      // Team per discipline.
      const ownersFor = (d) => (DESIGNERS[d] || []).filter((u) => !(P.id === "p9" && u === "u_des"));
      const sheetSpecs = [];
      for (let si = 0; si <= 6; si++) {
        if (si === 3) {
          Object.entries(P.disc).forEach(([d, ratio]) => {
            families(d, P.type, P.levels).forEach((fam, fi) => {
              const keep = fam.filter((_, k) => k === 0 || r() < ratio + 0.15);
              keep.forEach((title, k) => sheetSpecs.push({ d, title, stageIdx: 3, number: `${d}-${fi + 1}${String(k + 1).padStart(2, "0")}` }));
            });
          });
        } else if (STAGE_SETS[si] && (si <= P.cur || si === P.cur + 1 || (si === 4 && P.cur >= 3))) {
          if (si === 5 && P.id !== "p4") continue;
          if (si === 6 && !P.closure) continue;
          STAGE_SETS[si](P.type).forEach(([d, title], k) => { if (P.disc[d] === undefined && d !== "A") return; sheetSpecs.push({ d, title, stageIdx: si, number: `${d}-${["0", "0", "9", "", "8", "6", "7"][si]}${si === 1 ? String(k + 11) : String(k + 1).padStart(2, "0")}` }); });
        }
      }
      // De-duplicate numbers (stage sets can collide on small projects).
      const seen = new Set();
      const specs = sheetSpecs.filter((s) => (seen.has(s.number) ? false : seen.add(s.number)));

      specs.forEach((spec, idx) => {
        const st = stages[spec.stageIdx];
        const owners = ownersFor(spec.d);
        const ownerId = owners.length ? owners[(idx + spec.number.length) % owners.length] : DL_OF[spec.d];
        const checkerId = DL_OF[spec.d] === ownerId ? "u_sr" : DL_OF[spec.d];
        add(ownerId, "Designer", spec.d); add(DL_OF[spec.d], "DL", spec.d);
        // Planned issue date inside the stage window, working days only.
        const sLen = DO.diffDays(st.plannedStart, st.plannedEnd);
        let planned = toWD(DO.addDays(st.plannedStart, Math.round(sLen * (0.35 + r() * 0.65))));
        const sheet = { id: id("s"), projectId: P.id, number: spec.number, title: spec.title, discipline: spec.d, stageId: st.id, packageId: spec.stageIdx === 3 && pkgs[spec.d] && chance(0.85) ? pkgs[spec.d].id : null, ownerId, checkerId, planned, state: "planned", stateBefore: null, currentRevId: null, notes: "", cadLink: `\\\\fileserver\\${P.code}\\${{ A: "ARCH", S: "STR", C: "CIVIL" }[spec.d] || "MEP"}\\${spec.number}.${P.cad.some((c) => c.startsWith("Revit")) && spec.d === "A" ? "rvt" : "dwg"}`, aliases: [], reviewRound: 0, stateChangedAt: null, createdAt: at(DO.addDays(st.plannedStart, -10), 10), replacedBy: null, cancelReason: "" };
        if (sheet.packageId && chance(0.12)) sheet.planned = null; // inherits the package date (F-49)
        S.sheets.push(sheet);
      });

      // Team allocation targets: everyone on the project.
      project.members.forEach((m) => { if (m.role === "Viewer") return; team[m.userId] = team[m.userId] || []; if (!team[m.userId].some((x) => x.p === P.id)) team[m.userId].push({ p: P.id, stage: P.onHold ? null : stages[P.cur].id }); });
    }

    // ---------- Sheet histories ----------
    const effPlanned = (s) => s.planned || S.packages.find((p) => p.id === s.packageId)?.date || null;
    const stageOf = (s) => S.stages.find((x) => x.id === s.stageId);
    const projOf = (s) => S.projects.find((p) => p.id === s.projectId);
    const tr = (s, from, to, userId, date, h, m, reason = "") => { S.transitions.push({ id: id("t"), sheetId: s.id, from, to, userId, at: at(date, h, m), reason }); s.state = to; s.stateChangedAt = at(date, h, m); };
    const addRev = (s, code, state, stageId, purpose, upDate, issueDate, by, issuer, fileName) => {
      const rv = { id: id("r"), sheetId: s.id, code, seq: S.revisions.filter((x) => x.sheetId === s.id).length + 1, state, stageId, purpose, suitability: "", fileName: fileName || `${s.number}_${code}.pdf`, size: 1200000 + Math.floor(r() * 9000000), uploadedBy: by, uploadedAt: at(upDate, 9 + Math.floor(r() * 8), Math.floor(r() * 59)), issuedAt: issueDate ? at(issueDate, 15 + Math.floor(r() * 3), Math.floor(r() * 59)) : null, issuedBy: issueDate ? issuer : null, transmittalId: null, supersededAt: null, namingStatus: "ok", namingMessage: "", changeSummary: "", sha: (DO.hash(s.number + code + upDate) >>> 0).toString(16).padStart(8, "0") };
      S.revisions.push(rv); return rv;
    };
    // Firms batch their issues: drawings go out on the weekly Friday issue day (never in the future).
    const isIssueDay = (d) => DO.weekday(d) === 5 && DO.isWorkingDay(d);
    const snapIssue = (d) => { let x = d; for (let i = 0; i < 7 && !isIssueDay(x); i++) x = DO.addDays(x, 1); if (x >= T || !isIssueDay(x)) { x = d; for (let i = 0; i < 7 && !isIssueDay(x); i++) x = DO.addDays(x, -1); } return isIssueDay(x) && x < T ? x : DO.addWorkingDays(T, -1) < d ? DO.addWorkingDays(T, -1) : d; };
    const issueHistory = (s, st, issueDate, codes, purposes, stageIds) => {
      // Full cycle ending in an issued revision on issueDate; earlier codes are superseded.
      const start = DO.addWorkingDays(issueDate, -(8 + Math.floor(r() * 10)));
      tr(s, s.state, "in_progress", s.ownerId, start, 9, 40, s.state === "issued" ? "Start next revision" : "");
      let prev = null;
      codes.forEach((code, i) => {
        const iDate = snapIssue(i === codes.length - 1 ? issueDate : DO.addWorkingDays(issueDate, -(codes.length - 1 - i) * (6 + Math.floor(r() * 8))));
        const sub = DO.addWorkingDays(iDate, -(3 + Math.floor(r() * 3)));
        if (i > 0) tr(s, "issued", "in_progress", s.ownerId, DO.addWorkingDays(prev, 1), 10, 5, "Start next revision");
        tr(s, "in_progress", "ready_for_check", s.ownerId, sub, 17, 10); s.reviewRound++;
        const cs = DO.addWorkingDays(sub, chance(0.3) ? 2 : 1);
        tr(s, "ready_for_check", "in_check", s.checkerId, cs, 11, 30);
        const rev = addRev(s, code, "issued", stageIds[i], purposes[i], sub, iDate, s.ownerId, "u_dc");
        if (chance(0.25)) {
          const rd = DO.addWorkingDays(cs, 1);
          tr(s, "in_check", "changes_requested", s.checkerId, rd, 16, 20, pick(RETURN_REASONS[s.discipline] || RETURN_REASONS.A));
          S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: rev.id, kind: "check", reviewerId: s.checkerId, state: "returned", comment: S.transitions[S.transitions.length - 1].reason, redlines: chance(0.6) ? [`${s.number}_${code}_redlines.pdf`] : [], openedAt: at(cs, 11, 30), closedAt: at(rd, 16, 20), ticks: [] });
          tr(s, "changes_requested", "in_progress", s.ownerId, DO.addWorkingDays(rd, 1), 9, 50);
          tr(s, "in_progress", "ready_for_check", s.ownerId, DO.addWorkingDays(rd, 1), 18, 5); s.reviewRound++;
          tr(s, "ready_for_check", "in_check", s.checkerId, DO.addWorkingDays(rd, 1), 18, 30);
        }
        const ap = DO.addWorkingDays(iDate, -1);
        S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: rev.id, kind: "check", reviewerId: s.checkerId, state: "approved", comment: "", redlines: [], openedAt: at(DO.addWorkingDays(ap, -1), 11), closedAt: at(ap, 15), ticks: [] });
        if (st.seniorQC && stageIds[i] === st.id) S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: rev.id, kind: "senior_qc", reviewerId: "u_sr", state: "approved", comment: "", redlines: [], openedAt: at(ap, 15), closedAt: at(ap, 18), ticks: [] });
        tr(s, "in_check", "approved_for_issue", st.seniorQC ? "u_sr" : s.checkerId, ap, 18, 10);
        tr(s, "approved_for_issue", "issued", "u_dc", iDate, 16, 0);
        if (prev && s.currentRevId) { const old = S.revisions.find((x) => x.id === s.currentRevId); old.state = "superseded"; old.supersededAt = rev.issuedAt; }
        S.revisions.filter((x) => x.sheetId === s.id && x.id !== rev.id && x.state === "issued").forEach((x) => { x.state = "superseded"; x.supersededAt = rev.issuedAt; });
        s.currentRevId = rev.id; prev = iDate;
      });
    };
    const nextCode = (s, series) => { const n = S.revisions.filter((x) => x.sheetId === s.id && x.code[0] === series).length + 1; return `${series}${String(n).padStart(2, "0")}`; };

    for (const s of S.sheets) {
      const st = stageOf(s); const P = PROJECTS.find((p) => p.id === s.projectId); const stIdx = st.seq - 1; const project = projOf(s);
      const stages = S.stages.filter((x) => x.projectId === s.projectId);
      const planned = effPlanned(s);
      const dRel = planned ? DO.workingDaysBetween(T, planned) : 99;
      const purposeOf = (i) => PUR[i];
      if (stIdx < P.cur || (P.deliverablesDone && stIdx === P.cur) || (P.closure && stIdx <= P.cur)) {
        // Past stages: everything issued (a few early sheets went late).
        const issueDate = toWD(DO.addDays(planned || st.plannedEnd, Math.floor(r() * 9) - 4 + (chance(0.18) ? 6 + Math.floor(r() * 8) : 0)));
        let issueDate2 = issueDate; if (DO.diffDays(issueDate2, T) <= 1) issueDate2 = DO.addWorkingDays(T, -(2 + Math.floor(r() * 10)));
        if (s.planned && s.planned > T && stIdx >= P.cur) s.planned = DO.addWorkingDays(issueDate2, 2);
        if (stIdx === 3) {
          const p1 = stages[1]; const p2 = stages[2];
          const codes = chance(0.5) ? ["P01", "C01"] : ["P01", "P02", "C01"]; const purposes = codes.length === 2 ? ["FC", "GFC"] : ["FC", "FA", "GFC"]; const sids = codes.length === 2 ? [p2.id, st.id] : [p1.id, p2.id, st.id];
          issueHistory(s, st, issueDate2, codes, purposes, sids);
          if (P.cur >= 5 && chance(0.28)) { const d2 = toWD(DO.addDays(issueDate2, 25 + Math.floor(r() * 60))); if (DO.diffDays(d2, T) > 1) issueHistory(s, stages[5], d2, ["C02"], ["GFC"], [stages[5].id]); }
        } else {
          const codes = chance(0.6) ? ["P01"] : ["P01", "P02"];
          issueHistory(s, st, issueDate2, codes, codes.map(() => purposeOf(stIdx)), codes.map(() => st.id));
          if (stIdx === 6) { const rv = S.revisions.find((x) => x.id === s.currentRevId); rv.code = "C01"; rv.fileName = `${s.number}_C01.pdf`; rv.purpose = "REC"; }
        }
        continue;
      }
      if (P.onHold) { if (chance(0.5)) { tr(s, "planned", "in_progress", s.ownerId, DO.addDays(T, -70), 10, 0); } const before = s.state; tr(s, before, "on_hold", P.lead, DO.addDays(T, -55), 12, 0, "Client paused the project pending land-use change."); s.stateBefore = before; continue; }
      if (stIdx > P.cur) continue; // future stage: planned
      // Current stage: state depends on where the planned date sits.
      let state;
      const x = r();
      if (dRel < -10) state = x < 0.94 ? "issued" : x < 0.97 ? "in_progress" : x < 0.99 ? "in_check" : "changes_requested";
      else if (dRel < 0) state = x < 0.6 ? "issued" : x < 0.7 ? "approved_for_issue" : x < 0.8 ? "in_check" : x < 0.88 ? "ready_for_check" : "in_progress";
      else if (dRel <= 7) state = x < 0.45 ? "in_progress" : x < 0.58 ? "ready_for_check" : x < 0.68 ? "in_check" : x < 0.8 ? "planned" : x < 0.92 ? "approved_for_issue" : "changes_requested";
      else state = x < 0.6 ? "planned" : x < 0.95 ? "in_progress" : x < 0.98 ? "on_hold" : "cancelled";
      if (P.cur === 0) state = dRel < 0 ? "issued" : x < 0.5 ? "in_progress" : "planned";
      const prevStage = stages[Math.max(0, stIdx - 1)];
      if (state === "issued") {
        const issueDate = toWD(DO.addDays(planned || T, Math.floor(r() * 7) - 3));
        if (DO.diffDays(issueDate, T) > 0) issueHistory(s, st, issueDate, stIdx === 3 ? ["P01", "C01"] : ["P01"], stIdx === 3 ? ["FC", "GFC"] : [purposeOf(stIdx)], stIdx === 3 ? [prevStage.id, st.id] : [st.id]);
        continue;
      }
      // Earlier coordination issue (P01 for comment) for many working-drawing sheets.
      if (stIdx === 3 && chance(0.55)) { const d0 = DO.addWorkingDays(planned || T, -(18 + Math.floor(r() * 15))); if (DO.diffDays(d0, T) > 1) { issueHistory(s, st, d0, ["P01"], ["FC"], [prevStage.id]); tr(s, "issued", "in_progress", s.ownerId, DO.addWorkingDays(d0, 2), 10, 0, "Start next revision"); } }
      if (state === "planned") continue;
      if (state === "on_hold") { tr(s, s.state, "on_hold", P.lead, wd(-4), 12, 30, "Waiting for the client's equipment vendor finalisation."); s.stateBefore = "planned"; continue; }
      if (state === "cancelled") { tr(s, s.state, "cancelled", P.lead, wd(-12), 11, 0, "Dropped from scope: merged into the enlarged plan sheet."); s.cancelReason = "Dropped from scope: merged into the enlarged plan sheet."; continue; }
      const startD = DO.addWorkingDays(T, -(3 + Math.floor(r() * 12)));
      if (s.state === "planned") tr(s, "planned", "in_progress", s.ownerId, startD, 9, 30 + Math.floor(r() * 20));
      if (state === "in_progress") { if (chance(0.3)) { const code = nextCode(s, stIdx === 3 ? "C" : "P"); addRev(s, code, "draft", st.id, "", wd(-1), null, s.ownerId); } continue; }
      const series = stIdx === 3 ? "C" : "P";
      const subD = DO.addWorkingDays(T, -(Math.floor(r() * 5)));
      const code = nextCode(s, series);
      const draft = addRev(s, code, "draft", st.id, "", subD, null, s.ownerId);
      tr(s, "in_progress", "ready_for_check", s.ownerId, subD, 17, 15); s.reviewRound++;
      if (state === "ready_for_check") { S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: draft.id, kind: "check", reviewerId: s.checkerId, state: "open", comment: "", redlines: [], openedAt: at(subD, 17, 15), closedAt: null, ticks: [] }); continue; }
      const csD = DO.addWorkingDays(subD, 1) > T ? T : DO.addWorkingDays(subD, 1);
      tr(s, "ready_for_check", "in_check", s.checkerId, csD, 11, 0);
      if (state === "in_check") {
        const needSenior = st.seniorQC && chance(0.35);
        if (needSenior) { S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: draft.id, kind: "check", reviewerId: s.checkerId, state: "approved", comment: "", redlines: [], openedAt: at(csD, 11), closedAt: at(csD, 16), ticks: [] }); S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: draft.id, kind: "senior_qc", reviewerId: "u_sr", state: "open", comment: "", redlines: [], openedAt: at(csD, 16, 5), closedAt: null, ticks: [] }); }
        else S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: draft.id, kind: "check", reviewerId: s.checkerId, state: "open", comment: "", redlines: [], openedAt: at(csD, 11), closedAt: null, ticks: [] });
        continue;
      }
      if (state === "changes_requested") {
        const reason = pick(RETURN_REASONS[s.discipline] || RETURN_REASONS.A);
        tr(s, "in_check", "changes_requested", s.checkerId, csD, 16, 40, reason);
        S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: draft.id, kind: "check", reviewerId: s.checkerId, state: "returned", comment: reason, redlines: [`${s.number}_${code}_redlines.pdf`], openedAt: at(csD, 11), closedAt: at(csD, 16, 40), ticks: [] });
        continue;
      }
      if (state === "approved_for_issue") {
        S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: draft.id, kind: "check", reviewerId: s.checkerId, state: "approved", comment: "", redlines: [], openedAt: at(csD, 11), closedAt: at(csD, 15), ticks: [] });
        if (st.seniorQC) S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: draft.id, kind: "senior_qc", reviewerId: "u_sr", state: "approved", comment: "", redlines: [], openedAt: at(csD, 15), closedAt: at(csD, 18), ticks: [] });
        tr(s, "in_check", "approved_for_issue", st.seniorQC ? "u_sr" : s.checkerId, csD, 18, 0);
      }
    }

    // ---------- Storyline overrides on HSR Block B (DESIGN.md wireframes, UAT script) ----------
    const P1 = (n) => S.sheets.find((s) => s.projectId === "p1" && s.number === n);
    const reset = (s) => { S.transitions = S.transitions.filter((t) => t.sheetId !== s.id); S.reviews = S.reviews.filter((v) => v.sheetId !== s.id); S.revisions = S.revisions.filter((v) => v.sheetId !== s.id); s.state = "planned"; s.currentRevId = null; s.reviewRound = 0; };
    const st4 = S.stages.find((x) => x.projectId === "p1" && x.seq === 4); const st3p1 = S.stages.find((x) => x.projectId === "p1" && x.seq === 3);
    const story = (number, ownerId, planned, fn) => { const s = P1(number); if (!s) return; reset(s); s.ownerId = ownerId; s.checkerId = DL_OF[s.discipline] === ownerId ? "u_sr" : DL_OF[s.discipline]; s.planned = planned; fn(s); };
    story("M-205", "u_des", wd(-2), (s) => { s.title = "OT Ductwork Level 2"; issueHistory(s, st4, wd(-30), ["P01", "P02"], ["FC", "FC"], [st3p1.id, st4.id]); tr(s, "issued", "in_progress", "u_des", wd(-20), 10, 0, "Start next revision"); s.notes = "HEPA box sizes from Sterile Air Validation awaited for OT-2 and OT-3."; });
    story("M-204", "u_des", wd(3), (s) => { tr(s, "planned", "in_progress", "u_des", wd(-9), 9, 45); const d = addRev(s, "C01", "draft", st4.id, "", wd(-2), null, "u_des"); tr(s, "in_progress", "ready_for_check", "u_des", wd(-2), 17, 20); s.reviewRound = 1; tr(s, "ready_for_check", "in_check", "u_kar", wd(-1), 10, 15); const reason = "Return air path through the corridor ceiling is not allowed in the ICU zone; route via a dedicated RA duct. Show HEPA terminal box sizes."; tr(s, "in_check", "changes_requested", "u_kar", wd(-1), 16, 5, reason); S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: d.id, kind: "check", reviewerId: "u_kar", state: "returned", comment: reason, redlines: ["M-204_C01_redlines.pdf"], openedAt: at(wd(-1), 10, 15), closedAt: at(wd(-1), 16, 5), ticks: [] }); });
    story("M-206", "u_des", wd(4), (s) => { tr(s, "planned", "in_progress", "u_des", wd(-6), 10, 0); });
    story("M-201", "u_des", wd(1), (s) => { tr(s, "planned", "in_progress", "u_des", wd(-8), 9, 30); addRev(s, "C01", "draft", st4.id, "", wd(-1), null, "u_des"); });
    story("M-101", "u_des", wd(-14), (s) => { issueHistory(s, st4, wd(-13), ["P01", "C01"], ["FC", "GFC"], [st3p1.id, st4.id]); });
    story("M-102", "u_des", wd(12), () => {});
    story("A-101", "u_meg", wd(4), (s) => { s.title = "Ground Floor Plan"; issueHistory(s, st4, wd(-5), ["P01", "P02", "C01"], ["FC", "FA", "GFC"], [st3p1.id, st3p1.id, st4.id]); tr(s, "issued", "in_progress", "u_meg", wd(0), 10, 12, "Start next revision"); addRev(s, "C02", "draft", st4.id, "", wd(0), null, "u_meg").changeSummary = "Revised OT block layout after client meeting; ramp moved to grid C."; });
    story("A-102", "u_meg", wd(-5), (s) => { s.title = "First Floor Plan"; issueHistory(s, st4, wd(-5), ["P01", "C01"], ["FC", "GFC"], [st3p1.id, st4.id]); });
    // Approved sheets waiting for the document controller (issue composer).
    ["A-103", "A-104", "A-105", "A-201", "A-202", "E-101", "E-102", "P-101"].forEach((n, i) => story(n, P1(n)?.ownerId, wd(i < 4 ? 1 + i : -1), (s) => { tr(s, "planned", "in_progress", s.ownerId, wd(-10), 9, 30); if (i % 2 === 0) { issueHistory(s, st4, wd(-22 - i), ["P01"], ["FC"], [st3p1.id]); tr(s, "issued", "in_progress", s.ownerId, wd(-20 - i), 10, 0, "Start next revision"); } const d = addRev(s, nextCode(s, "C"), "draft", st4.id, "", wd(-3), null, s.ownerId, null, n === "A-104" ? "A104 ground floor rev.pdf" : null); if (n === "A-104") { d.namingStatus = "blocked"; d.namingMessage = "File name 'A104 ground floor rev.pdf' does not match rule ^[ASCMEPFXG]-\\d{3}(_[PC]\\d{2})?\\.pdf$. Rename to A-104_C01.pdf."; } if (n === "E-102") { S.revisions = S.revisions.filter((x) => x.id !== d.id); } tr(s, "in_progress", "ready_for_check", s.ownerId, wd(-3), 17, 0); s.reviewRound++; tr(s, "ready_for_check", "in_check", s.checkerId, wd(-2), 11, 0); S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: d.id, kind: "check", reviewerId: s.checkerId, state: "approved", comment: "", redlines: [], openedAt: at(wd(-2), 11), closedAt: at(wd(-2), 15), ticks: [] }); S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: d.id, kind: "senior_qc", reviewerId: "u_sr", state: "approved", comment: "", redlines: [], openedAt: at(wd(-2), 15), closedAt: at(wd(-1), 12), ticks: [] }); tr(s, "in_check", "approved_for_issue", "u_sr", wd(-1), 12, 5); }));
    // Anil's check queue and Sunita's senior QC queue.
    ["A-106", "A-107", "A-301", "A-302", "A-401"].forEach((n, i) => story(n, P1(n)?.ownerId, wd(2 + i), (s) => { tr(s, "planned", "in_progress", s.ownerId, wd(-12), 9, 20); const d = addRev(s, "C01", "draft", st4.id, "", wd(-(1 + i)), null, s.ownerId); tr(s, "in_progress", "ready_for_check", s.ownerId, wd(-(1 + i)), 17, 10); s.reviewRound = 1; if (i >= 3) { tr(s, "ready_for_check", "in_check", "u_dl", wd(-i), 10, 0); } S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: d.id, kind: "check", reviewerId: "u_dl", state: "open", comment: "", redlines: [], openedAt: at(wd(-(1 + i)), 17, 10), closedAt: null, ticks: [] }); }));
    ["A-203", "A-402", "M-202"].forEach((n, i) => story(n, P1(n)?.ownerId, wd(3 + i), (s) => { tr(s, "planned", "in_progress", s.ownerId, wd(-14), 9, 20); const d = addRev(s, "C01", "draft", st4.id, "", wd(-(3 + i)), null, s.ownerId); tr(s, "in_progress", "ready_for_check", s.ownerId, wd(-(3 + i)), 17, 0); s.reviewRound = 1; tr(s, "ready_for_check", "in_check", s.checkerId, wd(-(2 + i)), 10, 0); S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: d.id, kind: "check", reviewerId: s.checkerId, state: "approved", comment: "", redlines: [], openedAt: at(wd(-(2 + i)), 10), closedAt: at(wd(-(2 + i)), 16), ticks: [] }); S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: d.id, kind: "senior_qc", reviewerId: "u_sr", state: "open", comment: "", redlines: [], openedAt: at(wd(-(2 + i)), 16, 5), closedAt: null, ticks: [] }); }));
    // E-310 style: returned with redlines to an electrical designer.
    const e3 = S.sheets.find((s) => s.projectId === "p1" && s.discipline === "E" && /Lighting Layout - Third/.test(s.title));
    if (e3) story(e3.number, "u_roh", wd(2), (s) => { tr(s, "planned", "in_progress", "u_roh", wd(-10), 9, 0); const d = addRev(s, "C01", "draft", st4.id, "", wd(-2), null, "u_roh"); tr(s, "in_progress", "ready_for_check", "u_roh", wd(-2), 17, 0); s.reviewRound = 1; tr(s, "ready_for_check", "in_check", "u_far", wd(-1), 10, 30); const reason = "Emergency lighting circuits must be on the essential supply panel; lux levels in the corridor below 150."; tr(s, "in_check", "changes_requested", "u_far", wd(-1), 15, 45, reason); S.reviews.push({ id: id("rv"), sheetId: s.id, revisionId: d.id, kind: "check", reviewerId: "u_far", state: "returned", comment: reason, redlines: ["redlines_E_L3.png"], openedAt: at(wd(-1), 10, 30), closedAt: at(wd(-1), 15, 45), ticks: [] }); });

    // Rahul also works on Whitefield and Jayanagar.
    S.sheets.filter((s) => (s.projectId === "p3" || s.projectId === "p6") && s.discipline === "M").slice(0, 3).forEach((s) => { s.ownerId = "u_des"; });

    // ---------- Transmittals from issued revisions (grouped by project, date and purpose) ----------
    const issued = S.revisions.filter((v) => v.issuedAt).sort(DO.by("issuedAt"));
    const groups = {};
    issued.forEach((v) => { const s = S.sheets.find((x) => x.id === v.sheetId); const k = `${s.projectId}|${v.issuedAt.slice(0, 10)}|${v.purpose}`; (groups[k] = groups[k] || []).push(v); });
    const tCount = {};
    Object.entries(groups).sort(([a], [b]) => (a.split("|")[1] > b.split("|")[1] ? 1 : -1)).forEach(([k, revs]) => {
      const [pid, date, purpose] = k.split("|"); const p = S.projects.find((x) => x.id === pid);
      tCount[pid] = (tCount[pid] || 0) + 1;
      const number = `${p.code}-TR-${String(tCount[pid]).padStart(4, "0")}`;
      const rcp = [p.clientId, ...(p.recipients || []).slice(1)].slice(0, purpose === "GFC" ? 4 : 2).filter((x, i, a) => a.indexOf(x) === i);
      if (purpose === "AS") rcp.push(revs.some((v) => S.sheets.find((s) => s.id === v.sheetId).discipline === "F") ? "k_fs" : "k_pa");
      const sent = at(date, 16, 30);
      const old = DO.diffDays(date, T) > 10;
      const tm = { id: id("tm"), projectId: pid, number, seq: tCount[pid], purpose, note: purpose === "GFC" ? "Issued for construction. Please destroy earlier prints of these sheets." : "", sentBy: "u_dc", sentAt: sent, token: `t${DO.hash(number).toString(36)}${Math.floor(r() * 1e6).toString(36)}`, expiresAt: DO.addDays(date, ORG.linkDays), refersTo: null,
        recipients: rcp.map((cid, i) => ({ contactId: cid, delivery: S.contacts.find((c) => c.id === cid)?.kind === "authority" ? "hand" : "email", status: "sent", ackAt: old && chance(0.75) ? at(DO.addDays(date, 1 + Math.floor(r() * 3)), 10 + i, 12) : chance(0.3) ? at(DO.addDays(date, 1), 11, 0) : null, downloadedAt: chance(0.8) ? at(DO.addDays(date, Math.floor(r() * 3)), 12 + i, 5) : null })),
        items: revs.map((v) => ({ sheetId: v.sheetId, revisionId: v.id })) };
      S.transmittals.push(tm);
      revs.forEach((v) => { v.transmittalId = tm.id; });
    });
    // One bounced email on HSR, recent and unacknowledged.
    const lastHsr = S.transmittals.filter((t) => t.projectId === "p1").pop();
    if (lastHsr) { lastHsr.recipients.forEach((x) => { x.ackAt = null; }); if (lastHsr.recipients[1]) lastHsr.recipients[1].status = "bounced"; }
    S.counters = tCount;

    // ---------- Workload: allocations for weeks -4..+8 ----------
    const thisMon = DO.mondayOf(T);
    const weeks = Array.from({ length: 13 }, (_, i) => DO.addDays(thisMon, (i - 4) * 7));
    const special = { u_des: [1.32, 1.21, 0.98, 0.9, 0.75], u_tan: [0.38, 0.42, 0.7, 0.85, 0.9], u_kav: [1.12, 1.05, 0.6, 0.9, 0.95], u_meg: [1.04, 0.96, 0.88, 0.6, 0.4], u_roh: [0.92, 1.16, 1.14, 0.9, 0.8], u_imr: [0.46, 0.55, 0.8, 0.9, 0.9] };
    Object.entries(team).forEach(([uid, list]) => {
      const u = S.users.find((x) => x.id === uid); if (!u || ["u_acc", "u_admin", "u_owner"].includes(uid)) return;
      const active = list.filter((x) => x.stage);
      if (!active.length) return;
      weeks.forEach((w, wi) => {
        const rel = wi - 4; const factor = special[uid] ? special[uid][Math.max(0, Math.min(4, rel))] ?? 0.8 : 0.7 + r() * 0.3;
        // Leads plan around leave and holidays: allocate against the capacity actually available that week.
        const avail = [0, 1, 2, 3, 4, 5, 6].map((k) => DO.addDays(w, k)).filter((d) => ORG.workdays.includes(DO.weekday(d)) && !HOLIDAYS(T).some((h) => h.date === d) && !S.leave.some((l) => l.userId === uid && d >= l.from && d <= l.to)).length;
        const total = Math.round(((u.capacity * avail) / ORG.workdays.length) * factor * (rel > 4 ? 0.85 : 1));
        const shares = active.map((x, i) => (x.p === "p1" ? 2.2 : x.p === "p4" ? 1.4 : 1) * (i === 0 ? 1.2 : 1));
        const sumS = shares.reduce((a, b) => a + b, 0);
        let left = total;
        active.forEach((x, i) => { const h = i === active.length - 1 ? left : Math.round((total * shares[i]) / sumS); left -= h; if (h > 0) S.allocations.push({ id: id("al"), userId: uid, projectId: x.p, stageId: x.stage, week: w, hours: h }); });
      });
    });

    // ---------- Timesheets: four past weeks + this week (draft) ----------
    const missingLastWeek = new Set(["u_arj", "u_imr", "u_kav"]);
    S.users.filter((u) => u.orgRole !== "admin").forEach((u) => {
      for (let wi = 0; wi <= 4; wi++) {
        const w = weeks[wi]; const rel = wi - 4;
        if (rel === -1 && missingLastWeek.has(u.id)) continue;
        const allocs = S.allocations.filter((a) => a.userId === u.id && a.week === w);
        const rows = allocs.length ? allocs.map((a) => ({ projectId: a.projectId, stageId: a.stageId, hours: [0, 1, 2, 3, 4, 5, 6].map((d) => (d < 5 ? Math.max(0, Math.round(((a.hours * (0.85 + r() * 0.25)) / 5) * 2) / 2) : 0)) })) : [{ projectId: null, stageId: null, label: u.orgRole === "accounts" ? "Accounts and billing" : "Practice management", hours: [8, 8.5, 8, 9, 7.5, 0, 0] }];
        if (rel === 0) rows.forEach((row) => { row.hours = row.hours.map((h, d) => (d === 0 ? h : 0)); });
        const state = rel === 0 ? "draft" : rel === -1 ? (u.id === "u_tan" ? "returned" : r() < 0.55 ? "submitted" : "approved") : "approved";
        S.timesheets.push({ id: id("ts"), userId: u.id, week: w, state, rows, submittedAt: state === "draft" ? null : at(DO.addDays(w, 7 + (state === "approved" ? 0 : 1)), 10, 20), approvedBy: state === "approved" ? (DL_OF[u.discipline] || "u_pl") : null, approvedAt: state === "approved" ? at(DO.addDays(w, 8), 12) : null, reason: state === "returned" ? "Wednesday shows 14 h on Whitefield; please split between Whitefield and Hebbal." : "" });
      }
    });

    // ---------- Client comments (P2) ----------
    const p1Sheets = S.sheets.filter((s) => s.projectId === "p1");
    const sheetNo = (n) => p1Sheets.find((s) => s.number === n)?.id;
    const comments = [
      ["p1", "email", -18, "k_vn", "Please provide a dedicated donning/doffing room between the isolation ward and the corridor on Level 3.", ["A-104"], "u_meg", "closed", "Added a 2.4 x 2.0 m donning/doffing room; revised A-104 and M-206 accordingly."],
      ["p1", "meeting", -12, "k_sg", "OT ceiling: client wants laminar-flow ceilings with HEPA H14 terminal filters in all four OTs, not only OT-1 and OT-2.", ["M-205", "A-402"], "u_des", "responded", "Agreed. HEPA H14 laminar-flow ceiling in OT-1 to OT-4; AHU-OT capacity increases by 12%. Cost note sent to client."],
      ["p1", "whatsapp", -6, "k_sg", "Nurse station on Level 2 should face the ICU beds; current layout blocks the sightline from bed 6.", ["A-103"], "u_arj", "assigned", ""],
      ["p1", "call", -4, "k_vn", "Confirm generator room ventilation louvres will not face the neighbouring residential plot.", ["E-101"], "u_far", "assigned", ""],
      ["p1", "email", -9, "k_sv", "Pressure cascade table for OT suites needs to show +15 Pa OT / +10 Pa scrub / 0 Pa corridor.", ["M-205"], "u_kar", "assigned", ""],
      ["p1", "letter", -2, "k_vn", "Trust board asks for an additional 4-bed HDU on Level 4 within the same footprint.", [], null, "new", ""],
      ["p1", "email", -1, "k_sg", "Please share the revised door schedule with lead-lined doors for the X-ray rooms.", ["A-501"], null, "new", ""],
      ["p1", "meeting", -25, "k_vn", "Reduce the canopy depth at the main entrance to keep the ambulance bay clear.", ["A-405"], "u_meg", "rejected", "", "Canopy depth is set by the fire tender turning radius; cannot be reduced. Explained in the meeting of 08-Oct."],
      ["p4", "email", -7, "k_sk", "Tenant on Level 6 wants raised access flooring height increased to 300 mm.", [], "u_pl", "assigned", ""],
      ["p4", "meeting", -15, "k_sk", "Lobby ceiling to use a stretch ceiling instead of gypsum; see change order CO-03.", [], "u_sne", "closed", "Revised lobby ceiling issued as A-601; CO-03 approved."],
      ["p6", "email", -5, "k_ps", "MRI room RF shielding vendor needs a 600 mm service void above the ceiling.", [], "u_arj", "assigned", ""],
      ["p6", "call", -11, "k_ps", "CT suite control room window size to be increased to 1500 x 900.", [], "u_sne", "responded", "Window increased; lead glass equivalent 2 mm Pb confirmed with the physicist."],
      ["p2", "email", -8, "k_ra", "Society requests a separate entry for the pharmacy from the main road.", [], "u_sun", "assigned", ""],
    ];
    const pc = {};
    comments.forEach(([pid, source, days, from, text, sheets, assignee, status, response, rejectReason]) => {
      pc[pid] = (pc[pid] || 0) + 1; const p = S.projects.find((x) => x.id === pid);
      const date = DO.addDays(T, days);
      S.comments.push({ id: id("cm"), projectId: pid, number: `${p.code}-CC-${String(pc[pid]).padStart(3, "0")}`, source, receivedAt: at(date, 11, 15), fromId: from, text, sheetIds: sheets.map((n) => S.sheets.find((s) => s.projectId === pid && s.number === n)?.id).filter(Boolean), stageId: S.stages.find((s) => s.projectId === pid && s.state === "active")?.id || null, assigneeId: assignee, status, response: response || "", respondedAt: response ? at(DO.addDays(date, 2), 15) : null, rejectReason: rejectReason || "", email: source === "email" ? { from: S.contacts.find((c) => c.id === from)?.email, to: p.projectEmail, subject: text.slice(0, 60) } : null });
    });
    S.counters.comments = pc;
    // Email-ingested items from unknown senders wait in a review queue (F-25).
    S.inboundQueue = [{ id: "iq1", projectId: "p1", from: "site.engineer@unknown-mail.example", subject: "Fwd: Basement waterproofing query", body: "Sir, the waterproofing contractor asks whether the basement retaining wall needs a crystalline admixture or a membrane. Please advise.", receivedAt: at(wd(-1), 19, 42) }];

    // ---------- Construction administration on Koramangala (P3) ----------
    const p4 = S.projects.find((p) => p.id === "p4"); const p4s = S.sheets.filter((s) => s.projectId === "p4");
    const p4sheet = (d, k = 0) => p4s.filter((s) => s.discipline === d)[k]?.id;
    const rfis = [
      ["Clarify the slab drop at Level 4 toilet block: 50 mm on S-302 vs 75 mm on A-104.", "k_mh", "ours", -12, -2, [p4sheet("S", 3), p4sheet("A", 3)], "answered", "Use 75 mm drop. S-302 will be revised in the next issue.", true, false],
      ["AHU-3 chilled water connections clash with the cable tray at grid F/7. Confirm revised routing.", "k_rp", "ours", -9, 1, [p4sheet("M", 1), p4sheet("E", 2)], "open", "", false, true],
      ["Confirm fire damper locations at the shaft crossings on Levels 5 to 9.", "k_rp", "ours", -6, 2, [p4sheet("M", 0), p4sheet("F", 0)], "open", "", false, false],
      ["Facade bracket spacing at the curved corner: 1.2 m or 1.5 m?", "k_mh", "contractor", -15, -6, [p4sheet("A", 12)], "answered", "1.2 m at the curve; 1.5 m on straight runs. Revised detail to follow.", false, false],
      ["Basement ramp slope shown as 1:8 on A-101 but 1:10 on C-101. Which governs?", "k_mh", "ours", -4, 4, [p4sheet("A", 0), p4sheet("C", 0)], "open", "", false, true],
      ["Is a separate earth pit required for the UPS room?", "k_rp", "ours", -2, 6, [p4sheet("E", 0)], "open", "", false, false],
      ["Lobby ceiling: stretch ceiling fixing details needed (see CO-03).", "k_mh", "ours", -20, -14, [p4sheet("A", 5)], "closed", "Issued A-601 Revised Lobby Ceiling.", true, true],
      ["Water meter chamber location conflicts with the transformer yard.", "k_mh", "consultant", -8, 3, [p4sheet("P", 0)], "open", "", false, false],
      ["Confirm sprinkler head type in the double-height atrium.", "k_rp", "ours", -1, 9, [p4sheet("F", 1)], "open", "", false, false],
      ["Cable tray at Level 4 needs 150 mm more clearance under the beam.", "k_rp", "ours", -16, -9, [p4sheet("E", 2)], "answered", "Tray lowered by 150 mm; revised as E-603.", true, false],
      ["Terrace waterproofing upturn height at parapet: 300 or 450 mm?", "k_mh", "ours", -3, 1, [p4sheet("A", 3)], "open", "", false, false],
    ];
    rfis.forEach(([q, raisedBy, ball, raised, due, sheetIds, status, response, startsRevision, cost], i) => S.rfis.push({ id: id("rf"), projectId: "p4", number: `${p4.code}-RFI-${String(i + 1).padStart(3, "0")}`, question: q, raisedBy, ball, raisedAt: at(DO.addWorkingDays(T, raised), 10, 30), due: DO.addWorkingDays(T, due), sheetIds: sheetIds.filter(Boolean), status, response, respondedAt: response ? at(DO.addWorkingDays(T, Math.min(-1, due)), 16) : null, respondedBy: response ? "u_pl" : null, costImpact: cost, scheduleImpact: cost && i % 2 === 0, assigneeId: i % 3 === 0 ? "u_pl" : i % 3 === 1 ? "u_kar" : "u_far", startsRevision }));
    const subs = [
      ["AHU-3 shop drawing", "shop_drawing", "k_rp", "u_kar", -10, "approved_as_noted", "Provide a 600 mm access door on the filter section."],
      ["VRF outdoor units product data", "product_data", "k_rp", "u_kar", -6, "approved", ""],
      ["Granite flooring sample - Lobby", "sample", "k_mh", "u_sne", -4, "revise_resubmit", "Shade variation too high; resubmit three samples from the same lot."],
      ["Cable tray and support shop drawing", "shop_drawing", "k_rp", "u_far", -3, "open", ""],
      ["Curtain wall bracket calculation", "shop_drawing", "k_mh", "u_viv", -2, "open", ""],
      ["Fire pump set product data", "product_data", "k_rp", "u_jos", -8, "rejected", "Pump curve does not meet the duty point of 2850 LPM at 7 bar."],
      ["Toilet sanitary ware samples", "sample", "k_mh", "u_lak", -1, "open", ""],
      ["Stretch ceiling system data", "product_data", "k_mh", "u_sne", -14, "approved", ""],
    ];
    subs.forEach(([title, kind, from, reviewer, d, status, note], i) => S.submittals.push({ id: id("sb"), projectId: "p4", number: `${p4.code}-SUB-${String(i + 1).padStart(3, "0")}`, title, kind, fromId: from, reviewerId: reviewer, receivedAt: at(DO.addWorkingDays(T, d), 12), due: DO.addWorkingDays(T, d + 7), status, note, stampedAt: status !== "open" ? at(DO.addWorkingDays(T, d + 3), 17) : null, file: `${title}.pdf`, revision: i === 2 ? 2 : 1 }));
    [[-21, ["u_pl", "u_sne"], "Level 6 slab cast; Level 7 shuttering in progress. Facade brackets started on the east face.", 3], [-14, ["u_pl", "u_kar"], "AHU-3 delivered and placed on the plinth. Ductwork at Level 4 in progress; clearance issue at grid F/7 (see RFI-002).", 4], [-7, ["u_sne", "u_far"], "Cable tray at Level 4 lowered as per E-603. Lobby stretch ceiling mock-up approved by the client.", 3], [-2, ["u_pl", "u_jos"], "Sprinkler mains on Levels 5 to 7 hydro-tested at 15 bar for 2 hours; no drop. Atrium sprinkler type pending RFI-009.", 2]].forEach(([d, attendees, summary, nPhotos], i) => S.siteReports.push({ id: id("sr"), projectId: "p4", number: `${p4.code}-SVR-${String(i + 1).padStart(3, "0")}`, date: DO.addWorkingDays(T, d), attendees, contractor: "k_mh", weather: ["Clear", "Light rain", "Overcast", "Clear"][i], summary, observations: [{ text: summary.split(". ")[0] + ".", sheetId: p4sheet(i % 2 ? "M" : "A", i), action: i === 1 ? "Contractor to submit revised routing by Friday" : "" }, { text: summary.split(". ")[1] || "General housekeeping satisfactory.", sheetId: p4sheet("E", i), action: "" }], photos: Array.from({ length: nPhotos }, (_, k) => `site-photo-${((i * 3 + k) % 6) + 1}.jpg`), by: attendees[0], filedAt: at(DO.addWorkingDays(T, d), 18, 10) }));
    [["Additional raised floor height for Level 6 tenant", "client", null, 1850000, 6, "pending"], ["Lobby stretch ceiling instead of gypsum", "client", null, 640000, 0, "approved"], ["AHU-3 connection rerouting", "rfi", 1, 215000, 2, "pending"], ["Cable tray lowering at Level 4", "rfi", 9, 85000, 0, "approved"], ["Basement ramp slope revision", "rfi", 4, 0, 3, "draft"]].forEach(([d, origin, rfiIdx, cost, days, status], i) => S.changeOrders.push({ id: id("co"), projectId: "p4", number: `CO-${String(i + 1).padStart(2, "0")}`, description: d, origin, rfiId: rfiIdx !== null ? S.rfis[rfiIdx]?.id : null, cost, scheduleDays: days, status, sheetIds: [p4sheet(i % 2 ? "E" : "A", i + 2)].filter(Boolean), raisedAt: at(DO.addWorkingDays(T, -18 + i * 3), 12), approvedBy: status === "approved" ? "u_pl" : null, approvedAt: status === "approved" ? at(DO.addWorkingDays(T, -10 + i * 3), 17) : null }));
    [["Duct clashes with beam B4 at grid D/3", "M", "S", "open", "u_kav"], ["Sprinkler main through the transfer girder at Level 2", "F", "S", "open", "u_fir"], ["Cable tray vs chilled water pipe at F/7", "E", "M", "resolved", "u_roh"], ["Drain pipe through the column capital at B/5", "P", "S", "open", "u_imr"], ["AHU-3 access clearance blocked by the shaft wall", "M", "A", "closed", "u_kav"], ["Fire damper not accessible above the lobby ceiling", "M", "A", "open", "u_kav"], ["Smoke exhaust duct vs sprinkler branch at Level 9", "M", "F", "open", "u_kav"], ["Lighting trunking vs diffuser at Level 6", "E", "M", "resolved", "u_roh"]].forEach(([title, a, b, status, assignee], i) => S.clashes.push({ id: id("cx"), projectId: "p4", guid: `9f${(DO.hash(title) >>> 0).toString(16)}-bcf`, title, disciplines: [a, b], status, assigneeId: assignee, sheetIds: [p4sheet(a, i), p4sheet(b, i)].filter(Boolean), source: "Navisworks clash report (BCF 2.1)", importedAt: at(wd(-5), 14), priority: i < 2 ? "High" : "Normal", comments: i === 0 ? 2 : 0 }));

    // ---------- Decisions and knowledge (F-58) ----------
    [["p1", "OT ceiling: laminar-flow ceiling with HEPA H14 terminal filters in all four OTs.", "Client meeting with Navjeevan and Sterile Air Validation; AHU-OT capacity +12%.", ["M-205", "A-402"], -12, "u_pl"],
      ["p1", "Isolation rooms at Level 3 get a donning/doffing anteroom with -2.5 Pa cascade.", "Infection control committee recommendation.", ["A-104"], -16, "u_pl"],
      ["p1", "Medical gas manifold room moves to the basement service yard for cylinder truck access.", "Agreed with the client's biomedical team.", [], -40, "u_kar"],
      ["p4", "Level 4 cable tray lowered by 150 mm below beam soffit; ceiling height 2.85 m retained.", "RFI-010 response.", [], -9, "u_pl"],
      ["p4", "Facade brackets at 1.2 m spacing on the curved corner.", "Structural check by Vivek Reddy.", [], -6, "u_viv"],
      ["p6", "MRI room: 600 mm service void above the RF shield ceiling; quench pipe via the terrace.", "Vendor requirement confirmed.", [], -4, "u_pl"],
      ["p2", "OPD waiting halls to be naturally ventilated with ceiling fans; AC only in consulting rooms.", "Society budget decision.", [], -60, "u_sun"],
      ["p3", "Typical floor services shaft enlarged to 1.8 x 1.2 m for future EV charging risers.", "Developer request.", [], -20, "u_adi"],
    ].forEach(([pid, title, context, sheets, d, by], i) => S.decisions.push({ id: id("dc"), projectId: pid, number: `D-${String(i + 1).padStart(3, "0")}`, title, context, sheetIds: sheets.map((n) => S.sheets.find((s) => s.projectId === pid && s.number === n)?.id).filter(Boolean), date: DO.addWorkingDays(T, d), by }));

    // ---------- AI drawing check findings (F-57, advisory) ----------
    const draftRevs = S.revisions.filter((v) => v.state === "draft" && S.sheets.find((s) => s.id === v.sheetId)?.projectId === "p1").slice(0, 7);
    const FCHK = [["title_block", "Title block: 'Checked by' field is empty.", 0.93], ["reference", "Detail callout 3/A-409 points to a sheet that is not in the register.", 0.81], ["title_block", "Title block date is older than the revision upload date.", 0.77], ["reference", "Section mark B on this sheet has no matching section sheet in the current set.", 0.68], ["title_block", "Revision code on the title block (C01) does not match the uploaded revision (C02).", 0.95], ["scale", "Scale bar missing although the sheet states 1:50.", 0.62], ["reference", "Grid line H appears on this plan but not on the structural column layout.", 0.71]];
    draftRevs.forEach((v, i) => { const f = FCHK[i % FCHK.length]; S.findings.push({ id: id("fd"), revisionId: v.id, sheetId: v.sheetId, check: f[0], message: f[1], confidence: f[2], status: i < 5 ? "open" : i === 5 ? "accepted" : "dismissed", reviewedBy: i >= 5 ? "u_sr" : null, at: at(wd(-1), 8, 15) }); });

    // ---------- CAD sync proposals (F-09) and storage connector events (I-02) ----------
    [["M-210", "Kitchen Exhaust Layout - Ground Floor", "P01", "new"], ["M-211", "Laundry Exhaust Layout - Basement", "P01", "new"], ["A-109", "Fifth Floor Plan (future expansion)", "P01", "new"]].forEach(([n, t, rev, kind], i) => S.cadProposals.push({ id: id("cp"), projectId: "p1", number: n, title: t, revision: rev, kind, source: i < 2 ? "Revit 2025 · HSR_MEP_Central.rvt" : "AutoCAD 2025 · Sheet Set HSR-ARCH.dst", by: i < 2 ? "u_des" : "u_meg", at: at(wd(0), 9, 20 + i), status: "proposed" }));
    const mm = S.sheets.find((s) => s.projectId === "p1" && s.number === "M-206");
    if (mm) S.cadProposals.push({ id: id("cp"), projectId: "p1", number: "M-206", title: "OT Ductwork Level 3 (OT-3 and OT-4)", revision: "C01", kind: "mismatch", sheetId: mm.id, source: "Revit 2025 · HSR_MEP_Central.rvt", by: "u_des", at: at(wd(0), 9, 24), status: "proposed" });
    ["M-205", "A-101", "M-204", "M-206"].forEach((n, i) => { const s = S.sheets.find((x) => x.projectId === "p1" && x.number === n); if (s) S.cadEvents.push({ id: id("ce"), sheetId: s.id, path: s.cadLink, event: "modified", by: s.ownerId, at: at(wd(-i), 18 - i, 40) }); });

    // ---------- Integration tokens and invitations ----------
    S.tokens.push({ id: "tk1", name: "Revit add-in - MEP team", scope: "sheets:sync", prefix: "do_live_7f3a", createdAt: at(wd(-60), 11), lastUsed: at(wd(0), 9, 20), by: "u_admin" }, { id: "tk2", name: "AutoCAD plugin - Architecture", scope: "sheets:sync", prefix: "do_live_91c2", createdAt: at(wd(-58), 11), lastUsed: at(wd(0), 9, 23), by: "u_admin" }, { id: "tk3", name: "Office file server watcher", scope: "file_events:write", prefix: "do_live_c4e8", createdAt: at(wd(-30), 15), lastUsed: at(wd(0), 18, 40), by: "u_admin" });
    S.invitations.push({ id: "in1", name: "Rohit Bansal", email: "rohit.bansal@firm.example", orgRole: "staff", discipline: "A", token: "inv-rohit-2026", sentAt: at(wd(-1), 15, 10), by: "u_admin", accepted: false });

    // ---------- Automation runs (last 6 working days) ----------
    for (let k = 5; k >= 0; k--) { const d = wd(-k); S.automationRuns.push({ id: id("ar"), rule: "Daily sweep (A-01, A-02, A-07, A-08, A-10)", at: at(d, 8, 0), durationMs: 1200 + Math.floor(r() * 900), counts: { at_risk_raised: 3 + Math.floor(r() * 6), late_raised: 1 + Math.floor(r() * 3), cleared: 2 + Math.floor(r() * 5), reminders: 4 + Math.floor(r() * 8), duplicates_skipped: k === 0 ? 0 : 0 } }); }
    S.automationRuns.push({ id: id("ar"), rule: "Weekly allocation check (A-05)", at: at(thisMon, 7, 0), durationMs: 640, counts: { over: 0, under: 0 } }, { id: id("ar"), rule: "Weekly owner summary", at: at(thisMon, 8, 30), durationMs: 380, counts: { emails: 1 } });

    return S;
  }

  const RETURN_REASONS = {
    A: ["Dimension chain at grid C does not close; check the 230 wall.", "Door tags D7 and D9 missing from the door schedule.", "Toilet layout clashes with the shaft; revise per the latest MEP coordination.", "Room areas do not match the area statement; update the schedule."],
    M: ["Duct sizes missing on the branch runs; add sizes.", "Clearance below beam B4 is 180 mm; reroute the duct.", "AHU room door too small for the filter section; increase to 1500 mm."],
    E: ["Panel schedule loads do not match the SLD.", "Fire alarm interface points missing at the lift lobby.", "Emergency lighting circuits not shown."],
    P: ["Invert levels missing on the main drain.", "Water meter location conflicts with the transformer yard."],
    F: ["Sprinkler spacing exceeds 4.6 m in the corridor.", "Hydrant valve missing at the staircase landing."],
    S: ["Beam B12 depth inconsistent with the architectural section.", "Column C7 reinforcement table incomplete."],
    X: ["CCTV coverage gap at the service entry."],
    G: ["Zone valve box missing outside ICU."],
    C: ["Storm water invert at the boundary higher than the municipal drain."],
  };

  /** Sample working calendar (F-42): national and Karnataka holidays near the demo date. */
  function HOLIDAYS(T) {
    const y = +T.slice(0, 4);
    return [
      [`${y}-01-26`, "Republic Day"], [`${y}-08-15`, "Independence Day"], [`${y}-10-02`, "Gandhi Jayanti"], [`${y}-10-20`, "Vijayadashami"], [`${y}-11-09`, "Deepavali"], [`${y}-12-25`, "Christmas"], [`${y + 1}-01-01`, "New Year's Day"], [`${y + 1}-01-15`, "Makara Sankranti"], [`${y + 1}-01-26`, "Republic Day"],
    ].map(([date, name]) => ({ date, name }));
  }

  DO.DATA_VERSION = 9;
  DO.seed = { generate, PASSWORD, ADMIN_TOTP, DEMO_ACCOUNTS, STAGE_NAMES };
})(typeof window !== "undefined" ? window : globalThis);
