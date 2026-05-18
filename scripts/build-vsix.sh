#!/bin/bash
# scripts/build-vsix.sh — Build VSIX extension from current branch for testing
# Usage: ./scripts/build-vsix.sh [--vsix-name <name>] [--vsix-version <version>]
# Output: ~/Downloads/<name>-<version>.vsix (or specified output dir)

set -e

VSIX_NAME="openchamber"
VSIX_VERSION="1.11.2-local-$(git rev-parse --short HEAD)"
OUTPUT_DIR="$HOME/Downloads"

while [[ $# -gt 0 ]]; do
  case $1 in
    --vsix-name)
      VSIX_NAME="$2"
      shift 2
      ;;
    --vsix-version)
      VSIX_VERSION="$2"
      shift 2
      ;;
    --output-dir|--output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Determine working directory (repo root)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

if [ ! -f package.json ]; then
  echo "ERROR: Not in repo root with package.json at $REPO_ROOT" >&2
  exit 1
fi

echo "🔨 Building VSIX extension..."
echo "   Name:     $VSIX_NAME"
echo "   Version:  $VSIX_VERSION"  
echo "   Output:   $OUTPUT_DIR"
echo "   Branch:   $(git name-rev-reflog --disambiguate HEAD 2>/dev/null | cut -d' ' -f1 || git branch --show-current)"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Update version temporarily if requested
if [ "${VSIX_VERSION//[-0-9]/}" != "$VSIX_VERSION" ] || [[ "$VSIX_VERSION" == *"local"* ]]; then
  OLD_VERSION=$(jq '.version' package.json)
  jq --arg v "$VSIX_VERSION" '.version = $v' package.json > /tmp/package.tmp && mv /tmp/package.tmp package.json
  echo "   [Temp] Set package.json version to $VSIX_VERSION (was $OLD_VERSION)"
fi

# Build VSIX using @vscode/vsce (assumed installed via npm/yarn globally or in repo)
VSX_EXEC="npx --yes vsce"
if ! $VSX_EXEC --version &>/dev/null; then
  echo "   [Warn] 'npx vsce' not found, trying alternate..." >&2
  VSX_EXEC="vsce"
fi

BUILD_CMD="$VSX_EXEC package"
BUILD_FLAGS="--outputDirectory \"$OUTPUT_DIR\""

if [[ "$VSIX_NAME" != "openchamber" ]]; then
  BUILD_FLAGS="$BUILD_FLAGS --name $VSIX_NAME"
fi

echo "   Running: $BUILD_CMD $BUILD_FLAGS" >&2
$BUILD_CMD $BUILD_FLAGS --allow-star-as-file-dependency || {
  echo "   [Warn] Package build had warnings or errors" >&2
}

# Restore version if we changed it
if [ "${VSIX_VERSION//[-0-9]/}" != "$VSIX_VERSION" ] || [[ "$VSIX_VERSION" == *"local"* ]]; then
  jq --arg v "$OLD_VERSION" '.version = $v' package.json > /tmp/package.tmp && mv /tmp/package.tmp package.json
  echo "   [Temp] Restored package.json version to $OLD_VERSION"
fi

# Find built file
VSIX_FILE=$(find "$OUTPUT_DIR" -maxdepth 1 -name "${VSIX_NAME:-openchamber}-*.vsix" -type f | head -1)
if [ -f "$VSIX_FILE" ]; then
  echo "✅ Built: $VSIX_FILE"
else
  echo "⚠️  VSIX file not found in $OUTPUT_DIR (check build logs above)" >&2
  exit 0
fi

echo "📦 To install: Code --install-extension \"$VSIX_FILE\""