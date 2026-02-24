import { runPollJob } from "../src/jobs/poll";

async function main() {
  const result = await runPollJob();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
