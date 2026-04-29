-- This seed only works after Prisma migrations have created the public tables
-- in the same Supabase database you are targeting.
insert into public."Location" (name, latitude, longitude, "createdAt", "updatedAt")
values ('Barcelona', 41.3874, 2.1686, now(), now())
on conflict (name) do nothing;