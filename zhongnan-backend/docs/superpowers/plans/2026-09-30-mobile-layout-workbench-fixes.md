# Mobile Layout And Workbench Fixes Implementation Plan

> **For agentic workers:** Implement inline in this session. Sub-agent execution is disabled for this task.

**Goal:** Remove the confirmed mobile layout crowding and workbench overlap defects, with repeatable browser checks and before/after screenshots.

**Architecture:** Keep the existing single-page application and CSS system. Enforce workbench mutual exclusion in `app.js`, calculate its top inset from the navigation's visible geometry, and make the assistant leave the workbench hit area. Replace the mobile card gutter workaround with a compact two-row header and full-width content rules.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node.js test runner, Chrome DevTools Protocol browser tests.

**Spec:** `C:/Users/Administrator/.codex/visualizations/2026/09/30/01a0f05c-3c45-74d2-b392-a080fe892422/layout-audit/report.md`

## Global Constraints

- Preserve existing themes, IDs, classes, and user workflows.
- Do not invoke paid generation, publishing, purchasing, or persistent data writes.
- Verify 320px, 390px, 1024px, and 1440px viewports.
- Preserve the existing textarea and form-spacing fixes.

---

### Task 1: Workbench State And Obstruction

**Files:**
- Modify: `web/app.js`
- Modify: `web/styles.css`
- Test: `test/web-workbench-navigation.test.cjs`
- Test: `test/web-responsive-layout.test.cjs`

- [x] **Step 1: Add failing tests** for single-panel visibility, assistant removal, and scrolled mobile top inset.
- [x] **Step 2: Run the tests and confirm failure** against the current implementation.
- [x] **Step 3: Make `openWorkbench` and its observer display entry hide all non-target panels**, sync the inset from visible navigation geometry, and hide the assistant while open.
- [x] **Step 4: Run focused workbench tests** and verify tool opening, closing, and cross-view navigation.

### Task 2: Mobile Layout Hierarchy

**Files:**
- Modify: `web/styles.css`
- Modify: `web/app.js`
- Test: `test/web-responsive-layout.test.cjs`

- [x] **Step 1: Add failing browser assertions** for header height, control hit size, single-line navigation, compact headings, full-width cards, and readable copy.
- [x] **Step 2: Replace the three-row wrapping header** with a compact top row plus horizontally scrollable one-line navigation.
- [x] **Step 3: Stack simple section subtitles below headings**, keep eyebrows intrinsic, remove the 64px grid gutter, and raise long copy to 14px on mobile. Tool fees use a separate information row; narrow English headings wrap.
- [x] **Step 4: Give the free plan a meaningful footer state** instead of an em dash, and keep its natural content height.
- [x] **Step 5: Run the responsive browser suite** at all four target widths.

### Task 3: Visual Evidence And Final Verification

**Files:**
- Create: `docs/layout-fixes/layout-audit-after/*.png`
- Create: `docs/layout-fixes/layout-audit-after/index.html`

- [x] **Step 1: Capture after screenshots** for the mobile home, VIP, tool cards, workbench, and desktop VIP views.
- [x] **Step 2: Compose six labeled before/after comparison images** using the preserved audit screenshots.
- [x] **Step 3: Run focused tests, typecheck, and build**, then inspect screenshots for overflow or occlusion. 164 related tests passed; five tools checked on mobile and desktop; 20 public view/viewport combinations had no document overflow. Gallery loaded all 17 images at 390px and 1440px.
- [x] **Step 4: Report the local URL, fixed locations, limitations, and embedded comparison images.** Delivery accompanies this completed checklist. Service recovered at the default demo port 8099 after interruption; HTTP 200 verified. Authorized generation results, private Works details, and admin pages remain outside real-login verification.
