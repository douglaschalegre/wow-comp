import { runDailyInvocation } from "../src/jobs/daily-invocation";

interface CliOptions {
  dryRun: boolean;
  help: boolean;
}

function usage(): string {
  return [
    "Usage: npm run job [-- --dry-run]",
    "",
    "Options:",
    "  --dry-run, --dryRun  Run digest in preview mode (poll still writes to DB)",
    "  --help, -h           Show this help"
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    help: false
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--dry-run" || arg === "--dryRun") {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const execution = await runDailyInvocation({ dryRun: options.dryRun });

  if (execution.logLevel === "info") {
    console.log(execution.logPayload);
  } else {
    console.error(execution.logPayload);
  }

  console.log(JSON.stringify(execution.body, null, 2));

  if (execution.statusCode !== 200) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
