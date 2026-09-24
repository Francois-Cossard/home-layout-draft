# HomeLayout Studio

Build a simple web app for drawing 2D floor plans of apartments and houses.

Target user: homeowners, renters, and small renovation projects who want to sketch room layouts quickly without CAD software.

Core outcome: users can draw walls, add rooms, insert doors/windows, and export their floor plan as a vector PDF.

DATA MODEL:

- Project: id, name, created_at, updated_at

- Wall: id, project_id, start_x, start_y, end_x, end_y, thickness, wall_type (interior/exterior)

- Room: id, project_id, name, area, center_x, center_y

- Door: id, project_id, wall_id, position_along_wall, width, swing_direction

- Window: id, project_id, wall_id, position_along_wall, width

SCREENS:

1. Home/Dashboard — list of saved projects with thumbnails, "New Project" button, search by name

2. Plan Editor — main canvas with:

   - Toolbar: wall tool, room tool, door tool, window tool, select/move tool, dimension tool, undo/redo

   - Canvas: grid background (50cm or 1ft), snap-to-grid for walls

   - Properties panel: selected element properties (length, thickness, type)

   - Export button: "Export PDF" (vector, A4/A3, scale 1:50 or 1:100)

3. Project Settings — project name, default scale, units (metric/imperial)

CORE WORKFLOW:

User creates new project → draws walls by clicking start/end points → adds doors/windows by clicking on walls → labels rooms → exports as vector PDF.

DESIGN & UX:

- Clean, minimal interface with sidebar navigation

- Canvas uses HTML5 Canvas or SVG for crisp vector rendering

- Grid shows 50cm increments with thicker lines every meter

- Walls snap to 10cm increments

- Selected elements show handles for resizing

- Right-click context menu for delete/duplicate

- Keyboard shortcuts: Delete, Ctrl+Z (undo), Ctrl+Y (redo), Esc (deselect)

PDF EXPORT:

- Use jsPDF or pdfkit to generate vector PDF

- Export walls, doors, windows as vector paths (not raster)

- Include scale bar and project name in footer

- Default paper size: A4, orientation auto (portrait/landscape based on plan bounds)

- Scale options: 1:50, 1:100, fit to page

TECHNICAL:

- Frontend: React + TypeScript, SVG or Canvas for drawing

- PDF generation: jsPDF with svg2pdf or pdfkit for vector output

- No backend required for v1 (localStorage for saving projects)

- Responsive: desktop-first, tablet usable, mobile view-only

SAMPLE DATA:

Include 2 demo projects: "Studio 25m²" (one room, one door, two windows) and "T3 Apartment" (living room, 2 bedrooms, kitchen, bathroom).

ACCEPTANCE CRITERIA:

- Can draw a rectangular room with 4 walls

- Can add a door that creates an opening in the wall

- Can add a window embedded in a wall

- Exported PDF shows walls as solid lines, doors as arcs, windows as embedded rectangles

- PDF is vector (lines remain crisp when zoomed in Acrobat)

- Projects persist in localStorage across browser sessions

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b0d389ae-ac7a-4f64-9718-18017b91ab3a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
