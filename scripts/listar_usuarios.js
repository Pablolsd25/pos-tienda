const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rkxkbqqjjtblflwnkrpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGticXFqanRibGZsd25rcnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTg1MjMsImV4cCI6MjA5NDI5NDUyM30.hVZcsnUBrYRUTj-tWtIFzAr-QikVE1BabJNoGPo4J4o';

const supabase = createClient(supabaseUrl, supabaseKey);

// Buscar usuario y confirmar
async function confirmarUsuario() {
  // Listar usuarios
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  const data = await response.json();
  console.log('Usuarios:', JSON.stringify(data, null, 2));
}

confirmarUsuario();