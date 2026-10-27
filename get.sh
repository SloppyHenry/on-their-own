#!/usr/bin/env bash
# On Their Own: download and install in one go (Linux and macOS).
#
#   curl -fsSL https://raw.githubusercontent.com/SloppyHenry/on-their-own/main/get.sh | bash
#   curl -fsSL …/get.sh | bash -s -- --headless      options are passed on to install.sh (see ./install.sh --help)
#
# Fetches the project into $OTO_DIR (default ~/on-their-own; an existing copy is updated) and runs install.sh without
# questions. install.sh detects the machine (macOS or Linux, Apple Silicon, NVIDIA with CUDA, Vulkan or CPU only, memory,
# free disk space) and installs what fits: uv and Node.js if missing, llama.cpp, a curated model that fits, the services.
# OTO_ASK=1 asks before every step instead.
set -euo pipefail

REPO="${OTO_REPO:-SloppyHenry/on-their-own}"
BRANCH="${OTO_BRANCH:-main}"
DIR="${OTO_DIR:-$HOME/on-their-own}"

say() { printf '%s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

case "$(uname -s)" in Darwin|Linux) ;; *) die "only Linux and macOS are supported." ;; esac

if [ -d "$DIR/.git" ]; then
  say "Updating $DIR"
  git -C "$DIR" pull --ff-only || say "git pull not possible (local changes?), keeping the existing copy."
elif [ -e "$DIR/install.sh" ]; then
  say "Using the existing copy in $DIR"
elif have git; then
  say "Cloning $REPO into $DIR"
  git clone --depth 1 --branch "$BRANCH" "https://github.com/$REPO.git" "$DIR"
else
  # without git: the archive of the branch (updating later then means running this command again)
  have curl || die "neither git nor curl is available."
  say "Downloading $REPO ($BRANCH) into $DIR"
  mkdir -p "$DIR"
  curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" | tar -xz -C "$DIR" --strip-components 1
fi

if [ "${OTO_ASK:-0}" = 1 ] && [ -r /dev/tty ]; then
  exec bash "$DIR/install.sh" "$@" </dev/tty
fi
exec bash "$DIR/install.sh" --yes "$@"
