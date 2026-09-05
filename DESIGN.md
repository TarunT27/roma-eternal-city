# ROMA design system

Reference: docs/images/roma-concept.png, 1536 × 1024. Full-screen playable 3D Roman city diorama, warm golden sunlight, dense terracotta roofscape, cream stone monuments, teal Tiber at left, pine hills, aqueduct at back and large amphitheatre. Real Three.js models are an intentional implementation requirement because the user asked for a 3D model game. Image-generated buildings.png is production building selector art. No raster screenshot substitutes for the interactive world.

Palette: dark olive panels #1e261b at 94% opacity; brass #c9aa65; ivory #f7ebcc; muted #b9b298. Borders 1px brass at 55%, small chamfer effect / radius 5px. Warm background #b5b79b, terracotta #b9633f, limestone #dfd0aa, river #387b7b.

Typography: Georgia serif ROMA 48px with 6px tracking, headings 20px, dock labels 16px. System sans resource labels and controls 13px. Ivory copy and brass labels.

Layout: logo upper left 28,18. 670px resource strip top center. Round settings/sound top right. 285px objective panel at left top 110. Small ROMA · 125 AD scene title center top 94. Bottom center 700px construction dock five equal items with generated art, label, gold price. Bottom-left season and speed controls. Bottom-right map, zoom, compass. Entire 3D scene is fully interactive behind semantic DOM UI. On small screens scale logo and resources, collapse objective panel via its heading, horizontally fit five 70px building options, map hidden, hints short.

Allowed primary copy: ROMA; THE ETERNAL CITY; ROMA · 125 AD; A city worthy of an empire; Grow your settlement into a thriving Roman city.; Build 3 new buildings; Reach 400 citizens; Raise happiness to 80%; REWARDS; 500; +10; BUILD YOUR CITY; Domus; Farm; Market; Baths; Temple; prices 120,80,160,200,260; SPRING · 125 AD; 1x; 2x; 3x; Drag to orbit · Scroll to zoom · Select a building to place.

Necessary functional additions: contextual placement feedback, selected building benefit, help/settings overlay, saved status, a victory keep-building state, inspection panel and Explore control for street-level walking. Gameplay initial resources 1200 denarii, 240 citizens, 180 food, 72 happiness. Three goals on panel all tracked. No fake navigation. Controls are real.
