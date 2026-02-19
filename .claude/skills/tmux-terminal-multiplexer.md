# tmux - Terminal Multiplexer Mastery

## Overview
tmux is a terminal multiplexer that enables multiple terminal sessions within a single window, persistent sessions that survive disconnections, and powerful window/pane management. Essential for remote work, development workflows, and productivity.

## Core Concepts

### Architecture
- **Client-Server Model**: tmux server manages sessions; clients attach/detach
- **Sessions**: Independent workspaces that persist until server shutdown
- **Windows**: Virtual desktops within a session (like browser tabs)
- **Panes**: Split views within a window (tiled terminal instances)

### Key Benefits
1. **Session Persistence**: Detach/reattach without losing state
2. **Remote Resilience**: SSH disconnects don't kill your work
3. **Window Management**: Multiple terminals in one window
4. **Platform Independence**: Works on Linux, macOS, WSL, BSD
5. **Scriptable**: Automate complex layouts and workflows

## Installation

```bash
# Ubuntu/Debian/WSL
sudo apt-get install tmux

# macOS
brew install tmux

# Verify (requires tmux >= 2.6)
tmux -V
```

## Essential Keybindings

### Prefix Key
- **Default**: `Ctrl-b` (C-b)
- **Common Alternative**: `Ctrl-a` (C-a) - more ergonomic
- **Notation**: `<prefix>` means press prefix, release, then command key

### Session Management
```bash
# Create new session
tmux new -s session-name

# List sessions
tmux ls

# Attach to session
tmux attach -t session-name

# Detach from session
<prefix> d

# Switch between sessions
<prefix> s          # Interactive session list
<prefix> (          # Previous session
<prefix> )          # Next session

# Rename session
<prefix> $
tmux rename-session -t old-name new-name

# Kill session
tmux kill-session -t session-name
```

### Window Management
```bash
<prefix> c          # Create new window
<prefix> ,          # Rename current window
<prefix> n          # Next window
<prefix> p          # Previous window
<prefix> 0-9        # Switch to window by number
<prefix> w          # Interactive window list
<prefix> &          # Kill current window
<prefix> f          # Find window by name
```

### Pane Management
```bash
# Splitting
<prefix> %          # Split vertically (left/right)
<prefix> "          # Split horizontally (top/bottom)

# Navigation
<prefix> arrow-key  # Move to pane in direction
<prefix> o          # Cycle through panes
<prefix> q          # Show pane numbers (type number to jump)

# Resizing
<prefix> Ctrl-arrow # Resize pane in direction
<prefix> Alt-arrow  # Resize in 5-cell increments

# Layout
<prefix> space      # Cycle through preset layouts
<prefix> z          # Toggle pane zoom (fullscreen)
<prefix> !          # Break pane into new window
<prefix> x          # Kill current pane
```

### Copy Mode (Vi-style)
```bash
<prefix> [          # Enter copy mode
<prefix> ]          # Paste from buffer

# In copy mode (vi-mode):
Space               # Start selection
Enter               # Copy selection
v                   # Visual selection
y                   # Yank (copy)
q                   # Quit copy mode
/                   # Search forward
?                   # Search backward
n                   # Next search result
```

## Advanced Configuration

### Basic .tmux.conf
```bash
# ~/.tmux.conf or ~/.config/tmux/tmux.conf

# Change prefix to Ctrl-a
unbind C-b
set -g prefix C-a
bind C-a send-prefix

# Enable mouse support
set -g mouse on

# Vi mode
setw -g mode-keys vi

# Start windows/panes at 1 instead of 0
set -g base-index 1
setw -g pane-base-index 1

# Reload config
bind r source-file ~/.tmux.conf \; display "Config reloaded!"

# Better split bindings
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"

# Vim-style pane navigation
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R

# 256 color support
set -g default-terminal "screen-256color"

# Increase scrollback buffer
set -g history-limit 50000

# Display messages for 4 seconds
set -g display-time 4000

# Refresh status bar every 5 seconds
set -g status-interval 5
```

### Clipboard Integration
```bash
# macOS clipboard integration
bind -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "pbcopy"
bind -T copy-mode-vi Enter send-keys -X copy-pipe-and-cancel "pbcopy"

# Linux (X11) clipboard integration
bind -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "xclip -selection clipboard"

# WSL clipboard integration
bind -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "clip.exe"

# Mouse drag to copy
bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"
```

### Status Bar Customization
```bash
# Status bar styling
set -g status-style bg=black,fg=white
set -g status-left-length 40
set -g status-left "#[fg=green]Session: #S #[fg=yellow]#I #[fg=cyan]#P"
set -g status-right "#[fg=cyan]%d %b %R"

# Window status
setw -g window-status-current-style fg=white,bold,bg=red
setw -g window-status-style fg=cyan,bg=default

# Pane borders
set -g pane-border-style fg=green
set -g pane-active-border-style fg=yellow,bold
```

## Session Automation

### Scripting with Bash
```bash
#!/bin/bash
# Create development session with predefined layout

SESSION="dev-project"

# Create session
tmux new-session -d -s $SESSION -n editor

# First window: editor
tmux send-keys -t $SESSION:editor "cd ~/project && nvim" C-m

# Second window: server with split panes
tmux new-window -t $SESSION -n server
tmux split-window -h -t $SESSION:server
tmux send-keys -t $SESSION:server.0 "npm run dev" C-m
tmux send-keys -t $SESSION:server.1 "npm run test:watch" C-m

# Third window: git
tmux new-window -t $SESSION -n git
tmux send-keys -t $SESSION:git "git status" C-m

# Attach to session
tmux attach -t $SESSION
```

### tmuxinator (YAML-based)
```yaml
# ~/.config/tmuxinator/project.yml
name: project
root: ~/project

windows:
  - editor:
      layout: main-vertical
      panes:
        - nvim
        - git status
  - server:
      layout: even-horizontal
      panes:
        - npm run dev
        - npm run test:watch
  - logs:
      panes:
        - tail -f logs/development.log
```

```bash
# Install tmuxinator
gem install tmuxinator

# Start project
tmuxinator start project

# Edit config
tmuxinator edit project
```

### tmuxp (Python-based)
```yaml
# ~/.config/tmuxp/project.yaml
session_name: project
start_directory: ~/project
windows:
  - window_name: editor
    panes:
      - nvim
      - shell_command: git status
  - window_name: server
    layout: even-horizontal
    panes:
      - npm run dev
      - npm run test:watch
```

```bash
# Install tmuxp
pip install tmuxp

# Load session
tmuxp load project
```

## Remote Development Patterns

### SSH + tmux Workflow
```bash
# Connect and attach to existing session
ssh user@server -t "tmux attach -t dev || tmux new -s dev"

# Create local tmux, then SSH into remote tmux
# Local: Ctrl-b (default prefix)
# Remote: Ctrl-a (custom prefix to avoid conflicts)

# Nested session prefix forwarding
bind -n C-a send-prefix  # Forward Ctrl-a to nested session
```

### Nested Sessions Configuration
```bash
# Detect nested tmux and change status bar color
if-shell 'test -n "$TMUX"' \
  'set -g status-bg red' \
  'set -g status-bg green'

# Different prefix for nested sessions
bind -n C-q send-prefix  # Use Ctrl-q for inner tmux
```

### SSH-aware Status Bar
```bash
# Show hostname in status bar (useful for multiple servers)
set -g status-right "#H | %d %b %R"

# Color-code by environment
if-shell 'test "$ENV" = "production"' \
  'set -g status-bg red' \
  'set -g status-bg green'
```

## Plugin Management (TPM)

### Installing TPM
```bash
# Clone TPM
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# Add to .tmux.conf
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-sensible'
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'

# Initialize TPM (keep at bottom of .tmux.conf)
run '~/.tmux/plugins/tpm/tpm'
```

### Essential Plugins
```bash
# tmux-resurrect: Save/restore sessions
set -g @plugin 'tmux-plugins/tmux-resurrect'
# Save: <prefix> Ctrl-s
# Restore: <prefix> Ctrl-r

# tmux-continuum: Auto-save sessions
set -g @plugin 'tmux-plugins/tmux-continuum'
set -g @continuum-restore 'on'  # Auto-restore on tmux start

# tmux-yank: Better clipboard integration
set -g @plugin 'tmux-plugins/tmux-yank'

# tmux-pain-control: Better pane management
set -g @plugin 'tmux-plugins/tmux-pain-control'

# tmux-open: Open URLs/files from copy mode
set -g @plugin 'tmux-plugins/tmux-open'
```

### Plugin Keybindings
```bash
<prefix> I          # Install plugins
<prefix> U          # Update plugins
<prefix> alt-u      # Uninstall plugins
```

## Advanced Techniques

### Custom Layouts
```bash
# Save current layout
tmux list-windows  # Note layout string

# Apply custom layout
tmux select-layout "layout-string"

# Predefined layouts
<prefix> Alt-1      # Even horizontal
<prefix> Alt-2      # Even vertical
<prefix> Alt-3      # Main horizontal
<prefix> Alt-4      # Main vertical
<prefix> Alt-5      # Tiled
```

### Synchronized Panes
```bash
# Toggle synchronized input to all panes
<prefix> :setw synchronize-panes

# Useful for running same command on multiple servers
# Bind to key for quick access:
bind S setw synchronize-panes
```

### Command Mode Tricks
```bash
<prefix> :          # Enter command mode

# Useful commands:
:swap-window -s 2 -t 1          # Swap window positions
:move-window -t session:index   # Move window to another session
:join-pane -s :2 -t :1          # Join window 2 as pane in window 1
:break-pane -t :                # Break pane into new window
:resize-pane -D 10              # Resize down 10 cells
:set-option -g mouse on         # Enable mouse mode
```

### Conditional Configuration
```bash
# OS-specific settings
if-shell "uname | grep -q Darwin" \
  "set -g default-command 'reattach-to-user-namespace -l zsh'"

# Version-specific features
if-shell "tmux -V | awk '{exit !($2 >= 3.2)}'" \
  "set -g extended-keys on"

# Environment-based
if-shell '[ -n "$SSH_CLIENT" ]' \
  'set -g status-bg red' \
  'set -g status-bg green'
```

### Hooks and Automation
```bash
# Run command when pane created
set-hook -g after-split-window 'select-layout tiled'

# Alert on activity
set-hook -g alert-activity 'display "Activity in window #{window_index}"'

# Auto-rename windows based on current command
setw -g automatic-rename on
setw -g automatic-rename-format '#{b:pane_current_path}'
```

## Powerline/Oh-My-Tmux Themes

### Oh My Tmux Installation
```bash
cd ~
git clone https://github.com/gpakosz/.tmux.git
ln -s -f .tmux/.tmux.conf
cp .tmux/.tmux.conf.local .

# Edit .tmux.conf.local for customization
```

### Powerline Symbols
```bash
# Requires Powerline fonts or Nerd Fonts
# Install fonts: https://github.com/powerline/fonts

# Enable in .tmux.conf.local
tmux_conf_theme_left_separator_main='\uE0B0'
tmux_conf_theme_left_separator_sub='\uE0B1'
tmux_conf_theme_right_separator_main='\uE0B2'
tmux_conf_theme_right_separator_sub='\uE0B3'
```

## Troubleshooting

### Common Issues

**Colors not working:**
```bash
# Add to .bashrc/.zshrc
export TERM=xterm-256color

# In tmux.conf
set -g default-terminal "screen-256color"
set -ga terminal-overrides ",xterm-256color:Tc"
```

**Clipboard not working:**
```bash
# macOS: Install reattach-to-user-namespace
brew install reattach-to-user-namespace

# Add to .tmux.conf
set -g default-command "reattach-to-user-namespace -l $SHELL"
```

**Escape key delay in Vim:**
```bash
# Add to .tmux.conf
set -sg escape-time 0
```

**Mouse scrolling issues:**
```bash
# Enable mouse mode
set -g mouse on

# For older tmux versions (<2.1)
set -g mode-mouse on
set -g mouse-select-pane on
set -g mouse-resize-pane on
```

## Productivity Workflows

### Development Workflow
```bash
# Session: dev
# Window 1: Editor (nvim/vscode)
# Window 2: Server (split: app server | test runner)
# Window 3: Database (psql/mongo shell)
# Window 4: Git (split: status | logs)
# Window 5: Monitoring (htop/logs)
```

### Multi-Server Management
```bash
# Create session with panes for each server
tmux new -s servers
tmux split-window -h
tmux split-window -v
tmux select-pane -t 0
tmux split-window -v

# SSH into each pane
tmux send-keys -t 0 "ssh server1" C-m
tmux send-keys -t 1 "ssh server2" C-m
tmux send-keys -t 2 "ssh server3" C-m
tmux send-keys -t 3 "ssh server4" C-m

# Enable synchronized panes for broadcast commands
tmux setw synchronize-panes on
```

### Pair Programming
```bash
# Create shared session
tmux -S /tmp/pair new -s pairing

# Set permissions
chmod 777 /tmp/pair

# Partner attaches
tmux -S /tmp/pair attach -t pairing

# Read-only mode for observer
tmux -S /tmp/pair attach -t pairing -r
```

## Quick Reference Card

```
SESSION MANAGEMENT
  tmux new -s name          Create named session
  tmux ls                   List sessions
  tmux attach -t name       Attach to session
  <prefix> d                Detach from session
  <prefix> s                Session switcher

WINDOW MANAGEMENT
  <prefix> c                Create window
  <prefix> ,                Rename window
  <prefix> n/p              Next/previous window
  <prefix> 0-9              Jump to window number
  <prefix> w                Window list

PANE MANAGEMENT
  <prefix> %                Split vertical
  <prefix> "                Split horizontal
  <prefix> arrow            Navigate panes
  <prefix> z                Toggle zoom
  <prefix> x                Kill pane
  <prefix> space            Cycle layouts

COPY MODE
  <prefix> [                Enter copy mode
  Space                     Start selection
  Enter                     Copy selection
  <prefix> ]                Paste

MISC
  <prefix> ?                List all keybindings
  <prefix> :                Command prompt
  <prefix> t                Show clock
  tmux kill-server          Kill all sessions
```

## Resources

- **Official Docs**: https://github.com/tmux/tmux/wiki
- **Man Page**: `man tmux`
- **Oh My Tmux**: https://github.com/gpakosz/.tmux
- **Awesome Tmux**: https://github.com/rothgar/awesome-tmux
- **Book**: "tmux 2: Productive Mouse-Free Development" by Brian Hogan
- **Cheat Sheet**: https://tmuxcheatsheet.com/

## Best Practices

1. **Use meaningful session names** - Easier to identify and attach
2. **Keep .tmux.conf in version control** - Sync across machines
3. **Start with minimal config** - Add features as needed
4. **Use session managers** - tmuxinator/tmuxp for complex layouts
5. **Leverage plugins** - Don't reinvent the wheel
6. **Practice keybindings** - Muscle memory is key
7. **Use different prefixes** - For nested sessions
8. **Enable mouse mode** - Helpful for beginners
9. **Set up clipboard integration** - Seamless copy/paste
10. **Auto-save sessions** - tmux-resurrect + tmux-continuum

---

**Last Updated**: 2026-02-19
**tmux Version**: 3.x+
**Skill Level**: Beginner to Advanced

