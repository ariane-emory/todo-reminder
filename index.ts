import type { Plugin } from "@opencode-ai/plugin";

const SERVICE_NAME = "todo-reminder";

async function log(
  client: Parameters<Plugin>[0]["client"],
  level: "debug" | "info" | "warn" | "error",
  message: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await client.app.log({
      body: { service: SERVICE_NAME, level, message, extra },
    });
  } catch {
    // Silently fail - logging should never break the plugin
  }
}

export const TodoReminderPlugin: Plugin = async ({ client }) => {
  const lastInjectionTime = new Map<string, number>();
  const MIN_COOLDOWN_MS = 150_000; // 1 minute cooldown between reminders

  await log(client, "info", "Plugin loaded");

  return {
    "experimental.chat.messages.transform": async (_input, output) => {
      const messages = output.messages;
      if (!messages || messages.length === 0) return;

      // Find the last assistant message
      let lastAssistant = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].info.role === "assistant") {
          lastAssistant = messages[i];
          break;
        }
      }

      if (!lastAssistant) {
        return;
      }

      const sessionID = lastAssistant.info.sessionID;
      const now = Date.now();
      const lastInjected = lastInjectionTime.get(sessionID) ?? 0;

      if (now - lastInjected < MIN_COOLDOWN_MS) {
        return; // Cooldown active
      }

      try {
        const response = await client.session.todo({ path: { id: sessionID } });
        const todos = response.data || [];
        const pending = todos.filter((t: any) => t.status !== "completed");

        if (pending.length === 0) {
          return;
        }

        await log(client, "info", `Attempting to inject reminder for ${pending.length} pending todo(s)`, {
          sessionID,
          pendingCount: pending.length,
        });

        const result = await client.session.prompt({
          path: { id: sessionID },
          body: {
            noReply: true,
            parts: [
              {
                type: "text",
                text: `[Todo Reminder] You have ${pending.length} pending item(s). After completing your current task, please review and update your todo list using the todowrite tool.`,
              },
            ],
          },
        });

        lastInjectionTime.set(sessionID, now);

        await log(client, "info", `Successfully injected reminder`, {
          sessionID,
          pendingCount: pending.length,
          resultStatus: (result as any)?.status,
          resultData: JSON.stringify((result as any)?.data)?.substring(0, 200),
        });
      } catch (error) {
        await log(client, "error", "Failed to inject reminder", {
          sessionID,
          error: String(error),
          errorStack: (error as any)?.stack,
        });
      }
    },
  };
};

export default TodoReminderPlugin;
