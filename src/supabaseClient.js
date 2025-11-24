
import { createClient } from '@supabase/supabase-js'

// TODO: Replace with your actual Supabase project URL and Anon Key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tybetiakybwyqmntwfxd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5YmV0aWFreWJ3eXFtbnR3ZnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5ODUyMTcsImV4cCI6MjA3OTU2MTIxN30.-aKbTK-CGz42Jkzf1dRqzPeO_9gtPSBoRoP6aRXGGpo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
