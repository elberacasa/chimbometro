export function requireKey(): string {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) {
    console.error("TYPESAFE_API_KEY is missing. Copy .env.example to .env and add your key.");
    process.exit(1);
  }
  return key;
}
