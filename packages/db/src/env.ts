export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    console.error('DATABASE_URL is missing or not a postgres:// URL. See .env.example.');
    process.exit(1);
  }
  return url;
}
