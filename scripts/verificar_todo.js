const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rkxkbqqjjtblflwnkrpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGticXFqanRibGZsd25rcnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTg1MjMsImV4cCI6MjA5NDI5NDUyM30.hVZcsnUBrYRUTj-tWtIFzAr-QikVE1BabJNoGPo4J4o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificar() {
  // Ver perfiles
  const { data: perfiles } = await supabase.from('perfiles').select('*');
  console.log('Perfiles:', perfiles);
  
  // Ver categorías
  const { data: cats } = await supabase.from('categorias').select('*');
  console.log('Categorías:', cats?.length);
  
  // Ver productos
  const { data: prods } = await supabase.from('productos').select('*').limit(5);
  console.log('Productos:', prods?.length);
}

verificar();