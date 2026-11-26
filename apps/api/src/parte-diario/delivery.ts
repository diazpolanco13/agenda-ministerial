import { isSmtpConfigured, sendNotificationEmail } from "@kaneo/email";
import { and, eq, isNull } from "drizzle-orm";
import db from "../database";
import {
  agendaNtfySubscriptionTable,
  dailyBriefSentTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../database/schema";
import { decryptSecret } from "../notification-preferences/secrets";
import {
  getAgendaPublicUrl,
  isNtfyConfigured,
  publishNtfyMessage,
} from "../ntfy/client";
import {
  type DailyBrief,
  type DailyBriefItem,
  generateDailyBriefForUser,
  getCaracasDateKey,
} from "./generator";

function formatItemLine(item: DailyBriefItem): string {
  const ref = item.orderFolio ?? `${item.projectSlug}-${item.number ?? 0}`;
  return `- [${ref}] ${item.title}`;
}

export function formatDailyBriefText(brief: DailyBrief): string {
  const lines: string[] = [
    `${brief.saludo}`,
    `${brief.fechaLarga}`,
    "",
    brief.parrafoEjecutivo,
    "",
    `Resumen: Vencidas (${brief.contadores.vencidas}) · Vencen hoy (${brief.contadores.venceHoy}) · Órdenes nuevas (${brief.contadores.ordenesNuevas}) · Agenda del día (${brief.contadores.agendaDia}) · Visto bueno (${brief.contadores.pendientesVistoBueno})`,
  ];

  const highlights: DailyBriefItem[] = [];
  const seen = new Set<string>();
  const orderedLists = [
    brief.items.vencidas,
    brief.items.venceHoy,
    brief.items.pendientesVistoBueno,
    brief.items.ordenesNuevas,
    brief.items.agendaDia,
  ];

  for (const list of orderedLists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      highlights.push(item);
      if (highlights.length >= 5) break;
    }
    if (highlights.length >= 5) break;
  }

  if (highlights.length > 0) {
    lines.push("", "Prioridades:");
    for (const item of highlights) {
      lines.push(formatItemLine(item));
    }
  }

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDailyBriefHtml(brief: DailyBrief): string {
  const paragraphs = formatDailyBriefText(brief)
    .split("\n")
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<br />"))
    .join("");
  return `<div>${paragraphs}</div>`;
}

export async function sendDailyBriefEmailHook(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    const result = await sendNotificationEmail(input.to, input.subject, {
      title: input.subject,
      message: input.text,
      locale: "es",
      actionUrl: getAgendaPublicUrl(),
      actionLabel: "Abrir AGENDA",
    });

    if (result.success) {
      return { sent: true };
    }

    return {
      sent: false,
      reason:
        result.reason === "SMTP_NOT_CONFIGURED"
          ? "smtp_not_configured"
          : (result.reason ?? "smtp_error"),
    };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "smtp_error",
    };
  }
}

export async function runScheduledDailyBriefs(
  now: Date = new Date(),
): Promise<{ degraded: boolean; sentCount: number }> {
  const ntfyAvailable = isNtfyConfigured();
  const smtpAvailable = isSmtpConfigured();

  if (!ntfyAvailable && !smtpAvailable) {
    return { degraded: true, sentCount: 0 };
  }

  const dateKey = getCaracasDateKey(now);
  const subscriptions = await db
    .select({
      userId: agendaNtfySubscriptionTable.userId,
      topicEncrypted: agendaNtfySubscriptionTable.topicEncrypted,
      userEmail: userTable.email,
      workspaceId: workspaceUserTable.workspaceId,
      workspaceName: workspaceTable.name,
    })
    .from(agendaNtfySubscriptionTable)
    .innerJoin(userTable, eq(agendaNtfySubscriptionTable.userId, userTable.id))
    .innerJoin(
      workspaceUserTable,
      eq(workspaceUserTable.userId, agendaNtfySubscriptionTable.userId),
    )
    .innerJoin(
      workspaceTable,
      eq(workspaceTable.id, workspaceUserTable.workspaceId),
    )
    .where(
      and(
        eq(agendaNtfySubscriptionTable.enabled, true),
        eq(agendaNtfySubscriptionTable.eventDailyBrief, true),
        eq(userTable.banned, false),
        isNull(workspaceTable.archivedAt),
      ),
    );

  let degraded = !ntfyAvailable;
  let sentCount = 0;

  for (const row of subscriptions) {
    const [claimed] = await db
      .insert(dailyBriefSentTable)
      .values({
        userId: row.userId,
        workspaceId: row.workspaceId,
        dateKey,
        channels: [],
      })
      .onConflictDoNothing({
        target: [
          dailyBriefSentTable.userId,
          dailyBriefSentTable.workspaceId,
          dailyBriefSentTable.dateKey,
        ],
      })
      .returning({ id: dailyBriefSentTable.id });

    if (!claimed) continue;

    try {
      const brief = await generateDailyBriefForUser(
        row.workspaceId,
        row.userId,
        { useLlm: true, now },
      );
      const text = formatDailyBriefText(brief);
      const html = formatDailyBriefHtml(brief);
      const channels: string[] = [];

      if (ntfyAvailable) {
        const topic = decryptSecret(row.topicEncrypted);
        if (topic) {
          try {
            await publishNtfyMessage({
              topic,
              title: `Parte diario — ${row.workspaceName}`,
              body: text,
              priority: brief.contadores.vencidas > 0 ? 4 : 3,
              tags: "clipboard,calendar",
              clickUrl: `${getAgendaPublicUrl()}/dashboard/workspace/${row.workspaceId}`,
            });
            channels.push("ntfy");
          } catch (error) {
            degraded = true;
            console.error(
              `[parte-diario] Error enviando ntfy a ${row.userId}:`,
              error,
            );
          }
        }
      }

      if (row.userEmail) {
        const emailResult = await sendDailyBriefEmailHook({
          to: row.userEmail,
          subject: `Parte diario — ${brief.fechaLarga}`,
          text,
          html,
        });
        if (emailResult.sent) {
          channels.push("email");
        }
      }

      if (channels.length > 0) {
        await db
          .update(dailyBriefSentTable)
          .set({ channels })
          .where(eq(dailyBriefSentTable.id, claimed.id));
        sentCount += 1;
      } else {
        await db
          .delete(dailyBriefSentTable)
          .where(eq(dailyBriefSentTable.id, claimed.id));
      }
    } catch (error) {
      degraded = true;
      await db
        .delete(dailyBriefSentTable)
        .where(eq(dailyBriefSentTable.id, claimed.id))
        .catch(() => {});
      console.error(
        `[parte-diario] Error generando parte para ${row.userId} en ${row.workspaceId}:`,
        error,
      );
    }
  }

  return { degraded, sentCount };
}
