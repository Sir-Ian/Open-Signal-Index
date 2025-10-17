import 'dotenv/config';

export async function runSummaryJob() {
  console.log(JSON.stringify({ level: 'info', msg: 'Summarizer job stubbed for now.' }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSummaryJob().catch((error) => {
    console.error(JSON.stringify({ level: 'error', msg: 'Summary job failed', error: `${error}` }));
    process.exitCode = 1;
  });
}
