import { session, checkOrigin, failure, UUID } from '@/lib/arena/server';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    const choice = body.choice as 'left' | 'right' | 'tie' | 'bad';
    if (!UUID.test(body.id ?? '') || !['left', 'right', 'tie', 'bad'].includes(choice)) {
      throw new Error('Invalid vote.');
    }

    const { db } = await session();
    const { data, error } = await db.rpc('arena_vote', { p_battle: body.id, p_choice: choice });
    if (error) throw new Error(error.message);
    return Response.json({ battle: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
