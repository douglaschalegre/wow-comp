import React, { useMemo, useState } from "react";

const initialPlayers = [
  { id: 1, name: "Herseter", faction: "HORDE", region: "US", itemLevel: 602, score: 91.4 },
  { id: 2, name: "Nadruk", faction: "ALLIANCE", region: "US", itemLevel: 596, score: 88.1 },
  { id: 3, name: "Jinzo", faction: "ALLIANCE", region: "US", itemLevel: 605, score: 92.7 },
  { id: 4, name: "Arthrael", faction: "ALLIANCE", region: "US", itemLevel: 589, score: 84.9 }
];

function sortPlayers(players, sortBy) {
  const copy = [...players];

  if (sortBy === "itemLevel") {
    copy.sort((a, b) => b.itemLevel - a.itemLevel);
    return copy;
  }

  if (sortBy === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }

  copy.sort((a, b) => b.score - a.score);
  return copy;
}

function getVisiblePlayers(players, factionFilter, search, sortBy) {
  const term = search.trim().toLowerCase();

  const filtered = players.filter((player) => {
    const factionMatch = factionFilter === "ALL" || player.faction === factionFilter;
    const nameMatch = term === "" || player.name.toLowerCase().includes(term);
    return factionMatch && nameMatch;
  });

  return sortPlayers(filtered, sortBy);
}

function StatsCards({ players, visibleCount }) {
  const topScore = players.reduce((max, player) => Math.max(max, player.score), 0);

  return (
    <section className="stats">
      <article className="panel">
        <p className="stat-label">Total Players</p>
        <p className="stat-value">{players.length}</p>
      </article>
      <article className="panel">
        <p className="stat-label">Visible Players</p>
        <p className="stat-value">{visibleCount}</p>
      </article>
      <article className="panel">
        <p className="stat-label">Top Score</p>
        <p className="stat-value">{topScore.toFixed(1)}</p>
      </article>
    </section>
  );
}

function FilterControls({
  factionFilter,
  sortBy,
  search,
  onFactionChange,
  onSortChange,
  onSearchChange,
  onReset
}) {
  return (
    <section className="panel stack">
      <h2>Filters</h2>
      <div className="controls-grid">
        <label>
          Faction
          <select value={factionFilter} onChange={(event) => onFactionChange(event.target.value)}>
            <option value="ALL">All</option>
            <option value="HORDE">Horde</option>
            <option value="ALLIANCE">Alliance</option>
          </select>
        </label>

        <label>
          Sort by
          <select value={sortBy} onChange={(event) => onSortChange(event.target.value)}>
            <option value="score">Highest score</option>
            <option value="itemLevel">Highest item level</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </label>

        <label>
          Search by name
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Type a character name"
          />
        </label>
      </div>

      <div className="actions">
        <button className="btn-soft" type="button" onClick={onReset}>
          Reset filters
        </button>
      </div>
    </section>
  );
}

function AddPlayerForm({ onAddPlayer }) {
  const [form, setForm] = useState({
    name: "",
    faction: "HORDE",
    region: "US",
    itemLevel: "",
    score: ""
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();

    const name = form.name.trim();
    const itemLevel = Number(form.itemLevel);
    const score = Number(form.score);

    if (!name || !Number.isFinite(itemLevel) || !Number.isFinite(score)) {
      window.alert("Please fill all fields with valid values.");
      return;
    }

    onAddPlayer({
      name,
      faction: form.faction,
      region: form.region,
      itemLevel,
      score
    });

    setForm({ name: "", faction: "HORDE", region: "US", itemLevel: "", score: "" });
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <h2>Add a Player</h2>
      <div className="add-grid">
        <label>
          Name
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
        </label>

        <label>
          Faction
          <select value={form.faction} onChange={(event) => updateField("faction", event.target.value)}>
            <option value="HORDE">Horde</option>
            <option value="ALLIANCE">Alliance</option>
          </select>
        </label>

        <label>
          Region
          <select value={form.region} onChange={(event) => updateField("region", event.target.value)}>
            <option value="US">US</option>
            <option value="EU">EU</option>
          </select>
        </label>

        <label>
          Item Level
          <input
            type="number"
            min="1"
            value={form.itemLevel}
            onChange={(event) => updateField("itemLevel", event.target.value)}
          />
        </label>

        <label>
          Score
          <input
            type="number"
            step="0.1"
            min="0"
            value={form.score}
            onChange={(event) => updateField("score", event.target.value)}
          />
        </label>
      </div>

      <div className="actions">
        <button className="btn-primary" type="submit">
          Add player
        </button>
      </div>
    </form>
  );
}

function PlayerRow({ player, index }) {
  const pillClass = player.faction === "HORDE" ? "pill horde" : "pill alliance";

  return (
    <tr>
      <td>{index + 1}</td>
      <td>{player.name}</td>
      <td>
        <span className={pillClass}>{player.faction}</span>
      </td>
      <td>{player.region}</td>
      <td>{player.itemLevel}</td>
      <td>{player.score.toFixed(1)}</td>
    </tr>
  );
}

function LeaderboardTable({ players }) {
  if (players.length === 0) {
    return (
      <section className="panel">
        <h2>Leaderboard</h2>
        <p className="empty">No players match this filter.</p>
      </section>
    );
  }

  return (
    <section className="panel stack">
      <h2>Leaderboard</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Character</th>
              <th>Faction</th>
              <th>Region</th>
              <th>Item Level</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => (
              <PlayerRow key={player.id} player={player} index={index} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function App() {
  const [players, setPlayers] = useState(initialPlayers);
  const [factionFilter, setFactionFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("score");
  const [search, setSearch] = useState("");

  const visiblePlayers = useMemo(() => {
    return getVisiblePlayers(players, factionFilter, search, sortBy);
  }, [players, factionFilter, search, sortBy]);

  function resetFilters() {
    setFactionFilter("ALL");
    setSortBy("score");
    setSearch("");
  }

  function addPlayer(newPlayer) {
    setPlayers((current) => {
      const nextId = current.reduce((max, player) => Math.max(max, player.id), 0) + 1;
      return [...current, { id: nextId, ...newPlayer }];
    });
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">React + Vite Starter</p>
        <h1>WoW Progress Competition</h1>
        <p>Same idea as the HTML version, now split into React components with state and props.</p>
      </header>

      <div className="stack">
        <StatsCards players={players} visibleCount={visiblePlayers.length} />

        <FilterControls
          factionFilter={factionFilter}
          sortBy={sortBy}
          search={search}
          onFactionChange={setFactionFilter}
          onSortChange={setSortBy}
          onSearchChange={setSearch}
          onReset={resetFilters}
        />

        <AddPlayerForm onAddPlayer={addPlayer} />
        <LeaderboardTable players={visiblePlayers} />
      </div>
    </main>
  );
}
