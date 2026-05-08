# Bolt's Journal

## 2024-05-23 - Composite Index for Playlist Thumbnails
**Learning:** SQLite query optimizer needs explicit composite indexes for `WHERE x = ? ORDER BY y` clauses to avoid in-memory sorting, especially when used in correlated subqueries.
**Action:** Always check `ORDER BY` clauses in frequently run queries (like startup routines) and ensure covering indexes exist.
