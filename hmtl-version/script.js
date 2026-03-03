const players = [
  {
    name: "Herseter",
    faction: "HORDE",
    region: "US",
    itemLevel: 602,
    score: 91.4
  },
  {
    name: "Nadruk",
    faction: "ALLIANCE",
    region: "US",
    itemLevel: 596,
    score: 88.1
  },
  {
    name: "Jinzo",
    faction: "ALLIANCE",
    region: "US",
    itemLevel: 605,
    score: 92.7
  },
  {
    name: "Arthrael",
    faction: "ALLIANCE",
    region: "US",
    itemLevel: 589,
    score: 84.9
  }
];

const body = document.querySelector("#leaderboardBody");
const factionFilter = document.querySelector("#factionFilter");
const sortBy = document.querySelector("#sortBy");

function sortPlayers(list, mode) {
  const copy = [...list];

  if (mode === "itemLevel") {
    copy.sort((a, b) => b.itemLevel - a.itemLevel);
    return copy;
  }

  if (mode === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }

  copy.sort((a, b) => b.score - a.score);
  return copy;
}

function getVisiblePlayers() {
  const selectedFaction = factionFilter.value;
  const selectedSort = sortBy.value;

  const filtered = players.filter((player) => {
    if (selectedFaction === "ALL") {
      return true;
    }
    return player.faction === selectedFaction;
  });

  return sortPlayers(filtered, selectedSort);
}

function renderLeaderboard() {
  const visiblePlayers = getVisiblePlayers();

  body.innerHTML = "";

  visiblePlayers.forEach((player, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${player.name}</td>
      <td>${player.faction}</td>
      <td>${player.region}</td>
      <td>${player.itemLevel}</td>
      <td>${player.score.toFixed(1)}</td>
    `;

    body.appendChild(row);
  });
}

factionFilter.addEventListener("change", renderLeaderboard);
sortBy.addEventListener("change", renderLeaderboard);

renderLeaderboard();
