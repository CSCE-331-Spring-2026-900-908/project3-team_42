import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AccessibilityProvider } from './context/AccessibilityContext';
import AccessibilityPanel from './components/AccessibilityPanel';
import Portal from './views/Portal';
import Manager from './views/Manager';
import Cashier from './views/Cashier';
import CustomerKiosk from './views/CustomerKiosk';
import MenuBoard from './views/MenuBoard';

function App() {
  return (
    <BrowserRouter>
      <AccessibilityProvider>
        <AccessibilityPanel />
        <Routes>
          <Route path="/" element={<Portal />} />
          <Route path="/manager" element={<Manager />} />
          <Route path="/cashier" element={<Cashier />} />
          <Route path="/customer" element={<CustomerKiosk />} />
          <Route path="/menuboard" element={<MenuBoard />} />
        </Routes>
      </AccessibilityProvider>
    </BrowserRouter>
  );
}

export default App;
