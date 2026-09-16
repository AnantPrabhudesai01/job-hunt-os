// Achievement rules: ids, thresholds, XP, rarities. CLIENT-SAFE — zero imports,
// so client components (trophy wall, celebrations) can bundle it without ever
// touching next/headers. Server logic (stats + award-once writes) lives in
// ./achievements, which re-exports everything here.

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type AchDef = {
  id: string;
  title: string;
  desc: string;
  category: string;
  rarity: Rarity;
  xp: number;
  target: number;
  metric: keyof AchStats;
  better: string; // what counts, user-facing
};

export type AchStats = {
  applied: number;
  missions: number;
  resumes: number;
  preps: number;
  contacts: number;
  emailsSent: number;
  waSent: number;
  liNotes: number;
  companies: number;
  followups: number;
  dsa: number;
  streak: number;
  longestStreak: number;
  interviews: number;
  offers: number;
  rejected: number;
  syncedDocs: number;
  // Sprint (optional — older callers omit; engine reads ?? 0)
  sprintDays?: number;
  sprintPerfect?: number;
  sprintApps100?: number;
  sprintLeet5?: number;
  sprintProjects?: number;
  sprintLi?: number;
  sprintGh?: number;
  // Opportunity sources + own output (optional — older callers omit)
  oppsLinkedin?: number;
  oppsEmail?: number;
  oppsCareers?: number;
  myPosts?: number;
};

export const ACHIEVEMENTS: AchDef[] = [
  // Applications (user-confirmed APPLIED only)
  { id: "first_application", title: "First Application", desc: "Submit your first real application.", category: "Applications", rarity: "COMMON", xp: 25, target: 1, metric: "applied", better: "Mark a mission APPLIED (manual confirm)" },
  { id: "app_5", title: "Application Hunter", desc: "5 applications submitted.", category: "Applications", rarity: "UNCOMMON", xp: 50, target: 5, metric: "applied", better: "Submit 4 more" },
  { id: "app_10", title: "Application Veteran", desc: "10 applications submitted.", category: "Applications", rarity: "RARE", xp: 100, target: 10, metric: "applied", better: "Submit more" },
  { id: "app_25", title: "Relentless Applicant", desc: "25 applications submitted.", category: "Applications", rarity: "EPIC", xp: 250, target: 25, metric: "applied", better: "Submit more" },
  { id: "app_100", title: "Century Submitter", desc: "100 applications submitted.", category: "Applications", rarity: "EPIC", xp: 400, target: 100, metric: "applied", better: "Submit more" },
  { id: "app_500", title: "Application Machine", desc: "500 applications submitted.", category: "Applications", rarity: "LEGENDARY", xp: 1000, target: 500, metric: "applied", better: "Submit more" },
  // Resume
  { id: "first_resume", title: "First Loadout", desc: "Forge your first tailored resume.", category: "Resume", rarity: "COMMON", xp: 10, target: 1, metric: "resumes", better: "Tailor a resume" },
  { id: "resume_5", title: "Resume Smith", desc: "5 tailored resumes forged.", category: "Resume", rarity: "UNCOMMON", xp: 25, target: 5, metric: "resumes", better: "Forge more" },
  { id: "resume_10", title: "Resume Master", desc: "10 tailored resumes forged.", category: "Resume", rarity: "RARE", xp: 60, target: 10, metric: "resumes", better: "Forge more" },
  { id: "resume_20", title: "Arsenal Complete", desc: "20 tailored resumes forged.", category: "Resume", rarity: "EPIC", xp: 150, target: 20, metric: "resumes", better: "Forge more" },
  // Interview prep + research
  { id: "first_prep", title: "Battle Planner", desc: "Complete your first interview preparation.", category: "Preparation", rarity: "UNCOMMON", xp: 25, target: 1, metric: "preps", better: "Finish an interview prep" },
  { id: "prep_5", title: "War Strategist", desc: "5 interview preparations completed.", category: "Preparation", rarity: "RARE", xp: 60, target: 5, metric: "preps", better: "Prepare more" },
  { id: "researcher_5", title: "Intel Operative", desc: "Track 5 companies.", category: "Preparation", rarity: "COMMON", xp: 10, target: 5, metric: "companies", better: "Discover more companies" },
  // Networking
  { id: "first_contact", title: "First Ally", desc: "Recruit your first contact.", category: "Networking", rarity: "COMMON", xp: 10, target: 1, metric: "contacts", better: "Add a recruiter or HR contact" },
  { id: "network_5", title: "Network Builder", desc: "Recruit 5 contacts.", category: "Networking", rarity: "UNCOMMON", xp: 25, target: 5, metric: "contacts", better: "Recruit more" },
  { id: "network_10", title: "Connected", desc: "Recruit 10 contacts.", category: "Networking", rarity: "RARE", xp: 60, target: 10, metric: "contacts", better: "Recruit more" },
  // Outreach (sent/confirmed only — never drafts)
  { id: "first_email_sent", title: "First Transmission", desc: "Send your first email (Gmail-confirmed).", category: "Outreach", rarity: "RARE", xp: 60, target: 1, metric: "emailsSent", better: "Send an approved email" },
  { id: "first_wa_sent", title: "Direct Line", desc: "Confirm your first manually-sent WhatsApp.", category: "Outreach", rarity: "UNCOMMON", xp: 25, target: 1, metric: "waSent", better: "Send + confirm a WhatsApp" },
  { id: "first_li_note", title: "First Introduction", desc: "Create your first LinkedIn note.", category: "Outreach", rarity: "COMMON", xp: 10, target: 1, metric: "liNotes", better: "Draft a connection note" },
  { id: "followup_1", title: "Closer", desc: "Log your first follow-up.", category: "Outreach", rarity: "COMMON", xp: 10, target: 1, metric: "followups", better: "Schedule a follow-up" },
  // Streaks
  { id: "streak_2", title: "warming Up", desc: "2-day activity streak.", category: "Streak", rarity: "COMMON", xp: 10, target: 2, metric: "longestStreak", better: "Stay active daily" },
  { id: "streak_3", title: "On Fire", desc: "3-day activity streak.", category: "Streak", rarity: "UNCOMMON", xp: 25, target: 3, metric: "longestStreak", better: "Stay active daily" },
  { id: "streak_7", title: "Unstoppable Week", desc: "7-day activity streak.", category: "Streak", rarity: "RARE", xp: 60, target: 7, metric: "longestStreak", better: "Stay active daily" },
  { id: "streak_14", title: "Iron Will", desc: "14-day activity streak.", category: "Streak", rarity: "EPIC", xp: 150, target: 14, metric: "longestStreak", better: "Stay active daily" },
  { id: "streak_30", title: "Month of Fire", desc: "30-day activity streak.", category: "Streak", rarity: "LEGENDARY", xp: 400, target: 30, metric: "longestStreak", better: "Stay active daily" },
  // DSA
  { id: "dsa_1", title: "First Blood", desc: "Solve your first logged DSA problem.", category: "DSA", rarity: "COMMON", xp: 10, target: 1, metric: "dsa", better: "Log a solved problem" },
  { id: "dsa_10", title: "Problem Solver", desc: "Solve 10 DSA problems.", category: "DSA", rarity: "UNCOMMON", xp: 25, target: 10, metric: "dsa", better: "Solve more" },
  { id: "dsa_25", title: "DSA Grinder", desc: "Solve 25 DSA problems.", category: "DSA", rarity: "RARE", xp: 60, target: 25, metric: "dsa", better: "Solve more" },
  { id: "dsa_50", title: "Algorithm Elite", desc: "Solve 50 DSA problems.", category: "DSA", rarity: "EPIC", xp: 150, target: 50, metric: "dsa", better: "Solve more" },
  // Career milestones
  { id: "first_interview", title: "Boss Battle Unlocked", desc: "Reach your first interview stage.", category: "Career", rarity: "EPIC", xp: 150, target: 1, metric: "interviews", better: "Move a mission to interview" },
  { id: "first_offer", title: "Offer Unlocked", desc: "Receive your first offer.", category: "Career", rarity: "LEGENDARY", xp: 500, target: 1, metric: "offers", better: "Keep pushing missions forward" },
  { id: "lesson_unlocked", title: "Lesson Unlocked", desc: "Record your first rejection as learning.", category: "Career", rarity: "COMMON", xp: 10, target: 1, metric: "rejected", better: "Rejections happen — log the lesson" },
  { id: "vault_keeper", title: "Vault Keeper", desc: "Sync 10 documents to the cloud vault.", category: "Preparation", rarity: "UNCOMMON", xp: 25, target: 10, metric: "syncedDocs", better: "Sync more documents" },
  // 30-Day Career Sprint (all computed from real rows, award-once)
  { id: "sprint_first_day", title: "First Sprint Day", desc: "Complete your first sprint day.", category: "Sprint", rarity: "COMMON", xp: 25, target: 1, metric: "sprintDays", better: "Finish a sprint day 5/5" },
  { id: "sprint_7", title: "7-Day Sprint", desc: "Complete 7 sprint days.", category: "Sprint", rarity: "RARE", xp: 100, target: 7, metric: "sprintDays", better: "Keep the streak" },
  { id: "sprint_14", title: "14-Day Sprint", desc: "Complete 14 sprint days.", category: "Sprint", rarity: "EPIC", xp: 200, target: 14, metric: "sprintDays", better: "Halfway to legend" },
  { id: "sprint_30", title: "30-Day Sprint", desc: "Complete all 30 sprint days.", category: "Sprint", rarity: "LEGENDARY", xp: 500, target: 30, metric: "sprintDays", better: "Finish the run" },
  { id: "sprint_app100", title: "100 Application Day", desc: "Create 100 applications in one sprint day.", category: "Sprint", rarity: "EPIC", xp: 150, target: 1, metric: "sprintApps100", better: "Hit 100 creates in a day" },
  { id: "sprint_leet_day", title: "5/5 LeetCode Day", desc: "Solve all 5 problem slots in a day.", category: "Sprint", rarity: "UNCOMMON", xp: 50, target: 1, metric: "sprintLeet5", better: "Solve 5 slots" },
  { id: "sprint_leet_7", title: "5 LeetCode × 7 Days", desc: "Seven full 5/5 LeetCode days.", category: "Sprint", rarity: "RARE", xp: 150, target: 7, metric: "sprintLeet5", better: "More full houses" },
  { id: "sprint_first_project", title: "First Mini Project", desc: "Ship your first sprint mini-project.", category: "Sprint", rarity: "COMMON", xp: 25, target: 1, metric: "sprintProjects", better: "Confirm a project complete" },
  { id: "sprint_proj_7", title: "7 Projects", desc: "Ship 7 sprint mini-projects.", category: "Sprint", rarity: "RARE", xp: 100, target: 7, metric: "sprintProjects", better: "Ship more" },
  { id: "sprint_proj_15", title: "15 Projects", desc: "Ship 15 sprint mini-projects.", category: "Sprint", rarity: "EPIC", xp: 200, target: 15, metric: "sprintProjects", better: "Ship more" },
  { id: "sprint_li_7", title: "7 LinkedIn Posts", desc: "Publish 7 sprint LinkedIn posts.", category: "Sprint", rarity: "RARE", xp: 100, target: 7, metric: "sprintLi", better: "Publish more" },
  { id: "sprint_li_30", title: "30 LinkedIn Posts", desc: "Publish all 30 sprint posts.", category: "Sprint", rarity: "EPIC", xp: 300, target: 30, metric: "sprintLi", better: "Post daily" },
  { id: "sprint_gh_7", title: "7 GitHub Days", desc: "Log 7 sprint commit days.", category: "Sprint", rarity: "RARE", xp: 100, target: 7, metric: "sprintGh", better: "Commit more" },
  { id: "sprint_gh_30", title: "30 GitHub Days", desc: "A commit every sprint day.", category: "Sprint", rarity: "EPIC", xp: 300, target: 30, metric: "sprintGh", better: "Commit daily" },
  { id: "sprint_perfect", title: "Perfect Day", desc: "Finish all 5 sprint goals in one day.", category: "Sprint", rarity: "RARE", xp: 50, target: 1, metric: "sprintPerfect", better: "Go 5/5" },
  { id: "sprint_perfect_10", title: "10 Perfect Days", desc: "Ten 5/5 sprint days.", category: "Sprint", rarity: "EPIC", xp: 200, target: 10, metric: "sprintPerfect", better: "More perfect days" },
  { id: "sprint_perfect_30", title: "30 Perfect Days", desc: "A perfect 30-day run.", category: "Sprint", rarity: "LEGENDARY", xp: 500, target: 30, metric: "sprintPerfect", better: "Perfection" },
  // Opportunity sources (computed from real missions by source kind)
  { id: "first_linkedin_opp", title: "LinkedIn Scout", desc: "Capture your first LinkedIn opportunity.", category: "Sources", rarity: "COMMON", xp: 10, target: 1, metric: "oppsLinkedin", better: "Capture a LinkedIn post" },
  { id: "first_email_opp", title: "Inbox Scout", desc: "Capture your first email opportunity.", category: "Sources", rarity: "COMMON", xp: 10, target: 1, metric: "oppsEmail", better: "Capture a recruiter email" },
  { id: "first_careers_opp", title: "Direct Scout", desc: "Capture your first company-careers opportunity.", category: "Sources", rarity: "COMMON", xp: 10, target: 1, metric: "oppsCareers", better: "Capture a careers-page post" },
  { id: "opps_100", title: "Opportunity Magnet", desc: "Find 100 opportunities.", category: "Sources", rarity: "EPIC", xp: 250, target: 100, metric: "missions", better: "Discover more" },
  // Own LinkedIn output (published posts only — drafts never count)
  { id: "my_post_1", title: "First Post Out", desc: "Publish your first tracked LinkedIn post.", category: "Output", rarity: "COMMON", xp: 15, target: 1, metric: "myPosts", better: "Publish a post" },
  { id: "my_post_10", title: "Consistent Voice", desc: "Publish 10 LinkedIn posts.", category: "Output", rarity: "RARE", xp: 100, target: 10, metric: "myPosts", better: "Publish more" },
  { id: "my_post_30", title: "Thought Leader", desc: "Publish 30 LinkedIn posts.", category: "Output", rarity: "EPIC", xp: 300, target: 30, metric: "myPosts", better: "Publish more" },
];

export const RARITY_STYLE: Record<Rarity, string> = {
  COMMON: "border-zinc-500/50 text-zinc-300",
  UNCOMMON: "border-emerald-400/50 text-emerald-200",
  RARE: "border-sky-400/50 text-sky-200",
  EPIC: "border-violet-400/60 text-violet-200",
  LEGENDARY: "border-yellow-300/60 text-yellow-200",
};
