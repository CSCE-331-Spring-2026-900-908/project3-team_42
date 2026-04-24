import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Portal from './views/Portal';
import Manager from './views/Manager';
import Cashier from './views/Cashier';
import CustomerKiosk from './views/CustomerKiosk';
import MenuBoard from './views/MenuBoard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/manager" element={<Manager />} />
        <Route path="/cashier" element={<Cashier />} />
        <Route path="/customer" element={<CustomerKiosk />} />
        <Route path="/menuboard" element={<MenuBoard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
