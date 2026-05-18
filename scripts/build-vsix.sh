#!/bin/bash
# scripts/build-vsix.sh — Build VSIX extension from current branch for testing
# Usage: ./scripts/build-vsix.sh [--vsix-name <name>] [--vsix-version <version>]
# Output: ./dist/<name>-<version>.vsix (relative to repo root)
#
# Examples:
#   # Default: ./dist/openchamber-1.11.2-local-<sha>.vsix
#   ./scripts/build-vsix.sh
#
#   # Custom version
#   ./scripts/build-vsix.sh --vsix-version "1.11.2-editable-subagents"
#
#   # Custom output dir (overrides default)
#   ./scripts/build-vsix.sh --output-dir ~/Downloads

set -e

VSIX_NAME="openchamber"
VSIX_VERSION="1.11.2-local-$(git rev-parse --short HEAD)"

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

# Default output: ./dist relative to repo root
OUTPUT_DIR="${OUTPUT_DIR:=$REPO_ROOT/dist}"

if [ ! -f package.json ]; then
  echo "ERROR: Not in repo root with package.json at $REPO_ROOT" >&2
  exit 1
fi

echo "[BUILD] Building VSIX extension..."
echo "   Name:     $VSIX_NAME"
echo "   Version:  $VSIX_VERSION"  
echo "   Output:   $OUTPUT_DIR"
echo "   Branch:   $(git name-rev-reflog --disambiguate HEAD 2>/dev/null | cut -d' ' -f1 || git branch --show-current)"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Update version temporarily if requested (target vscode package.json)
VERSION_CHANGED=false
if [ "${VSIX_VERSION//[-0-9]/}" != "$VSIX_VERSION" ] || [[ "$VSIX_VERSION" == *"local"* ]]; then
  OLD_VERSION=$(jq -r '.version' packages/vscode/package.json)
  jq --arg v "$VSIX_VERSION" '.version = $v' packages/vscode/package.json > /tmp/package.tmp && mv /tmp/package.tmp packages/vscode/package.json
  echo "   [Temp] Set packages/vscode/package.json version to $VSIX_VERSION (was $OLD_VERSION)"
  VERSION_CHANGED=true
fi

# Ensure .env is ignored (add to .vscodeignore if not present)
VSCODE_IGNORE="$REPO_ROOT/packages/vscode/.vscodeignore"
if [ -f "$VSCODE_IGNORE" ] && ! grep -q '^\.env$' "$VSCODE_IGNORE" 2>/dev/null; then
  echo ".env" >> "$VSCODE_IGNORE"
fi

# Build VSIX using @vscode/vsce (assumed installed via npm/yarn globally or in repo)
VSX_EXEC="npx --yes vsce"
if ! $VSX_EXEC --version &>/dev/null; then
  echo "   [Warn] 'npx vsce' not found, trying alternate..." >&2
  VSX_EXEC="vsce"
fi

BUILD_CMD="$VSX_EXEC package"
BUILD_FLAGS="--out $OUTPUT_DIR --no-dependencies"

if [[ "$VSIX_NAME" != "openchamber" ]]; then
  BUILD_FLAGS="$BUILD_FLAGS --name $VSIX_NAME"
fi

# Change to vscode package directory for build
cd "$REPO_ROOT/packages/vscode" || exit 1

echo "   Running: $BUILD_CMD $BUILD_FLAGS" >&2
$BUILD_CMD $BUILD_FLAGS || {
  echo "   [Warn] Package build had warnings or errors" >&2
}

# Restore version if we changed it (still in vscode package dir)
if [ "$VERSION_CHANGED" = true ]; then
  jq --arg v "$OLD_VERSION" '.version = $v' package.json > /tmp/package.tmp && mv /tmp/package.tmp package.json
  echo "   [Temp] Restored packages/vscode/package.json version to $OLD_VERSION"
fi

# Find built file
VSIX_FILE=$(find "$OUTPUT_DIR" -maxdepth 1 -name "${VSIX_NAME:-openchamber}-*.vsix" -type f | head -1)
if [ -f "$VSIX_FILE" ]; then
  echo "[OK] Built: $VSIX_FILE"
else
  echo "[WARN] VSIX file not found in $OUTPUT_DIR (check build logs above)" >&2
  exit 0
fi

echo "[INFO] To install: Code --install-extension \"$VSIX_FILE\""
