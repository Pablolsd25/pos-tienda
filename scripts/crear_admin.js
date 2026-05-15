const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rkxkbqqjjtblflwnkrpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGticXFqanRibGZsd25rcnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTg1MjMsImV4cCI6MjA5NDI5NDUyM30.hVZcsnUBrYRUTj-tWtIFzAr-QikVE1BabJNoGPo4J4o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function crearTodo() {
  // Crear usuario (el email debe ser único)
  const { data: user, error } = await supabase.auth.admin.createUser({
    email: 'admin@tienda.com',
    password: 'tienda123',
    email_confirm: true,  // Confirma el email automáticamente
    user_metadata: { nombre: 'Admin' }
  });

  if (error) {
    console.log('Error creando usuario:', error.message);
    return;
  }

  console.log('Usuario creado:', user.user.id);

  // Crear perfil
  const { error: errorPerfil } = await supabase.from('perfiles').insert({
    id: user.user.id,
    nombre: 'Admin',
    rol: 'admin',
    activo: true
  });

  if (errorPerfil) {
    console.log('Error creando perfil:', errorPerfil.message);
  } else {
    console.log('Perfil creado correctamente');
    console.log('\n=== CREDENCIALES ===');
    console.log('Email: admin@tienda.com');
    console.log('Password: tienda123');
  }
}

crearTodo();