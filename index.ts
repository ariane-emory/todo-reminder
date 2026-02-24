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
    "chat.message": async (input, output) => {
      // Only trigger on assistant messages (model responses)
      if (output.message.role !== "assistant") return;

      const sessionID = input.sessionID;
      
      // Count assistant messages by checking how many times this hook has fired
      // We use a simple counter per session
      const currentCount = (lastInjectionCount.get(sessionID) ?? 0) + 1;
      
      // Query the todo list
      try {
        const response = await client.session.todo({ path: { id: sessionID } });
        const todos = response.data || [];
        
        const pending = todos.filter((t: any) => t.status !== "completed");
        
        if (pending.length === 0) {
          await log(client, "debug", "No pending todos", { sessionID });
          lastInjectionCount.set(sessionID, currentCount);
          return;
        }

        // Cooldown: require at least 2 assistant messages since last injection
        // First injection happens at message 2
        if (currentCount < 2) {
          await log(client, "debug", "Waiting for more messages", { 
            sessionID, 
            currentCount 
          });
          lastInjectionCount.set(sessionID, currentCount);
          return;
        }

        // Check if we already injected recently (within last 2 messages)
        const lastInjectedAt = lastInjectionCount.get(`${sessionID}-injected`) ?? 0;
        if (currentCount - lastInjectedAt < 2) {
          await log(client, "debug", "Cooldown active", { 
            sessionID, 
            lastInjectedAt, 
            currentCount 
          });
          lastInjectionCount.set(sessionID, currentCount);
          return;
        }

        // Inject reminder using prompt (persists to UI)
        await client.session.prompt({
          path: { id: sessionID },
          body: {
            parts: [
              {
                type: "text",
                text: `[Todo Reminder] You have ${pending.length} pending item(s). After completing your current task, please review and update your todo list using the todowrite tool.`,
              },
            ],
          },
        });

        // Mark when we last injected
        lastInjectionCount.set(`${sessionID}-injected`, currentCount);
        lastInjectionCount.set(sessionID, currentCount);
        
        await log(client, "info", `Injected reminder for ${pending.length} pending todo(s)`, { 
          sessionID, 
          pendingCount: pending.length,
          messageCount: currentCount 
        });
      } catch (error) {
        await log(client, "error", "Failed to inject reminder", { 
          sessionID, 
          error: String(error) 
        });
      }
    },
  };
};

export default TodoReminderPlugin;
