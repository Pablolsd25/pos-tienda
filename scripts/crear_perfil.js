const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rkxkbqqjjtblflwnkrpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGticXFqanRibGZsd25rcnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTg1MjMsImV4cCI6MjA5NDI5NDUyM30.hVZcsnUBrYRUTj-tWtIFzAr-QikVE1BabJNoGPo4J4o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function crearPerfil() {
  const { error } = await supabase.from('perfiles').insert({
    id: '9cb174ab-2303-41a4-9b1c-a52383d83ca7',
    nombre: 'Admin',
    rol: 'admin',
    activo: true
  });

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Perfil creado correctamente');
  }
}

crearPerfil();