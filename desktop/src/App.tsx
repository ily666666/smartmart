import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cashier from './pages/Cashier';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import Pairing from './pages/Pairing';
import Samples from './pages/Samples';
import Database from './pages/Database';
import "./App.css";

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cashier" element={<Cashier />} />
          <Route path="/products" element={<Products />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/reports" element={<Reports />} />
          {/* 兼容旧链接，重定向到数据中心 */}
          <Route path="/analysis" element={<Navigate to="/reports" replace />} />
          <Route path="/pairing" element={<Pairing />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/database" element={<Database />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
