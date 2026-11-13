ALTER TABLE "game_tables" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_code_unique" UNIQUE("code");--> statement-breakpoint
-- Short table codes for /t/<code> links: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L; 31^6 ≈ 887M
-- codes), retried on collision; after 50 tries it widens to 8 characters. Filled on insert so no caller has to know about it.
CREATE OR REPLACE FUNCTION game_table_code() RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  len int := 6;
  c text;
BEGIN
  FOR attempt IN 1..100 LOOP
    IF attempt > 50 THEN len := 8; END IF;
    c := '';
    FOR i IN 1..len LOOP
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM game_tables WHERE code = c) THEN RETURN c; END IF;
  END LOOP;
  RAISE EXCEPTION 'game_table_code: no free code';
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION game_tables_set_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL THEN NEW.code := game_table_code(); END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER game_tables_code BEFORE INSERT ON game_tables FOR EACH ROW EXECUTE FUNCTION game_tables_set_code();--> statement-breakpoint
-- Backfill one row per statement so each new code sees the ones assigned before it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM game_tables WHERE code IS NULL LOOP
    UPDATE game_tables SET code = game_table_code() WHERE id = r.id;
  END LOOP;
END $$;
