import { prisma } from "@/lib/prisma";
import { HistoryEntry, CategoryRule, AnalysisLog } from "@/types";

export async function getHistory(): Promise<HistoryEntry[]> {
  // Placeholder implementation
  return [];
}

export async function getCategoryRules(): Promise<CategoryRule[]> {
  // Placeholder implementation
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function saveCategoryRules(_rules: CategoryRule[]): Promise<void> {
  // Placeholder implementation
}

export async function resetAllData(): Promise<void> {
  // Placeholder implementation
}

export async function getAnalysisLogs(): Promise<AnalysisLog[]> {
  const logs = await prisma.analysisLog.findMany({
    orderBy: { date: 'desc' },
  });

  return logs.map(log => ({
    ...log,
    sources: typeof log.sources === 'string' ? JSON.parse(log.sources) : log.sources
  })) as AnalysisLog[];
}

export async function saveAnalysisLog(log: Omit<AnalysisLog, "id">): Promise<AnalysisLog> {
  const created = await prisma.analysisLog.create({
    data: {
      date: log.date,
      title: log.title,
      summary: log.summary,
      script: log.script,
      sources: JSON.stringify(log.sources),
    },
  });

  return {
    ...created,
    sources: created.sources ? JSON.parse(created.sources) : []
  } as AnalysisLog;
}
