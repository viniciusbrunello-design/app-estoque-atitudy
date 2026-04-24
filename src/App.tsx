import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Estoque from './pages/Estoque';
import Movimentacoes from './pages/Movimentacoes';
import Assistente from './pages/Assistente';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="estoque" element={<Estoque />} />
          <Route path="movimentacoes" element={<Movimentacoes />} />
          <Route path="assistente" element={<Assistente />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
