# Responsive Layout Fix Evidence

## Textarea horizontal resize fix

`textarea-comparisons.html` contains all 16 representative before/after pairs.
The affected locations are square post body, pitch idea, script reading,
viral-content breakdown, branch JSON, trending content and angle, branch main
story and choice, source adaptation text, feedback content, listing sample,
and runtime character persona/signature lines, prop meaning, and scene meaning.
Interview answers also inherited two-axis resizing; their flex layout prevented
horizontal growth in the simulation, so they are checked but not shown as an
overflow case. Admin and multi-version fields already used vertical resizing.

The global textarea rule now uses `resize: vertical`, `max-width: 100%`, and
`box-sizing: border-box`. Subpanels use `min-width: 0` to avoid widening grid
tracks under oversized-content pressure. These rules also constrain newly
inserted textareas.

The textarea images use a 1440 x 900 viewport. The test assigns the equivalent
post-resize dimensions (+120px width, +60px height), because CDP mobile
emulation does not activate the native desktop resize handle. These are
dimension simulations, not screenshots of native mouse dragging. Before CSS
is reconstructed by removing only these two changes from the served stylesheet;
production files are not reverted. Dynamic editors use test API responses and
do not write to real accounts or the database. Red outlines mark each textarea.

The browser checks cover static and runtime textareas, plus 1440, 1024, 390,
and 320 pixel viewport widths with a forced 2000px field width. Regenerate:

```powershell
$env:LAYOUT_SCREENSHOTS = Join-Path (Get-Location) 'docs/layout-fixes'
$env:LAYOUT_PHASE = 'before'
$env:TEXTAREA_LEGACY = '1'
node --test --test-name-pattern='captures representative' test/web-responsive-layout.test.cjs
Remove-Item Env:TEXTAREA_LEGACY
$env:LAYOUT_PHASE = 'after'
node --test test/web-responsive-layout.test.cjs
Remove-Item Env:LAYOUT_PHASE, Env:LAYOUT_SCREENSHOTS
```

## Earlier responsive fixes

The comparison images use a 390 x 844 Chrome viewport. The left side uses the
previous CSS rules, reconstructed by removing only the styles introduced by this
fix. The right side renders the current workspace source. Red rectangles mark
the affected controls. No real account, payment, or generation request is used.

- `comparison-workbench-390.png`: navigation covered the workbench back button.
- `comparison-checkbox.png`: feedback checkbox occupied a full-width input row.
- `comparison-floating.png`: the floating assistant covered the mode-card arrow.

Run the layout checks with Node.js and a locally installed Chrome:

```powershell
node --test test/web-responsive-layout.test.cjs
```

Set `CHROME_PATH` when Chrome is not in its default Windows installation path.
The browser tests are skipped when Chrome is unavailable.

To regenerate the images, first capture the legacy CSS, then the current source:

```powershell
$env:LAYOUT_SCREENSHOTS = Join-Path (Get-Location) 'docs/layout-fixes'
$env:LAYOUT_PHASE = 'before'
$env:LAYOUT_LEGACY = '1'
node --test test/web-responsive-layout.test.cjs
# The legacy run intentionally fails the three original regression checks.
Remove-Item Env:LAYOUT_LEGACY
$env:LAYOUT_PHASE = 'after'
node --test test/web-responsive-layout.test.cjs
Remove-Item Env:LAYOUT_PHASE, Env:LAYOUT_SCREENSHOTS
```
