const STORAGE_KEY = "abema-elo-state-v1";
const DEFAULT_EXTERNAL_JSON = "./abema-rating-data.json";
const SEARCHABLE_VIEWS = new Set(["dashboard", "tournaments", "matches"]);

const sampleMatches = [
  { date: "2025-04-05", tournament: "2025", stage: "予選第1試合", teamA: "チーム藤井", playerA: "藤井聡太", teamB: "チーム永瀬", playerB: "永瀬拓矢", winner: "A", note: "" },
  { date: "2025-04-05", tournament: "2025", stage: "予選第1試合", teamA: "チーム藤井", playerA: "佐々木大地", teamB: "チーム永瀬", playerB: "増田康宏", winner: "B", note: "" },
  { date: "2025-04-12", tournament: "2025", stage: "予選第2試合", teamA: "チーム羽生", playerA: "羽生善治", teamB: "チーム渡辺", playerB: "渡辺明", winner: "A", note: "" },
  { date: "2025-04-19", tournament: "2025", stage: "予選第3試合", teamA: "チーム豊島", playerA: "豊島将之", teamB: "チーム稲葉", playerB: "稲葉陽", winner: "B", note: "" },
  { date: "2025-04-26", tournament: "2025", stage: "本戦", teamA: "チーム藤井", playerA: "藤井聡太", teamB: "チーム羽生", playerB: "羽生善治", winner: "A", note: "" }
];

const state = loadState();
let computed = computeRatings();
let chartPoints = [];
let editingMatchIndex = null;
let editingTeamMetaIndex = null;
let externalFileHandle = null;
let externalSaveTimer = null;
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
  teamEntryForm: document.querySelector("#teamEntryForm"),
  formTournament: document.querySelector('#matchForm [name="tournament"]'),
  teamEntryTournament: document.querySelector('#teamEntryForm [name="tournament"]'),
  tournamentOptions: document.querySelector("#tournamentOptions"),
  teamOptions: document.querySelector("#teamOptions"),
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
  exportJsonButton: document.querySelector("#exportJsonButton"),
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
  toast: document.querySelector("#toast")
};

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});
document.querySelectorAll("th[data-sort]").forEach((header) => {
  header.classList.add("sortable");
  header.addEventListener("click", () => updateSort(header));
});

els.searchInput.addEventListener("input", render);
els.tournamentSelect.addEventListener("change", renderTournaments);
els.ratingCanvas.addEventListener("mousemove", showChartTooltip);
els.ratingCanvas.addEventListener("mouseleave", hideChartTooltip);
els.formTournament.addEventListener("input", renderFormOptions);
els.teamEntryTournament.addEventListener("input", renderFormOptions);
els.playerDetailSelect.addEventListener("change", () => {
  renderPlayerDetail();
  drawChart();
});
els.playerDetailSelect.addEventListener("input", () => {
  if (computed.players.has(els.playerDetailSelect.value)) {
    renderPlayerDetail();
    drawChart();
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
els.exportJsonButton.addEventListener("click", exportJson);
els.exportCsvButton.addEventListener("click", exportCsv);
els.saveSettingsButton.addEventListener("click", saveSettings);

render();
loadDefaultExternalFile();

function loadState() {
  const fallback = {
    settings: { initialRating: 1500, kFactor: 32, minGames: 0 },
    matches: [],
    rankingMeta: [],
    ratingFormulaVersion: 2
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const loaded = {
      ...fallback,
      ...saved,
      settings: { ...fallback.settings, ...(saved.settings || {}) }
    };
    if (!saved.ratingFormulaVersion && Number(loaded.settings.kFactor) === 24) {
      loaded.settings.kFactor = 32;
    }
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
      const seeded = state.matches.find((match) => normalizeName(match.playerA) === cleanName && isFiniteNumber(match.aBefore))
        || state.matches.find((match) => normalizeName(match.playerB) === cleanName && isFiniteNumber(match.bBefore));
      const seedRating = seeded
        ? (normalizeName(seeded.playerA) === cleanName ? Number(seeded.aBefore) : Number(seeded.bBefore))
        : initial;
      players.set(cleanName, {
        name: cleanName,
        rating: seedRating,
        wins: 0,
        losses: 0,
        draws: 0,
        games: 0,
        peakRating: seedRating,
        lastDelta: 0,
        history: [{ label: "開始", rating: seedRating, detail: "開始時レーティング" }]
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
      a.history.push({ label: match.tournament || `#${index + 1}`, rating: a.rating, detail: `${match.tournament || ""} ${match.stage || ""}`.trim() });
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
    const sourceBefore = isFiniteNumber(match.aBefore) && isFiniteNumber(match.bBefore);
    const aBefore = sourceBefore ? Number(match.aBefore) : a.rating;
    const bBefore = sourceBefore ? Number(match.bBefore) : b.rating;
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
      expectedB,
      sourceBefore
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
  drawChart();
  renderPlayerDetail();
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

function renderRanking() {
  const query = normalizeName(els.searchInput.value).toLowerCase();
  const rows = sortRows(computed.rankings
    .filter((player) => player.name.toLowerCase().includes(query))
    .map((player) => ({
      ...player,
      record: player.wins - player.losses,
      winRate: player.games ? player.wins / player.games : 0
    })), sortState.ranking)
    .map((player, index) => {
      const rate = player.games ? Math.round((player.wins / player.games) * 1000) / 10 : 0;
      return `<tr>
        <td><span class="rank">${index + 1}</span></td>
        <td>${escapeHtml(player.name)}</td>
        <td><strong>${player.rating.toFixed(1)}</strong></td>
        <td>${player.wins}-${player.losses}-${player.draws}</td>
        <td>${rate.toFixed(1)}%</td>
        <td>${formatDelta(player.lastDelta)}</td>
      </tr>`;
    });
  els.rankingBody.innerHTML = rows.join("") || emptyRow(6, "まだランキング対象の試合がありません");
}

function renderMatches() {
  const query = normalizeName(els.searchInput.value).toLowerCase();
  const rows = sortRows(computed.history
    .filter((match) => {
      const text = [match.date, match.tournament, match.stage, match.teamA, match.playerA, match.teamB, match.playerB, match.note].join(" ").toLowerCase();
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
          <td>${escapeHtml(match.playerA)}<br><small>${escapeHtml(match.stage || "")}</small></td>
          <td>レート反映</td>
          <td>${formatDelta(match.deltaA)}</td>
          <td><button data-edit="${match.index}" title="編集">編集</button></td>
        </tr>`;
      }
      return `<tr>
        <td>${escapeHtml(match.date || "")}</td>
        <td>${escapeHtml(match.tournament || "")}</td>
        <td>${plainMatchupHtml(match)}<br><small>${escapeHtml([match.stage, senteText(match)].filter(Boolean).join(" / "))}</small></td>
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
  const standings = sortRows(computeTournamentStandings(allMatches)
    .filter((player) => player.name.toLowerCase().includes(query))
    .map((player) => ({
      ...player,
      record: player.wins - player.losses,
      winRate: player.games ? player.wins / player.games : 0
    })), sortState.tournament);
  const matches = allMatches.filter((match) => {
    const text = [match.playerA, match.playerB, match.stage, match.teamA, match.teamB].join(" ").toLowerCase();
    return text.includes(query);
  });
  const decisiveGames = matches.reduce((sum, match) => sum + Number(match.aWins || 0) + Number(match.bWins || 0), 0);
  const noResultGames = matches.reduce((sum, match) => sum + (Number(match.aWins || 0) + Number(match.bWins || 0) === 0 ? 1 : 0), 0);
  els.tournamentSummary.innerHTML = [
    detailCard("大会", tournament || "-"),
    detailCard("対局行", matches.length.toLocaleString("ja-JP")),
    detailCard("決着局", decisiveGames.toLocaleString("ja-JP")),
    detailCard("無勝敗", noResultGames.toLocaleString("ja-JP")),
    detailCard("参加棋士", standings.length.toLocaleString("ja-JP"))
  ].join("");

  els.tournamentBody.innerHTML = standings.map((player, index) => {
    const winRate = player.games ? ((player.wins / player.games) * 100).toFixed(1) : "0.0";
    return `<tr>
      <td><span class="rank">${index + 1}</span></td>
      <td>${escapeHtml(player.name)}</td>
      <td>${player.start.toFixed(1)}</td>
      <td><strong>${player.end.toFixed(1)}</strong></td>
      <td>${formatDelta(player.delta)}</td>
      <td>${player.wins}-${player.losses}-${player.draws}</td>
      <td>${winRate}%</td>
    </tr>`;
  }).join("") || emptyRow(7, "この大会の対局がありません");

  els.tournamentMatchesBody.innerHTML = sortRows(matches.map((match) => ({
    ...match,
    matchup: `${match.playerA} ${match.playerB}`,
    winnerText: winnerLabel(match),
    scoreValue: Number(match.aWins || 0) - Number(match.bWins || 0),
    delta: Math.abs(Number(match.deltaA || 0)) + Math.abs(Number(match.deltaB || 0))
  })), sortState.tournamentMatches).map((match) => {
    const score = `${match.aWins || 0}-${match.bWins || 0}`;
    return `<tr>
      <td>${resultMatchupHtml(match)}</td>
      <td>${score}</td>
      <td>${escapeHtml(match.playerA)} ${formatDelta(match.deltaA)} / ${escapeHtml(match.playerB)} ${formatDelta(match.deltaB)}</td>
      <td>${escapeHtml(match.stage || "")}</td>
    </tr>`;
  }).join("") || emptyRow(4, "この大会の対局がありません");

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
  els.tournamentOptions.innerHTML = tournaments.map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
  els.teamOptions.innerHTML = teams.map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
  els.playerOptions.innerHTML = players.map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
}

function renderPlayerDetail() {
  const player = computed.players.get(els.playerDetailSelect.value);
  if (!player) {
    els.playerDetail.innerHTML = "<p>棋士を選択してください。</p>";
    els.playerTournamentBody.innerHTML = emptyRow(6, "棋士を選択してください");
    els.playerOpponentBody.innerHTML = emptyRow(4, "棋士を選択してください");
    els.playerRatingHistoryBody.innerHTML = emptyRow(5, "棋士を選択してください");
    return;
  }
  const playerMatches = computed.history.filter((match) => match.playerA === player.name || match.playerB === player.name);
  const opponents = computePlayerOpponents(player, playerMatches);
  const tournaments = computePlayerTournaments(player.name, playerMatches);
  const ratingRows = computePlayerRatingRows(player.name, playerMatches);
  const winRate = player.games ? ((player.wins / player.games) * 100).toFixed(1) : "0.0";
  const rank = player.rank ? `${player.rank}位` : "-";
  els.playerDetail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card"><span>レーティング</span><strong>${player.rating.toFixed(1)}</strong></div>
      <div class="detail-card"><span>順位</span><strong>${rank}</strong></div>
      <div class="detail-card"><span>最高レーティング</span><strong>${player.peakRating.toFixed(1)}</strong></div>
      <div class="detail-card"><span>勝敗無</span><strong>${player.wins}-${player.losses}-${player.draws}</strong></div>
      <div class="detail-card"><span>勝率</span><strong>${winRate}%</strong></div>
    </div>`;
  els.playerTournamentBody.innerHTML = sortRows(tournaments, sortState.playerTournaments).map((row) => `
    <tr>
      <td>${escapeHtml(row.tournament)}</td>
      <td>${row.wins}-${row.losses}-${row.draws}</td>
      <td>${(row.winRate * 100).toFixed(1)}%</td>
      <td>${row.start.toFixed(1)}</td>
      <td><strong>${row.end.toFixed(1)}</strong></td>
      <td>${formatDelta(row.delta)}</td>
    </tr>
  `).join("") || emptyRow(6, "大会別成績がありません");
  els.playerOpponentBody.innerHTML = sortRows(opponents, sortState.playerOpponents).map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td><strong>${(row.expected * 100).toFixed(1)}%</strong></td>
      <td>${row.rating.toFixed(1)}</td>
      <td>${row.wins}-${row.losses}-${row.draws}</td>
    </tr>
  `).join("") || emptyRow(4, "対戦相手がありません");
  els.playerRatingHistoryBody.innerHTML = sortRows(ratingRows, sortState.playerRatingHistory).map((row) => `
    <tr>
      <td>${row.index}</td>
      <td>${escapeHtml(row.tournament)}</td>
      <td>${escapeHtml(row.stage || "")}</td>
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
    row.winRate = row.games ? row.wins / row.games : 0;
    row.delta = Math.round((row.end - row.start) * 10) / 10;
    row.record = row.wins - row.losses;
  });
  return [...tournaments.values()];
}

function computePlayerRatingRows(playerName, matches) {
  const rows = new Map();
  matches.forEach((match) => {
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
  if (document.querySelector("#playersView").classList.contains("active-view")) drawChart();
});

function setView(view) {
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active-view"));
  document.querySelector(`#${view}View`).classList.add("active-view");
  els.viewTitle.textContent = { dashboard: "概要", tournaments: "大会", matches: "試合", players: "棋士", import: "追加", settings: "設定" }[view];
  els.searchBox.hidden = !SEARCHABLE_VIEWS.has(view);
}

function addMatchFromForm() {
  const data = Object.fromEntries(new FormData(els.matchForm).entries());
  if (!data.playerA || !data.playerB || !data.winner) {
    showToast("棋士A・棋士B・勝者を入力してください");
    return;
  }
  const cleaned = cleanMatch(data);
  if (editingMatchIndex === null) {
    state.matches.push(cleaned);
    showToast("試合を追加しました");
  } else {
    state.matches[editingMatchIndex] = cleaned;
    resetEditMode();
    showToast("試合を更新しました");
  }
  els.matchForm.reset();
  recompute();
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
    stage: match.stage || "",
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
  els.addMatchButton.textContent = "更新";
  els.cancelEditButton.hidden = false;
  els.matchForm.scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("試合を編集できます");
}

function cancelEditMatch() {
  resetEditMode();
  els.matchForm.reset();
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
  const aWins = isFiniteNumber(match.aWins) ? Number(match.aWins) : (winner === "A" ? 1 : 0);
  const bWins = isFiniteNumber(match.bWins) ? Number(match.bWins) : (winner === "B" ? 1 : 0);
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
          suggestedName: "abema-rating-data.json",
          types: [{ description: "ABEMAレーティングJSON", accept: { "application/json": [".json"] } }]
        });
      }
      await writeExternalFile();
      updateExternalStatus(`${externalFileHandle.name || "外部JSON"} へ保存済み`, new Date());
      showToast("外部JSONへ保存しました");
      return;
    }
    exportJson();
    updateExternalStatus("JSONを書き出しました", new Date());
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

function exportJson() {
  download("abema-elo-data.json", JSON.stringify(statePayload(), null, 2), "application/json");
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

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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
    current.direction = isNumericSortKey(key) ? "desc" : "asc";
  }
  current.key = key;
  current.touched = true;
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
  if (key === "winRate") return row.winRate ?? ((row.games || 0) ? (row.wins || 0) / row.games : 0);
  if (key === "lastDelta") return row.lastDelta ?? 0;
  if (key === "delta") return row.delta ?? row.deltaA ?? 0;
  if (key === "winner") return row.winnerText ?? winnerLabel(row);
  if (key === "expected") return row.expected ?? 0;
  return row[key] ?? "";
}

function isNumericSortKey(key) {
  return ["rating", "record", "winRate", "lastDelta", "start", "end", "delta", "score", "average", "count", "index", "expected", "order"].includes(key);
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

function resultPlayerHtml(match, side) {
  const name = side === "A" ? match.playerA : match.playerB;
  const won = match.winner === side;
  const mark = match.winner === "D" ? "△" : won ? "○" : "●";
  const label = `${mark}${name}`;
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
  return `${escapeHtml(match.playerA)} ${(aRate * 100).toFixed(1)}% / ${escapeHtml(match.playerB)} ${(bRate * 100).toFixed(1)}%`;
}

function chartDetail(match, opponent, score, before, after, delta) {
  const winner = match.winner === "A" ? match.playerA : match.winner === "B" ? match.playerB : "引分・無勝敗";
  const side = match.sente ? (match.sente === "A" ? `${match.playerA}先手` : `${match.playerB}先手`) : "";
  const heading = [match.tournament, match.stage].filter(Boolean).join(" / ");
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
