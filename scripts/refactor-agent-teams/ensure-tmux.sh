#!/usr/bin/env bash
# Ensure tmux is installed (required for agent team split-pane mode on WSL2)
set -e

if ! command -v tmux &> /dev/null; then
  echo "tmux is not installed. Installing..."
  if command -v apt-get &> /dev/null; then
    sudo apt-get update && sudo apt-get install -y tmux
  elif command -v brew &> /dev/null; then
    brew install tmux
  else
    echo "ERROR: Cannot install tmux automatically. Please install tmux manually:"
    echo "  - Ubuntu/Debian/WSL2: sudo apt-get install tmux"
    echo "  - macOS: brew install tmux"
    exit 1
  fi
  echo "tmux installed successfully."
else
  echo "tmux is already installed: $(tmux -V)"
fi
