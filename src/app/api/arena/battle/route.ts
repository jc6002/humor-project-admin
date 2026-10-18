import { session, failure, UUID } from '@/lib/arena/server';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    const skipParam = params.get('skip');
    const requestId = params.get('request');
    const skipIds = skipParam ? skipParam.split(',').filter((x) => UUID.test(x)).slice(0, 50) : null;
    if ((id && !UUID.test(id)) || (requestId && !UUID.test(requestId))) throw new Error('Invalid battle.');

    const { db } = await session();
    const { data, error } = requestId
      ? await db.rpc('arena_request', { p_request: requestId })
      : await db.rpc('arena_battle', { p_id: id, p_skip: skipIds?.length ? skipIds : null });
    if (error) throw new Error('The arena is unavailable. Please try again shortly.');
    const { data: quota } = await db.rpc('arena_quota');
    return Response.json({ battle: data, quota }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
