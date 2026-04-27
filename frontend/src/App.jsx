import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Portal from './views/Portal';
import Manager from './views/Manager';
import Cashier from './views/Cashier';
import CustomerKiosk from './views/CustomerKiosk';
import CheckoutPage from './views/CheckoutPage';
import MenuBoard from './views/MenuBoard';
import OrderConfirmation from './views/OrderConfirmation';
import { AccessibilityProvider } from './context/AccessibilityContext';
import AccessibilityPanel from './components/AccessibilityPanel';
import { getActivePortalPath } from './lib/portalLock';

function PortalRoute() {
  const activePortalPath = getActivePortalPath();
  if (activePortalPath) {
    return <Navigate to={activePortalPath} replace />;
  }

  return <Portal />;
}

function App() {
  return (
    <AccessibilityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PortalRoute />} />
          <Route path="/manager" element={<Manager />} />
          <Route path="/cashier" element={<Cashier />} />
          <Route path="/customer" element={<CustomerKiosk />} />
          <Route path="/customer/checkout" element={<CheckoutPage />} />
          <Route path="/customer/confirmation" element={<OrderConfirmation />} />
          <Route path="/menuboard" element={<MenuBoard />} />
        </Routes>
        <AccessibilityPanel />
      </BrowserRouter>
    </AccessibilityProvider>
  );
}

export default App;
