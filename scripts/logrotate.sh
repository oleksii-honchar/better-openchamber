#!/usr/bin/env bash
# OpenChamber log rotation — mmm1 (launchd label: com.mmm1.openchamber-logrotate)
# Bounded growth for the three log locations the stack writes. WITHOUT root,
# WITHOUT restarting anything, and NEVER by renaming a live file: launchd and the
# app hold fds, so every rotation is copy-and-truncate; the live file's inode
# must survive (verified mechanically by --self-test with a held-fd write).
#
# Usage: scripts/logrotate.sh [--self-test | --status]
# (no args)    Run one rotation cycle over the three sets, then exit 0.
# --self-test  Ephemeral fixture under mktemp -d (fake HOME layout) covering:
#              under-cap noop · over-cap copy-truncate (ARCHIVE + TRUNCATE +
#              same-inode verified) · fd-held proof (open fd BEFORE rotation,
#              append after through it, bytes must land in the same file) ·
#              copy-failure safety (no truncate, file unchanged) · dated-file
#              policy (aged→gzipped, 30d→deleted, fresh→untouched) · self-log
#              cap · --status shape. Prints CASE ... PASS/FAIL and a final
#              SELF-TEST: PASS/FAIL. Writes nothing outside its $TMPDIR fixture.
# --status     One screen: policy summary, size vs cap per target, last log
#              line. Never prints file contents or secrets.
#
# Policy (defaults; byte caps; all env-overridable — REQUIRED for --self-test):
#   LXD_LOGDIR       (~/Library/Logs/OpenChamber)   service.err.log     copy-truncate
#   OC_CONFIG_LOGDIR (~/.config/openchamber/logs)   *.log               copy-truncate
#   OC_DATA_LOGDIR   (~/.local/share/opencode/log)  dev.log             copy-truncate
#                                                     <ISO>.log(.gz)      age policy
#   copy-truncate: file over MAX_BYTES → drop .3, shift .2→.3 and .1→.2
#     (both moved archives end compressed), cp current → .1 and gzip .1 at
#     once (retention: .1.gz .2.gz .3.gz — the install acceptance names the
#     fresh .1.gz, so the newest archive is compressed at creation), then
#     truncate current IN PLACE (`: >` — same inode, the holder's fd stays
#     valid). A failed archive copy means NO truncate: the live file is never
#     shortened without a copy.
#   age policy (dated files are retired, never truncated): older than KEEP_DAYS
#     by last-write mtime → gzip (never touching an existing .gz); older than
#     DELETE_DAYS → delete. mtime (not the ISO name) ages the file: an ISO-named
#     log here was observed STILL OPEN by the app (2026-11-09, lsof) —
#     name-based aging would gzip a live writer away and orphan every later
#     write on the unlinked inode.
#   Bookkeeping: own log at $LXD_LOGDIR/logrotate.log — UTC ISO lines, no
#   secrets, self-capped (truncate) past SELF_LOG_MAX_BYTES. ~/Library/Logs/
#   icm-olho (ICM engine logs) is a different contract: never touched, and
#   nothing outside the three sets above is managed.
#
# launchd entry: scripts/com.mmm1.openchamber-logrotate.plist — expand-at-install
# (@@USER_HOME@@ → $HOME via sed), same convention as the com.mmm1.icm-sync
# plist install. macOS host tooling only (BSD stat/touch/date -v).

set -euo pipefail

# ---------------------------------------------------------------- configuration
MAX_BYTES="${MAX_BYTES:-5242880}"                  # 5 MiB per live log
SELF_LOG_MAX_BYTES="${SELF_LOG_MAX_BYTES:-524288}" # 512 KiB cap for logrotate.log
KEEP_DAYS="${KEEP_DAYS:-14}"                       # dated files: gzip past
DELETE_DAYS="${DELETE_DAYS:-30}"                   # dated files: delete past
DAY=86400

LXD_LOGDIR="${LXD_LOGDIR:-$HOME/Library/Logs/OpenChamber}"
OC_CONFIG_LOGDIR="${OC_CONFIG_LOGDIR:-$HOME/.config/openchamber/logs}"
OC_DATA_LOGDIR="${OC_DATA_LOGDIR:-$HOME/.local/share/opencode/log}"

# Set 1 is exactly service.err.log — the launchd-captured err stream of the
# RUNNING com.mmm1.openchamber job. Everything else in LXD_LOGDIR apart from
# logrotate.log itself stays untouched.
LXD_SET_FILE="service.err.log"
OC_DATA_HELD_FILE="dev.log"                        # append-only stream the app holds

SELF_LOG=""    # per-run, set at cycle entry
ERRORS_SEEN=0  # soft failures this cycle: logged and counted, never fatal

utc_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
file_size() { stat -f %z "$1"; }

log_line() {
  # Self-cap first: truncate-only policy on our own bookkeeping.
  if [[ -f "$SELF_LOG" ]] && [[ "$(file_size "$SELF_LOG")" -gt "$SELF_LOG_MAX_BYTES" ]]; then
    : > "$SELF_LOG"
  fi
  printf '[%s] %s\n' "$(utc_now)" "$*" >> "$SELF_LOG"
}

# ------------------------------------------------- sets 1+2 and held dev.log
# rotate_copy_truncate <file> — retention: .1.gz .2.gz .3.gz, nothing older.
# Card shift order: drop .3; shift .2→.3, .1→.2 (moved archives must end up
# compressed); cp current → .1 and gzip it AT ONCE (AC: the fresh archive
# exists as .1.gz after the cycle); ONLY after copy success, `: >` in place.
rotate_copy_truncate() {
  local f="$1" size
  [[ -f "$f" ]] || return 0
  size="$(file_size "$f")"
  if [[ "$size" -le "$MAX_BYTES" ]]; then
    return 0
  fi
  rm -f "$f.3" "$f.3.gz"
  [[ -f "$f.2"    ]] && mv "$f.2"    "$f.3"
  [[ -f "$f.2.gz" ]] && mv "$f.2.gz" "$f.3.gz"
  [[ -f "$f.1"    ]] && mv "$f.1"    "$f.2"
  [[ -f "$f.1.gz" ]] && mv "$f.1.gz" "$f.2.gz"
  [[ -f "$f.2" ]] && gzip -f "$f.2"
  [[ -f "$f.3" ]] && gzip -f "$f.3"
  if ! cp "$f" "$f.1"; then
    # SAFETY: archive-copy failed ⇒ NO truncate — file stays whole, error logged.
    ERRORS_SEEN=$((ERRORS_SEEN + 1))
    log_line "ERROR rotate-aborted copy-failed file=$f size=$size (file left intact, no truncate)"
    return 0
  fi
  gzip -f "$f.1"
  : > "$f"
  log_line "ROTATED $f size=$size -> $(basename "$f").1.gz; truncated in place, inode preserved"
}

# ------------------------------------------------- set 3: dated-file age policy
# ISO-timestamp-named logs (e.g. 2026-10-19T143713.log(.gz)): retire by mtime.
apply_dated_policy() {
  local d="$1" now m age name f
  [[ -d "$d" ]] || return 0
  now="$(date +%s)"
  for f in "$d"/*; do
    [[ -f "$f" ]] || continue
    name="${f##*/}"
    [[ "$name" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}\.log(\.gz)?$ ]] || continue
    m="$(stat -f %m "$f")"
    age=$(( now - m ))
    if [[ "$age" -gt $(( DELETE_DAYS * DAY )) ]]; then
      rm -f "$f"
      log_line "DELETED aged dated-log $f (age $(( age / DAY ))d > ${DELETE_DAYS}d)"
    elif [[ "$age" -gt $(( KEEP_DAYS * DAY )) && "$name" != *.gz ]]; then
      if gzip -f "$f"; then
        log_line "GZIPPED aged dated-log $f (age $(( age / DAY ))d > ${KEEP_DAYS}d)"
      else
        ERRORS_SEEN=$((ERRORS_SEEN + 1))
        log_line "ERROR gzip-failed dated-log $f (left in place)"
      fi
    fi
  done
  return 0
}

# ---------------------------------------------------------------- cycle
cycle_fingerprint() {
  # compact per-target state for the honest noop line — paths+sizes only,
  # never file contents.
  {
    stat -f "%N %z" "$LXD_LOGDIR/$LXD_SET_FILE" 2>/dev/null || true
    find "$OC_CONFIG_LOGDIR" -maxdepth 1 -type f -name '*[!d]' 2>/dev/null | sort || true
    find "$OC_DATA_LOGDIR"   -maxdepth 1 -type f -name '*[!d]' 2>/dev/null | sort || true
  }
}

run_cycle() {
  SELF_LOG="$LXD_LOGDIR/logrotate.log"
  mkdir -p "$LXD_LOGDIR"
  local before after f

  before="$(cycle_fingerprint)"
  rotate_copy_truncate "$LXD_LOGDIR/$LXD_SET_FILE"          # set 1 (launchd err stream)
  if [[ -d "$OC_CONFIG_LOGDIR" ]]; then                     # set 2 (app-named logs)
    for f in "$OC_CONFIG_LOGDIR"/*.log; do
      [[ -f "$f" ]] && rotate_copy_truncate "$f"
    done
  fi
  rotate_copy_truncate "$OC_DATA_LOGDIR/$OC_DATA_HELD_FILE" # set 3 held stream
  apply_dated_policy "$OC_DATA_LOGDIR"                      # set 3 dated files
  after="$(cycle_fingerprint)"

  if [[ "$before" == "$after" ]]; then
    log_line "noop: all targets within caps; no archive, truncate, gzip, or delete needed (errors=$ERRORS_SEEN)"
  elif [[ "$ERRORS_SEEN" -gt 0 ]]; then
    log_line "cycle finished with $ERRORS_SEEN error(s) — see lines above"
  fi
  return 0
}

# ---------------------------------------------------------------- status
_status_target() {
  local f="$1" size
  if [[ ! -f "$f" ]]; then printf '    (absent) %s\n' "$f"; return 0; fi
  size="$(file_size "$f")"
  if [[ "$size" -gt "$MAX_BYTES" ]]; then
    printf '    OVER-CAP size=%s cap=%s %s\n' "$size" "$MAX_BYTES" "$f"
  else
    printf '    size=%s cap=%s %s\n' "$size" "$MAX_BYTES" "$f"
  fi
}

run_status() {
  local f
  printf 'openchamber-logrotate policy %s\n' "$(utc_now)"
  printf '  caps: MAX_BYTES=%s SELF_LOG_MAX=%s dated: gzip>%sd delete>%sd\n' \
    "$MAX_BYTES" "$SELF_LOG_MAX_BYTES" "$KEEP_DAYS" "$DELETE_DAYS"
  printf '  live files copy-truncated (never renamed); dated files age out by last-write mtime\n'
  printf '  set1 LXD_LOGDIR=%s (file: %s)\n' "$LXD_LOGDIR" "$LXD_SET_FILE"
  _status_target "$LXD_LOGDIR/$LXD_SET_FILE"
  printf '  set2 OC_CONFIG_LOGDIR=%s (*.log)\n' "$OC_CONFIG_LOGDIR"
  if [[ -d "$OC_CONFIG_LOGDIR" ]]; then
    for f in "$OC_CONFIG_LOGDIR"/*; do [[ -f "$f" ]] && _status_target "$f"; done
  fi
  printf '  set3 OC_DATA_LOGDIR=%s (held: %s; dated policy on ISO names)\n' "$OC_DATA_LOGDIR" "$OC_DATA_HELD_FILE"
  _status_target "$OC_DATA_LOGDIR/$OC_DATA_HELD_FILE"
  if [[ -d "$OC_DATA_LOGDIR" ]]; then
    for f in "$OC_DATA_LOGDIR"/*; do
      [[ -f "$f" ]] || continue
      [[ "$(basename "$f")" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}\.log(\.gz)?$ ]] || continue
      printf '    %s mtime=%s %s\n' "$(file_size "$f")" "$(stat -f '%Sm' -t '%Y-%m-%dT%H:%MZ' "$f")" "$f"
    done
  fi
  printf '  last log line:\n'
  if [[ -f "$LXD_LOGDIR/logrotate.log" ]]; then
    tail -1 "$LXD_LOGDIR/logrotate.log" | sed 's/^/    /'
  else
    printf '    (no log yet)\n'
  fi
}

# ---------------------------------------------------------------- self-test
st_pass=0; st_fail=0
st_ok()  { printf 'CASE %s PASS %s\n' "$1" "${2:-}"; st_pass=$((st_pass + 1)); }
st_bad() { printf 'CASE %s FAIL %s\n' "$1" "${2:-}"; st_fail=$((st_fail + 1)); }
st_check() { # got expected name detail
  if [[ "$1" == "$2" ]]; then st_ok "$3" "${4:-}"; else st_bad "$3" "expected='$2' got='$1' ${4:-}"; fi
}
st_touch_age() { touch -t "$(date -v"$2"d +%Y%m%d%H%M.%S)" "$1"; }  # $2: negative days

_ST_FIXTURE=""   # MUST be global: the EXIT trap fires after the function returns
run_self_test() {
  _ST_FIXTURE="$(mktemp -d)"
  trap 'rm -rf "$_ST_FIXTURE"' EXIT
  local ROOT="$_ST_FIXTURE"
  local FAKE_HOME="$ROOT/home"
  local T_LXD="$FAKE_HOME/Library/Logs/OpenChamber"
  local T_CFG="$FAKE_HOME/.config/openchamber/logs"
  local T_DATA="$FAKE_HOME/.local/share/opencode/log"
  mkdir -p "$T_LXD" "$T_CFG" "$T_DATA"

  # Isolate ALL state through the env-override surface — the same overrides a
  # non-default install would use, which is exactly why they are required.
  LXD_LOGDIR="$T_LXD"; OC_CONFIG_LOGDIR="$T_CFG"; OC_DATA_LOGDIR="$T_DATA"

  local BIG=$(( MAX_BYTES + 1024 ))
  local S="$T_LXD/service.err.log" C="$T_CFG/openchamber-3011.log" D="$T_DATA/dev.log"
  local fp a b f

  # ---- T1 under-cap noop: nothing touched anywhere + honest noop line
  head -c 1024 /dev/zero > "$S"; head -c 1024 /dev/zero > "$C"; head -c 2048 /dev/zero > "$D"
  fp="$(cycle_fingerprint)"
  run_cycle
  st_check "$(cycle_fingerprint)" "$fp" T1-under-cap-noop "fingerprint changed"
  st_check "$(grep -c ' noop: ' "$T_LXD/logrotate.log" || true)" "1" T1b-honest-noop-line
  st_check "$(find "$T_LXD" "$T_CFG" "$T_DATA" -name '*.1*' | wc -l | tr -d ' ')" "0" T1c-no-archive-created

  # ---- T2 over-cap copy-truncate: TRUNCATE + ARCHIVE + SAME-INODE
  head -c "$BIG" /dev/zero > "$S"
  a="$(stat -f %i "$S")"; b="$(file_size "$S")"
  run_cycle
  st_check "$(file_size "$S")" "0" T2a-truncated-to-zero
  st_check "$(stat -f %i "$S")" "$a" T2b-same-inode-survives "a rename happened"
  # AC: after a rotation the archive exists as .1.gz (install acceptance names
  # it) — fresh copy is gzipped at once; retention is .1.gz .2.gz .3.gz.
  st_check "$(gunzip < "$S.1.gz" | wc -c | tr -d ' ')" "$b" T2c-archive-gz-has-all-bytes
  st_check "$([[ ! -e "$S.1" ]] && echo gz-only || echo plain-leftover)" "gz-only" T2c2-fresh-archive-compressed
  st_check "$(grep -c " ROTATED .*service\\.err\\.log" "$T_LXD/logrotate.log" || true)" "1" T2d-one-summary-line

  # ---- T2e/2f next cycle shifts archives and gzips the moved ones
  head -c "$BIG" /dev/zero > "$S"
  printf 'OLD2' > "$S.2"
  run_cycle
  st_check "$(gunzip < "$S.3.gz")" "OLD2" T2e-oldest-shifted-and-gzipped
  st_check "$([[ -f "$S.2.gz" ]] && echo present || echo missing)" "present" T2f-prev-archive-gzipped
  st_check "$([[ -f "$S.1.gz" && ! -e "$S.1" ]] && echo compressed || echo wrong)" "compressed" T2g-newest-archive-compressed
  head -c "$BIG" /dev/zero > "$S"; run_cycle
  head -c "$BIG" /dev/zero > "$S"; run_cycle     # one more shift → retention cap 3+
  st_check "$(find "$T_LXD" -name 'service.err.log.4*' | wc -l | tr -d ' ')" "0" T2h-nothing-beyond-3
  rm -f "$T_LXD"/service.err.log.1* "$T_LXD"/service.err.log.2* "$T_LXD"/service.err.log.3*
  head -c 1024 /dev/zero > "$S"

  # ---- T3 fd-held proof: holder opens BEFORE rotation; later append must land
  # in the SAME file (inode equality + marker via the pre-existing fd).
  head -c "$BIG" /dev/zero > "$D"
  a="$(stat -f %i "$D")"
  exec 9>>"$D"                                  # simulate the app's held fd
  run_cycle
  st_check "$(stat -f %i "$D")" "$a" T3a-held-fd-same-inode "inode changed — rename-based rotation"
  printf 'HELD_FD_AFTER_ROTATION\n' >&9
  st_check "$(grep -c 'HELD_FD_AFTER_ROTATION' "$D" || true)" "1" T3b-append-via-held-fd-lands-in-same-file
  exec 9>&-

  # ---- T4 copy-failure safety ⇒ no truncate, file unchanged. Reliable
  # mechanism: strip dir write bit AFTER the no-source shifts no-op, so cp is
  # the first step that can fail.
  head -c "$BIG" /dev/zero > "$C"
  b="$(file_size "$C")"
  chmod 500 "$T_CFG"
  run_cycle
  chmod 755 "$T_CFG"
  st_check "$(file_size "$C")" "$b" T4a-file-unchanged-after-copy-failure
  st_check "$(find "$T_CFG" -name 'openchamber-3011.log.1*' | wc -l | tr -d ' ')" "0" T4b-no-partial-archive
  st_check "$(grep -c 'ERROR rotate-aborted copy-failed' "$T_LXD/logrotate.log" || true)" "1" T4c-error-logged
  rm -f "$T_CFG"/*
  rm -f "$T_DATA"/dev.log.1* ; : > "$D"; head -c 1024 /dev/zero > "$D"

  # ---- T5 dated-file policy on the age gate (mtime-based, see header)
  head -c 512 /dev/zero > "$T_DATA/2026-01-01T000001.log"; st_touch_age "$T_DATA/2026-01-01T000001.log" -20
  head -c 512 /dev/zero > "$T_DATA/2026-01-01T000002.log"; gzip -f "$T_DATA/2026-01-01T000002.log"
      st_touch_age "$T_DATA/2026-01-01T000002.log.gz" -40                       # aged .gz → delete
  head -c 512 /dev/zero > "$T_DATA/2026-01-01T000003.log.gz"
      st_touch_age "$T_DATA/2026-01-01T000003.log.gz" -20                       # gz between limits → skip
  head -c 512 /dev/zero > "$T_DATA/2026-01-01T000004.log"                        # fresh → untouched
  head -c 512 /dev/zero > "$T_DATA/2026-01-01T000005.log"
      st_touch_age "$T_DATA/2026-01-01T000005.log" -35                           # aged .log → gzip-then-not-yet... (35d ⇒ delete path)
  apply_dated_policy "$T_DATA"
  st_check "$([[ -f "$T_DATA/2026-01-01T000001.log.gz" && ! -e "$T_DATA/2026-01-01T000001.log" ]] && echo gz || echo wrong)" "gz" T5a-aged-log-gzipped
  st_check "$([[ -e "$T_DATA/2026-01-01T000002.log.gz" ]] && echo still || echo deleted)" "deleted" T5b-aged-gz-deleted
  st_check "$(file_size "$T_DATA/2026-01-01T000003.log.gz")" "512" T5c-existing-gz-skipped
  st_check "$([[ -f "$T_DATA/2026-01-01T000004.log" ]] && echo plain || echo touched)" "plain" T5d-fresh-untouched
  st_check "$([[ -e "$T_DATA/2026-01-01T000005.log" ]] && echo still || echo gone)" "gone" T5e-35d-dated-deleted
  rm -f "$T_DATA"/2026-01-01T00000*.log*

  # ---- T6 scope guard: non-dated, non-held extras in the data dir are not managed
  head -c 300 /dev/zero > "$T_DATA/tools.log"; st_touch_age "$T_DATA/tools.log" -45
  apply_dated_policy "$T_DATA"
  st_check "$([[ -f "$T_DATA/tools.log" ]] && echo plain || echo touched)" "plain" T6-unrelated-file-not-touched
  rm -f "$T_DATA/tools.log"

  # ---- T7 self-log cap: own log past 512 KiB is truncated next write
  head -c "$(( SELF_LOG_MAX_BYTES + 4096 ))" /dev/zero > "$T_LXD/logrotate.log"
  run_cycle
  st_check "$([[ "$(file_size "$T_LXD/logrotate.log")" -le "$SELF_LOG_MAX_BYTES" ]] && echo capped || echo over)" "capped" T7-selflog-capped

  # ---- T8 --status one screen: policy, sizes vs caps, last log line — and
  # file CONTENTS (a planted marker) never appear in it (= no secrets).
  printf 'SECRET-MARKER-IN-FILE-CONTENT\n' >> "$S"
  local out; out="$(run_status)"; local rc=$?
  st_check "$rc" "0" T8a-status-exit0
  st_check "$(printf '%s\n' "$out" | grep -c 'openchamber-logrotate policy ' || true)" "1" T8b-policy-line
  st_check "$(printf '%s\n' "$out" | grep -c "MAX_BYTES=$MAX_BYTES" || true)" "1" T8c-caps-shown
  st_check "$(printf '%s\n' "$out" | grep -c 'last log line' || true)" "1" T8d-log-line-section
  st_check "$(printf '%s\n' "$out" | grep -c 'SECRET-MARKER-IN-FILE-CONTENT' || true)" "0" T8e-contents-never-in-status

  # ---- T9 own log: every line UTC-timestamped, no secret-looking tokens
  st_check "$(grep -Evc '^\[[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\] ' "$T_LXD/logrotate.log" || true)" "0" T9a-utc-timestamps
  st_check "$(grep -Eic 'password|token|secret|bearer' "$T_LXD/logrotate.log" || true)" "0" T9b-no-secrets

  printf 'SELF-TEST: %s pass=%d fail=%d\n' \
    "$([[ "$st_fail" -eq 0 ]] && echo PASS || echo FAIL)" "$st_pass" "$st_fail"
  [[ "$st_fail" -eq 0 ]]
}

# ---------------------------------------------------------------- entry
case "${1:-}" in
  --self-test) run_self_test ;;
  --status)    run_status ;;
  "")          run_cycle ;;
  *) printf 'usage: %s [--self-test | --status]\n' "$0" >&2; exit 2 ;;
esac
