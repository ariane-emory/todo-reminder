import type { Plugin } from "@opencode-ai/plugin";

export const TodoReminderPlugin: Plugin = async ({ client }) => {
  const lastInjectionCount = new Map<string, number>();

  return {
    "experimental.chat.messages.transform": async ({}, { messages }) => {
      const lastAssistant = messages.findLast((m) => m.info.role === "assistant");
      if (!lastAssistant) return;

      const sessionID = lastAssistant.info.sessionID;
      
      const assistantCount = messages.filter((m) => m.info.role === "assistant").length;
      
      const lastCount = lastInjectionCount.get(sessionID);
      
      if (lastCount !== undefined && assistantCount - lastCount < 2) return;

      try {
        const response = await client.session.todo({ path: { id: sessionID } });
        const todos = response.data || [];
        
        const pending = todos.filter((t: any) => t.status !== "completed");
        
        if (pending.length === 0) return;

        const lastUser = messages.findLast((m) => m.info.role === "user");
        if (!lastUser) return;

        lastUser.parts.push({
          id: `todo-reminder-${Date.now()}`,
          messageID: lastUser.info.id,
          sessionID: lastUser.info.sessionID,
          type: "text",
          text: `<system-reminder>
You have ${pending.length} pending todo item(s). After completing your current task, please review and update your todo list using the todowrite tool.
</system-reminder>`,
          synthetic: true,
        });

        lastInjectionCount.set(sessionID, assistantCount);
      } catch (error) {
        // Silently fail - todo API might not be available
      }
    },
  };
};
