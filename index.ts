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
  const lastInjectionCount = new Map<string, number>();

  await log(client, "info", "Plugin loaded");

  return {
    "experimental.chat.messages.transform": async ({}, { messages }) => {
      const lastAssistant = messages.findLast((m) => m.info.role === "assistant");
      if (!lastAssistant) return;

      const sessionID = lastAssistant.info.sessionID;
      
      const assistantCount = messages.filter((m) => m.info.role === "assistant").length;
      
      const lastCount = lastInjectionCount.get(sessionID);
      
      if (lastCount !== undefined && assistantCount - lastCount < 2) {
        await log(client, "debug", "Skipping - cooldown active", { 
          sessionID, 
          lastCount, 
          assistantCount 
        });
        return;
      }

      try {
        const response = await client.session.todo({ path: { id: sessionID } });
        const todos = response.data || [];
        
        const pending = todos.filter((t: any) => t.status !== "completed");
        
        if (pending.length === 0) {
          await log(client, "debug", "No pending todos", { sessionID });
          return;
        }

        const lastUser = messages.findLast((m) => m.info.role === "user");
        if (!lastUser) return;

        lastUser.parts.push({
          id: `todo-reminder-${Date.now()}`,
          messageID: lastUser.info.id,
          sessionID: lastUser.info.sessionID,
          type: "text",
          text: `[Todo Reminder] You have ${pending.length} pending item(s). After completing your current task, please review and update your todo list using the todowrite tool.`,
        });

        lastInjectionCount.set(sessionID, assistantCount);
        
        await log(client, "info", `Injected reminder for ${pending.length} pending todo(s)`, { 
          sessionID, 
          pendingCount: pending.length,
          assistantCount 
        });
      } catch (error) {
        await log(client, "error", "Failed to query todos", { 
          sessionID, 
          error: String(error) 
        });
      }
    },
  };
};

export default TodoReminderPlugin;
