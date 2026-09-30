#!/bin/sh
# Baut tailwind.css neu (nach HTML/JS-Änderungen mit neuen Tailwind-Klassen).
# Voraussetzung: npx tailwindcss v3 (npm i -D tailwindcss@3)
cat > /tmp/tw-input.css <<'INPUT'
@tailwind base;
@tailwind components;
@tailwind utilities;
INPUT
npx tailwindcss -i /tmp/tw-input.css -o tailwind.css --minify
echo "tailwind.css aktualisiert."
