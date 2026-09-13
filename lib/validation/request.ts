import type { ZodType } from 'zod';

type ParsedRequest<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

export async function parseJsonRequest<T>(
  request: Request,
  schema: ZodType<T>
): Promise<ParsedRequest<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: 'INVALID_JSON' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: Response.json(
        {
          error: 'INVALID_BODY',
          issues: parsed.error.issues.map(issue => ({
            path: issue.path.map(String).join('.') || '$',
            message: issue.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export function invalidPathParameter(parameter: string): Response {
  return Response.json(
    {
      error: 'INVALID_PATH_PARAMETER',
      issues: [{ path: parameter, message: 'Expected a UUID.' }],
    },
    { status: 400 }
  );
}
