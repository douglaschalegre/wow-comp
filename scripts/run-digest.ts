import {
  digestJobUsage,
  parseSnapshotDateArg,
  runDigestJob,
  type DigestRunOptions
} from "../src/jobs/digest";

function parseArgs(argv: string[]): DigestRunOptions & { help?: boolean } {
  const options: DigestRunOptions & { help?: boolean } = {
    mode: "preview"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--send") {
      options.mode = "send";
      continue;
    }

    if (arg.startsWith("--snapshot-date=")) {
      options.snapshotDate = parseSnapshotDateArg(arg.slice("--snapshot-date=".length));
      continue;
    }

    if (arg === "--snapshot-date") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --snapshot-date. Expected YYYY-MM-DD.");
      }
      options.snapshotDate = parseSnapshotDateArg(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(digestJobUsage());
    return;
  }

  const result = await runDigestJob(options);

  console.log(
    JSON.stringify(
      {
        snapshotDate: result.snapshotDate,
        variant: result.variant,
        status: result.status,
        deliveryId: result.deliveryId ?? null,
        telegramMessageId: result.telegramMessageId ?? null,
        pollSummary: result.pollSummary ?? null,
        warningLines: result.warnings.length,
        messageLength: result.text.length
      },
      null,
      2
    )
  );
  console.log("");
  console.log(result.text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
