const path = require("node:path");
const { createDataSnapshot, ensureDataFiles } = require("../server");

async function main() {
  const label = process.argv[2] || "manual";
  await ensureDataFiles();
  const snapshot = await createDataSnapshot(label);
  const relativeDirectory = path.relative(process.cwd(), snapshot.directory) || snapshot.directory;

  console.log(`Backup created: ${relativeDirectory}`);
  console.log(`Files: ${snapshot.files.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
