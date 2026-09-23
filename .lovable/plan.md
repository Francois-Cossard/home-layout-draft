# Finish Planche and add reusable furniture

## Outcome
Complete the existing floor-plan editor and verify its core drawing and export flows. Add persistent wall-length annotations, conventional structural/drywall wall graphics, and a reusable furniture-symbol workflow built from lines, rectangles, and circles.

## Changes

### Wall drafting and representation
- Replace the current interior/exterior wall choice with **Structural** and **Drywall**.
- Render structural walls as a conventional heavy solid wall and drywall as two lighter parallel faces with appropriate drafting treatment.
- Show each wall’s length offset on one consistent side, aligned with the wall like an AutoCAD dimension, while drawing and after placement.
- Keep wall length and thickness editable from the properties panel.
- Apply the same wall graphics and wall dimensions to project thumbnails and vector PDF exports.

### Furniture builder and library
- Add a **Furniture** tool to the editor toolbar.
- Provide a furniture library panel containing saved symbols and an action to create a new symbol.
- Add a focused symbol builder where users draw simple **lines, rectangles, and circles**, name the furniture, preview it, and save it locally.
- Persist the furniture library across browser sessions.
- Let users choose a saved furniture item, place it on the plan, select it, move it, duplicate it, delete it, and adjust its rotation.
- Persist furniture placements inside each project and include them in thumbnails and vector PDF exports.

### Compatibility and completion
- Migrate existing saved plans safely: interior walls become drywall, exterior walls become structural, and missing furniture data defaults to empty.
- Remove unsafe assumptions found in the existing editor while extending selection, history, undo/redo, and deletion behavior for furniture.
- Preserve local-only storage; no account or cloud setup is introduced.

## Verification
- Check that the app loads without browser errors on the projects page and editor.
- Exercise wall drawing, one-sided wall dimensions, both wall styles, door/window placement, furniture creation, saving, placement, moving, duplication, deletion, undo/redo, and persistence after reload.
- Export a PDF and verify furniture, openings, wall conventions, and dimensions remain vector graphics.
- Check the editor at desktop size and confirm the existing small-screen view-only behavior remains intact.

## Technical details
- Extend the project schema with furniture definitions, primitive geometry, and placed furniture instances.
- Store reusable furniture definitions under a versioned localStorage key and migrate project payloads during load.
- Centralize geometry helpers for offset dimensions and furniture transforms so canvas, thumbnails, and PDF output stay consistent.
- Keep the existing TanStack Start routes and drafting-table visual system.
