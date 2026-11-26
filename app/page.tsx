import CreatorFeed from '@/components/CreatorFeed';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export default async function HomePage() {
  const supabase = createClient();
  const user = await getUser(supabase);

  return <CreatorFeed user={user} />;
}
