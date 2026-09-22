-- Backfill lat/lng for the curated MVP destinations (schema.sql seeded them
-- as NULL). Run in Supabase SQL Editor. Needed by the weather collector
-- agent (Open-Meteo requires latitude/longitude).

update destinations set lat = 40.7128, lng = -74.0060 where name = 'New York';
update destinations set lat = 34.0522, lng = -118.2437 where name = 'Los Angeles';
update destinations set lat = 43.6532, lng = -79.3832 where name = 'Toronto';
update destinations set lat = 28.6139, lng = 77.2090 where name = 'Delhi';
update destinations set lat = 19.0760, lng = 72.8777 where name = 'Mumbai';
update destinations set lat = 51.5074, lng = -0.1278 where name = 'London';
update destinations set lat = 48.8566, lng = 2.3522 where name = 'Paris';
update destinations set lat = -33.8688, lng = 151.2093 where name = 'Sydney';
update destinations set lat = -23.5505, lng = -46.6333 where name = 'São Paulo';
update destinations set lat = -34.6037, lng = -58.3816 where name = 'Buenos Aires';
