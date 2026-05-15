const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rkxkbqqjjtblflwnkrpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGticXFqanRibGZsd25rcnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTg1MjMsImV4cCI6MjA5NDI5NDUyM30.hVZcsnUBrYRUTj-tWtIFzAr-QikVE1BabJNoGPo4J4o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function crearUsuario() {
  const email = 'admin@tienda.com';
  const password = 'tienda123';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.log('Error:', error.message);
    
    // Si ya existe, intentar iniciar sesión para obtener el user
    if (error.message.includes('already registered')) {
      console.log('El usuario ya existe, intentando crear perfil...');
      return;
    }
  } else {
    console.log('Usuario creado:', data.user?.id);
  }
}

crearUsuario();