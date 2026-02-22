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

## Verification

Check logs to verify the plugin is working:
```bash
grep "service=todo-reminder" ~/.local/share/opencode/log/dev.log
```

You should see entries like:
- `Plugin loaded` - when OpenCode starts
- `Injected reminder for X pending todo(s)` - when a reminder is added
- `Skipping - cooldown active` - when waiting for 2 messages between reminders
- `No pending todos` - when all todos are completed
