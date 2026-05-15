const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rkxkbqqjjtblflwnkrpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGticXFqanRibGZsd25rcnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTg1MjMsImV4cCI6MjA5NDI5NDUyM30.hVZcsnUBrYRUTj-tWtIFzAr-QikVE1BabJNoGPo4J4o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function probarLogin() {
  console.log('=== Probando login ===');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@tienda.com',
    password: 'tienda123',
  });

  if (error) {
    console.log('Error login:', error.message);
    return;
  }

  console.log('Login exitoso!');
  console.log('User ID:', data.user.id);
  console.log('Email:', data.user.email);

  // Verificar perfil
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', data.user.id);

  console.log('Perfil:', perfil);
}

probarLogin();