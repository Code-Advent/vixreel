
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vmbmjmwcdbtnxiwjfwht.supabase.co';
const supabaseAnonKey = 'sb_publishable_RhuzDGQLYyPsPzDzhYMmJA_YC1VsTyu';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
