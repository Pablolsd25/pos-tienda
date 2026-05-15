const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rkxkbqqjjtblflwnkrpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGticXFqanRibGZsd25rcnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTg1MjMsImV4cCI6MjA5NDI5NDUyM30.hVZcsnUBrYRUTj-tWtIFzAr-QikVE1BabJNoGPo4J4o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function crearUsuarioYPerfil() {
  console.log('1. Creando usuario...');
  
  // Intentar registrar
  const { data, error } = await supabase.auth.signUp({
    email: 'test@tienda.com',
    password: 'test1234',
  });

  console.log('signup result:', { data, error });
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (data.user) {
    console.log('User ID:', data.user.id);
    
    // Crear perfil
    console.log('2. Creando perfil...');
    const { error: perfilError } = await supabase.from('perfiles').insert({
      id: data.user.id,
      nombre: 'Test',
      rol: 'admin',
      activo: true
    });
    
    console.log('perfil error:', perfilError);
  }
}

crearUsuarioYPerfil();