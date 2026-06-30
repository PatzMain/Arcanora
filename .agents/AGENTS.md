# Arcanora Project Rules

## Discord Component Custom IDs
When defining button, select menu, or modal custom IDs and their respective handlers:
1. **Ensure Strict Formatting Alignment**: Always format custom IDs using `_` as a delimiter (e.g., `prefix_action_userId_param1_param2`).
2. **Index Verification**: Double check that the index offsets used in the handler to extract metadata (e.g. `parts[2]` for `userId`) align exactly with the tokens defined in `customId`.
3. **Avoid Redundant Delimiter Tokens**: Do not include extra descriptive words in custom IDs (e.g., using `inspect_select` instead of `inspect`) that would offset the index matching unless the handler is explicitly coded to expect them.
