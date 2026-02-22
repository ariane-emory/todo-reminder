# Todo Reminder Plugin

An OpenCode plugin that reminds the model to update its todo list when there are pending items.

## How It Works

1. Detects when there are pending (incomplete) todo items
2. Injects a synthetic reminder message after the model responds
3. Uses a 2-message cooldown to prevent infinite reminder loops

## Loop Prevention

The plugin tracks the assistant message count at the time of each injection. After injecting a reminder, it waits for at least 2 new assistant messages before injecting again. This prevents:

```
inject → model responds to reminder → (skip, only 1 new msg) → user interacts → model responds → (inject, 2 new msgs)
```

## Installation

Place this folder in your OpenCode plugin directory:
```
~/.config/opencode/supplemental/plugin/todo-reminder/
```
