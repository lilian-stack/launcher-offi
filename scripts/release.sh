#!/bin/bash

set -e

REPO="lilian-stack/launcher-offi"
TAG="v1.0.4"
NAME="Actoris Launcher $TAG"
EXE_FILE="./release/Actoris-Setup-1.0.4.exe"
BLOCKMAP_FILE="./release/Actoris-Setup-1.0.4.exe.blockmap"
LATEST_YML="./release/latest.yml"
PATCH_FILE="./PATCH_NOTES_1.0.4.md"

if [ -n "$1" ]; then
    NOTES="$1"
    echo "📝 Patch notes reçus via argument."
elif [ -f "$PATCH_FILE" ]; then
    echo "📝 Patch notes trouvés dans $PATCH_FILE."
    NOTES=$(cat "$PATCH_FILE")
else
    echo "📝 Aucun patch note trouvé."
    echo "Entrez votre patch note (finissez par CTRL+D) :"
    NOTES=$(</dev/stdin)
fi

if [ -z "$NOTES" ]; then
    echo "❌ Impossible de publier une release sans patch notes."
    exit 1
fi

for f in "$EXE_FILE" "$BLOCKMAP_FILE" "$LATEST_YML"; do
    if [ ! -f "$f" ]; then
        echo "❌ Fichier introuvable : $f"
        exit 1
    fi
done

echo "🏷  Création du tag $TAG..."
git tag -f "$TAG"
git push -f origin "$TAG"

echo "🚀 Création de la release GitHub..."
RELEASE_ID=$(gh release create "$TAG" \
  --repo "$REPO" \
  --title "$NAME" \
  --notes "$NOTES" \
  --latest \
  --json id \
  --jq '.id')

echo "📦 Release ID : $RELEASE_ID"

echo "⬆️  Upload des fichiers..."

gh release upload "$TAG" \
  "$EXE_FILE" \
  "$BLOCKMAP_FILE" \
  "$LATEST_YML" \
  --repo "$REPO" \
  --clobber

echo "🎉 Release $TAG publiée avec patch notes et upload complet !"