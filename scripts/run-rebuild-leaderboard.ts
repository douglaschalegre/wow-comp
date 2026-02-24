import { runRebuildLeaderboardJob } from "../src/jobs/rebuild-leaderboard";

async function main() {
  const result = await runRebuildLeaderboardJob();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
