export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };
export async function result<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() }; }
  catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message, code: error.code };
    if (error instanceof Error && error.name === 'ZodError') return { ok: false, error: '请检查填写内容、日期和坐标', code: 'INVALID_INPUT' };
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event: 'operation_failed', name: error instanceof Error ? error.name : 'unknown', code: error && typeof error === 'object' && 'code' in error ? error.code : undefined }));
    return { ok: false, error: '服务暂时无法完成操作，请重试；未保存的表单会保留', code: 'SERVER_ERROR' };
  }
}
