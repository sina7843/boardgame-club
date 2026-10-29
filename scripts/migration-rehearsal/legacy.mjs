// Fills the pre-0021 scratch database with realistic legacy rows (tournaments in every state) and dumps them for comparison.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const postgres = require('postgres');
const sql = postgres(process.argv[2], { max: 1 });
const mode = process.argv[3];
if (mode === 'seed') {
  const u = await sql`insert into users (display_name) select 'player ' || g from generate_series(1, 6) g returning id`;
  await sql`insert into games (id, name_fa, name_original, search_text, summary_fa, rules_fa, min_players, max_players, min_minutes, max_minutes, difficulty, access, paces, competitions, is_test_game, timeout_policy_fa, resign_policy_fa, tutorial_fa)
    values ('chess','شطرنج','Chess','chess','x','{}'::jsonb,2,2,10,60,'medium','free','{live,turn}','{friendly,ranked}',false,'x','x','x')`;
  const [gv] = await sql`insert into game_versions (game_id, rules_version, state_schema_version, client_bundle_ref, assets_ref, manifest, status) values ('chess','1',1,'chess@1','a','{}'::jsonb,'active') returning id`;
  for (const [i, st] of ['open', 'running', 'finished', 'cancelled'].entries()) {
    const [t] = await sql`insert into tournaments (game_id, title_fa, format, pace, turn_seconds, table_size, min_entrants, max_entrants, starts_at, entry_kind, created_by, status)
      values ('chess', ${'جام ' + st}, 'swiss', 'live', 60, 2, 2, 32, now() - (${i} || ' days')::interval, 'free', ${u[0].id}, ${st}) returning id`;
    for (const x of u.slice(0, 4)) await sql`insert into tournament_entries (tournament_id, user_id) values (${t.id}, ${x.id})`;
    const [gt] = await sql`insert into game_tables (game_id, game_version_id, pace, competition, visibility, status, host_id, capacity) values ('chess', ${gv.id}, 'live', 'ranked', 'public', ${st === 'running' ? 'active' : 'finished'}, ${u[0].id}, 2) returning id`;
    await sql`insert into tournament_tables (table_id, tournament_id, round, seats) values (${gt.id}, ${t.id}, 1, '[]'::jsonb)`;
  }
}
const dump = {};
for (const t of ['users', 'tournaments', 'tournament_entries', 'tournament_tables', 'game_tables']) dump[t] = (await sql.unsafe(`select count(*)::int n from ${t}`))[0].n;
dump.fingerprint = (await sql`select md5(string_agg(t::text, '|' order by id)) h from (select id, title_fa, status, starts_at, min_entrants, max_entrants from tournaments) t`)[0].h;
dump.entries = (await sql`select md5(string_agg(e::text, '|' order by tournament_id, user_id)) h from (select tournament_id, user_id, status from tournament_entries) e`)[0].h;
console.log(JSON.stringify(dump));
await sql.end();
