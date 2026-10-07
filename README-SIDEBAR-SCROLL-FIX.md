# Bellroy Admin Sidebar Scroll Fix

## v34

Fixed the desktop admin sidebar disappearing/background ending while the main page is scrolled.

### Changes
- Desktop sidebar is now fixed to the viewport from top to bottom.
- Sidebar has its own vertical scrolling when navigation items exceed viewport height.
- Main admin content gets a 240px left offset on desktop.
- Mobile behavior remains a fixed off-canvas sidebar with 260px width.
- Prevents sidebar navigation from visually overflowing into the page content.

### Files changed
- `src/app/admin.css`
