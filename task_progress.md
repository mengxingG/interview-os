# Task Progress: 90s 流程整合功能修复

- [x] Analyze codebase and identify issues
- [ ] Step 1: Fix button click event - update COMPRESS_90S_PROMPT and ensure it triggers useChat send
- [ ] Step 2: Add useEffect to auto-detect ### ⏱️ 90秒口述版本 and open preview modal
- [ ] Step 3: Update preview modal "确认同步" button to call /api/story/sync with type: '90s_oral'
- [ ] Step 3b: Update backend /api/story/sync to handle type: '90s_oral' and wrap as callout block
- [ ] Step 4: Ensure toast notifications and loading state reset on sync success/failure
