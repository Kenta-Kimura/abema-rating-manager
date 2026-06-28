const STORAGE_KEY = "abema-elo-state-v1";
const DEFAULT_EXTERNAL_JSON_NAME = "abema-rating-data.json";
const DEFAULT_EXTERNAL_JSON = `./${DEFAULT_EXTERNAL_JSON_NAME}`;
const FIXED_SIMULATION_COUNT = 100000;
const REGIONAL_FORECAST_CACHE_VERSION = 1;
const SEARCHABLE_VIEWS = new Set(["dashboard", "tournaments", "matches"]);
const REGIONAL_2026_TOURNAMENT = "地域2026";
const REGIONAL_2026_DISPLAY_NAMES = {
  "ルシーグ横浜": "TDI ルシーグ横浜",
  "北関東ブリッツァーズ": "東武鉄道 北関東ブリッツァーズ",
  "ノース・トラッズ神戸": "KOYOHD ノース・トラッズ神戸"
};
const REGIONAL_2026_BRACKET = {
  A: [
    ["ルシーグ横浜", "九州サザンフェニックス"],
    ["北海道・東北バルペックス", "中部トライキングス"]
  ],
  B: [
    ["中国・四国ナヴィセトス", "サウスゴッツ大阪"],
    ["北関東ブリッツァーズ", "ノース・トラッズ神戸"]
  ]
};
const MATCH_STAGE_PHASES = ["予選", "本選"];
const MATCH_STAGE_TYPES = [
  { value: "リーグA", label: "Aリーグ", groupRequired: true },
  { value: "リーグB", label: "Bリーグ", groupRequired: true },
  { value: "リーグC", label: "Cリーグ", groupRequired: true },
  { value: "リーグ準", label: "準決勝", groupRequired: true },
  { value: "リーグ決", label: "決勝", groupRequired: false }
];
const MATCH_STAGE_MATCHES = [
  { value: "1", label: "第1試合" },
  { value: "2", label: "第2試合" },
  { value: "3", label: "1位決定戦" },
  { value: "4", label: "敗者復活戦" },
  { value: "5", label: "2位決定戦" }
];
const MATCH_STAGE_GAMES = Array.from({ length: 9 }, (_, index) => String(index + 1));
const REGIONAL_STAGE_PREFIXES = {
  "Aリーグ 初戦1": "予選 リーグA 1組",
  "Aリーグ 初戦2": "予選 リーグA 2組",
  "Aリーグ 1位決定戦": "予選 リーグA 3組",
  "Aリーグ 敗者復活戦": "予選 リーグA 4組",
  "Aリーグ 2位決定戦": "予選 リーグA 5組",
  "Bリーグ 初戦1": "予選 リーグB 1組",
  "Bリーグ 初戦2": "予選 リーグB 2組",
  "Bリーグ 1位決定戦": "予選 リーグB 3組",
  "Bリーグ 敗者復活戦": "予選 リーグB 4組",
  "Bリーグ 2位決定戦": "予選 リーグB 5組",
  "準決勝1 (A1 vs B2)": "本選 リーグ準 1組",
  "準決勝2 (B1 vs A2)": "本選 リーグ準 2組",
  "決勝": "本選 リーグ決"
};
const REGIONAL_AWARDS = [
  { key: "mostWins", label: "最多勝" },
  { key: "bestWinRate", label: "最高勝率賞" },
  { key: "mostGames", label: "最多対局賞" },
  { key: "bestPrelim", label: "予選最高成績賞" },
  { key: "fightingSpirit", label: "敢闘賞" }
];

const state = loadState();
let computed = computeRatings();
let chartPoints = [];
let pendingChartFrame = 0;
let editingMatchIndex = null;
let editingTeamMetaIndex = null;
let matchStageTouched = false;
let externalFileHandle = null;
let externalSaveTimer = null;
let simulationRunId = 0;
let simulationRunning = false;
let simulationStopRequested = false;
let simulationResultRenderState = null;
let regionalForecastRunId = 0;
let regionalForecastRunning = false;
let regionalForecastStopRequested = false;
let regionalForecastRenderState = null;
let regionalAwardCurrentKey = REGIONAL_AWARDS[0].key;
let regionalAwardRenderState = null;
let customTeamSuggestionBox = null;
let customTeamSuggestionInput = null;
let inlineSuggestionBox = null;
let inlineSuggestionInput = null;
const sortState = {
  ranking: { key: "rating", direction: "desc", touched: false },
  tournament: { key: "end", direction: "desc", touched: false },
  tournamentMatches: { key: "index", direction: "asc", touched: false },
  matches: { key: "index", direction: "desc", touched: false },
  leagueRatings: { key: "average", direction: "desc", touched: false },
  teamRatings: { key: "average", direction: "desc", touched: false },
  playerTournaments: { key: "order", direction: "asc", touched: false },
  playerOpponents: { key: "rating", direction: "desc", touched: false },
  playerRatingHistory: { key: "index", direction: "asc", touched: false },
  simulationPlayerStats: { key: "wins", direction: "desc", touched: false },
  regionalForecast: { key: "champion", direction: "desc", touched: false },
  regionalAwards: { key: "awardRate", direction: "desc", touched: false },
  teamMeta: { key: "teamMetaDefault", direction: "asc", touched: false }
};

const els = {
  viewTitle: document.querySelector("#viewTitle"),
  searchInput: document.querySelector("#searchInput"),
  matchCount: document.querySelector("#matchCount"),
  playerCount: document.querySelector("#playerCount"),
  topRating: document.querySelector("#topRating"),
  avgRating: document.querySelector("#avgRating"),
  rankingBody: document.querySelector("#rankingBody"),
  searchBox: document.querySelector(".search"),
  tournamentSelect: document.querySelector("#tournamentSelect"),
  tournamentSummary: document.querySelector("#tournamentSummary"),
  tournamentBody: document.querySelector("#tournamentBody"),
  tournamentMatchesBody: document.querySelector("#tournamentMatchesBody"),
  leagueRatingBody: document.querySelector("#leagueRatingBody"),
  teamRatingBody: document.querySelector("#teamRatingBody"),
  matchesBody: document.querySelector("#matchesBody"),
  ratingCanvas: document.querySelector("#ratingCanvas"),
  chartTooltip: document.querySelector("#chartTooltip"),
  matchForm: document.querySelector("#matchForm"),
  matchDate: document.querySelector('#matchForm [name="date"]'),
  teamEntryForm: document.querySelector("#teamEntryForm"),
  formTournament: document.querySelector('#matchForm [name="tournament"]'),
  matchStage: document.querySelector('#matchForm [name="stage"]'),
  matchStagePhaseSelect: document.querySelector("#matchStagePhaseSelect"),
  matchStageTypeSelect: document.querySelector("#matchStageTypeSelect"),
  matchStageMatchSelect: document.querySelector("#matchStageMatchSelect"),
  matchStageGameSelect: document.querySelector("#matchStageGameSelect"),
  matchTeamA: document.querySelector('#matchForm [name="teamA"]'),
  matchTeamB: document.querySelector('#matchForm [name="teamB"]'),
  teamEntryTournament: document.querySelector('#teamEntryForm [name="tournament"]'),
  tournamentOptions: document.querySelector("#tournamentOptions"),
  teamOptions: document.querySelector("#teamOptions"),
  matchPlayerAOptions: document.querySelector("#matchPlayerAOptions"),
  matchPlayerBOptions: document.querySelector("#matchPlayerBOptions"),
  playerOptions: document.querySelector("#playerOptions"),
  addMatchButton: document.querySelector("#addMatchButton"),
  addTeamEntryButton: document.querySelector("#addTeamEntryButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  clearMatchesButton: document.querySelector("#clearMatchesButton"),
  fileInput: document.querySelector("#fileInput"),
  pasteArea: document.querySelector("#pasteArea"),
  importPasteButton: document.querySelector("#importPasteButton"),
  openExternalFileButton: document.querySelector("#openExternalFileButton"),
  saveExternalFileButton: document.querySelector("#saveExternalFileButton"),
  externalFileStatus: document.querySelector("#externalFileStatus"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  initialRating: document.querySelector("#initialRating"),
  kFactor: document.querySelector("#kFactor"),
  minGames: document.querySelector("#minGames"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  playerDetailSelect: document.querySelector("#playerDetailSelect"),
  playerDetail: document.querySelector("#playerDetail"),
  playerTournamentBody: document.querySelector("#playerTournamentBody"),
  playerOpponentBody: document.querySelector("#playerOpponentBody"),
  playerRatingHistoryBody: document.querySelector("#playerRatingHistoryBody"),
  renameTournamentForm: document.querySelector("#renameTournamentForm"),
  renameTournamentButton: document.querySelector("#renameTournamentButton"),
  teamMetaBody: document.querySelector("#teamMetaBody"),
  simulationForm: document.querySelector("#simulationForm"),
  simulationTournamentSelect: document.querySelector("#simulationTournamentSelect"),
  simulationStageSelect: document.querySelector("#simulationStageSelect"),
  simulationLeagueSelect: document.querySelector("#simulationLeagueSelect"),
  simulationTeamASelect: document.querySelector("#simulationTeamASelect"),
  simulationTeamBSelect: document.querySelector("#simulationTeamBSelect"),
  runSimulationButton: document.querySelector("#runSimulationButton"),
  simulationStatus: document.querySelector("#simulationStatus"),
  simulationWarnings: document.querySelector("#simulationWarnings"),
  simulationConfirmedBody: document.querySelector("#simulationConfirmedBody"),
  simulationResult: document.querySelector("#simulationResult"),
  simulationScoreBody: document.querySelector("#simulationScoreBody"),
  simulationPlayerStatsATitle: document.querySelector("#simulationPlayerStatsATitle"),
  simulationPlayerStatsBTitle: document.querySelector("#simulationPlayerStatsBTitle"),
  simulationPlayerStatsABody: document.querySelector("#simulationPlayerStatsABody"),
  simulationPlayerStatsBBody: document.querySelector("#simulationPlayerStatsBBody"),
  simulationSampleLog: document.querySelector("#simulationSampleLog"),
  runRegionalForecastButton: document.querySelector("#runRegionalForecastButton"),
  regionalForecastCountInput: document.querySelector("#regionalForecastCountInput"),
  regionalForecastStatus: document.querySelector("#regionalForecastStatus"),
  regionalForecastWarnings: document.querySelector("#regionalForecastWarnings"),
  regionalForecastFixedSummary: document.querySelector("#regionalForecastFixedSummary"),
  regionalForecastBody: document.querySelector("#regionalForecastBody"),
  regionalAwardHead: document.querySelector("#regionalAwardHead"),
  regionalAwardBody: document.querySelector("#regionalAwardBody"),
  regionalForecastSampleLog: document.querySelector("#regionalForecastSampleLog"),
  customTeamABox: document.querySelector("#customTeamABox"),
  customTeamBBox: document.querySelector("#customTeamBBox"),
  customTeamAPlayers: Array.from({ length: 5 }, (_, index) => document.querySelector(`#customTeamAPlayer${index + 1}`)),
  customTeamBPlayers: Array.from({ length: 5 }, (_, index) => document.querySelector(`#customTeamBPlayer${index + 1}`)),
  copyCustomTeamAButton: document.querySelector("#copyCustomTeamAButton"),
  copyCustomTeamBButton: document.querySelector("#copyCustomTeamBButton"),
  toast: document.querySelector("#toast")
};

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});
document.querySelectorAll("th[data-sort]").forEach((header) => {
  registerSortableHeader(header);
});

function registerSortableHeader(header) {
  if (header.dataset.sortReady) return;
  header.classList.add("sortable");
  header.addEventListener("click", () => updateSort(header));
  header.dataset.sortReady = "true";
}

els.searchInput.addEventListener("input", render);
els.tournamentSelect.addEventListener("change", renderTournaments);
els.ratingCanvas.addEventListener("mousemove", showChartTooltip);
els.ratingCanvas.addEventListener("mouseleave", hideChartTooltip);
els.matchDate.addEventListener("input", handleMatchDateInput);
els.matchDate.addEventListener("change", handleMatchDateInput);
els.formTournament.addEventListener("input", renderFormOptions);
els.matchStagePhaseSelect.addEventListener("change", handleMatchStageControlChange);
els.matchStageTypeSelect.addEventListener("change", handleMatchStageControlChange);
els.matchStageMatchSelect.addEventListener("change", handleMatchStageControlChange);
els.matchStageGameSelect.addEventListener("change", handleMatchStageControlChange);
els.matchTeamA.addEventListener("input", renderFormOptions);
els.matchTeamB.addEventListener("input", renderFormOptions);
els.teamEntryTournament.addEventListener("input", renderFormOptions);
els.playerDetailSelect.addEventListener("change", () => {
  renderPlayerDetail();
  scheduleChartDraw();
});
els.playerDetailSelect.addEventListener("input", () => {
  if (computed.players.has(els.playerDetailSelect.value)) {
    renderPlayerDetail();
    scheduleChartDraw();
  }
});
els.addMatchButton.addEventListener("click", addMatchFromForm);
els.addTeamEntryButton.addEventListener("click", addTeamEntryFromForm);
els.cancelEditButton.addEventListener("click", cancelEditMatch);
els.clearMatchesButton.addEventListener("click", clearMatches);
els.fileInput.addEventListener("change", importFile);
els.importPasteButton.addEventListener("click", importPastedCsv);
els.openExternalFileButton.addEventListener("click", openExternalFile);
els.saveExternalFileButton.addEventListener("click", saveExternalFile);
els.renameTournamentButton.addEventListener("click", renameTournament);
els.exportCsvButton.addEventListener("click", exportCsv);
els.saveSettingsButton.addEventListener("click", saveSettings);
els.simulationTournamentSelect.addEventListener("change", () => {
  renderSimulationControls();
  renderSimulationPreview();
});
els.simulationStageSelect.addEventListener("change", renderSimulationPreview);
els.simulationLeagueSelect.addEventListener("change", () => {
  renderSimulationControls();
  renderSimulationPreview();
});
els.simulationTeamASelect.addEventListener("change", renderSimulationPreview);
els.simulationTeamBSelect.addEventListener("change", renderSimulationPreview);
els.regionalForecastCountInput.addEventListener("input", renderRegionalForecastPreview);
els.customTeamAPlayers.forEach(registerCustomTeamInput);
els.customTeamBPlayers.forEach(registerCustomTeamInput);
initInlineDatalistSuggestions();
updateDateInputState(els.matchDate);
els.copyCustomTeamAButton.addEventListener("click", () => fillCustomTeamFromFirst("A"));
els.copyCustomTeamBButton.addEventListener("click", () => fillCustomTeamFromFirst("B"));
els.runSimulationButton.addEventListener("click", handleSimulationButton);
els.runRegionalForecastButton.addEventListener("click", handleRegionalForecastButton);
document.querySelectorAll("[data-simulation-tab]").forEach((button) => {
  button.addEventListener("click", () => setSimulationTab(button.dataset.simulationTab));
});
document.querySelectorAll("[data-regional-award-tab]").forEach((button) => {
  button.addEventListener("click", () => setRegionalAwardTab(button.dataset.regionalAwardTab));
});
document.addEventListener("click", (event) => {
  if (inlineSuggestionBox?.contains(event.target)) return;
  if (event.target === inlineSuggestionInput) return;
  hideInlineSuggestions();
  if (customTeamSuggestionBox?.contains(event.target)) return;
  if (els.customTeamAPlayers.includes(event.target) || els.customTeamBPlayers.includes(event.target)) return;
  hideCustomTeamSuggestions();
});
window.addEventListener("resize", () => {
  repositionInlineSuggestions();
  hideCustomTeamSuggestions();
});
window.addEventListener("scroll", () => {
  repositionInlineSuggestions();
  hideCustomTeamSuggestions();
}, true);

render();
loadDefaultExternalFile();

function loadState() {
  const fallback = {
    settings: { initialRating: 1500, kFactor: 32, minGames: 0 },
    matches: [],
    rankingMeta: [],
    regionalForecastCache: createEmptyRegionalForecastCache(),
    ratingFormulaVersion: 2
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const loaded = {
      ...fallback,
      ...saved,
      settings: { ...fallback.settings, ...(saved.settings || {}) },
      regionalForecastCache: normalizeRegionalForecastCache(saved.regionalForecastCache)
    };
    if (!saved.ratingFormulaVersion && Number(loaded.settings.kFactor) === 24) {
      loaded.settings.kFactor = 32;
    }
    delete loaded.simulationCache;
    if (loaded.matches.some((match) => match.playerB === "__基準__")) {
      loaded.rankingMeta = [
        ...(loaded.rankingMeta || []),
        ...loaded.matches.filter((match) => match.playerB === "__基準__").map((match) => ({
          tournament: match.tournament || "",
          player: match.playerA || "",
          team: match.teamA || "",
          league: match.teamB || "",
          startRating: match.aBefore,
          currentRating: match.aAfter,
          rank: String(match.note || "").replace("現在順位 ", "")
        }))
      ];
      loaded.matches = loaded.matches.filter((match) => match.playerB !== "__基準__");
    }
    loaded.matches = (loaded.matches || []).map(cleanMatch);
    loaded.ratingFormulaVersion = 2;
    return loaded;
  } catch {
    return fallback;
  }
}

function saveState() {
  state.savedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleExternalSave();
}

function createEmptyRegionalForecastCache() {
  return { version: REGIONAL_FORECAST_CACHE_VERSION, regional2026: null };
}

function normalizeRegionalForecastCache(cache) {
  if (!cache || cache.version !== REGIONAL_FORECAST_CACHE_VERSION) return createEmptyRegionalForecastCache();
  return {
    version: REGIONAL_FORECAST_CACHE_VERSION,
    regional2026: cache.regional2026 || null
  };
}

function recompute() {
  computed = computeRatings();
  saveState();
  render();
}

function computeRatings() {
  const players = new Map();
  const history = [];
  const initial = Number(state.settings.initialRating) || 1500;
  const k = Number(state.settings.kFactor) || 24;

  const getPlayer = (name) => {
    const cleanName = normalizeName(name);
    if (!players.has(cleanName)) {
      players.set(cleanName, {
        name: cleanName,
        rating: initial,
        wins: 0,
        losses: 0,
        draws: 0,
        games: 0,
        peakRating: initial,
        lastDelta: 0,
        lastMatchDetail: null,
        history: [{ label: "開始", rating: initial, detail: "開始時レーティング" }]
      });
    }
    return players.get(cleanName);
  };

  state.matches.forEach((match, index) => {
    const a = getPlayer(match.playerA);
    if (match.playerB === "__基準__") {
      const aBefore = isFiniteNumber(match.aBefore) ? Number(match.aBefore) : a.rating;
      const aAfter = isFiniteNumber(match.aAfter) ? Number(match.aAfter) : a.rating;
      const deltaA = Math.round((aAfter - aBefore) * 10) / 10;
      a.rating = aAfter;
      a.peakRating = Math.max(a.peakRating, a.rating);
      a.lastDelta = deltaA;
      a.lastMatchDetail = buildRankingLastMatchDetail(match, "");
      a.history.push({ label: match.tournament || `#${index + 1}`, rating: a.rating, detail: `${match.tournament || ""} ${formatStageLabel(match.stage)}`.trim() });
      history.push({
        ...match,
        index,
        aBefore,
        bBefore: null,
        aAfter: a.rating,
        bAfter: null,
        deltaA,
        deltaB: 0,
        aWins: 0,
        bWins: 0,
        sourceRated: true
      });
      return;
    }
    const b = getPlayer(match.playerB);
    const aBefore = a.rating;
    const bBefore = b.rating;
    if (match.winner === "U") {
      history.push({
        ...match,
        index,
        aBefore,
        bBefore,
        aAfter: a.rating,
        bAfter: b.rating,
        deltaA: 0,
        deltaB: 0,
        aWins: 0,
        bWins: 0,
        expectedA: expectedScore(aBefore, bBefore),
        expectedB: expectedScore(bBefore, aBefore),
        pending: true
      });
      return;
    }
    const aWins = isFiniteNumber(match.aWins) ? Number(match.aWins) : (match.winner === "A" ? 1 : 0);
    const bWins = isFiniteNumber(match.bWins) ? Number(match.bWins) : (match.winner === "B" ? 1 : 0);
    const decisiveGames = aWins + bWins;
    const playedGames = decisiveGames > 0 ? decisiveGames : 1;
    const expectedA = 1 / (1 + Math.pow(10, (bBefore - aBefore) / 400));
    const expectedB = 1 - expectedA;
    const rawDeltaA = decisiveGames > 0 ? k * (aWins - decisiveGames * expectedA) : 0;
    const deltaA = Math.round(rawDeltaA * 10) / 10;
    const deltaB = Math.round(-rawDeltaA * 10) / 10;
    a.rating = Math.round((aBefore + rawDeltaA) * 10) / 10;
    b.rating = Math.round((bBefore - rawDeltaA) * 10) / 10;

    a.lastDelta = deltaA;
    b.lastDelta = deltaB;
    a.lastMatchDetail = buildRankingLastMatchDetail(match, match.playerB);
    b.lastMatchDetail = buildRankingLastMatchDetail(match, match.playerA);
    a.peakRating = Math.max(a.peakRating, a.rating);
    b.peakRating = Math.max(b.peakRating, b.rating);
    a.games += playedGames;
    b.games += playedGames;
    a.wins += aWins;
    a.losses += bWins;
    a.draws += Math.max(0, playedGames - aWins - bWins);
    b.wins += bWins;
    b.losses += aWins;
    b.draws += Math.max(0, playedGames - aWins - bWins);

    const label = match.date || `#${index + 1}`;
    const aDetail = chartDetail(match, match.playerB, `${aWins}-${bWins}`, aBefore, a.rating, deltaA);
    const bDetail = chartDetail(match, match.playerA, `${bWins}-${aWins}`, bBefore, b.rating, deltaB);
    a.history.push({ label, rating: a.rating, detail: aDetail });
    b.history.push({ label, rating: b.rating, detail: bDetail });
    history.push({
      ...match,
      index,
      aBefore,
      bBefore,
      aAfter: a.rating,
      bAfter: b.rating,
      deltaA,
      deltaB,
      aWins,
      bWins,
      expectedA,
      expectedB
    });
  });

  const rankings = [...players.values()]
    .filter((player) => player.games >= Number(state.settings.minGames || 0))
    .sort((left, right) => right.rating - left.rating || right.wins - left.wins || left.name.localeCompare(right.name, "ja"));
  rankings.forEach((player, index) => {
    player.rank = index + 1;
  });

  return { players, rankings, history };
}

function render() {
  computed = computeRatings();
  renderSettings();
  renderKpis();
  renderRanking();
  renderTournamentSelects();
  renderTournaments();
  renderMatches();
  renderTeamMeta();
  renderSelects();
  renderFormOptions();
  renderSimulationControls();
  renderSimulationPreview();
  renderRegionalForecastPreview();
  renderPlayerDetail();
  scheduleChartDraw();
}

function renderSettings() {
  els.initialRating.value = state.settings.initialRating;
  els.kFactor.value = state.settings.kFactor;
  els.minGames.value = state.settings.minGames;
}

function renderKpis() {
  const ratings = [...computed.players.values()].map((player) => player.rating);
  els.matchCount.textContent = state.matches.length.toLocaleString("ja-JP");
  els.playerCount.textContent = computed.players.size.toLocaleString("ja-JP");
  els.topRating.textContent = ratings.length ? Math.max(...ratings).toFixed(1) : "-";
  els.avgRating.textContent = ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : "-";
}

function decisiveWinRate(row) {
  const decisiveGames = Number(row.wins || 0) + Number(row.losses || 0);
  return decisiveGames ? Number(row.wins || 0) / decisiveGames : 0;
}

function renderRanking() {
  const query = normalizeName(els.searchInput.value).toLowerCase();
  const deviations = calculateRatingDeviations(computed.rankings);
  const rows = sortRows(computed.rankings
    .filter((player) => player.name.toLowerCase().includes(query))
    .map((player) => ({
      ...player,
      deviation: deviations.get(player.name) ?? 50,
      record: player.wins - player.losses,
      winRate: decisiveWinRate(player)
    })), sortState.ranking)
    .map((player, index) => {
      return `<tr>
        <td><span class="rank">${index + 1}</span></td>
        <td>${escapeHtml(player.name)}</td>
        <td><strong>${player.rating.toFixed(1)}</strong></td>
        <td>${player.deviation.toFixed(1)}</td>
        <td>${player.wins}-${player.losses}-${player.draws}</td>
        <td>${formatPercent(decisiveWinRate(player), 1)}</td>
        <td>${formatRankingLastDelta(player)}</td>
      </tr>`;
    });
  els.rankingBody.innerHTML = rows.join("") || emptyRow(7, "まだランキング対象の試合がありません");
}

function buildRankingLastMatchDetail(match, opponent) {
  return {
    date: match.date || "",
    tournament: match.tournament || "",
    stage: formatStageLabel(match.stage),
    opponent: opponent || ""
  };
}

function formatRankingLastDelta(player) {
  const detail = player.lastMatchDetail;
  if (!detail) return formatDelta(player.lastDelta);
  const context = [
    detail.date,
    [detail.tournament, detail.stage].filter(Boolean).join(" "),
    detail.opponent ? `vs ${detail.opponent}` : ""
  ].filter(Boolean).join(" / ");
  return `${formatDelta(player.lastDelta)}<span class="muted-cell ranking-last-detail">${escapeHtml(context)}</span>`;
}

function calculateRatingDeviations(players) {
  const ratings = players.map((player) => Number(player.rating)).filter(Number.isFinite);
  if (!ratings.length) return new Map();
  const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  const variance = ratings.reduce((sum, rating) => sum + (rating - average) ** 2, 0) / ratings.length;
  const standardDeviation = Math.sqrt(variance);
  return new Map(players.map((player) => [
    player.name,
    standardDeviation ? 50 + 10 * ((player.rating - average) / standardDeviation) : 50
  ]));
}

function renderMatches() {
  const query = normalizeName(els.searchInput.value).toLowerCase();
  const rows = sortRows(computed.history
    .filter((match) => {
      const text = [match.date, match.tournament, match.stage, formatStageLabel(match.stage), match.teamA, match.playerA, match.teamB, match.playerB, match.note].join(" ").toLowerCase();
      return text.includes(query);
    })
    .map((match) => ({
      ...match,
      matchup: `${match.playerA} ${match.playerB}`,
      winnerText: winnerLabel(match),
      expected: match.expectedA ?? 0,
      delta: Math.abs(Number(match.deltaA || 0)) + Math.abs(Number(match.deltaB || 0))
    })), sortState.matches)
    .map((match) => {
      if (match.playerB === "__基準__") {
        return `<tr>
          <td>${escapeHtml(match.date || "")}</td>
          <td>${escapeHtml(match.tournament || "")}</td>
          <td>${escapeHtml(match.playerA)}<br><small>${escapeHtml(formatStageLabel(match.stage))}</small></td>
          <td>レート反映</td>
          <td>${formatDelta(match.deltaA)}</td>
          <td><button data-edit="${match.index}" title="編集">編集</button></td>
        </tr>`;
      }
      return `<tr>
        <td>${escapeHtml(match.date || "")}</td>
        <td>${escapeHtml(match.tournament || "")}</td>
        <td>${plainMatchupHtml(match)}<br><small>${escapeHtml([formatStageLabel(match.stage), senteText(match)].filter(Boolean).join(" / "))}</small></td>
        <td>${expectedHtml(match)}</td>
        <td>${escapeHtml(match.playerA)} ${formatDelta(match.deltaA)} / ${escapeHtml(match.playerB)} ${formatDelta(match.deltaB)}</td>
        <td class="row-actions"><button data-edit="${match.index}" title="編集">編集</button><button data-delete="${match.index}" class="danger subtle" title="削除">削除...</button></td>
      </tr>`;
    });
  els.matchesBody.innerHTML = rows.join("") || emptyRow(6, "試合が未登録です");
  els.matchesBody.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => startEditMatch(Number(button.dataset.edit)));
  });
  els.matchesBody.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteMatch(Number(button.dataset.delete));
    });
  });
}

function renderTournamentSelects() {
  const current = els.tournamentSelect.value;
  const names = uniqueInOrder([
    ...state.matches.map((match) => match.tournament || "未分類"),
    ...(state.rankingMeta || []).map((item) => item.tournament)
  ].filter(Boolean));
  els.tournamentSelect.innerHTML = names.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("") || '<option value="">未登録</option>';
  els.tournamentSelect.value = names.includes(current) ? current : (names[0] || "");
}

function getTournamentOrder() {
  const names = uniqueInOrder([
    ...state.matches.map((match) => match.tournament || "未分類"),
    ...(state.rankingMeta || []).map((item) => item.tournament)
  ].filter(Boolean));
  return new Map(names.map((name, index) => [name, index]));
}

function renderTournaments() {
  const tournament = els.tournamentSelect.value;
  if (els.teamEntryTournament && !els.teamEntryTournament.value) {
    els.teamEntryTournament.value = tournament || "";
  }
  const query = normalizeName(els.searchInput.value).toLowerCase();
  const allMatches = computed.history.filter((match) => (match.tournament || "未分類") === tournament && match.playerB !== "__基準__");
  const tournamentRankMeta = computeTournamentRankMeta(tournament);
  const tournamentTeams = getTournamentTeamMap(tournament, allMatches);
  const standings = sortRows(computeTournamentStandings(allMatches)
    .filter((player) => player.name.toLowerCase().includes(query))
    .map((player) => ({
      ...player,
      ...tournamentRankMeta.get(player.name),
      team: tournamentTeams.get(player.name) || "",
      record: player.wins - player.losses,
      winRate: decisiveWinRate(player)
    })), sortState.tournament);
  const matches = allMatches.filter((match) => {
    const text = [match.playerA, match.playerB, match.stage, formatStageLabel(match.stage), match.teamA, match.teamB].join(" ").toLowerCase();
    return text.includes(query);
  });
  const decisiveGames = matches.reduce((sum, match) => sum + Number(match.aWins || 0) + Number(match.bWins || 0), 0);
  const noResultGames = matches.reduce((sum, match) => sum + (match.winner !== "U" && Number(match.aWins || 0) + Number(match.bWins || 0) === 0 ? 1 : 0), 0);
  const pendingGames = matches.reduce((sum, match) => sum + (match.winner === "U" ? 1 : 0), 0);
  els.tournamentSummary.innerHTML = [
    detailCard("大会", tournament || "-"),
    detailCard("対局行", matches.length.toLocaleString("ja-JP")),
    detailCard("決着局", decisiveGames.toLocaleString("ja-JP")),
    detailCard("無勝敗", noResultGames.toLocaleString("ja-JP")),
    detailCard("未定局", pendingGames.toLocaleString("ja-JP")),
    detailCard("参加棋士", standings.length.toLocaleString("ja-JP"))
  ].join("");

  els.tournamentBody.innerHTML = standings.map((player, index) => {
    return `<tr>
      <td><span class="rank">${index + 1}</span></td>
      <td>${tournamentPlayerCellHtml(player.name, player.team)}</td>
      <td>${formatRank(player.overallRank)}</td>
      <td>${formatRankChange(player.overallRankChange)}</td>
      <td>${player.start.toFixed(1)}</td>
      <td><strong>${player.end.toFixed(1)}</strong></td>
      <td>${formatDelta(player.delta)}</td>
      <td>${player.wins}-${player.losses}-${player.draws}</td>
      <td>${formatPercent(decisiveWinRate(player), 1)}</td>
    </tr>`;
  }).join("") || emptyRow(9, "この大会の対局がありません");

  els.tournamentMatchesBody.innerHTML = sortRows(matches.map((match) => ({
    ...match,
    matchup: `${match.playerA} ${match.playerB}`,
    winnerText: winnerLabel(match)
  })), sortState.tournamentMatches).map((match) => {
    return `<tr>
      <td>${tournamentMatchupHtml(match, tournamentTeams)}</td>
      <td>${escapeHtml(formatStageLabel(match.stage))}</td>
    </tr>`;
  }).join("") || emptyRow(2, "この大会の対局がありません");

  const groupRatings = computeGroupRatings(tournament, allMatches, standings);
  els.leagueRatingBody.innerHTML = sortRows(groupRatings.leagues, sortState.leagueRatings).map((group) => `
    <tr>
      <td>${escapeHtml(group.name)}</td>
      <td><strong>${group.average.toFixed(1)}</strong></td>
      <td>${group.count}</td>
      <td>${escapeHtml(group.players.join("、"))}</td>
    </tr>
  `).join("") || emptyRow(4, "リーグ情報がありません");
  els.teamRatingBody.innerHTML = sortRows(groupRatings.teams, sortState.teamRatings).map((group) => `
    <tr>
      <td>${escapeHtml(group.name)}</td>
      <td>${escapeHtml(group.league || "")}</td>
      <td><strong>${group.average.toFixed(1)}</strong></td>
      <td>${group.count}</td>
      <td>${escapeHtml(group.players.join("、"))}</td>
    </tr>
  `).join("") || emptyRow(5, "チーム情報がありません。順位CSVを取り込むと表示できます");
}

function computeTournamentStandings(matches) {
  const players = new Map();
  const ensure = (name, startRating) => {
    if (!players.has(name)) {
      players.set(name, {
        name,
        start: Number(startRating) || 0,
        end: Number(startRating) || 0,
        wins: 0,
        losses: 0,
        draws: 0,
        games: 0,
        delta: 0
      });
    }
    return players.get(name);
  };

  matches.forEach((match) => {
    if (match.winner === "U") return;
    const aWins = Number(match.aWins || 0);
    const bWins = Number(match.bWins || 0);
    const playedGames = aWins + bWins > 0 ? aWins + bWins : 1;
    const draws = Math.max(0, playedGames - aWins - bWins);
    const a = ensure(match.playerA, match.aBefore);
    const b = ensure(match.playerB, match.bBefore);
    a.end = Number(match.aAfter);
    b.end = Number(match.bAfter);
    a.wins += aWins;
    a.losses += bWins;
    a.draws += draws;
    a.games += playedGames;
    b.wins += bWins;
    b.losses += aWins;
    b.draws += draws;
    b.games += playedGames;
  });

  return [...players.values()].map((player) => ({
    ...player,
    delta: Math.round((player.end - player.start) * 10) / 10
  })).sort((left, right) => right.end - left.end || right.delta - left.delta || right.wins - left.wins || left.name.localeCompare(right.name, "ja"));
}

function computeTournamentRankMeta(tournament) {
  const initial = Number(state.settings.initialRating) || 1500;
  const entries = new Map([...computed.players.keys()].map((name) => [name, {
    name,
    rating: initial,
    wins: 0,
    games: 0
  }]));
  let startRanks = null;
  let endRanks = null;
  let hasSelectedRatedMatch = false;

  const ensure = (name) => {
    const cleanName = normalizeName(name);
    if (!entries.has(cleanName)) {
      entries.set(cleanName, { name: cleanName, rating: initial, wins: 0, games: 0 });
    }
    return entries.get(cleanName);
  };

  computed.history.forEach((match) => {
    const isSelectedTournament = (match.tournament || "未分類") === tournament;
    if (isSelectedTournament && startRanks === null) startRanks = rankSnapshot(entries);

    const a = ensure(match.playerA);
    if (match.sourceRated) {
      a.rating = Number(match.aAfter);
    } else {
      const b = ensure(match.playerB);
      if (match.winner !== "U") {
        const aWins = Number(match.aWins || 0);
        const bWins = Number(match.bWins || 0);
        const playedGames = aWins + bWins > 0 ? aWins + bWins : 1;
        a.rating = Number(match.aAfter);
        b.rating = Number(match.bAfter);
        a.wins += aWins;
        b.wins += bWins;
        a.games += playedGames;
        b.games += playedGames;
      }
    }

    if (isSelectedTournament && (match.sourceRated || match.winner !== "U")) {
      hasSelectedRatedMatch = true;
      endRanks = rankSnapshot(entries);
    }
  });

  return new Map([...computed.players.keys()].map((name) => {
    const startRank = startRanks?.get(name);
    const endRank = endRanks?.get(name);
    return [name, {
      overallRank: hasSelectedRatedMatch ? endRank : null,
      overallRankChange: hasSelectedRatedMatch && Number.isFinite(startRank) && Number.isFinite(endRank) ? startRank - endRank : null
    }];
  }));
}

function rankSnapshot(entries) {
  return new Map([...entries.values()]
    .filter((player) => player.games >= Number(state.settings.minGames || 0))
    .sort((left, right) => right.rating - left.rating || right.wins - left.wins || left.name.localeCompare(right.name, "ja"))
    .map((player, index) => [player.name, index + 1]));
}

function getTournamentTeamMap(tournament, matches) {
  const teams = new Map();
  matches.forEach((match) => {
    if (match.teamA) teams.set(normalizeName(match.playerA), match.teamA);
    if (match.teamB) teams.set(normalizeName(match.playerB), match.teamB);
  });
  getTournamentPlayerMeta(tournament).forEach((info, playerName) => {
    if (info.team) teams.set(normalizeName(playerName), info.team);
  });
  return teams;
}

function tournamentPlayerCellHtml(name, team) {
  const teamText = normalizeName(team);
  if (!teamText) return escapeHtml(name);
  return `${escapeHtml(name)}<span class="muted-cell">${escapeHtml(teamText)}</span>`;
}

function computeGroupRatings(tournament, matches, standings) {
  const playerMap = new Map(standings.map((player) => [player.name, player]));
  const meta = getTournamentPlayerMeta(tournament);
  const leagues = new Map();
  const teams = new Map();

  const ratingFor = (playerName, info) => {
    if (playerMap.has(playerName)) return playerMap.get(playerName).end;
    if (isFiniteNumber(info?.currentRating)) return Number(info.currentRating);
    return computed.players.get(playerName)?.rating ?? Number(state.settings.initialRating || 1500);
  };

  const add = (map, key, playerName, league = "", info = undefined) => {
    if (!key || !playerName) return;
    if (!map.has(key)) map.set(key, { name: key, league, ratings: [], players: [] });
    const group = map.get(key);
    const rating = ratingFor(playerName, info);
    group.ratings.push(rating);
    const marker = info?.leader ? " L" : "";
    group.players.push(`${playerName}${marker} ${rating.toFixed(1)}`);
    if (league && !group.league) group.league = league;
  };

  const playerNames = uniqueInOrder([...playerMap.keys(), ...meta.keys()]);
  playerNames.forEach((playerName) => {
    const info = meta.get(playerName);
    if (info?.league) add(leagues, info.league, playerName, "", info);
    if (info?.team) add(teams, info.team, playerName, info.league || "", info);
  });

  if (!leagues.size) {
    matches.forEach((match) => {
      const league = extractLeague(match.stage);
      add(leagues, league, match.playerA);
      add(leagues, league, match.playerB);
    });
  }

  return {
    leagues: finalizeGroups(leagues),
    teams: finalizeGroups(teams)
  };
}

function getTournamentPlayerMeta(tournament) {
  const meta = new Map();
  (state.rankingMeta || []).forEach((item) => {
    if (item.tournament !== tournament) return;
    meta.set(item.player, {
      team: item.team || "",
      league: item.league || "",
      currentRating: item.currentRating,
      order: item.order || item.rank || "",
      leader: Boolean(item.leader)
    });
  });
  return meta;
}

function extractLeague(stage) {
  const match = normalizeName(stage).match(/リーグ([A-ZＡ-Ｚ一二三四五六七八九十\d]+)/);
  return match ? match[1].replace(/[Ａ-Ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)) : "";
}

function finalizeGroups(map) {
  return [...map.values()].map((group) => ({
    ...group,
    count: group.ratings.length,
    average: group.ratings.reduce((sum, rating) => sum + rating, 0) / Math.max(1, group.ratings.length)
  }));
}

function renderSelects() {
  const names = [...computed.players.keys()].sort((a, b) => a.localeCompare(b, "ja"));
  const currentDetail = els.playerDetailSelect.value;
  els.playerDetailSelect.value = names.includes(currentDetail) ? currentDetail : (computed.rankings[0]?.name || names[0] || "");
}

function renderFormOptions() {
  const tournaments = uniqueInOrder([
    ...state.matches.map((match) => match.tournament),
    ...(state.rankingMeta || []).map((item) => item.tournament)
  ].filter(Boolean));
  const isAddView = document.querySelector("#importView").classList.contains("active-view");
  const selectedTournament = normalizeName((isAddView ? els.teamEntryTournament.value : els.formTournament.value) || els.formTournament.value || els.teamEntryTournament.value);
  const teams = uniqueInOrder([
    ...state.matches
    .filter((match) => !selectedTournament || match.tournament === selectedTournament)
    .flatMap((match) => [match.teamA, match.teamB])
    .filter(Boolean),
    ...(state.rankingMeta || [])
      .filter((item) => !selectedTournament || item.tournament === selectedTournament)
      .map((item) => item.team)
      .filter(Boolean)
  ]);
  const players = [...computed.players.keys()].sort((a, b) => a.localeCompare(b, "ja"));
  const playerOptions = players.map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
  const playerAOptions = getMatchPlayerOptions(selectedTournament, els.matchTeamA.value, players)
    .map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
  const playerBOptions = getMatchPlayerOptions(selectedTournament, els.matchTeamB.value, players)
    .map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
  els.tournamentOptions.innerHTML = tournaments.map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
  els.teamOptions.innerHTML = teams.map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
  els.matchPlayerAOptions.innerHTML = playerAOptions;
  els.matchPlayerBOptions.innerHTML = playerBOptions;
  els.playerOptions.innerHTML = playerOptions;
  renderMatchStageControls();
}

function renderMatchStageControls() {
  if (!els.matchStagePhaseSelect.options.length) {
    els.matchStagePhaseSelect.innerHTML = MATCH_STAGE_PHASES.map((phase) => `<option value="${escapeAttr(phase)}">${escapeHtml(phase)}</option>`).join("");
    els.matchStageTypeSelect.innerHTML = MATCH_STAGE_TYPES.map((type) => `<option value="${escapeAttr(type.value)}">${escapeHtml(type.label)}</option>`).join("");
    els.matchStageMatchSelect.innerHTML = MATCH_STAGE_MATCHES.map((match) => `<option value="${escapeAttr(match.value)}">${escapeHtml(match.label)}</option>`).join("");
    els.matchStageGameSelect.innerHTML = MATCH_STAGE_GAMES.map((game) => `<option value="${escapeAttr(game)}">${escapeHtml(`第${game}局`)}</option>`).join("");
  }
  if (!els.matchStage.value) updateMatchStageInput();
  updateMatchStageAvailability();
}

function handleMatchStageControlChange() {
  matchStageTouched = true;
  updateMatchStageInput();
}

function updateMatchStageInput() {
  updateMatchStageAvailability();
  els.matchStage.value = composeMatchStage();
}

function updateMatchStageAvailability() {
  const type = MATCH_STAGE_TYPES.find((item) => item.value === els.matchStageTypeSelect.value) || MATCH_STAGE_TYPES[0];
  els.matchStageMatchSelect.disabled = !type.groupRequired;
}

function composeMatchStage() {
  const phase = els.matchStagePhaseSelect.value || MATCH_STAGE_PHASES[0];
  const type = els.matchStageTypeSelect.value || MATCH_STAGE_TYPES[0].value;
  const game = els.matchStageGameSelect.value || "1";
  const typeMeta = MATCH_STAGE_TYPES.find((item) => item.value === type) || MATCH_STAGE_TYPES[0];
  return [phase, type, typeMeta.groupRequired ? `${els.matchStageMatchSelect.value || "1"}組` : "", `${game}局`]
    .filter(Boolean)
    .join(" ");
}

function applyMatchStageControls(stage) {
  if (!els.matchStagePhaseSelect.options.length) renderMatchStageControls();
  const parsed = parseMatchStage(stage);
  els.matchStagePhaseSelect.value = parsed.phase;
  els.matchStageTypeSelect.value = parsed.type;
  els.matchStageMatchSelect.value = parsed.match;
  els.matchStageGameSelect.value = parsed.game;
  updateMatchStageInput();
}

function parseMatchStage(stage) {
  const normalized = normalizeName(stage);
  const match = normalized.match(/^(予選|本選)\s+(リーグ[A-ZＡ-Ｚ]|リーグ準|リーグ決)(?:\s+([一二三四五六七八九十\d]+)組)?(?:\s+(\d+)局)?$/);
  if (!match) return { phase: "予選", type: "リーグA", match: "1", game: "1", valid: false };
  return {
    phase: match[1],
    type: normalizeStageType(match[2]),
    match: normalizeStageNumber(match[3]) || "1",
    game: match[4] || "1",
    valid: true
  };
}

function formatStageLabel(stage) {
  if (!stage) return "";
  const parsed = parseMatchStage(stage);
  if (!parsed.valid) return stage;
  const typeMeta = MATCH_STAGE_TYPES.find((item) => item.value === parsed.type);
  const parts = [parsed.phase, typeMeta?.label || parsed.type];
  if (typeMeta?.groupRequired) parts.push(`第${parsed.match}試合`);
  if (hasStageGame(stage)) parts.push(`第${parsed.game}局`);
  return parts.join(" ");
}

function hasStageGame(stage) {
  return /(?:^|\s)\d+局$/.test(normalizeName(stage));
}

function normalizeStageType(value) {
  const normalized = normalizeName(value).replace("リーグＡ", "リーグA").replace("リーグＢ", "リーグB").replace("リーグＣ", "リーグC");
  return MATCH_STAGE_TYPES.some((type) => type.value === normalized) ? normalized : "リーグA";
}

function normalizeStageNumber(value) {
  const text = normalizeName(value);
  const kanji = { "一": "1", "二": "2", "三": "3", "四": "4", "五": "5" };
  return kanji[text] || text.replace(/[^\d]/g, "");
}

function getMatchPlayerOptions(tournament, team, allPlayers) {
  const selectedTeam = normalizeName(team);
  const selectedTournament = normalizeName(tournament);
  if (!selectedTeam) return allPlayers;
  const members = uniqueInOrder([
    ...(state.rankingMeta || [])
      .filter((item) => (!selectedTournament || normalizeName(item.tournament) === selectedTournament) && normalizeName(item.team) === selectedTeam)
      .map((item) => item.player),
    ...state.matches
      .filter((match) => !selectedTournament || normalizeName(match.tournament) === selectedTournament)
      .flatMap((match) => [
        normalizeName(match.teamA) === selectedTeam ? match.playerA : "",
        normalizeName(match.teamB) === selectedTeam ? match.playerB : ""
      ])
  ].map((name) => normalizeName(name)).filter(Boolean));
  return members.sort((a, b) => a.localeCompare(b, "ja"));
}

function renderSimulationControls() {
  const groups = getSimulationTeamGroups();
  const tournaments = uniqueInOrder(groups.map((group) => group.tournament));
  const previousTournament = els.simulationTournamentSelect.value;
  const tournament = tournaments.includes(previousTournament)
    ? previousTournament
    : (tournaments.includes(REGIONAL_2026_TOURNAMENT) ? REGIONAL_2026_TOURNAMENT : (tournaments[0] || ""));
  els.simulationTournamentSelect.innerHTML = tournaments.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("") || '<option value="">未登録</option>';
  els.simulationTournamentSelect.value = tournament;

  const stages = getSimulationStageOptions(tournament);
  const previousStage = els.simulationStageSelect.value;
  const stage = stages.some((option) => option.value === previousStage) ? previousStage : "";
  els.simulationStageSelect.innerHTML = [
    '<option value="">指定なし</option>',
    ...stages.map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`)
  ].join("");
  els.simulationStageSelect.value = stage;

  const tournamentGroups = groups.filter((group) => group.tournament === tournament);
  const leagues = uniqueInOrder(tournamentGroups.map((group) => group.league || "未設定"));
  const previousLeague = els.simulationLeagueSelect.value;
  const league = leagues.includes(previousLeague) ? previousLeague : (leagues[0] || "");
  els.simulationLeagueSelect.innerHTML = leagues.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("") || '<option value="">未登録</option>';
  els.simulationLeagueSelect.value = league;

  const teamGroups = tournamentGroups.filter((group) => (group.league || "未設定") === league);
  const teamIdsA = [...teamGroups.map((group) => group.id), "custom::A"];
  const teamIdsB = [...teamGroups.map((group) => group.id), "custom::B"];
  const previousA = els.simulationTeamASelect.value;
  const previousB = els.simulationTeamBSelect.value;
  const teamA = teamIdsA.includes(previousA) ? previousA : (teamIdsA[0] || "");
  const teamB = teamIdsB.includes(previousB) ? previousB : (teamIdsB.find((team) => team !== teamA) || teamA || "");
  const realOptions = teamGroups.map((group) => `<option value="${escapeAttr(group.id)}">${escapeHtml(group.team)}</option>`).join("");
  els.simulationTeamASelect.innerHTML = `${realOptions}<option value="custom::A">カスタムチームA</option>`;
  els.simulationTeamBSelect.innerHTML = `${realOptions}<option value="custom::B">カスタムチームB</option>`;
  els.simulationTeamASelect.value = teamA;
  els.simulationTeamBSelect.value = teamB;
}

function renderSimulationPreview() {
  const setup = getSimulationSetup();
  simulationResultRenderState = null;
  const allWarnings = [...setup.warnings, ...setup.confirmed.warnings];
  els.simulationWarnings.innerHTML = allWarnings.map((warning) => `<div class="warning-item">${escapeHtml(warning)}</div>`).join("");
  els.simulationConfirmedBody.innerHTML = renderSimulationConfirmedRows(setup.confirmed.games);
  els.simulationScoreBody.innerHTML = emptyRow(3, "シミュレーション実行後に表示します");
  els.simulationPlayerStatsATitle.textContent = setup.teamA ? `チームA: ${setup.teamA.team}` : "チームA";
  els.simulationPlayerStatsBTitle.textContent = setup.teamB ? `チームB: ${setup.teamB.team}` : "チームB";
  els.customTeamABox.classList.toggle("hidden", els.simulationTeamASelect.value !== "custom::A");
  els.customTeamBBox.classList.toggle("hidden", els.simulationTeamBSelect.value !== "custom::B");
  els.simulationPlayerStatsABody.innerHTML = emptyRow(9, "シミュレーション実行後に表示します");
  els.simulationPlayerStatsBBody.innerHTML = emptyRow(9, "シミュレーション実行後に表示します");
  if (!setup.teamA || !setup.teamB) {
    els.simulationStatus.textContent = "大会・リーグ・チームを選択してください。";
  } else if (allWarnings.length) {
    els.simulationStatus.textContent = "警告を確認してください。チーム編成、レーティング、確定済み対局の整合性が必要です。";
  } else {
    const fixedCount = setup.confirmed.games.filter((game) => !game.pending).length;
    const pendingCount = setup.confirmed.games.filter((game) => game.pending).length;
    const count = fixedCount + pendingCount;
    const total = FIXED_SIMULATION_COUNT;
    els.simulationStatus.textContent = setup.teamA.team === setup.teamB.team
      ? `${total.toLocaleString("ja-JP")}回実行できます。同じチーム同士のため、確定済み対局は参照しません。`
      : setup.teamA.source === "custom" || setup.teamB.source === "custom"
      ? `${total.toLocaleString("ja-JP")}回実行できます。カスタムチームを含むため、確定済み対局は参照しません。`
      : count
      ? `確定${fixedCount}局・未定${pendingCount}局を固定して${total.toLocaleString("ja-JP")}回実行できます。`
      : `${total.toLocaleString("ja-JP")}回実行できます。`;
  }
}

function renderSimulationConfirmedRows(games = []) {
  return games.map((game, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(game.pending ? "未定局" : "確定済み対局")}</strong></td>
      <td>${escapeHtml(simulationMemberLabel(game.a))}</td>
      <td>${escapeHtml(simulationMemberLabel(game.b))}</td>
      <td><strong>${escapeHtml(game.pending ? "未定" : simulationMemberLabel(game.winner))}</strong></td>
      <td>${escapeHtml(game.pending ? "未定" : simulationMemberLabel(game.loser))}</td>
      <td>${escapeHtml(game.stageLabel)}</td>
    </tr>
  `).join("") || emptyRow(7, "固定対象局はありません");
}

function getSimulationSetup() {
  const groups = getSimulationTeamGroups();
  const tournament = els.simulationTournamentSelect.value;
  const stage = els.simulationStageSelect.value;
  const league = els.simulationLeagueSelect.value;
  const teamAId = els.simulationTeamASelect.value;
  const teamBId = els.simulationTeamBSelect.value;
  const findGroup = (id) => {
    if (id === "custom::A") return getCustomSimulationTeam("A", tournament, league);
    if (id === "custom::B") return getCustomSimulationTeam("B", tournament, league);
    return groups.find((group) => group.id === id && group.tournament === tournament && (group.league || "未設定") === league);
  };
  const teamA = prepareSimulationTeam(findGroup(teamAId), "A");
  const teamB = prepareSimulationTeam(findGroup(teamBId), "B");
  const warnings = [
    ...validateSimulationTeam(teamA, "チームA"),
    ...validateSimulationTeam(teamB, "チームB")
  ];
  const stageFilter = getSimulationStageFilter(stage);
  const confirmed = teamA && teamB ? getConfirmedSimulationGames(tournament, stageFilter, teamA, teamB) : { games: [], warnings: [] };
  return { tournament, stage, league, teamA, teamB, confirmed, warnings };
}

function registerCustomTeamInput(input) {
  input.addEventListener("input", () => {
    renderSimulationPreview();
    renderCustomTeamSuggestions(input);
  });
  input.addEventListener("focus", () => renderCustomTeamSuggestions(input));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideCustomTeamSuggestions();
  });
}

function ensureCustomTeamSuggestionBox() {
  if (customTeamSuggestionBox) return customTeamSuggestionBox;
  customTeamSuggestionBox = document.createElement("div");
  customTeamSuggestionBox.className = "custom-team-suggestions hidden";
  customTeamSuggestionBox.addEventListener("mousedown", (event) => event.preventDefault());
  document.body.appendChild(customTeamSuggestionBox);
  return customTeamSuggestionBox;
}

function renderCustomTeamSuggestions(input) {
  const box = ensureCustomTeamSuggestionBox();
  const query = normalizeName(input.value);
  const players = [...computed.players.keys()].sort((a, b) => a.localeCompare(b, "ja"));
  const matches = players
    .filter((name) => !query || name.includes(query));
  if (!matches.length) {
    hideCustomTeamSuggestions();
    return;
  }
  const rect = input.getBoundingClientRect();
  box.style.left = `${rect.left + window.scrollX}px`;
  box.style.top = `${rect.bottom + window.scrollY + 4}px`;
  box.style.width = `${rect.width}px`;
  box.innerHTML = matches.map((name) => `<button type="button" data-name="${escapeAttr(name)}">${escapeHtml(name)}</button>`).join("");
  box.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.name || "";
      hideCustomTeamSuggestions();
      renderSimulationPreview();
      input.focus();
    });
  });
  customTeamSuggestionInput = input;
  box.classList.remove("hidden");
}

function hideCustomTeamSuggestions() {
  if (!customTeamSuggestionBox) return;
  customTeamSuggestionBox.classList.add("hidden");
  customTeamSuggestionInput = null;
}

function initInlineDatalistSuggestions() {
  document.querySelectorAll("input[list]").forEach((input) => {
    input.dataset.suggestionList = input.getAttribute("list") || "";
    input.removeAttribute("list");
    input.setAttribute("autocomplete", "off");
    input.addEventListener("input", () => renderInlineSuggestions(input));
    input.addEventListener("focus", () => renderInlineSuggestions(input));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideInlineSuggestions();
    });
  });
}

function ensureInlineSuggestionBox() {
  if (inlineSuggestionBox) return inlineSuggestionBox;
  inlineSuggestionBox = document.createElement("div");
  inlineSuggestionBox.className = "inline-suggestions hidden";
  inlineSuggestionBox.addEventListener("mousedown", (event) => event.preventDefault());
  document.body.appendChild(inlineSuggestionBox);
  return inlineSuggestionBox;
}

function renderInlineSuggestions(input) {
  const listId = input.dataset.suggestionList;
  const list = listId ? document.getElementById(listId) : null;
  if (!list) {
    hideInlineSuggestions();
    return;
  }
  const query = normalizeName(input.value);
  const values = Array.from(list.options)
    .map((option) => normalizeName(option.value))
    .filter(Boolean);
  const matches = uniqueInOrder(values)
    .filter((value) => !query || value.includes(query));
  if (!matches.length) {
    hideInlineSuggestions();
    return;
  }
  const box = ensureInlineSuggestionBox();
  positionInlineSuggestionBox(input, box);
  box.innerHTML = matches.map((value) => `<button type="button" data-value="${escapeAttr(value)}">${escapeHtml(value)}</button>`).join("");
  box.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.value || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      hideInlineSuggestions();
      input.focus();
    });
  });
  inlineSuggestionInput = input;
  box.classList.remove("hidden");
}

function positionInlineSuggestionBox(input, box = inlineSuggestionBox) {
  if (!input || !box) return false;
  const rect = input.getBoundingClientRect();
  const isVisible = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  if (!isVisible) return false;
  box.style.left = `${rect.left + window.scrollX}px`;
  box.style.top = `${rect.bottom + window.scrollY + 4}px`;
  box.style.width = `${rect.width}px`;
  return true;
}

function repositionInlineSuggestions() {
  if (!inlineSuggestionInput || !inlineSuggestionBox || inlineSuggestionBox.classList.contains("hidden")) return;
  if (!positionInlineSuggestionBox(inlineSuggestionInput)) hideInlineSuggestions();
}

function hideInlineSuggestions() {
  if (!inlineSuggestionBox) return;
  inlineSuggestionBox.classList.add("hidden");
  inlineSuggestionInput = null;
}

function updateDateInputState(input) {
  input.classList.toggle("empty-date", !input.value);
}

function handleMatchDateInput() {
  updateDateInputState(els.matchDate);
  autofillMatchFieldsFromDate();
}

function autofillMatchFieldsFromDate() {
  const source = findLatestMatchForFormDate(els.matchDate.value);
  if (!source) return;
  let filled = false;
  ["tournament", "stage", "teamA", "teamB"].forEach((name) => {
    const field = els.matchForm.elements[name];
    if (!field || !source[name]) return;
    if (name === "stage") {
      if (!shouldAutofillMatchStage(source.stage)) return;
      applyMatchStageControls(source.stage);
      matchStageTouched = true;
      filled = true;
      return;
    }
    if (normalizeName(field.value)) return;
    field.value = source[name];
    filled = true;
  });
  if (filled) renderFormOptions();
}

function shouldAutofillMatchStage(stage) {
  if (!stage || !parseMatchStage(stage).valid) return false;
  return !normalizeName(els.matchStage.value) || (editingMatchIndex === null && !matchStageTouched);
}

function findLatestMatchForFormDate(date) {
  if (!date) return null;
  for (let index = state.matches.length - 1; index >= 0; index--) {
    if (index === editingMatchIndex) continue;
    const match = state.matches[index];
    if (match?.date !== date) continue;
    if (match.tournament || match.stage || match.teamA || match.teamB) return match;
  }
  return null;
}

function fillCustomTeamFromFirst(side) {
  const inputs = side === "A" ? els.customTeamAPlayers : els.customTeamBPlayers;
  const first = normalizeName(inputs[0]?.value || "");
  if (!first) {
    showToast("1枠目の棋士を選択してください");
    return;
  }
  inputs.forEach((input) => {
    input.value = first;
  });
  renderSimulationPreview();
}

function getCustomSimulationTeam(side, tournament, league) {
  const inputs = side === "A" ? els.customTeamAPlayers : els.customTeamBPlayers;
  const members = inputs.map((input, index) => {
    const name = normalizeName(input.value);
    const player = computed.players.get(name);
    return {
      name,
      displayName: name ? `${name} ${index + 1}` : "",
      team: side === "A" ? "カスタムチームA" : "カスタムチームB",
      league,
      order: index + 1,
      slot: index + 1,
      leader: index === 0,
      rating: player?.rating,
      ratingSource: player ? "computed" : ""
    };
  });
  return {
    id: `custom::${side}`,
    source: "custom",
    tournament,
    league,
    team: side === "A" ? "カスタムチームA" : "カスタムチームB",
    members
  };
}

function prepareSimulationTeam(team, side) {
  if (!team) return null;
  return {
    ...team,
    side,
    members: team.members.map((member, index) => ({
      ...member,
      side,
      statKey: `${side}:${member.name}:${member.slot || index + 1}`
    }))
  };
}

function getSimulationCount(input) {
  const value = Math.round(Number(input.value || 100000));
  if (!Number.isFinite(value)) return 100000;
  return Math.max(1, value);
}

function getRegionalForecastCount() {
  return getSimulationCount(els.regionalForecastCountInput);
}

function getSimulationStageOptions(tournament) {
  const stages = uniqueInOrder(computed.history
    .filter((match) => (match.tournament || "未分類") === tournament && match.playerB !== "__基準__")
    .map((match) => match.stage || "未分類")
    .filter(Boolean));
  return stages.map((stage) => {
    const group = simulationStageGroup(stage);
    return group
      ? { value: `group:${group}`, label: simulationStageGroupLabel(group) }
      : { value: `stage:${stage}`, label: formatStageLabel(stage) };
  }).filter((option, index, options) => options.findIndex((item) => item.value === option.value) === index);
}

function getSimulationStageFilter(value) {
  if (!value) return "";
  if (value.startsWith("group:")) {
    const prefix = value.slice("group:".length);
    return (stage) => isStageInPrefix(stage, prefix);
  }
  if (value.startsWith("stage:")) return value.slice("stage:".length);
  return value;
}

function simulationStageGroup(stage) {
  const parsed = parseMatchStage(stage);
  if (!parsed.valid) return "";
  const typeMeta = MATCH_STAGE_TYPES.find((type) => type.value === parsed.type);
  return [parsed.phase, parsed.type, typeMeta?.groupRequired ? `${parsed.match}組` : ""].filter(Boolean).join(" ");
}

function simulationStageGroupLabel(group) {
  const parsed = parseMatchStage(`${group} 1局`);
  if (!parsed.valid) return group;
  return formatStageLabel(group);
}

function getSimulationTeamGroups() {
  const groups = new Map();
  (state.rankingMeta || []).forEach((item) => {
    if (!item.tournament || !item.team) return;
    const key = [item.tournament, item.league || "未設定", item.team].join("::");
    if (!groups.has(key)) {
      groups.set(key, {
        id: `real::${key}`,
        source: "real",
        tournament: item.tournament,
        league: item.league || "未設定",
        team: item.team,
        members: []
      });
    }
    groups.get(key).members.push(simulationMemberFromMeta(item));
  });
  const realGroups = [...groups.values()].map((group) => ({
    ...group,
    members: normalizeSimulationMembers(group.members
      .sort((left, right) => Number(left.order || 999) - Number(right.order || 999) || Number(right.leader) - Number(left.leader) || left.name.localeCompare(right.name, "ja"))
      .slice(0, 5))
  })).filter((group) => group.members.length);
  return realGroups;
}

function normalizeSimulationMembers(members) {
  if (members.some((member) => member.leader)) return members;
  return members.map((member, index) => ({
    ...member,
    leader: index === 0
  }));
}

function simulationMemberFromMeta(item) {
  const name = normalizeName(item.player);
  const ratingInfo = getSimulationRatingInfo(name, item);
  return {
    name,
    team: item.team || "",
    league: item.league || "",
    order: item.order || item.rank || "",
    leader: Boolean(item.leader),
    rating: ratingInfo.rating,
    ratingSource: ratingInfo.source
  };
}

function getSimulationRatingInfo(name, item = {}) {
  const player = computed.players.get(name);
  if (player && isFiniteNumber(player.rating)) return { rating: Number(player.rating), source: "computed" };
  if (isFiniteNumber(item.currentRating)) return { rating: Number(item.currentRating), source: "meta" };
  if (isFiniteNumber(item.startRating)) return { rating: Number(item.startRating), source: "meta" };
  return { rating: undefined, source: "" };
}

function validateSimulationTeam(team, label) {
  if (!team) return [`${label}が選択されていません。`];
  const warnings = [];
  if (team.members.length !== 5) warnings.push(`${label}「${team.team}」のメンバーが5人ではありません。現在${team.members.length}人です。`);
  if (!team.members.some((member) => member.leader)) warnings.push(`${label}「${team.team}」の監督が判定できません。チーム編成で1人目をリーダーにしてください。`);
  const emptySlots = team.members.filter((member) => !member.name).map((member) => member.slot || member.order).filter(Boolean);
  if (emptySlots.length) warnings.push(`${label}「${team.team}」で未選択の枠があります: ${emptySlots.join("、")}`);
  const missing = team.members.filter((member) => member.name && !isFiniteNumber(member.rating)).map((member) => member.name);
  if (missing.length) warnings.push(`${label}「${team.team}」でレーティング未登録のメンバーがあります: ${missing.join("、")}`);
  return warnings;
}

function renderRegionalForecastPreview() {
  const setup = getRegionalForecastSetup();
  els.regionalForecastWarnings.innerHTML = setup.warnings.map((warning) => `<div class="warning-item">${escapeHtml(warning)}</div>`).join("");
  els.regionalForecastFixedSummary.innerHTML = "";
  regionalForecastRenderState = null;
  els.regionalForecastBody.innerHTML = emptyRow(7, "優勝予測実行後に表示します");
  regionalAwardRenderState = null;
  renderRegionalAwardRows();
  els.regionalForecastSampleLog.innerHTML = "";
  if (setup.warnings.length) {
    els.regionalForecastStatus.textContent = "地域2026のチーム編成を確認してください。";
  } else {
    const total = getRegionalForecastCount();
    const cachedResult = getRegionalForecastCachedResult(setup, total);
    if (cachedResult) {
      renderRegionalForecastCachedResult(setup, cachedResult);
      els.regionalForecastStatus.textContent = "保存済みの10万回シミュレーション結果を表示しています。";
      return;
    }
    els.regionalForecastStatus.textContent = `${total.toLocaleString("ja-JP")}回実行できます。予選A/Bリーグと仮定決勝トーナメントをまとめて計算します。`;
  }
}

function getRegionalForecastSetup() {
  const teamMap = new Map(getSimulationTeamGroups()
    .filter((group) => group.tournament === REGIONAL_2026_TOURNAMENT)
    .map((group) => [group.team, group]));
  const orderedTeams = getRegionalBracketTeamNames().map((name) => teamMap.get(name)).filter(Boolean);
  const confirmedCache = new Map();
  const warnings = [];
  getRegionalBracketTeamNames().forEach((name) => {
    const team = teamMap.get(name);
    if (!team) {
      warnings.push(`${REGIONAL_2026_TOURNAMENT}に「${regionalDisplayName(name)}」のチーム編成がありません。`);
      return;
    }
    warnings.push(...validateSimulationTeam(team, regionalDisplayName(team)).map((warning) => warning.replace(/^チームA|^チームB/, "チーム")));
  });
  return { teams: teamMap, orderedTeams, confirmedCache, warnings };
}

function getRegionalBracketTeamNames() {
  return uniqueInOrder([...REGIONAL_2026_BRACKET.A.flat(), ...REGIONAL_2026_BRACKET.B.flat()]);
}

async function runRegionalForecast() {
  if (regionalForecastRunning) return;
  const setup = getRegionalForecastSetup();
  if (setup.warnings.length) {
    renderRegionalForecastPreview();
    showToast("地域2026のチーム編成を確認してください");
    return;
  }

  const total = getRegionalForecastCount();
  els.regionalForecastCountInput.value = total;
  const cachedResult = getRegionalForecastCachedResult(setup, total);
  if (cachedResult) {
    renderRegionalForecastCachedResult(setup, cachedResult);
    els.regionalForecastStatus.textContent = "保存済みの10万回シミュレーション結果を表示しています。";
    showToast("保存済みの優勝予測を表示しました");
    return;
  }
  const chunkSize = 500;
  const runId = ++regionalForecastRunId;
  let completed = 0;
  const stats = createRegionalForecastStats(setup.orderedTeams);
  const awardStats = createRegionalAwardStats(setup.orderedTeams);
  let sample = null;
  regionalForecastRunning = true;
  regionalForecastStopRequested = false;
  els.runRegionalForecastButton.disabled = false;
  els.runRegionalForecastButton.textContent = "停止して結果表示";
  els.regionalForecastBody.innerHTML = emptyRow(7, "計算中です");
  els.regionalForecastFixedSummary.innerHTML = "";
  regionalForecastRenderState = null;
  regionalAwardRenderState = null;
  renderRegionalAwardRows("計算中です");
  els.regionalForecastSampleLog.innerHTML = "";

  for (let done = 0; done < total && runId === regionalForecastRunId && !regionalForecastStopRequested; done += chunkSize) {
    const limit = Math.min(chunkSize, total - done);
    for (let index = 0; index < limit; index++) {
      const tournament = simulateRegionalTournament(setup, sample === null);
      addRegionalForecastResult(stats, tournament);
      addRegionalAwardResult(awardStats, tournament);
      if (sample === null) sample = tournament.sample;
    }
    completed = Math.min(total, done + limit);
    els.regionalForecastStatus.textContent = `${completed.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 回を実行中...`;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const stopped = regionalForecastStopRequested && completed < total;
  regionalForecastRunning = false;
  regionalForecastStopRequested = false;
  els.runRegionalForecastButton.disabled = false;
  els.runRegionalForecastButton.textContent = "優勝予測を実行";
  if (runId !== regionalForecastRunId) return;
  if (!completed) {
    els.regionalForecastStatus.textContent = "結果を表示するには1回以上実行してください。";
    return;
  }
  renderRegionalForecastResult(stats, awardStats, completed, sample || [], setup);
  if (!stopped && completed === FIXED_SIMULATION_COUNT) {
    saveRegionalForecastCache(setup, stats, awardStats, completed, sample || []);
  }
  els.regionalForecastStatus.textContent = stopped
    ? `${completed.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 回で停止しました。途中結果を表示しています。`
    : "完了しました。";
  showToast(stopped ? "途中結果を表示しました" : "優勝予測が完了しました");
}

function handleRegionalForecastButton() {
  if (regionalForecastRunning) {
    regionalForecastStopRequested = true;
    els.runRegionalForecastButton.textContent = "停止中...";
    els.runRegionalForecastButton.disabled = true;
    els.regionalForecastStatus.textContent = "停止しています。ここまでの結果を集計します...";
    return;
  }
  runRegionalForecast();
}

function createRegionalForecastStats(teams) {
  const stats = new Map();
  teams.forEach((team) => {
    stats.set(team.team, {
      league: team.league || "",
      team,
      first: 0,
      second: 0,
      semifinal: 0,
      finalist: 0,
      runnerUp: 0,
      champion: 0
    });
  });
  return stats;
}

function createRegionalAwardStats(teams) {
  const players = new Map();
  teams.forEach((team) => {
    team.members.forEach((member) => {
      if (!players.has(member.name)) {
        players.set(member.name, {
          name: member.name,
          team: team.team,
          firstTimer: isRegionalFirstTimer(member.name),
          awards: Object.fromEntries(REGIONAL_AWARDS.map((award) => [award.key, 0])),
          wins: 0,
          losses: 0,
          appearances: 0,
          prelimWins: 0,
          prelimLosses: 0,
          prelimAppearances: 0,
          decidingWins: 0
        });
      }
    });
  });
  return players;
}

function createRegionalFixedAwardStats(setup, awardStats) {
  const stats = new Map([...awardStats.keys()].map((name) => [name, {
    wins: 0,
    losses: 0,
    appearances: 0,
    prelimWins: 0,
    prelimLosses: 0,
    prelimAppearances: 0,
    decidingWins: 0
  }]));
  setup.confirmedCache.forEach((confirmed, key) => {
    const fixedGames = confirmed.games.filter((game) => !game.pending);
    if (!fixedGames.length) return;
    const label = key.split("__")[0] || "";
    const isPrelim = label.startsWith("Aリーグ") || label.startsWith("Bリーグ");
    const teams = regionalConfirmedTeamsFromKey(setup, key);
    const alive = teams
      ? {
        A: new Set(teams.teamA.members.map((member) => member.statKey)),
        B: new Set(teams.teamB.members.map((member) => member.statKey))
      }
      : null;
    let decidingWinner = null;
    fixedGames.forEach((game) => {
      const aWon = game.winner.side === "A";
      addRegionalFixedAwardGame(stats, game.a.name, aWon, isPrelim);
      addRegionalFixedAwardGame(stats, game.b.name, !aWon, isPrelim);
      if (!alive || decidingWinner) return;
      if (aWon) alive.B.delete(game.b.statKey);
      else alive.A.delete(game.a.statKey);
      if (!alive.A.size || !alive.B.size) decidingWinner = aWon ? game.a.name : game.b.name;
    });
    if (decidingWinner) {
      const row = stats.get(decidingWinner);
      if (row) row.decidingWins++;
    }
  });
  return stats;
}

function regionalConfirmedTeamsFromKey(setup, key) {
  const parts = key.split("__");
  const teamA = setup.teams.get(parts[1] || "");
  const teamB = setup.teams.get(parts[3] || "");
  if (!teamA || !teamB) return null;
  return {
    teamA: prepareSimulationTeam(teamA, "A"),
    teamB: prepareSimulationTeam(teamB, "B")
  };
}

function addRegionalFixedAwardGame(stats, name, won, isPrelim = false) {
  const row = stats.get(name);
  if (!row) return;
  row.appearances++;
  if (won) row.wins++;
  else row.losses++;
  if (!isPrelim) return;
  row.prelimAppearances++;
  if (won) row.prelimWins++;
  else row.prelimLosses++;
}

function simulateRegionalTournament(setup, keepLog = false) {
  const sample = { aLeague: [], bLeague: [], finals: [] };
  const playerStats = createRegionalTournamentPlayerStats(setup.orderedTeams);
  const play = (label, teamA, teamB, phase) => {
    const match = simulateRegionalTeamMatch(setup, teamA, teamB, label);
    mergeRegionalTournamentPlayerStats(playerStats, match.playerStats, phase);
    if (keepLog) addRegionalSampleMatch(sample, label, match, phase);
    return match;
  };
  const aLeague = simulateRegionalLeague("A", REGIONAL_2026_BRACKET.A, setup.teams, play);
  const bLeague = simulateRegionalLeague("B", REGIONAL_2026_BRACKET.B, setup.teams, play);
  const semifinal1 = play("準決勝1 (A1 vs B2)", aLeague.first, bLeague.second, "final");
  const semifinal2 = play("準決勝2 (B1 vs A2)", bLeague.first, aLeague.second, "final");
  const final = play("決勝", semifinal1.winner, semifinal2.winner, "final");
  const teamProgress = createRegionalTeamProgress(aLeague, bLeague, semifinal1, semifinal2, final);
  applyRegionalTeamProgress(playerStats, teamProgress);
  return {
    aLeague,
    bLeague,
    semifinalists: [aLeague.first, aLeague.second, bLeague.first, bLeague.second],
    finalists: [semifinal1.winner, semifinal2.winner],
    runnerUp: final.loser,
    champion: final.winner,
    playerStats,
    sample
  };
}

function simulateRegionalLeague(league, matches, teams, play) {
  const firstMatch = play(`${league}リーグ 初戦1`, teams.get(matches[0][0]), teams.get(matches[0][1]), "prelim");
  const secondMatch = play(`${league}リーグ 初戦2`, teams.get(matches[1][0]), teams.get(matches[1][1]), "prelim");
  const firstPlaceMatch = play(`${league}リーグ 1位決定戦`, firstMatch.winner, secondMatch.winner, "prelim");
  const revivalMatch = play(`${league}リーグ 敗者復活戦`, firstMatch.loser, secondMatch.loser, "prelim");
  const secondPlaceMatch = play(`${league}リーグ 2位決定戦`, firstPlaceMatch.loser, revivalMatch.winner, "prelim");
  return {
    league,
    first: firstPlaceMatch.winner,
    second: secondPlaceMatch.winner,
    eliminated: [revivalMatch.loser, secondPlaceMatch.loser]
  };
}

function addRegionalSampleMatch(sample, label, match, phase) {
  const item = {
    label,
    teamA: regionalDisplayName(match.teamA),
    teamB: regionalDisplayName(match.teamB),
    score: `${match.scoreA}-${match.scoreB}`,
    winner: regionalDisplayName(match.winner),
    fixedGames: match.fixedGames,
    pendingGames: match.pendingGames
  };
  if (phase === "final") {
    sample.finals.push(item);
  } else if (label.startsWith("Aリーグ")) {
    sample.aLeague.push(item);
  } else if (label.startsWith("Bリーグ")) {
    sample.bLeague.push(item);
  }
}

function simulateRegionalTeamMatch(setup, teamA, teamB, label) {
  const preparedA = prepareSimulationTeam(teamA, "A");
  const preparedB = prepareSimulationTeam(teamB, "B");
  const confirmed = getRegionalConfirmedGames(setup, label, preparedA, preparedB);
  const result = simulateTeamMatch(preparedA.members, preparedB.members, confirmed.games);
  const aWon = result.winner === "A";
  const winner = aWon ? teamA : teamB;
  const loser = aWon ? teamB : teamA;
  const fixedGames = confirmed.games.filter((game) => !game.pending).length;
  const pendingGames = confirmed.games.filter((game) => game.pending).length;
  return { label, teamA, teamB, winner, loser, scoreA: result.scoreA, scoreB: result.scoreB, fixedGames, pendingGames, playerStats: result.playerStats };
}

function getRegionalConfirmedGames(setup, label, teamA, teamB) {
  const key = `${label}__${teamA.team}__vs__${teamB.team}`;
  if (!setup.confirmedCache.has(key)) {
    const stagePrefix = REGIONAL_STAGE_PREFIXES[label] || "";
    setup.confirmedCache.set(key, stagePrefix
      ? getConfirmedSimulationGames(REGIONAL_2026_TOURNAMENT, (stage) => isStageInPrefix(stage, stagePrefix), teamA, teamB)
      : { games: [], warnings: [] });
  }
  return setup.confirmedCache.get(key);
}

function isStageInPrefix(stage, prefix) {
  const normalizedStage = normalizeName(stage);
  const normalizedPrefix = normalizeName(prefix);
  return normalizedStage === normalizedPrefix || normalizedStage.startsWith(`${normalizedPrefix} `);
}

function addRegionalForecastResult(stats, tournament) {
  [
    [tournament.aLeague.first, "first"],
    [tournament.bLeague.first, "first"],
    [tournament.aLeague.second, "second"],
    [tournament.bLeague.second, "second"]
  ].forEach(([team, key]) => {
    stats.get(team.team)[key]++;
  });
  tournament.semifinalists.forEach((team) => stats.get(team.team).semifinal++);
  tournament.finalists.forEach((team) => stats.get(team.team).finalist++);
  stats.get(tournament.runnerUp.team).runnerUp++;
  stats.get(tournament.champion.team).champion++;
}

function createRegionalTournamentPlayerStats(teams) {
  const players = new Map();
  teams.forEach((team) => {
    team.members.forEach((member) => {
      if (!players.has(member.name)) {
        players.set(member.name, {
          name: member.name,
          team: team.team,
          wins: 0,
          losses: 0,
          appearances: 0,
          prelimWins: 0,
          prelimLosses: 0,
          prelimAppearances: 0,
          decidingWins: 0,
          progress: 0
        });
      }
    });
  });
  return players;
}

function mergeRegionalTournamentPlayerStats(total, incoming, phase) {
  incoming.forEach((row) => {
    const target = total.get(row.name);
    if (!target) return;
    target.wins += row.wins;
    target.losses += row.losses;
    target.appearances += row.appearances;
    target.decidingWins += row.decidingWins || 0;
    if (phase === "prelim") {
      target.prelimWins += row.wins;
      target.prelimLosses += row.losses;
      target.prelimAppearances += row.appearances;
    }
  });
}

function createRegionalTeamProgress(aLeague, bLeague, semifinal1, semifinal2, final) {
  const progress = new Map();
  [...aLeague.eliminated, ...bLeague.eliminated].forEach((team) => progress.set(team.team, 1));
  [aLeague.first, aLeague.second, bLeague.first, bLeague.second].forEach((team) => progress.set(team.team, 2));
  [semifinal1.loser, semifinal2.loser].forEach((team) => progress.set(team.team, 3));
  progress.set(final.loser.team, 4);
  progress.set(final.winner.team, 5);
  return progress;
}

function applyRegionalTeamProgress(playerStats, teamProgress) {
  playerStats.forEach((row) => {
    row.progress = teamProgress.get(row.team) || 0;
  });
}

function addRegionalAwardResult(awardStats, tournament) {
  mergeRegionalAwardTotals(awardStats, tournament.playerStats);
  const awards = chooseRegionalAwardWinners(tournament.playerStats);
  awards.forEach((winners, key) => {
    winners.forEach((winner) => {
      const row = awardStats.get(winner.name);
      if (!row) return;
      row.awards[key]++;
    });
  });
}

function mergeRegionalAwardTotals(awardStats, playerStats) {
  playerStats.forEach((source) => {
    const target = awardStats.get(source.name);
    if (!target) return;
    target.wins += source.wins;
    target.losses += source.losses;
    target.appearances += source.appearances;
    target.prelimWins += source.prelimWins;
    target.prelimLosses += source.prelimLosses;
    target.prelimAppearances += source.prelimAppearances;
    target.decidingWins += source.decidingWins;
  });
}

function chooseRegionalAwardWinners(playerStats) {
  const players = [...playerStats.values()];
  return new Map([
    ["mostWins", chooseRegionalAwardWinnersForKey(players, "mostWins")],
    ["bestWinRate", chooseRegionalAwardWinnersForKey(players, "bestWinRate")],
    ["mostGames", chooseRegionalAwardWinnersForKey(players, "mostGames")],
    ["bestPrelim", chooseRegionalAwardWinnersForKey(players, "bestPrelim")],
    ["fightingSpirit", chooseRegionalAwardWinnersForKey(players.filter((row) => isRegionalFirstTimer(row.name)), "fightingSpirit")]
  ].filter(([, winners]) => winners.length));
}

function chooseRegionalAwardWinnersForKey(players, awardKey) {
  const eligible = players.filter((row) => {
    if (awardKey === "bestPrelim") return row.prelimAppearances > 0;
    return row.appearances > 0;
  });
  if (!eligible.length) return [];
  const compare = regionalAwardComparator(awardKey);
  const sorted = [...eligible].sort(compare);
  const winner = sorted[0];
  return sorted.filter((row) => compare(row, winner) === 0);
}

function regionalAwardComparator(awardKey) {
  return (left, right) => {
    const primary = regionalAwardPrimaryValue(right, awardKey) - regionalAwardPrimaryValue(left, awardKey);
    if (primary) return primary;
    const tieValues = regionalAwardTieValues(awardKey);
    for (const value of tieValues) {
      const diff = value(right) - value(left);
      if (diff) return diff;
    }
    return 0;
  };
}

function regionalAwardPrimaryValue(row, awardKey) {
  if (awardKey === "bestWinRate" || awardKey === "fightingSpirit") return row.appearances ? row.wins / row.appearances : 0;
  if (awardKey === "mostGames") return row.appearances;
  if (awardKey === "bestPrelim") return row.prelimWins;
  return row.wins;
}

function regionalAwardTieValues(awardKey) {
  const winRate = (row) => row.appearances ? row.wins / row.appearances : 0;
  const prelimWinRate = (row) => row.prelimAppearances ? row.prelimWins / row.prelimAppearances : 0;
  if (awardKey === "bestWinRate" || awardKey === "fightingSpirit") {
    return [(row) => row.wins, (row) => row.progress, (row) => row.decidingWins];
  }
  if (awardKey === "bestPrelim") {
    return [prelimWinRate, (row) => row.progress, (row) => row.decidingWins];
  }
  return [winRate, (row) => row.progress, (row) => row.decidingWins];
}

function isRegionalFirstTimer(name) {
  return !computed.history.some((match) => {
    if (match.playerB === "__基準__" || match.tournament === REGIONAL_2026_TOURNAMENT) return false;
    return match.playerA === name || match.playerB === name;
  });
}

function renderRegionalForecastResult(stats, awardStats, total, sample, setup) {
  regionalForecastRenderState = { stats, total };
  renderRegionalForecastRows();
  els.regionalForecastFixedSummary.innerHTML = renderRegionalFixedSummary(setup);
  regionalAwardRenderState = { awardStats, fixedStats: createRegionalFixedAwardStats(setup, awardStats), total, setup };
  renderRegionalAwardRows();
  els.regionalForecastSampleLog.innerHTML = renderRegionalSampleBracket(sample);
}

function getRegionalForecastCachedResult(setup, total) {
  if (total !== FIXED_SIMULATION_COUNT) return null;
  const cache = state.regionalForecastCache?.regional2026;
  if (!cache || cache.key !== getRegionalForecastCacheKey(setup, total)) return null;
  return cache;
}

function renderRegionalForecastCachedResult(setup, cachedResult) {
  const awardStats = deserializeRegionalAwardStats(cachedResult.awardStats);
  regionalForecastRenderState = { stats: deserializeRegionalForecastStats(cachedResult.stats), total: cachedResult.total };
  renderRegionalForecastRows();
  els.regionalForecastFixedSummary.innerHTML = cachedResult.fixedSummary || renderRegionalFixedSummary(setup);
  regionalAwardRenderState = {
    awardStats,
    fixedStats: deserializeRegionalFixedAwardStats(cachedResult.fixedAwardStats),
    total: cachedResult.total,
    setup
  };
  renderRegionalAwardRows();
  els.regionalForecastSampleLog.innerHTML = renderRegionalSampleBracket(cachedResult.sample || []);
}

function saveRegionalForecastCache(setup, stats, awardStats, total, sample) {
  state.regionalForecastCache = normalizeRegionalForecastCache(state.regionalForecastCache);
  state.regionalForecastCache.regional2026 = {
    key: getRegionalForecastCacheKey(setup, total),
    total,
    stats: serializeRegionalForecastStats(stats),
    awardStats: serializeRegionalAwardStats(awardStats),
    fixedAwardStats: serializeRegionalFixedAwardStats(createRegionalFixedAwardStats(setup, awardStats)),
    fixedSummary: renderRegionalFixedSummary(setup),
    sample,
    savedAt: new Date().toISOString()
  };
  saveState();
}

function getRegionalForecastCacheKey(setup, total) {
  return hashString(JSON.stringify({
    version: REGIONAL_FORECAST_CACHE_VERSION,
    total,
    settings: state.settings,
    matches: state.matches,
    rankingMeta: state.rankingMeta || [],
    teams: setup.orderedTeams.map((team) => ({
      team: team.team,
      league: team.league || "",
      members: team.members.map((member) => ({
        name: member.name,
        order: member.order,
        slot: member.slot,
        leader: !!member.leader,
        rating: member.rating
      }))
    })),
    bracket: REGIONAL_2026_BRACKET
  }));
}

function serializeRegionalForecastStats(stats) {
  return [...stats.values()].map((row) => ({
    ...row,
    team: regionalDisplayName(row.team)
  }));
}

function deserializeRegionalForecastStats(rows = []) {
  return new Map(rows.map((row) => [row.team, row]));
}

function serializeRegionalAwardStats(stats) {
  return [...stats.values()];
}

function deserializeRegionalAwardStats(rows = []) {
  return new Map(rows.map((row) => [row.name, row]));
}

function serializeRegionalFixedAwardStats(stats) {
  return [...stats.entries()].map(([name, row]) => ({ name, ...row }));
}

function deserializeRegionalFixedAwardStats(rows = []) {
  return new Map(rows.map((row) => [row.name, {
    wins: row.wins || 0,
    losses: row.losses || 0,
    appearances: row.appearances || 0,
    prelimWins: row.prelimWins || 0,
    prelimLosses: row.prelimLosses || 0,
    prelimAppearances: row.prelimAppearances || 0,
    decidingWins: row.decidingWins || 0
  }]));
}

function renderRegionalForecastRows() {
  if (!regionalForecastRenderState) {
    els.regionalForecastBody.innerHTML = emptyRow(7, "優勝予測実行後に表示します");
    return;
  }
  const { stats, total } = regionalForecastRenderState;
  const rows = [...stats.values()].map((row) => ({
    ...row,
    team: regionalDisplayName(row.team),
    advance: row.first + row.second
  }));
  const sortedRows = sortState.regionalForecast.touched
    ? sortRows(rows, sortState.regionalForecast)
    : rows.sort((left, right) => {
      const leagueCompare = String(left.league).localeCompare(String(right.league), "ja");
      if (leagueCompare) return leagueCompare;
      return right.champion - left.champion || right.semifinal - left.semifinal || left.team.localeCompare(right.team, "ja");
    });
  els.regionalForecastBody.innerHTML = sortedRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.league || "-")}</td>
      <td><strong>${escapeHtml(row.team)}</strong></td>
      <td>${formatRegionalRate(row.first, total)}</td>
      <td>${formatRegionalRate(row.second, total)}</td>
      <td><strong>${formatRegionalRate(row.advance, total)}</strong></td>
      <td>${formatRegionalRate(row.runnerUp, total)}</td>
      <td><strong>${formatRegionalRate(row.champion, total)}</strong></td>
    </tr>`).join("");
}

function renderRegionalSampleBracket(sample) {
  if (!sample) return "";
  return `
    <div class="sample-bracket-section">
      <h4>Aリーグ</h4>
      <div class="sample-bracket-grid">${renderRegionalSampleCards(sample.aLeague)}</div>
    </div>
    <div class="sample-bracket-section">
      <h4>Bリーグ</h4>
      <div class="sample-bracket-grid">${renderRegionalSampleCards(sample.bLeague)}</div>
    </div>
    <div class="sample-bracket-section">
      <h4>決勝トーナメント</h4>
      <div class="sample-bracket-grid finals-grid">${renderRegionalSampleCards(sample.finals)}</div>
    </div>
  `;
}

function renderRegionalFixedSummary(setup) {
  const fixedMatches = [...setup.confirmedCache.entries()]
    .map(([key, confirmed]) => ({
      label: key.split("__")[0],
      fixedGames: confirmed.games.filter((game) => !game.pending).length,
      pendingGames: confirmed.games.filter((game) => game.pending).length
    }))
    .filter((match) => match.fixedGames + match.pendingGames > 0)
    .sort((left, right) => left.label.localeCompare(right.label, "ja"));
  if (!fixedMatches.length) {
    return `
      <div class="regional-fixed-summary regional-fixed-summary-empty">
        <strong>確定済み対局なし</strong>
        <span>登録済みの対局は固定せず、全カードを現在レーティングから試行しています</span>
      </div>
    `;
  }
  const fixedTotal = fixedMatches.reduce((sum, match) => sum + match.fixedGames, 0);
  const pendingTotal = fixedMatches.reduce((sum, match) => sum + match.pendingGames, 0);
  return `
    <div class="regional-fixed-summary">
      <strong>固定対局を反映</strong>
      <span>${fixedMatches.length}カード / 確定${fixedTotal}局 / 未定${pendingTotal}局を優勝予測全体に固定しています</span>
      <div>
        ${fixedMatches.map((match) => `<em>${escapeHtml(match.label)}: 確定${match.fixedGames}局 / 未定${match.pendingGames}局</em>`).join("")}
      </div>
    </div>
  `;
}

function renderRegionalSampleCards(matches = []) {
  return matches.map((match) => `
    <div class="sample-match-card">
      <span>${escapeHtml(match.label)}</span>
      <strong>${escapeHtml(match.teamA)} ${escapeHtml(match.score)} ${escapeHtml(match.teamB)}</strong>
      <em>勝者 ${escapeHtml(match.winner)}</em>
    </div>
  `).join("");
}

function renderRegionalAwardRows(emptyMessage = "優勝予測実行後に表示します") {
  const columns = getRegionalAwardColumns(regionalAwardCurrentKey);
  renderRegionalAwardHead(columns);
  if (!regionalAwardRenderState) {
    els.regionalAwardBody.innerHTML = emptyRow(columns.length, emptyMessage);
    return;
  }
  const { awardStats, fixedStats, total, setup } = regionalAwardRenderState;
  const possibilityStats = setup ? createRegionalAwardPossibilityStats(setup, awardStats, fixedStats) : new Map();
  const rows = [...awardStats.values()]
    .filter((row) => regionalAwardCurrentKey !== "fightingSpirit" || row.firstTimer)
    .map((row) => {
      const fixed = fixedStats.get(row.name) || createEmptyRegionalFixedAwardRow();
      const awardCount = row.awards[regionalAwardCurrentKey] || 0;
      const awardPossible = awardCount > 0 || canRegionalAwardStillOccur(row, regionalAwardCurrentKey, possibilityStats);
      const averageWins = row.wins / Math.max(1, total);
      const averageLosses = row.losses / Math.max(1, total);
      const averageAppearances = row.appearances / Math.max(1, total);
      const averagePrelimWins = row.prelimWins / Math.max(1, total);
      const averagePrelimAppearances = row.prelimAppearances / Math.max(1, total);
      return {
        ...row,
        fixed,
        awardCount,
        awardRate: total ? awardCount / total : 0,
        awardPossible,
        awardRateRankKey: regionalAwardRateRankKey(awardCount, total, awardPossible),
        averageWins,
        averageRecord: averageWins - averageLosses,
        averageWinRate: averageAppearances ? averageWins / averageAppearances : -1,
        averageAppearances,
        fixedWins: fixed.wins,
        fixedRecord: fixed.wins - fixed.losses,
        fixedWinRate: fixed.appearances ? fixed.wins / fixed.appearances : -1,
        fixedAppearances: fixed.appearances,
        averagePrelimWins,
        averagePrelimAppearances,
        fixedPrelimWins: fixed.prelimWins,
        fixedPrelimAppearances: fixed.prelimAppearances
      };
    });
  const rankedRows = rows
    .slice()
    .sort((left, right) => right.awardRateRankKey - left.awardRateRankKey);
  let currentRank = 0;
  let previousAwardRateRankKey = null;
  rankedRows.forEach((row, index) => {
    if (previousAwardRateRankKey === null || row.awardRateRankKey !== previousAwardRateRankKey) {
      currentRank = index + 1;
      previousAwardRateRankKey = row.awardRateRankKey;
    }
    row.awardRank = currentRank;
  });
  resetRegionalAwardSortIfNeeded(columns);
  const sortedRows = sortState.regionalAwards.touched
    ? sortRows(rankedRows, sortState.regionalAwards)
    : rankedRows;
  els.regionalAwardBody.innerHTML = sortedRows.map((row) => {
    const rank = row.awardRank;
    const cells = columns.map((column) => column.render(row, row.fixed, total, row.awardCount, rank));
    return `<tr class="${rank <= 3 ? `award-rank-row award-rank-${rank}` : ""}">
      ${cells.map((cell) => `<td>${cell}</td>`).join("")}
    </tr>`;
  }).join("") || emptyRow(columns.length, "該当者なし");
}

function getRegionalAwardColumns(awardKey) {
  const base = [
    { label: "#", render: (row, fixed, total, awardCount, rank) => `<span class="award-rank">${rank}</span>` },
    { label: "候補", sortKey: "name", render: (row) => `<strong>${escapeHtml(row.name)}</strong><span class="muted-cell">${escapeHtml(regionalDisplayName(row.team))}${row.firstTimer ? " / 初出場" : ""}</span>` },
    { label: "受賞率", sortKey: "awardRate", render: (row, fixed, total, awardCount) => `<strong>${formatRegionalAwardRate(awardCount, total, row.awardPossible)}</strong>` }
  ];
  if (awardKey === "mostWins") {
    return [
      ...base,
      { label: "平均勝数", sortKey: "averageWins", render: (row, fixed, total) => formatRegionalAverage(row.wins, total) },
      { label: "確定勝数", sortKey: "fixedWins", render: (row, fixed) => fixed.wins }
    ];
  }
  if (awardKey === "bestWinRate" || awardKey === "fightingSpirit") {
    return [
      ...base,
      { label: "平均勝敗", sortKey: "averageRecord", render: (row, fixed, total) => `${formatRegionalAverage(row.wins, total)}-${formatRegionalAverage(row.losses, total)}` },
      { label: "平均勝率", sortKey: "averageWinRate", render: (row, fixed, total) => formatRegionalRatio(row.wins, row.appearances, total) },
      { label: "確定勝敗", sortKey: "fixedRecord", render: (row, fixed) => `${fixed.wins}-${fixed.losses}` },
      { label: "確定勝率", sortKey: "fixedWinRate", render: (row, fixed) => formatRegionalFixedRatio(fixed.wins, fixed.appearances) }
    ];
  }
  if (awardKey === "mostGames") {
    return [
      ...base,
      { label: "平均対局数", sortKey: "averageAppearances", render: (row, fixed, total) => formatRegionalAverage(row.appearances, total) },
      { label: "確定対局数", sortKey: "fixedAppearances", render: (row, fixed) => fixed.appearances }
    ];
  }
  if (awardKey === "bestPrelim") {
    return [
      ...base,
      { label: "平均予選勝数", sortKey: "averagePrelimWins", render: (row, fixed, total) => formatRegionalAverage(row.prelimWins, total) },
      { label: "平均予選対局数", sortKey: "averagePrelimAppearances", render: (row, fixed, total) => formatRegionalAverage(row.prelimAppearances, total) },
      { label: "確定予選勝数", sortKey: "fixedPrelimWins", render: (row, fixed) => fixed.prelimWins },
      { label: "確定予選対局数", sortKey: "fixedPrelimAppearances", render: (row, fixed) => fixed.prelimAppearances }
    ];
  }
  return base;
}

function renderRegionalAwardHead(columns) {
  els.regionalAwardHead.innerHTML = `<tr>${columns.map((column) => column.sortKey
    ? `<th data-sort="${escapeAttr(column.sortKey)}">${escapeHtml(column.label)}</th>`
    : `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>`;
  els.regionalAwardHead.querySelectorAll("th[data-sort]").forEach(registerSortableHeader);
}

function resetRegionalAwardSortIfNeeded(columns) {
  if (columns.some((column) => column.sortKey === sortState.regionalAwards.key)) return;
  sortState.regionalAwards.key = "awardRate";
  sortState.regionalAwards.direction = "desc";
  sortState.regionalAwards.touched = false;
}

function createRegionalAwardPossibilityStats(setup, awardStats, fixedStats) {
  const teamBounds = createRegionalTeamPossibilityBounds(setup);
  return new Map([...awardStats.values()].map((row) => {
    const fixed = fixedStats.get(row.name) || createEmptyRegionalFixedAwardRow();
    const team = setup.teams.get(row.team);
    const teamBound = teamBounds.get(row.team) || { remainingTeamMatches: 0, remainingPrelimMatches: 0, progress: 0 };
    const maxAppearances = fixed.appearances + teamBound.remainingTeamMatches * 5;
    const maxPrelimAppearances = fixed.prelimAppearances + teamBound.remainingPrelimMatches * 5;
    const maxWins = fixed.wins + teamBound.remainingTeamMatches * 5;
    const maxPrelimWins = fixed.prelimWins + teamBound.remainingPrelimMatches * 5;
    return [row.name, {
      name: row.name,
      team: row.team,
      firstTimer: row.firstTimer,
      fixed,
      maxAppearances,
      maxWins,
      maxPrelimAppearances,
      maxPrelimWins,
      maxDecidingWins: fixed.decidingWins + teamBound.remainingTeamMatches,
      maxProgress: teamBound.progress,
      inTeam: Boolean(team)
    }];
  }));
}

function createRegionalTeamPossibilityBounds(setup) {
  const bounds = new Map([...setup.teams.keys()].map((team) => [team, {
    teamMatches: 0,
    prelimMatches: 0,
    remainingTeamMatches: 0,
    remainingPrelimMatches: 0,
    progress: 0
  }]));
  enumerateRegionalTournamentPossibilities(setup).forEach((outcome) => {
    outcome.teamMatches.forEach((count, team) => {
      const bound = bounds.get(team);
      if (bound) bound.teamMatches = Math.max(bound.teamMatches, count);
    });
    outcome.prelimMatches.forEach((count, team) => {
      const bound = bounds.get(team);
      if (bound) bound.prelimMatches = Math.max(bound.prelimMatches, count);
    });
    outcome.remainingTeamMatches.forEach((count, team) => {
      const bound = bounds.get(team);
      if (bound) bound.remainingTeamMatches = Math.max(bound.remainingTeamMatches, count);
    });
    outcome.remainingPrelimMatches.forEach((count, team) => {
      const bound = bounds.get(team);
      if (bound) bound.remainingPrelimMatches = Math.max(bound.remainingPrelimMatches, count);
    });
    outcome.progress.forEach((progress, team) => {
      const bound = bounds.get(team);
      if (bound) bound.progress = Math.max(bound.progress, progress);
    });
  });
  return bounds;
}

function enumerateRegionalTournamentPossibilities(setup) {
  const aLeagues = enumerateRegionalLeaguePossibilities("A", REGIONAL_2026_BRACKET.A, setup);
  const bLeagues = enumerateRegionalLeaguePossibilities("B", REGIONAL_2026_BRACKET.B, setup);
  const outcomes = [];
  aLeagues.forEach((aLeague) => {
    bLeagues.forEach((bLeague) => {
      enumerateRegionalMatchPossibilities(setup, "準決勝1 (A1 vs B2)", aLeague.first, bLeague.second, false).forEach((semifinal1) => {
        enumerateRegionalMatchPossibilities(setup, "準決勝2 (B1 vs A2)", bLeague.first, aLeague.second, false).forEach((semifinal2) => {
          enumerateRegionalMatchPossibilities(setup, "決勝", semifinal1.winner, semifinal2.winner, false).forEach((final) => {
            const teamMatches = mergeCountMaps(aLeague.teamMatches, bLeague.teamMatches, semifinal1.teamMatches, semifinal2.teamMatches, final.teamMatches);
            const prelimMatches = mergeCountMaps(aLeague.prelimMatches, bLeague.prelimMatches);
            const progress = new Map();
            [...aLeague.eliminated, ...bLeague.eliminated].forEach((team) => progress.set(team.team, Math.max(progress.get(team.team) || 0, 1)));
            [aLeague.first, aLeague.second, bLeague.first, bLeague.second].forEach((team) => progress.set(team.team, Math.max(progress.get(team.team) || 0, 2)));
            [semifinal1.loser, semifinal2.loser].forEach((team) => progress.set(team.team, Math.max(progress.get(team.team) || 0, 3)));
            progress.set(final.loser.team, Math.max(progress.get(final.loser.team) || 0, 4));
            progress.set(final.winner.team, Math.max(progress.get(final.winner.team) || 0, 5));
            const remainingTeamMatches = mergeCountMaps(aLeague.remainingTeamMatches, bLeague.remainingTeamMatches, semifinal1.remainingTeamMatches, semifinal2.remainingTeamMatches, final.remainingTeamMatches);
            const remainingPrelimMatches = mergeCountMaps(aLeague.remainingPrelimMatches, bLeague.remainingPrelimMatches);
            outcomes.push({ teamMatches, prelimMatches, remainingTeamMatches, remainingPrelimMatches, progress });
          });
        });
      });
    });
  });
  return outcomes;
}

function enumerateRegionalLeaguePossibilities(league, matches, setup) {
  const team = (name) => setup.teams.get(name);
  const outcomes = [];
  enumerateRegionalMatchPossibilities(setup, `${league}リーグ 初戦1`, team(matches[0][0]), team(matches[0][1]), true).forEach((firstMatch) => {
    enumerateRegionalMatchPossibilities(setup, `${league}リーグ 初戦2`, team(matches[1][0]), team(matches[1][1]), true).forEach((secondMatch) => {
      enumerateRegionalMatchPossibilities(setup, `${league}リーグ 1位決定戦`, firstMatch.winner, secondMatch.winner, true).forEach((firstPlaceMatch) => {
        enumerateRegionalMatchPossibilities(setup, `${league}リーグ 敗者復活戦`, firstMatch.loser, secondMatch.loser, true).forEach((revivalMatch) => {
          enumerateRegionalMatchPossibilities(setup, `${league}リーグ 2位決定戦`, firstPlaceMatch.loser, revivalMatch.winner, true).forEach((secondPlaceMatch) => {
            outcomes.push({
              first: firstPlaceMatch.winner,
              second: secondPlaceMatch.winner,
              eliminated: [revivalMatch.loser, secondPlaceMatch.loser],
              teamMatches: mergeCountMaps(firstMatch.teamMatches, secondMatch.teamMatches, firstPlaceMatch.teamMatches, revivalMatch.teamMatches, secondPlaceMatch.teamMatches),
              prelimMatches: mergeCountMaps(firstMatch.prelimMatches, secondMatch.prelimMatches, firstPlaceMatch.prelimMatches, revivalMatch.prelimMatches, secondPlaceMatch.prelimMatches),
              remainingTeamMatches: mergeCountMaps(firstMatch.remainingTeamMatches, secondMatch.remainingTeamMatches, firstPlaceMatch.remainingTeamMatches, revivalMatch.remainingTeamMatches, secondPlaceMatch.remainingTeamMatches),
              remainingPrelimMatches: mergeCountMaps(firstMatch.remainingPrelimMatches, secondMatch.remainingPrelimMatches, firstPlaceMatch.remainingPrelimMatches, revivalMatch.remainingPrelimMatches, secondPlaceMatch.remainingPrelimMatches)
            });
          });
        });
      });
    });
  });
  return outcomes;
}

function enumerateRegionalMatchPossibilities(setup, label, teamA, teamB, isPrelim) {
  if (!teamA || !teamB) return [];
  const possibleSides = regionalPossibleMatchWinnerSides(setup, label, teamA, teamB);
  return possibleSides.map((side) => {
    const winner = side === "A" ? teamA : teamB;
    const loser = side === "A" ? teamB : teamA;
    const teamMatches = incrementCountMap(new Map(), teamA.team, teamB.team);
    const prelimMatches = isPrelim ? incrementCountMap(new Map(), teamA.team, teamB.team) : new Map();
    const remaining = possibleSides.length > 1;
    const remainingTeamMatches = remaining ? incrementCountMap(new Map(), teamA.team, teamB.team) : new Map();
    const remainingPrelimMatches = remaining && isPrelim ? incrementCountMap(new Map(), teamA.team, teamB.team) : new Map();
    return { winner, loser, teamMatches, prelimMatches, remainingTeamMatches, remainingPrelimMatches };
  });
}

function regionalPossibleMatchWinnerSides(setup, label, teamA, teamB) {
  const preparedA = prepareSimulationTeam(teamA, "A");
  const preparedB = prepareSimulationTeam(teamB, "B");
  const confirmed = getRegionalConfirmedGames(setup, label, preparedA, preparedB);
  const aliveA = new Set(preparedA.members.map((member) => member.statKey));
  const aliveB = new Set(preparedB.members.map((member) => member.statKey));
  confirmed.games.filter((game) => !game.pending).forEach((game) => {
    if (game.winner.side === "A") aliveB.delete(game.b.statKey);
    else aliveA.delete(game.a.statKey);
  });
  if (!aliveA.size) return ["B"];
  if (!aliveB.size) return ["A"];
  return ["A", "B"];
}

function incrementCountMap(map, ...keys) {
  keys.forEach((key) => map.set(key, (map.get(key) || 0) + 1));
  return map;
}

function mergeCountMaps(...maps) {
  const merged = new Map();
  maps.forEach((map) => {
    map.forEach((count, key) => merged.set(key, (merged.get(key) || 0) + count));
  });
  return merged;
}

function canRegionalAwardStillOccur(row, awardKey, possibilityStats) {
  const candidate = possibilityStats.get(row.name);
  if (!candidate || !candidate.inTeam) return false;
  if (awardKey === "fightingSpirit" && !candidate.firstTimer) return false;
  const candidateTuple = regionalAwardMaxTuple(candidate, awardKey);
  if (!candidateTuple) return false;
  return [...possibilityStats.values()]
    .filter((other) => other.name !== candidate.name)
    .filter((other) => awardKey !== "fightingSpirit" || other.firstTimer)
    .every((other) => compareRegionalAwardTuple(regionalAwardMinTuple(other.fixed, awardKey), candidateTuple) <= 0);
}

function regionalAwardMaxTuple(row, awardKey) {
  const maxWinRate = row.maxAppearances ? row.maxWins / Math.max(1, row.maxWins + row.fixed.losses) : 0;
  const maxPrelimWinRate = row.maxPrelimAppearances ? row.maxPrelimWins / Math.max(1, row.maxPrelimWins + row.fixed.prelimLosses) : 0;
  if (awardKey === "bestPrelim") {
    if (!row.maxPrelimAppearances) return null;
    return [row.maxPrelimWins, maxPrelimWinRate, row.maxProgress, row.maxDecidingWins];
  }
  if (!row.maxAppearances) return null;
  if (awardKey === "bestWinRate" || awardKey === "fightingSpirit") return [maxWinRate, row.maxWins, row.maxProgress, row.maxDecidingWins];
  if (awardKey === "mostGames") return [row.maxAppearances, maxWinRate, row.maxProgress, row.maxDecidingWins];
  return [row.maxWins, maxWinRate, row.maxProgress, row.maxDecidingWins];
}

function regionalAwardMinTuple(fixed, awardKey) {
  const winRate = fixed.appearances ? fixed.wins / fixed.appearances : 0;
  const prelimWinRate = fixed.prelimAppearances ? fixed.prelimWins / fixed.prelimAppearances : 0;
  if (awardKey === "bestPrelim") return [fixed.prelimWins, prelimWinRate, 0, fixed.decidingWins];
  if (awardKey === "bestWinRate" || awardKey === "fightingSpirit") return [winRate, fixed.wins, 0, fixed.decidingWins];
  if (awardKey === "mostGames") return [fixed.appearances, winRate, 0, fixed.decidingWins];
  return [fixed.wins, winRate, 0, fixed.decidingWins];
}

function compareRegionalAwardTuple(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const diff = Number(left[index] || 0) - Number(right[index] || 0);
    if (Math.abs(diff) > 1e-12) return diff;
  }
  return 0;
}

function createEmptyRegionalFixedAwardRow() {
  return {
    wins: 0,
    losses: 0,
    appearances: 0,
    prelimWins: 0,
    prelimLosses: 0,
    prelimAppearances: 0,
    decidingWins: 0
  };
}

function formatRegionalRate(count, total) {
  return total ? formatPercent(count / total, 2) : "0%";
}

function formatRegionalAwardRate(count, total, possible = false) {
  if (!count) return possible ? "<0.01%" : "0%";
  if (total && count / total < 0.0001) return "<0.01%";
  return formatRegionalRate(count, total);
}

function regionalAwardRateRankKey(count, total, possible = false) {
  if (!count) return possible ? 0.000001 : 0;
  const rate = total ? count / total : 0;
  return rate < 0.0001 ? 0.000001 : Number(rate.toFixed(4));
}

function formatRegionalAverage(value, count) {
  return (value / Math.max(1, count)).toFixed(1);
}

function formatRegionalRatio(wins, appearances, total) {
  const averageWins = wins / Math.max(1, total);
  const averageAppearances = appearances / Math.max(1, total);
  return formatRegionalFixedRatio(averageWins, averageAppearances);
}

function formatRegionalFixedRatio(wins, appearances) {
  if (!appearances) return "-";
  return formatPercent(wins / appearances, 1);
}

function regionalDisplayName(teamOrName) {
  const name = typeof teamOrName === "string" ? teamOrName : teamOrName?.team;
  return name || "";
}

async function runTeamSimulation() {
  if (simulationRunning) return;
  const setup = getSimulationSetup();
  renderSimulationPreview();
  const allWarnings = [...setup.warnings, ...setup.confirmed.warnings];
  if (!setup.teamA || !setup.teamB || allWarnings.length) {
    showToast("シミュレーション条件を確認してください");
    return;
  }

  const total = FIXED_SIMULATION_COUNT;
  const chunkSize = 2500;
  const runId = ++simulationRunId;
  let completed = 0;
  const result = { aWins: 0, bWins: 0, games: 0, sample: null, players: createSimulationPlayerStats(setup.teamA.members, setup.teamB.members), scores: createSimulationScoreDistribution() };
  simulationRunning = true;
  simulationStopRequested = false;
  els.runSimulationButton.disabled = true;
  els.runSimulationButton.textContent = "実行中...";
  els.simulationResult.innerHTML = "";
  els.simulationSampleLog.innerHTML = "";
  els.simulationPlayerStatsABody.innerHTML = emptyRow(9, "計算中です");
  els.simulationPlayerStatsBBody.innerHTML = emptyRow(9, "計算中です");

  for (let done = 0; done < total && runId === simulationRunId && !simulationStopRequested; done += chunkSize) {
    const limit = Math.min(chunkSize, total - done);
    for (let index = 0; index < limit; index++) {
      const match = simulateTeamMatch(setup.teamA.members, setup.teamB.members, setup.confirmed.games, result.sample === null);
      if (match.winner === "A") result.aWins++;
      else result.bWins++;
      result.games += match.games;
      addSimulationScoreResult(result.scores, match.scoreA, match.scoreB);
      mergeSimulationPlayerStats(result.players, match.playerStats);
      if (result.sample === null) result.sample = match.log;
    }
    completed = Math.min(total, done + limit);
    els.simulationStatus.textContent = `${completed.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 回を実行中...`;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const stopped = simulationStopRequested && completed < total;
  simulationRunning = false;
  simulationStopRequested = false;
  els.runSimulationButton.disabled = false;
  els.runSimulationButton.textContent = "実行";
  if (runId !== simulationRunId) return;
  if (!completed) {
    els.simulationStatus.textContent = "結果を表示するには1回以上実行してください。";
    return;
  }
  const averageGames = result.games / completed;
  const aRate = result.aWins / completed;
  const bRate = result.bWins / completed;
  els.simulationResult.innerHTML = [
    detailCard(`${setup.teamA.team} 勝率`, formatPercent(aRate, 2)),
    detailCard(`${setup.teamB.team} 勝率`, formatPercent(bRate, 2)),
    detailCard("平均対局数", averageGames.toFixed(2))
  ].join("");
  simulationResultRenderState = { setup, result, total: completed };
  renderSimulationPlayerStatsTables();
  els.simulationScoreBody.innerHTML = renderSimulationScoreRows(result.scores, completed);
  els.simulationSampleLog.innerHTML = result.sample.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  els.simulationStatus.textContent = stopped
    ? `${completed.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 回で停止しました。途中結果を表示しています。`
    : "完了しました。";
  showToast(stopped ? "途中結果を表示しました" : "シミュレーションが完了しました");
}

function simulateTeamMatch(teamA, teamB, fixedGames = [], keepLog = false) {
  const log = [];
  const playerStats = createSimulationPlayerStats(teamA, teamB);
  const aliveA = new Set(teamA.map((member) => member.statKey));
  const aliveB = new Set(teamB.map((member) => member.statKey));
  const usedStage1A = new Set();
  const usedStage1B = new Set();
  let games = 0;
  let scoreA = 0;
  let scoreB = 0;
  let stage1Count = 0;
  let stage2Started = false;
  let stage2ActiveSide = "";
  let stage2Active = null;
  let decidingWinnerKey = "";

  fixedGames.forEach((fixed) => {
    games++;
    const aWon = fixed.pending ? Math.random() < expectedScore(fixed.a.rating, fixed.b.rating) : fixed.winner.side === "A";
    const winnerMember = aWon ? fixed.a : fixed.b;
    decidingWinnerKey = winnerMember.statKey;
    if (aWon) scoreA++;
    else scoreB++;
    recordSimulationGame(playerStats, fixed.a, fixed.b, aWon ? "A" : "B", fixed.stageLabel);
    if (aWon) aliveB.delete(fixed.b.statKey);
    else aliveA.delete(fixed.a.statKey);
    if (fixed.stage === 1) {
      stage1Count++;
      usedStage1A.add(fixed.a.statKey);
      usedStage1B.add(fixed.b.statKey);
    } else {
      stage2Started = true;
      stage2ActiveSide = aWon ? "A" : "B";
      stage2Active = aWon ? fixed.a : fixed.b;
    }
    if (keepLog) {
      const label = fixed.pending ? "未定" : "確定";
      log.push(`${label} 第${games}局 ${simulationMemberLabel(fixed.a)} vs ${simulationMemberLabel(fixed.b)}: ${simulationMemberLabel(winnerMember)}勝ち（${fixed.stageLabel}）`);
    }
  });

  if (!aliveA.size || !aliveB.size) {
    const winner = aliveA.size ? "A" : "B";
    addSimulationDecidingWin(playerStats, decidingWinnerKey);
    if (keepLog) log.push(`確定済み対局で${winner === "A" ? "チームA" : "チームB"}勝利`);
    return { winner, games, log, playerStats, scoreA, scoreB };
  }

  if (!stage2Started && stage1Count < 5) {
    const aStage1 = shuffle(teamA.filter((member) => !usedStage1A.has(member.statKey)));
    const bStage1 = shuffle(teamB.filter((member) => !usedStage1B.has(member.statKey)));
    if (keepLog) {
      log.push(`ステージ1残り: ${aStage1.map(simulationMemberLabel).join("、")} vs ${bStage1.map(simulationMemberLabel).join("、")}`);
    }
    for (let index = 0; index < Math.min(aStage1.length, bStage1.length, 5 - stage1Count); index++) {
      const a = aStage1[index];
      const b = bStage1[index];
      const aWon = Math.random() < expectedScore(a.rating, b.rating);
      const winnerMember = aWon ? a : b;
      decidingWinnerKey = winnerMember.statKey;
      games++;
      if (aWon) scoreA++;
      else scoreB++;
      recordSimulationGame(playerStats, a, b, aWon ? "A" : "B", `ステージ1 第${stage1Count + index + 1}局`);
      if (aWon) aliveB.delete(b.statKey);
      else aliveA.delete(a.statKey);
      if (keepLog) log.push(`第${games}局 ${simulationMemberLabel(a)} vs ${simulationMemberLabel(b)}: ${simulationMemberLabel(aWon ? a : b)}勝ち`);
    }
  }

  if (!aliveA.size || !aliveB.size) {
    const winner = aliveA.size ? "A" : "B";
    addSimulationDecidingWin(playerStats, decidingWinnerKey);
    if (keepLog) log.push(`ステージ1で${winner === "A" ? "チームA" : "チームB"}勝利`);
    return { winner, games, log, playerStats, scoreA, scoreB };
  }

  const aQueue = shuffle(teamA.filter((member) => aliveA.has(member.statKey) && !(stage2ActiveSide === "A" && stage2Active?.statKey === member.statKey)));
  const bQueue = shuffle(teamB.filter((member) => aliveB.has(member.statKey) && !(stage2ActiveSide === "B" && stage2Active?.statKey === member.statKey)));
  let activeA = stage2ActiveSide === "A" ? stage2Active : aQueue.shift();
  let activeB = stage2ActiveSide === "B" ? stage2Active : bQueue.shift();
  if (keepLog) {
    log.push(`ステージ2: ${[activeA, ...aQueue].filter(Boolean).map(simulationMemberLabel).join("、")} / ${[activeB, ...bQueue].filter(Boolean).map(simulationMemberLabel).join("、")}`);
  }

  while (activeA && activeB) {
    const aWon = Math.random() < expectedScore(activeA.rating, activeB.rating);
    const winnerMember = aWon ? activeA : activeB;
    decidingWinnerKey = winnerMember.statKey;
    games++;
    if (aWon) scoreA++;
    else scoreB++;
    recordSimulationGame(playerStats, activeA, activeB, aWon ? "A" : "B", "ステージ2");
    if (keepLog) log.push(`第${games}局 ${simulationMemberLabel(activeA)} vs ${simulationMemberLabel(activeB)}: ${simulationMemberLabel(aWon ? activeA : activeB)}勝ち`);
    if (aWon) {
      activeB = bQueue.shift();
      stage2ActiveSide = "A";
      stage2Active = activeA;
    } else {
      activeA = aQueue.shift();
      stage2ActiveSide = "B";
      stage2Active = activeB;
    }
  }

  const winner = activeA ? "A" : "B";
  addSimulationDecidingWin(playerStats, decidingWinnerKey);
  if (keepLog) log.push(`${winner === "A" ? "チームA" : "チームB"}勝利`);
  return { winner, games, log, playerStats, scoreA, scoreB };
}

function getConfirmedSimulationGames(tournament, stage, teamA, teamB) {
  if (teamA.team === teamB.team || teamA.source === "custom" || teamB.source === "custom") return { games: [], warnings: [] };
  const teamAPlayers = new Map(teamA.members.map((member) => [member.name, member]));
  const teamBPlayers = new Map(teamB.members.map((member) => [member.name, member]));
  const warnings = [];
  const sourceMatches = computed.history
    .filter((match) => (match.tournament || "未分類") === tournament && match.playerB !== "__基準__")
    .filter((match) => {
      if (!stage) return true;
      const matchStage = match.stage || "未分類";
      return typeof stage === "function" ? stage(matchStage) : matchStage === stage;
    })
    .filter((match) => match.winner === "A" || match.winner === "B" || match.winner === "U");
  const raw = sourceMatches
    .map((match) => {
      const relevant = isRelevantSimulationMatch(match, teamA, teamB, teamAPlayers, teamBPlayers);
      if (!relevant) return null;
      const oriented = orientSimulationMatch(match, teamAPlayers, teamBPlayers);
      if (!oriented) {
        warnings.push(`固定対象局${match.index + 1}: チーム構成外の棋士が含まれています（${match.playerA} vs ${match.playerB}）。`);
      }
      return oriented;
    })
    .filter(Boolean)
    .sort((left, right) => left.index - right.index);

  const alive = { A: new Set(teamA.members.map((member) => member.statKey)), B: new Set(teamB.members.map((member) => member.statKey)) };
  const usedStage1 = { A: new Set(), B: new Set() };
  let stage1Count = 0;
  let stage2Started = false;
  const games = raw.map((game) => {
    const issues = [];
    if (!alive.A.has(game.a.statKey)) issues.push(`敗退済みの${game.a.name}が再登場しています。`);
    if (!alive.B.has(game.b.statKey)) issues.push(`敗退済みの${game.b.name}が再登場しています。`);
    const canStage1 = !stage2Started && stage1Count < 5 && !usedStage1.A.has(game.a.statKey) && !usedStage1.B.has(game.b.statKey);
    const stageNumber = canStage1 ? 1 : 2;
    if (!canStage1 && !stage2Started && stage1Count < 5) {
      issues.push("ステージ1未消化中に同じ棋士が再登場しているため、ステージ推定に矛盾があります。");
    }
    if (stageNumber === 1) {
      stage1Count++;
      usedStage1.A.add(game.a.statKey);
      usedStage1.B.add(game.b.statKey);
    } else {
      stage2Started = true;
    }
    if (!game.pending) {
      if (game.winner.side === "A") alive.B.delete(game.b.statKey);
      else alive.A.delete(game.a.statKey);
    }
    issues.forEach((issue) => warnings.push(`固定対象局${game.order}: ${issue}`));
    return {
      ...game,
      stage: stageNumber,
      stageLabel: stageNumber === 1 ? `ステージ1 第${stage1Count}局` : "ステージ2"
    };
  });
  return { games, warnings };
}

function isRelevantSimulationMatch(match, teamA, teamB, teamAPlayers, teamBPlayers) {
  if (isSimulationMatchBetweenSelectedTeams(match, teamA, teamB, teamAPlayers, teamBPlayers)) return true;
  return false;
}

function isSimulationMatchBetweenSelectedTeams(match, teamA, teamB, teamAPlayers, teamBPlayers) {
  const selectedTeams = [teamA.team, teamB.team].map(normalizeName);
  const matchTeams = [match.teamA, match.teamB].map(normalizeName);
  const filledMatchTeams = matchTeams.filter(Boolean);
  if (filledMatchTeams.length === 2) {
    return selectedTeams.every((team) => filledMatchTeams.includes(team));
  }
  if (filledMatchTeams.length === 1 && !selectedTeams.includes(filledMatchTeams[0])) {
    return false;
  }
  const playerA = normalizeName(match.playerA);
  const playerB = normalizeName(match.playerB);
  return (teamAPlayers.has(playerA) && teamBPlayers.has(playerB)) || (teamAPlayers.has(playerB) && teamBPlayers.has(playerA));
}

function orientSimulationMatch(match, teamAPlayers, teamBPlayers) {
  const playerA = normalizeName(match.playerA);
  const playerB = normalizeName(match.playerB);
  if (teamAPlayers.has(playerA) && teamBPlayers.has(playerB)) {
    return simulationFixedGame(match, teamAPlayers.get(playerA), teamBPlayers.get(playerB), match.winner);
  }
  if (teamAPlayers.has(playerB) && teamBPlayers.has(playerA)) {
    return simulationFixedGame(match, teamAPlayers.get(playerB), teamBPlayers.get(playerA), match.winner === "U" ? "U" : match.winner === "A" ? "B" : "A");
  }
  return null;
}

function simulationFixedGame(match, a, b, winnerSide) {
  const pending = winnerSide === "U";
  const winner = winnerSide === "A" ? a : b;
  const loser = winnerSide === "A" ? b : a;
  return {
    order: match.index + 1,
    index: match.index,
    a,
    b,
    pending,
    winner: pending ? null : { ...winner, side: winnerSide },
    loser: pending ? null : loser,
    winnerSide
  };
}

function createSimulationPlayerStats(teamA, teamB) {
  const map = new Map();
  [...teamA, ...teamB].forEach((member) => {
    map.set(member.statKey, {
      name: member.name,
      displayName: simulationMemberLabel(member),
      team: member.team,
      side: member.side,
      rating: member.rating,
      appearances: 0,
      wins: 0,
      losses: 0,
      stage1Appearances: 0,
      stage1Wins: 0,
      stage2Appearances: 0,
      stage2Wins: 0,
      decidingWins: 0
    });
  });
  return map;
}

function createSimulationScoreDistribution() {
  return new Map(simulationScoreKeys().map((key) => [key, 0]));
}

function simulationScoreKeys() {
  return ["5-0", "5-1", "5-2", "5-3", "5-4", "4-5", "3-5", "2-5", "1-5", "0-5"];
}

function addSimulationScoreResult(scores, scoreA, scoreB) {
  const key = `${scoreA}-${scoreB}`;
  scores.set(key, (scores.get(key) || 0) + 1);
}

function renderSimulationScoreRows(scores, total) {
  const keys = [
    ...simulationScoreKeys(),
    ...[...scores.keys()].filter((key) => !simulationScoreKeys().includes(key)).sort()
  ];
  return keys.map((key) => {
    const count = scores.get(key) || 0;
    return `<tr>
      <td>${escapeHtml(key)}</td>
      <td>${count.toLocaleString("ja-JP")}</td>
      <td><strong>${formatPercent(total ? count / total : 0, 2)}</strong></td>
    </tr>`;
  }).join("") || emptyRow(3, "スコア分布がありません");
}

function recordSimulationGame(stats, a, b, winnerSide, role) {
  const stage = String(role || "").startsWith("ステージ1") ? 1 : 2;
  addSimulationPlayerGame(stats.get(a.statKey), winnerSide === "A", stage);
  addSimulationPlayerGame(stats.get(b.statKey), winnerSide === "B", stage);
}

function addSimulationPlayerGame(row, won, stage) {
  if (!row) return;
  row.appearances++;
  if (won) row.wins++;
  else row.losses++;
  if (stage === 1) {
    row.stage1Appearances++;
    if (won) row.stage1Wins++;
  } else {
    row.stage2Appearances++;
    if (won) row.stage2Wins++;
  }
}

function addSimulationDecidingWin(stats, statKey) {
  const row = stats.get(statKey);
  if (row) row.decidingWins++;
}

function mergeSimulationPlayerStats(total, incoming) {
  incoming.forEach((row, name) => {
    const target = total.get(name);
    if (!target) return;
    target.appearances += row.appearances;
    target.wins += row.wins;
    target.losses += row.losses;
    target.stage1Appearances += row.stage1Appearances;
    target.stage1Wins += row.stage1Wins;
    target.stage2Appearances += row.stage2Appearances;
    target.stage2Wins += row.stage2Wins;
    target.decidingWins += row.decidingWins || 0;
  });
}

function handleSimulationButton() {
  if (simulationRunning) {
    return;
  }
  runTeamSimulation();
}

function renderSimulationPlayerStatsTables() {
  if (!simulationResultRenderState) {
    els.simulationPlayerStatsABody.innerHTML = emptyRow(9, "シミュレーション実行後に表示します");
    els.simulationPlayerStatsBBody.innerHTML = emptyRow(9, "シミュレーション実行後に表示します");
    return;
  }
  const { setup, result, total } = simulationResultRenderState;
  els.simulationPlayerStatsABody.innerHTML = renderSimulationPlayerStatsRows(setup.teamA.members, result.players, total);
  els.simulationPlayerStatsBBody.innerHTML = renderSimulationPlayerStatsRows(setup.teamB.members, result.players, total);
}

function renderSimulationPlayerStatsRows(members, stats, total) {
  const rows = members.map((member) => {
    const row = stats.get(member.statKey);
    const appearances = row?.appearances || 0;
    const wins = row?.wins || 0;
    const losses = row?.losses || 0;
    const winRate = appearances ? wins / appearances : 0;
    const stage1Appearances = row?.stage1Appearances || 0;
    const stage1Wins = row?.stage1Wins || 0;
    const stage2Appearances = row?.stage2Appearances || 0;
    const stage2Wins = row?.stage2Wins || 0;
    const stage1Rate = stage1Appearances ? stage1Wins / stage1Appearances : 0;
    const stage2Rate = stage2Appearances ? stage2Wins / stage2Appearances : 0;
    return {
      name: simulationMemberLabel(member),
      rating: Number(member.rating),
      appearances: appearances / total,
      wins: wins / total,
      losses: losses / total,
      winRate,
      stage1Rate: stage1Appearances ? stage1Rate : -1,
      stage2Wins: stage2Wins / total,
      stage2Rate: stage2Appearances ? stage2Rate : -1
    };
  });
  const sortedRows = sortRows(rows, sortState.simulationPlayerStats);
  return sortedRows.map((row) => {
    return `<tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${Number(row.rating).toFixed(1)}</td>
      <td>${row.appearances.toFixed(2)}</td>
      <td>${row.wins.toFixed(2)}</td>
      <td>${row.losses.toFixed(2)}</td>
      <td><strong>${formatPercent(row.winRate, 1)}</strong></td>
      <td>${row.stage1Rate >= 0 ? formatPercent(row.stage1Rate, 1) : "-"}</td>
      <td>${row.stage2Wins.toFixed(2)}</td>
      <td>${row.stage2Rate >= 0 ? formatPercent(row.stage2Rate, 1) : "-"}</td>
    </tr>`;
  }).join("") || emptyRow(9, "メンバーがありません");
}

function simulationMemberLabel(member) {
  return member?.displayName || member?.name || "";
}

function renderPlayerDetail() {
  const player = computed.players.get(els.playerDetailSelect.value);
  if (!player) {
    els.playerDetail.innerHTML = "<p>棋士を選択してください。</p>";
    els.playerTournamentBody.innerHTML = emptyRow(5, "棋士を選択してください");
    els.playerOpponentBody.innerHTML = emptyRow(4, "棋士を選択してください");
    els.playerRatingHistoryBody.innerHTML = emptyRow(5, "棋士を選択してください");
    return;
  }
  const playerMatches = computed.history.filter((match) => match.playerA === player.name || match.playerB === player.name);
  const opponents = computePlayerOpponents(player, playerMatches);
  const tournaments = computePlayerTournaments(player.name, playerMatches);
  const ratingRows = computePlayerRatingRows(player.name, playerMatches);
  const rank = player.rank ? `${player.rank}位` : "-";
  els.playerDetail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card"><span>レーティング</span><strong>${player.rating.toFixed(1)}</strong></div>
      <div class="detail-card"><span>順位</span><strong>${rank}</strong></div>
      <div class="detail-card"><span>最高レーティング</span><strong>${player.peakRating.toFixed(1)}</strong></div>
      <div class="detail-card"><span>勝敗無</span><strong>${player.wins}-${player.losses}-${player.draws}</strong></div>
      <div class="detail-card"><span>勝率</span><strong>${formatPercent(decisiveWinRate(player), 1)}</strong></div>
    </div>`;
  els.playerTournamentBody.innerHTML = sortRows(tournaments, sortState.playerTournaments).map((row) => `
    <tr>
      <td>${escapeHtml(row.tournament)}</td>
      <td>${row.wins}-${row.losses}-${row.draws}</td>
      <td>${formatPercent(row.winRate, 1)}</td>
      <td><strong>${row.end.toFixed(1)}</strong></td>
      <td>${formatDelta(row.delta)}</td>
    </tr>
  `).join("") || emptyRow(5, "大会別成績がありません");
  els.playerOpponentBody.innerHTML = sortRows(opponents, sortState.playerOpponents).map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td><strong>${formatPercent(row.expected, 1)}</strong></td>
      <td>${row.rating.toFixed(1)}</td>
      <td>${row.wins}-${row.losses}-${row.draws}</td>
    </tr>
  `).join("") || emptyRow(4, "対戦相手がありません");
  els.playerRatingHistoryBody.innerHTML = sortRows(ratingRows, sortState.playerRatingHistory).map((row) => `
    <tr>
      <td>${row.index}</td>
      <td>${escapeHtml(row.tournament)}</td>
      <td>${escapeHtml(formatStageLabel(row.stage))}</td>
      <td><strong>${row.rating.toFixed(1)}</strong></td>
      <td>${formatDelta(row.delta)}</td>
    </tr>
  `).join("") || emptyRow(5, "レーティング推移がありません");
}

function computePlayerOpponents(player, matches) {
  const opponents = new Map();
  [...computed.players.values()].forEach((opponent) => {
    if (opponent.name === player.name) return;
    opponents.set(opponent.name, {
      name: opponent.name,
      rating: opponent.rating,
      expected: expectedScore(player.rating, opponent.rating),
      wins: 0,
      losses: 0,
      draws: 0,
      record: 0
    });
  });
  matches.forEach((match) => {
    if (match.winner === "U") return;
    const isA = match.playerA === player.name;
    const opponentName = isA ? match.playerB : match.playerA;
    const opponent = computed.players.get(opponentName);
    const won = (isA && match.winner === "A") || (!isA && match.winner === "B");
    const lost = (isA && match.winner === "B") || (!isA && match.winner === "A");
    const item = opponents.get(opponentName) || {
      name: opponentName,
      rating: opponent?.rating ?? Number(state.settings.initialRating || 1500),
      expected: expectedScore(player.rating, opponent?.rating ?? Number(state.settings.initialRating || 1500)),
      wins: 0,
      losses: 0,
      draws: 0,
      record: 0
    };
    if (won) item.wins++;
    else if (lost) item.losses++;
    else item.draws++;
    item.record = item.wins - item.losses;
    opponents.set(opponentName, item);
  });
  return [...opponents.values()];
}

function computePlayerTournaments(playerName, matches) {
  const tournaments = new Map();
  const tournamentOrder = getTournamentOrder();
  matches.forEach((match) => {
    if (match.winner === "U") return;
    const isA = match.playerA === playerName;
    const tournament = match.tournament || "未分類";
    if (!tournaments.has(tournament)) {
      tournaments.set(tournament, {
        tournament,
        order: tournamentOrder.get(tournament) ?? tournaments.size,
        start: isA ? Number(match.aBefore) : Number(match.bBefore),
        end: isA ? Number(match.aAfter) : Number(match.bAfter),
        wins: 0,
        losses: 0,
        draws: 0,
        games: 0,
        winRate: 0,
        delta: 0,
        record: 0
      });
    }
    const row = tournaments.get(tournament);
    row.end = isA ? Number(match.aAfter) : Number(match.bAfter);
    const ownWins = isA ? Number(match.aWins || 0) : Number(match.bWins || 0);
    const ownLosses = isA ? Number(match.bWins || 0) : Number(match.aWins || 0);
    const playedGames = Number(match.aWins || 0) + Number(match.bWins || 0) > 0 ? Number(match.aWins || 0) + Number(match.bWins || 0) : 1;
    row.wins += ownWins;
    row.losses += ownLosses;
    row.draws += Math.max(0, playedGames - ownWins - ownLosses);
    row.games += playedGames;
    row.winRate = decisiveWinRate(row);
    row.delta = Math.round((row.end - row.start) * 10) / 10;
    row.record = row.wins - row.losses;
  });
  return [...tournaments.values()];
}

function computePlayerRatingRows(playerName, matches) {
  const rows = new Map();
  matches.forEach((match) => {
    if (match.winner === "U") return;
    const isA = match.playerA === playerName;
    const tournament = match.tournament || "未分類";
    if (!rows.has(tournament)) {
      rows.set(tournament, {
        tournament,
        start: isA ? Number(match.aBefore) : Number(match.bBefore),
        stage: "",
        rating: 0,
        delta: 0
      });
    }
    const row = rows.get(tournament);
    row.stage = match.stage || "";
    row.rating = isA ? Number(match.aAfter) : Number(match.bAfter);
    row.delta = Math.round((row.rating - row.start) * 10) / 10;
  });
  return [...rows.values()].map((row, index) => ({
    ...row,
    index: index + 1
  }));
}

function drawChart() {
  const canvas = els.ratingCanvas;
  const ctx = canvas.getContext("2d");
  const player = computed.players.get(els.playerDetailSelect.value);
  if (!isChartVisible(canvas)) return;
  const size = resizeCanvasForDisplay(canvas, ctx);
  const width = size.width;
  const height = size.height;
  chartPoints = [];
  hideChartTooltip();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcfa";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#dce2dc";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = 36 + i * 64;
    ctx.beginPath();
    ctx.moveTo(46, y);
    ctx.lineTo(width - 24, y);
    ctx.stroke();
  }
  if (!player || player.history.length < 2) {
    ctx.fillStyle = "#66716a";
    ctx.font = "16px sans-serif";
    ctx.fillText("試合を追加すると推移が表示されます", 52, 174);
    return;
  }
  const values = player.history.map((point) => point.rating);
  const min = Math.min(...values) - 20;
  const max = Math.max(...values) + 20;
  const left = 52;
  const right = width - 30;
  const top = 28;
  const bottom = height - 48;
  const xFor = (index) => left + ((right - left) * index) / Math.max(1, values.length - 1);
  const yFor = (value) => bottom - ((bottom - top) * (value - min)) / Math.max(1, max - min);

  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#0f766e";
  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    chartPoints.push({ x, y, value, label: player.history[index].label, detail: player.history[index].detail });
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#17201b";
  ctx.font = "15px sans-serif";
  ctx.fillText(`${player.name} ${player.rating.toFixed(1)}`, left, 22);
  ctx.fillStyle = "#66716a";
  ctx.font = "12px sans-serif";
  ctx.fillText(Math.round(max).toString(), 12, top + 4);
  ctx.fillText(Math.round(min).toString(), 12, bottom + 4);
}

function scheduleChartDraw() {
  if (pendingChartFrame) cancelAnimationFrame(pendingChartFrame);
  pendingChartFrame = requestAnimationFrame(() => {
    pendingChartFrame = 0;
    drawChart();
  });
}

function isChartVisible(canvas) {
  const view = document.querySelector("#playersView");
  return view.classList.contains("active-view") && canvas.getBoundingClientRect().width > 0;
}

function resizeCanvasForDisplay(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.max(240, Math.round(rect.height || 360));
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height };
}

window.addEventListener("resize", () => {
  if (document.querySelector("#playersView").classList.contains("active-view")) scheduleChartDraw();
});

function setView(view) {
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active-view"));
  document.querySelector(`#${view}View`).classList.add("active-view");
  els.viewTitle.textContent = { dashboard: "概要", tournaments: "大会", simulation: "チーム対決シミュレーション", matches: "試合", players: "棋士", import: "追加", settings: "設定" }[view];
  els.searchBox.hidden = !SEARCHABLE_VIEWS.has(view);
  if (view === "players") scheduleChartDraw();
}

function setSimulationTab(tab) {
  document.querySelectorAll("[data-simulation-tab]").forEach((button) => {
    const active = button.dataset.simulationTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-simulation-pane]").forEach((pane) => {
    const active = pane.dataset.simulationPane === tab;
    pane.classList.toggle("active-simulation-pane", active);
    pane.hidden = !active;
  });
}

function setRegionalAwardTab(tab) {
  regionalAwardCurrentKey = tab;
  document.querySelectorAll("[data-regional-award-tab]").forEach((button) => {
    const active = button.dataset.regionalAwardTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  renderRegionalAwardRows();
}

function addMatchFromForm() {
  updateMatchStageInput();
  const data = Object.fromEntries(new FormData(els.matchForm).entries());
  if (!data.playerA || !data.playerB || !data.winner) {
    showToast("棋士A・棋士B・勝者を入力してください");
    return;
  }
  const cleaned = cleanMatch(data);
  if (editingMatchIndex === null) {
    state.matches.push(cleaned);
    recompute();
    clearMatchPlayerInputs();
    showToast("試合を追加しました");
  } else {
    state.matches[editingMatchIndex] = cleaned;
    resetEditMode();
    els.matchForm.reset();
    applyMatchStageControls("");
    matchStageTouched = false;
    updateDateInputState(els.matchDate);
    recompute();
    showToast("試合を更新しました");
  }
}

function clearMatchPlayerInputs() {
  els.matchForm.elements.playerA.value = "";
  els.matchForm.elements.playerB.value = "";
  advanceMatchStageGame();
  updateDateInputState(els.matchDate);
  hideInlineSuggestions();
  renderFormOptions();
}

function advanceMatchStageGame() {
  const currentGame = Number(els.matchStageGameSelect.value || 0);
  const nextGame = currentGame + 1;
  if (!MATCH_STAGE_GAMES.includes(String(nextGame))) return;
  els.matchStageGameSelect.value = String(nextGame);
  matchStageTouched = true;
  updateMatchStageInput();
}

function addTeamEntryFromForm() {
  const data = Object.fromEntries(new FormData(els.teamEntryForm).entries());
  const tournament = normalizeName(data.tournament);
  const league = normalizeName(data.league);
  const team = normalizeName(data.team);
  const players = uniqueInOrder([data.player1, data.player2, data.player3, data.player4, data.player5]
    .map((player) => normalizeName(player))
    .filter(Boolean));
  if (!tournament || !league || !team || !players.length) {
    showToast("大会名・リーグ・チーム・棋士を1人以上入力してください");
    return;
  }
  const entries = players.map((player, index) => ({
    tournament,
    league,
    team,
    player,
    order: "",
    leader: data.leader === "on" && index === 0,
    currentRating: computed.players.get(player)?.rating ?? Number(state.settings.initialRating || 1500)
  }));
  const existingMeta = state.rankingMeta || [];
  if (editingTeamMetaIndex !== null) {
    const indexes = Array.isArray(editingTeamMetaIndex.indexes) ? editingTeamMetaIndex.indexes : [editingTeamMetaIndex];
    indexes.slice().sort((a, b) => b - a).forEach((index) => existingMeta.splice(index, 1));
    editingTeamMetaIndex = null;
    els.addTeamEntryButton.textContent = "追加";
  }
  state.rankingMeta = mergeRankingMeta(existingMeta, entries);
  els.teamEntryForm.reset();
  els.teamEntryTournament.value = tournament;
  saveState();
  render();
  els.tournamentSelect.value = tournament;
  renderTournaments();
  showToast(`${entries.length}人を追加しました`);
}

function renderTeamMeta() {
  const rows = groupTeamMeta();
  els.teamMetaBody.innerHTML = sortRows(rows, sortState.teamMeta).map((item) => `
    <tr>
      <td>${escapeHtml(item.tournament || "")}</td>
      <td>${escapeHtml(item.league || "")}</td>
      <td>${escapeHtml(item.team || "")}</td>
      <td>${escapeHtml(item.players.join("、"))}</td>
      <td class="row-actions"><button data-team-edit="${escapeAttr(item.key)}" title="編集">編集</button><button data-team-delete="${escapeAttr(item.key)}" class="danger subtle" title="削除">削除...</button></td>
    </tr>
  `).join("") || emptyRow(5, "チーム編成は未登録です");
  els.teamMetaBody.querySelectorAll("[data-team-edit]").forEach((button) => {
    button.addEventListener("click", () => editTeamMeta(button.dataset.teamEdit));
  });
  els.teamMetaBody.querySelectorAll("[data-team-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteTeamMeta(button.dataset.teamDelete));
  });
}

function groupTeamMeta() {
  const groups = new Map();
  const tournamentOrder = getTournamentOrder();
  (state.rankingMeta || []).forEach((item, index) => {
    if (!item.team || !item.league) return;
    const key = [item.tournament || "", item.league || "", item.team || ""].join("::");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        tournament: item.tournament || "",
        tournamentOrder: tournamentOrder.get(item.tournament || "") ?? groups.size,
        league: item.league || "",
        team: item.team || "",
        indexes: [],
        players: [],
        orderValues: [],
        order: "",
        count: 0
      });
    }
    const group = groups.get(key);
    group.indexes.push(index);
    if (item.player) group.players.push(item.player);
    const order = item.order || item.rank || "";
    if (order) group.orderValues.push(order);
    group.count = group.players.length;
    group.order = formatOrderRange(group.orderValues);
  });
  return [...groups.values()];
}

function editTeamMeta(key) {
  const group = groupTeamMeta().find((item) => item.key === key);
  if (!group) return;
  const items = group.indexes.map((index) => state.rankingMeta[index]).filter(Boolean);
  els.teamEntryForm.elements.tournament.value = group.tournament;
  els.teamEntryForm.elements.league.value = group.league;
  els.teamEntryForm.elements.team.value = group.team;
  ["player1", "player2", "player3", "player4", "player5"].forEach((name, index) => {
    els.teamEntryForm.elements[name].value = items[index]?.player || "";
  });
  els.teamEntryForm.elements.leader.checked = items.some((item) => item.leader);
  editingTeamMetaIndex = { key, indexes: group.indexes };
  els.addTeamEntryButton.textContent = "更新";
  setView("import");
  els.teamEntryForm.scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("チーム単位で上のフォームに読み込みました");
}

function deleteTeamMeta(key) {
  const group = groupTeamMeta().find((item) => item.key === key);
  if (!group) return;
  if (!confirm(`${group.tournament} ${group.team} のチーム編成を削除しますか？`)) return;
  group.indexes.slice().sort((a, b) => b - a).forEach((index) => state.rankingMeta.splice(index, 1));
  if (editingTeamMetaIndex?.key === key) {
    editingTeamMetaIndex = null;
    els.teamEntryForm.reset();
    els.addTeamEntryButton.textContent = "追加";
  }
  saveState();
  render();
  showToast("チーム編成を削除しました");
}

function renameTournament() {
  const data = Object.fromEntries(new FormData(els.renameTournamentForm).entries());
  const from = normalizeName(data.from);
  const to = normalizeName(data.to);
  if (!from || !to) {
    showToast("現在の大会名と新しい大会名を入力してください");
    return;
  }
  state.matches.forEach((match) => {
    if ((match.tournament || "未分類") === from) match.tournament = to;
  });
  (state.rankingMeta || []).forEach((item) => {
    if (item.tournament === from) item.tournament = to;
  });
  els.renameTournamentForm.reset();
  recompute();
  els.tournamentSelect.value = to;
  renderTournaments();
  showToast("大会名を更新しました");
}

function clearMatches() {
  if (!state.matches.length) return;
  if (confirm("登録済みの試合をすべて削除します。JSONでバックアップ済みですか？")) {
    state.matches = [];
    recompute();
    showToast("すべて削除しました");
  }
}

function startEditMatch(index) {
  const match = state.matches[index];
  if (!match) return;
  editingMatchIndex = index;
  Object.entries({
    date: match.date || "",
    tournament: match.tournament || "",
    teamA: match.teamA || "",
    playerA: match.playerA || "",
    teamB: match.teamB || "",
    playerB: match.playerB || "",
    sente: match.sente || "",
    winner: match.winner || ""
  }).forEach(([name, value]) => {
    const field = els.matchForm.elements[name];
    if (field) field.value = value;
  });
  updateDateInputState(els.matchDate);
  applyMatchStageControls(match.stage || "");
  matchStageTouched = true;
  renderFormOptions();
  els.addMatchButton.textContent = "更新";
  els.cancelEditButton.hidden = false;
  els.matchForm.scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("試合を編集できます");
}

function cancelEditMatch() {
  resetEditMode();
  els.matchForm.reset();
  applyMatchStageControls("");
  matchStageTouched = false;
  updateDateInputState(els.matchDate);
  renderFormOptions();
  showToast("編集をキャンセルしました");
}

function resetEditMode() {
  editingMatchIndex = null;
  els.addMatchButton.textContent = "追加";
  els.cancelEditButton.hidden = true;
}

function deleteMatch(index) {
  const match = state.matches[index];
  if (!match) return;
  const label = `${match.playerA || ""} vs ${match.playerB || ""}`.trim();
  if (!confirm(`この試合を削除しますか？\n${label}\n削除後はレーティングを再計算します。`)) return;
  state.matches.splice(index, 1);
  if (editingMatchIndex === index) {
    els.matchForm.reset();
    applyMatchStageControls("");
    matchStageTouched = false;
    updateDateInputState(els.matchDate);
    resetEditMode();
  }
  recompute();
  showToast("試合を削除しました");
}

async function importFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    applyExternalState(parsed);
  } else {
    const imported = parseCsv(text, file.name);
    state.matches = [...state.matches, ...imported.matches.map(cleanMatch)];
    state.rankingMeta = mergeRankingMeta(state.rankingMeta || [], imported.rankingMeta);
  }
  recompute();
  showToast("取り込みました");
  event.target.value = "";
}

function importPastedCsv() {
  const text = els.pasteArea.value.trim();
  if (!text) {
    showToast("CSVを貼り付けてください");
    return;
  }
  const imported = parseCsv(text, "貼り付けCSV");
  if (!imported.matches.length && !imported.rankingMeta.length) {
    showToast("取り込める対戦行が見つかりませんでした");
    return;
  }
  state.matches = [...state.matches, ...imported.matches.map(cleanMatch)];
  state.rankingMeta = mergeRankingMeta(state.rankingMeta || [], imported.rankingMeta);
  els.pasteArea.value = "";
  recompute();
  showToast(`${imported.matches.length + imported.rankingMeta.length}件取り込みました`);
}

function parseCsv(text, sourceName = "") {
  const delimiter = detectDelimiter(text);
  const tournament = sourceName
    .replace(/-対戦表\.csv$/i, "")
    .replace(/-順位\.csv$/i, "")
    .replace(/-鈴木-1-1\.csv$/i, "")
    .replace(/\.csv$/i, "");
  const rawRows = splitDelimited(text, delimiter);
  const nonEmptyRows = rawRows.filter((items) => items.some((item) => item.trim()));
  if (!nonEmptyRows.length) return { matches: [], rankingMeta: [] };
  const matchHeader = findHeaderRow(nonEmptyRows, isAbemaMatchTable);
  if (matchHeader >= 0) return { matches: parseAbemaMatchTable(nonEmptyRows.slice(matchHeader), tournament), rankingMeta: [] };
  const rankingHeader = findHeaderRow(nonEmptyRows, isAbemaRankingTable);
  if (rankingHeader >= 0) return { matches: [], rankingMeta: parseAbemaRankingTable(nonEmptyRows.slice(rankingHeader), tournament) };
  const genericHeader = findHeaderRow(nonEmptyRows, isGenericMatchTable);
  return { matches: parseGenericCsvRows(nonEmptyRows.slice(Math.max(0, genericHeader))), rankingMeta: [] };
}

function splitDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function parseGenericCsvRows(nonEmptyRows) {
  const headers = nonEmptyRows[0].map((header) => normalizeHeader(header));
  return nonEmptyRows.slice(1).map((items) => mapCsvRow(headers, items)).filter((match) => match.playerA && match.playerB && match.winner);
}

function isAbemaMatchTable(rows) {
  const header = rows[0].map(normalizeHeader);
  return (header.includes("対局前aレート") && header.includes("対局後aレート") && (header.includes("a勝") || header.includes("a勝数")))
    || (header.includes("試合番号") && header.includes("a") && header.includes("b") && header.includes("対局前aレート"));
}

function isAbemaRankingTable(rows) {
  const header = rows[0].map(normalizeHeader);
  return (header.includes("開会前レート") && header.includes("現在レート") && header.includes("棋士"))
    || (header.includes("開会前") && header.includes("閉会後") && header.includes("氏名"));
}

function isGenericMatchTable(rows) {
  const header = rows[0].map(normalizeHeader);
  return indexOfAny(header, ["playera", "棋士a", "先手", "対局者a"]) >= 0
    && indexOfAny(header, ["playerb", "棋士b", "後手", "対局者b"]) >= 0;
}

function parseAbemaMatchTable(rows, fallbackTournament) {
  const header = rows[0].map(normalizeHeader);
  const modern = header.includes("リーグ") && header.includes("対局前aレート");
  const indexes = {
    number: indexOfAny(header, ["試合番号"]) >= 0 ? indexOfAny(header, ["試合番号"]) : 0,
    phase: modern ? 1 : -1,
    league: modern ? indexOfAny(header, ["リーグ"]) : -1,
    block: modern ? 3 : -1,
    game: modern ? 4 : -1,
    senteA: modern ? 5 : -1,
    playerA: indexOfAny(header, ["a"]),
    senteB: modern ? 7 : -1,
    playerB: indexOfAny(header, ["b"]),
    aBefore: indexOfAny(header, ["対局前aレート"]),
    bBefore: indexOfAny(header, ["対局前bレート"]),
    aWins: indexOfAny(header, ["a勝", "a勝数"]),
    bWins: indexOfAny(header, ["b数", "b勝", "b勝数"]),
    aAfter: indexOfAny(header, ["対局後aレート"]),
    bAfter: indexOfAny(header, ["対局後bレート"])
  };

  return rows.slice(1).map((items) => {
    const aWins = toNumber(items[indexes.aWins]);
    const bWins = toNumber(items[indexes.bWins]);
    const phase = valueAt(items, indexes.phase);
    const league = valueAt(items, indexes.league);
    const block = valueAt(items, indexes.block);
    const game = valueAt(items, indexes.game);
    const stage = [phase, league && `リーグ${league}`, block && `${block}組`, game && `${game}局`].filter(Boolean).join(" ");
    return cleanMatch({
      date: "",
      tournament: fallbackTournament,
      stage: stage || `試合${valueAt(items, indexes.number)}`,
      teamA: "",
      playerA: valueAt(items, indexes.playerA),
      teamB: "",
      playerB: valueAt(items, indexes.playerB),
      sente: valueAt(items, indexes.senteA) === "先" ? "A" : valueAt(items, indexes.senteB) === "先" ? "B" : "",
      winner: aWins > bWins ? "A" : bWins > aWins ? "B" : "D",
      aWins,
      bWins,
      aBefore: toNumber(items[indexes.aBefore]),
      bBefore: toNumber(items[indexes.bBefore]),
      aAfter: toNumber(items[indexes.aAfter]),
      bAfter: toNumber(items[indexes.bAfter]),
      note: ""
    });
  }).filter((match) => match && match.playerA && match.playerB);
}

function parseAbemaRankingTable(rows, fallbackTournament) {
  const header = rows[0].map(normalizeHeader);
  const playerIndex = indexOfAny(header, ["棋士", "氏名"]);
  const beforeIndex = indexOfAny(header, ["開会前レート", "開会前"]);
  const afterIndex = indexOfAny(header, ["現在レート", "閉会後"]);
  const teamIndex = indexOfAny(header, ["チーム"]);
  const leagueIndex = indexOfAny(header, ["リーグ"]);
  const rankIndex = indexOfAny(header, ["現在順位"]);
  const orderIndex = indexOfAny(header, ["指名順"]);
  const leaderIndex = indexOfAny(header, ["リーダー"]);
  return rows.slice(1).map((items) => {
    const player = stripTitle(valueAt(items, playerIndex));
    if (!player || !isFiniteNumber(toNumber(items[beforeIndex])) || !isFiniteNumber(toNumber(items[afterIndex]))) return null;
    return {
      tournament: fallbackTournament,
      player,
      team: valueAt(items, teamIndex),
      league: valueAt(items, leagueIndex),
      rank: valueAt(items, rankIndex),
      order: valueAt(items, orderIndex),
      leader: valueAt(items, leaderIndex) === "1",
      startRating: toNumber(items[beforeIndex]),
      currentRating: toNumber(items[afterIndex])
    };
  }).filter(Boolean);
}

function mergeRankingMeta(existing, incoming) {
  const map = new Map();
  [...existing, ...incoming].forEach((item) => {
    if (!item?.tournament || !item?.player) return;
    map.set(`${item.tournament}::${item.player}`, item);
  });
  return [...map.values()];
}

function mapCsvRow(headers, items) {
  const row = {};
  headers.forEach((header, index) => row[header] = (items[index] || "").trim());
  const winnerRaw = pick(row, ["winner", "勝者", "勝ち", "result", "結果"]);
  const playerA = pick(row, ["playera", "棋士a", "先手", "対局者a", "player1", "namea"]);
  const playerB = pick(row, ["playerb", "棋士b", "後手", "対局者b", "player2", "nameb"]);
  const senteRaw = pick(row, ["sente", "先手", "手番"]);
  return {
    date: pick(row, ["date", "日付", "対局日"]),
    tournament: pick(row, ["tournament", "大会", "年度", "season"]),
    stage: pick(row, ["stage", "回戦", "局", "round"]),
    teamA: pick(row, ["teama", "チームa", "team1"]),
    playerA,
    teamB: pick(row, ["teamb", "チームb", "team2"]),
    playerB,
    sente: normalizeSente(senteRaw, playerA, playerB),
    winner: normalizeWinner(winnerRaw, playerA, playerB),
    aWins: toNumber(pick(row, ["awins", "a勝", "a勝数"])),
    bWins: toNumber(pick(row, ["bwins", "b勝", "b勝数", "b数"])),
    note: pick(row, ["note", "備考", "memo"])
  };
}

function cleanMatch(match) {
  const winner = normalizeWinner(match.winner, match.playerA, match.playerB);
  const aWins = winner === "U" ? 0 : isFiniteNumber(match.aWins) ? Number(match.aWins) : (winner === "A" ? 1 : 0);
  const bWins = winner === "U" ? 0 : isFiniteNumber(match.bWins) ? Number(match.bWins) : (winner === "B" ? 1 : 0);
  const inferredSente = match.sente || (String(match.note || "").includes("A先手") ? "A" : String(match.note || "").includes("B先手") ? "B" : "");
  const note = stripSenteNote(match.note);
  return {
    date: match.date || "",
    tournament: match.tournament || "",
    stage: match.stage || "",
    teamA: match.teamA || "",
    playerA: normalizeName(match.playerA),
    teamB: match.teamB || "",
    playerB: normalizeName(match.playerB),
    sente: normalizeSente(inferredSente, match.playerA, match.playerB),
    winner,
    aWins,
    bWins,
    aBefore: isFiniteNumber(match.aBefore) ? Number(match.aBefore) : undefined,
    bBefore: isFiniteNumber(match.bBefore) ? Number(match.bBefore) : undefined,
    aAfter: isFiniteNumber(match.aAfter) ? Number(match.aAfter) : undefined,
    bAfter: isFiniteNumber(match.bAfter) ? Number(match.bAfter) : undefined,
    note
  };
}

function saveSettings() {
  state.settings = {
    initialRating: Number(els.initialRating.value) || 1500,
    kFactor: Number(els.kFactor.value) || 24,
    minGames: Number(els.minGames.value) || 0
  };
  recompute();
  showToast("設定を保存しました");
}

async function openExternalFile() {
  try {
    if ("showOpenFilePicker" in window) {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "ABEMAレーティングJSON", accept: { "application/json": [".json"] } }],
        multiple: false
      });
      externalFileHandle = handle;
      const file = await handle.getFile();
      const parsed = JSON.parse(await file.text());
      applyExternalState(parsed);
      updateExternalStatus(`${file.name} を接続中`, parsed.savedAt || file.lastModified);
      showToast("外部JSONを読み込みました");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const parsed = JSON.parse(await file.text());
      applyExternalState(parsed);
      updateExternalStatus(`${file.name} を読み込み済み`, parsed.savedAt || file.lastModified);
      showToast("外部JSONを読み込みました");
    }, { once: true });
    input.click();
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      showToast("外部JSONを読み込めませんでした");
    }
  }
}

async function loadDefaultExternalFile() {
  if (window.location.protocol === "file:") {
    updateExternalStatus("ファイル直開き中。既定JSONの自動読み込みにはローカルサーバーを使うか、外部JSONを開いてください");
    return;
  }
  try {
    const response = await fetch(DEFAULT_EXTERNAL_JSON, { cache: "no-store" });
    if (!response.ok) {
      updateExternalStatus("既定JSONなし");
      return;
    }
    const parsed = await response.json();
    const externalTime = Date.parse(parsed.savedAt || "");
    const localTime = Date.parse(state.savedAt || "");
    if (!Number.isFinite(localTime) || (Number.isFinite(externalTime) && externalTime > localTime)) {
      applyExternalState(parsed);
      updateExternalStatus("既定JSONを読み込み済み", parsed.savedAt);
      return;
    }
    updateExternalStatus("ローカルキャッシュを使用中", state.savedAt);
  } catch {
    updateExternalStatus("既定JSONなし");
  }
}

async function saveExternalFile() {
  try {
    if ("showSaveFilePicker" in window) {
      if (!externalFileHandle) {
        externalFileHandle = await window.showSaveFilePicker({
          suggestedName: DEFAULT_EXTERNAL_JSON_NAME,
          types: [{ description: "ABEMAレーティングJSON", accept: { "application/json": [".json"] } }]
        });
      }
      await writeExternalFile();
      updateExternalStatus(`${externalFileHandle.name || "外部JSON"} へ保存済み`, new Date());
      showToast("外部JSONへ保存しました");
      return;
    }
    downloadExternalJson();
    updateExternalStatus(`${DEFAULT_EXTERNAL_JSON_NAME} を書き出しました`, new Date());
    showToast(`${DEFAULT_EXTERNAL_JSON_NAME} を書き出しました`);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      showToast("外部JSONへ保存できませんでした");
    }
  }
}

function scheduleExternalSave() {
  if (!externalFileHandle || !("createWritable" in externalFileHandle)) return;
  clearTimeout(externalSaveTimer);
  externalSaveTimer = setTimeout(() => {
    writeExternalFile().then(() => updateExternalStatus(`${externalFileHandle.name || "外部JSON"} へ自動保存済み`, new Date())).catch(() => updateExternalStatus("外部JSONへの自動保存に失敗"));
  }, 800);
}

async function writeExternalFile() {
  state.savedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const writable = await externalFileHandle.createWritable();
  await writable.write(JSON.stringify(statePayload(), null, 2));
  await writable.close();
}

function applyExternalState(parsed) {
  const next = Array.isArray(parsed)
    ? { matches: parsed }
    : parsed;
  state.settings = { ...state.settings, ...(next.settings || {}) };
  state.matches = (next.matches || []).map(cleanMatch);
  state.rankingMeta = next.rankingMeta || [];
  state.regionalForecastCache = normalizeRegionalForecastCache(next.regionalForecastCache);
  delete state.simulationCache;
  state.ratingFormulaVersion = 2;
  state.savedAt = next.savedAt || new Date().toISOString();
  computed = computeRatings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function statePayload() {
  return {
    settings: state.settings,
    matches: state.matches,
    rankingMeta: state.rankingMeta || [],
    regionalForecastCache: normalizeRegionalForecastCache(state.regionalForecastCache),
    ratingFormulaVersion: 2,
    savedAt: state.savedAt || new Date().toISOString()
  };
}

function updateExternalStatus(text, updatedAt = "") {
  if (!els.externalFileStatus) return;
  els.externalFileStatus.textContent = `${text} / 最終更新: ${formatDateTime(updatedAt)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function downloadExternalJson() {
  download(DEFAULT_EXTERNAL_JSON_NAME, JSON.stringify(statePayload(), null, 2), "application/json");
}

function exportCsv() {
  const headers = ["date", "tournament", "stage", "teamA", "playerA", "teamB", "playerB", "sente", "winner", "aWins", "bWins", "aBefore", "bBefore", "aAfter", "bAfter", "note"];
  const rows = [headers.join(","), ...state.matches.map((match) => headers.map((key) => csvCell(match[key])).join(","))];
  download("abema-elo-matches.csv", rows.join("\n"), "text/csv");
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[normalizeHeader(key)]) return row[normalizeHeader(key)];
  }
  return "";
}

function normalizeHeader(value) {
  return String(value || "").replace(/^\ufeff/, "").trim().replace(/\s+/g, "").toLowerCase();
}

function stripTitle(value) {
  return normalizeName(value).replace(/(竜王・名人|名人|竜王|王位|叡王|王座|棋王|王将|棋聖|九段|八段|七段|六段|五段|四段|女流.*)$/u, "");
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitPlayers(value) {
  return uniqueInOrder(String(value || "")
    .split(/[\n,、]/)
    .map((name) => normalizeName(name))
    .filter(Boolean));
}

function stripSenteNote(value) {
  return normalizeName(String(value || "")
    .replace(/(^|[\/\s、,])A先手(?=$|[\/\s、,])/g, " ")
    .replace(/(^|[\/\s、,])B先手(?=$|[\/\s、,])/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " "));
}

function normalizeWinner(value, playerA = "", playerB = "") {
  const raw = normalizeName(value);
  const compact = raw.toLowerCase();
  if (!raw) return "";
  if (["u", "未定", "未実施", "予定", "pending", "undecided"].includes(compact)) return "U";
  if (["a", "1", "playera", "棋士a", "先手"].includes(compact)) return "A";
  if (["b", "2", "playerb", "棋士b", "後手"].includes(compact)) return "B";
  if (["d", "draw", "引分", "引き分け", "千日手", "持将棋", "無勝敗"].includes(compact)) return "D";
  if (raw && raw === normalizeName(playerA)) return "A";
  if (raw && raw === normalizeName(playerB)) return "B";
  if (raw.includes("A")) return "A";
  if (raw.includes("B")) return "B";
  return "";
}

function normalizeSente(value, playerA = "", playerB = "") {
  const raw = normalizeName(value);
  const compact = raw.toLowerCase();
  if (!raw) return "";
  if (["a", "1", "playera", "棋士a", "a先手"].includes(compact)) return "A";
  if (["b", "2", "playerb", "棋士b", "b先手"].includes(compact)) return "B";
  if (raw === normalizeName(playerA)) return "A";
  if (raw === normalizeName(playerB)) return "B";
  return "";
}

function expectedScore(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (Number(opponentRating) - Number(rating)) / 400));
}

function formatDelta(value) {
  const number = Number(value) || 0;
  const className = number >= 0 ? "delta-up" : "delta-down";
  const sign = number > 0 ? "+" : "";
  return `<span class="${className}">${sign}${number.toFixed(1)}</span>`;
}

function formatPercent(value, digits = 1) {
  const percent = Number(value) * 100;
  if (!Number.isFinite(percent)) return "-";
  const rounded = Number(percent.toFixed(digits));
  if (!rounded) return "0%";
  if (rounded === 100) return "100%";
  return `${rounded.toFixed(digits)}%`;
}

function formatRank(value) {
  return Number.isFinite(value) ? `${value}位` : "-";
}

function formatRankChange(value) {
  if (!Number.isFinite(value)) return "-";
  if (!value) return "±0";
  const className = value > 0 ? "delta-up" : "delta-down";
  const sign = value > 0 ? "+" : "";
  return `<span class="${className}">${sign}${value}</span>`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function hashString(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}">${escapeHtml(text)}</td></tr>`;
}

function detailCard(label, value) {
  return `<div class="detail-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function updateSort(header) {
  const table = header.closest("table");
  const body = table?.querySelector("tbody");
  const tableName = {
  rankingBody: "ranking",
  tournamentBody: "tournament",
  tournamentMatchesBody: "tournamentMatches",
  leagueRatingBody: "leagueRatings",
  teamRatingBody: "teamRatings",
  matchesBody: "matches",
  simulationPlayerStatsABody: "simulationPlayerStats",
  simulationPlayerStatsBBody: "simulationPlayerStats",
  regionalForecastBody: "regionalForecast",
  regionalAwardBody: "regionalAwards",
  playerTournamentBody: "playerTournaments",
  playerOpponentBody: "playerOpponents",
  playerRatingHistoryBody: "playerRatingHistory",
  teamMetaBody: "teamMeta"
  }[body?.id];
  if (!tableName) return;
  const key = header.dataset.sort;
  const current = sortState[tableName];
  if (current.key === key && current.touched) {
    current.direction = current.direction === "asc" ? "desc" : "asc";
  } else {
    current.direction = key === "overallRank" ? "asc" : isNumericSortKey(key) ? "desc" : "asc";
  }
  current.key = key;
  current.touched = true;
  if (tableName === "simulationPlayerStats") {
    renderSimulationPlayerStatsTables();
    return;
  }
  if (tableName === "regionalForecast") {
    renderRegionalForecastRows();
    return;
  }
  if (tableName === "regionalAwards") {
    renderRegionalAwardRows();
    return;
  }
  render();
}

function sortRows(rows, sort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows.slice().sort((left, right) => compareValues(sortValue(left, sort.key), sortValue(right, sort.key)) * direction);
}

function sortValue(row, key) {
  if (key === "teamMetaDefault") return `${Number(row.tournamentOrder ?? 0).toString().padStart(6, "0")} ${row.league || ""} ${row.team || ""}`;
  if (key === "tournament" && Number.isFinite(Number(row.tournamentOrder))) return Number(row.tournamentOrder);
  if (key === "score") return row.scoreValue ?? `${row.aWins || 0}-${row.bWins || 0}`;
  if (key === "record") return row.record ?? ((row.wins || 0) - (row.losses || 0));
  if (key === "winRate") return row.winRate ?? decisiveWinRate(row);
  if (key === "lastDelta") return row.lastDelta ?? 0;
  if (key === "overallRank") return row.overallRank ?? Number.POSITIVE_INFINITY;
  if (key === "delta") return row.delta ?? row.deltaA ?? 0;
  if (key === "winner") return row.winnerText ?? winnerLabel(row);
  if (key === "expected") return row.expected ?? 0;
  return row[key] ?? "";
}

function isNumericSortKey(key) {
  return [
    "rating", "deviation", "record", "winRate", "lastDelta", "overallRank", "overallRankChange", "start", "end", "delta",
    "score", "average", "count", "index", "expected", "order", "appearances", "wins", "losses", "stage1Rate",
    "stage2Wins", "stage2Rate", "first", "second", "advance", "runnerUp", "champion", "awardRate", "averageWins",
    "fixedWins", "averageRecord", "averageWinRate", "fixedRecord", "fixedWinRate", "averageAppearances",
    "fixedAppearances", "averagePrelimWins", "averagePrelimAppearances", "fixedPrelimWins", "fixedPrelimAppearances"
  ].includes(key);
}

function compareValues(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return String(left).localeCompare(String(right), "ja", { numeric: true });
}

function winnerLabel(match) {
  if (match.winner === "A") return match.playerA;
  if (match.winner === "B") return match.playerB;
  if (match.winner === "U") return "未定";
  return "引分・無勝敗";
}

function plainMatchupHtml(match) {
  const a = match.winner === "A" ? `<strong>${escapeHtml(match.playerA)}</strong>` : escapeHtml(match.playerA);
  const b = match.winner === "B" ? `<strong>${escapeHtml(match.playerB)}</strong>` : escapeHtml(match.playerB);
  return `${a} vs ${b}`;
}

function resultMatchupHtml(match) {
  const a = resultPlayerHtml(match, "A");
  const b = resultPlayerHtml(match, "B");
  return `${a} vs ${b}`;
}

function tournamentMatchupHtml(match, teamMap) {
  return `<span class="tournament-match-line"><span class="tournament-match-players">${resultPlayerHtml(match, "A", teamMap)} <span class="match-separator">vs</span> ${resultPlayerHtml(match, "B", teamMap)}</span><span class="tournament-match-delta">変動: ${formatDelta(match.deltaA)} / ${formatDelta(match.deltaB)}</span></span>`;
}

function resultPlayerHtml(match, side, teamMap = null) {
  const name = side === "A" ? match.playerA : match.playerB;
  const team = side === "A"
    ? (teamMap?.get(name) || match.teamA || "")
    : (teamMap?.get(name) || match.teamB || "");
  const won = match.winner === side;
  const mark = match.winner === "U" ? "?" : match.winner === "D" ? "△" : won ? "○" : "●";
  const label = `${mark}${team ? `${team}・` : ""}${name}`;
  return won ? `<strong>${escapeHtml(label)}</strong>` : escapeHtml(label);
}

function senteText(match) {
  if (match.sente === "A") return `先手: ${match.playerA}`;
  if (match.sente === "B") return `先手: ${match.playerB}`;
  return "";
}

function expectedHtml(match) {
  const aRate = isFiniteNumber(match.expectedA) ? Number(match.expectedA) : expectedScore(match.aBefore, match.bBefore);
  const bRate = 1 - aRate;
  return `${escapeHtml(match.playerA)} ${formatPercent(aRate, 1)} / ${escapeHtml(match.playerB)} ${formatPercent(bRate, 1)}`;
}

function chartDetail(match, opponent, score, before, after, delta) {
  const winner = match.winner === "A" ? match.playerA : match.winner === "B" ? match.playerB : "引分・無勝敗";
  const side = match.sente ? (match.sente === "A" ? `${match.playerA}先手` : `${match.playerB}先手`) : "";
  const heading = [match.tournament, formatStageLabel(match.stage)].filter(Boolean).join(" / ");
  return [
    heading,
    `相手: ${opponent}`,
    side,
    `結果: ${winner} ${score}`,
    `レーティング: ${Number(before).toFixed(1)} → ${Number(after).toFixed(1)} (${delta > 0 ? "+" : ""}${Number(delta).toFixed(1)})`
  ].filter(Boolean).join("\n");
}

function showChartTooltip(event) {
  if (!chartPoints.length) return;
  const rect = els.ratingCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const nearest = chartPoints
    .map((point) => ({ ...point, distance: Math.hypot(point.x - x, point.y - y) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (!nearest || nearest.distance > 24) {
    hideChartTooltip();
    return;
  }
  els.chartTooltip.innerHTML = `
    <strong>${escapeHtml(nearest.label)}</strong>
    <span>${escapeHtml(Number(nearest.value).toFixed(1))}</span>
    <p>${escapeHtml(nearest.detail || "").replace(/\n/g, "<br>")}</p>
  `;
  const left = Math.min(rect.width - 240, Math.max(8, nearest.x + 12));
  const top = Math.max(8, nearest.y - 24);
  els.chartTooltip.style.left = `${left}px`;
  els.chartTooltip.style.top = `${top}px`;
  els.chartTooltip.classList.add("show");
}

function hideChartTooltip() {
  els.chartTooltip.classList.remove("show");
}

function uniqueInOrder(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeName(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shuffle(items) {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function formatOrderRange(values) {
  const numbers = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return uniqueInOrder(values).join("、");
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  return first === last ? String(first) : `${first}-${last}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/, 1)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function findHeaderRow(rows, predicate) {
  const scanLimit = Math.min(rows.length, 25);
  for (let index = 0; index < scanLimit; index++) {
    if (predicate(rows.slice(index, index + 1))) return index;
  }
  return -1;
}

function indexOfAny(header, names) {
  return names.map(normalizeHeader).map((name) => header.indexOf(name)).find((index) => index >= 0) ?? -1;
}

function valueAt(items, index) {
  return index >= 0 ? normalizeName(items[index]) : "";
}

function toNumber(value) {
  const text = String(value ?? "").replace(/[%+,]/g, "").trim();
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function isFiniteNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}
