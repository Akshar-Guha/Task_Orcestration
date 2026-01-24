[MTO Synchronization]
The system now supports dual-write synchronization:
1. **Primary Write**: Supabase (Postgres)
2. **Secondary Write**: GitHub -> Obsidian Vault (Markdown)

# Obsidian Structure (MTO/)
All data is consolidated under the `MTO/` directory in your vault:
- **Diary**: `MTO/Diary/YYYY/MM/YYYY-MM-DD.md`
- **Goals**: `MTO/Goals/{active|completed}/{id}.md`
- **Tasks**: `MTO/Tasks/{active|completed}/{id}.md`
- **Sleep**: `MTO/Sleep/YYYY/MM.md`

Use `SyncStatus` component to view sync health.
Credentials managed via `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`.
