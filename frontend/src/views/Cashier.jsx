import { useState, useEffect } from 'react';
import api from '../api';

export default function Cashier() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const cashierId = 2; // Hardcoded to 'Cashier Alice' from the database seed

  useEffect(() => {
    api.get('/menu').then(res => setMenuItems(res.data)).catch(console.error);
  }, []);

  const addToCart = (item) => {
    setCart([...cart, { ...item, unique_id: Date.now(), quantity: 1, customization: null }]);
  };

  const removeFromCart = (unique_id) => {
    setCart(cart.filter(item => item.unique_id !== unique_id));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    
    const total_amount = cart.reduce((sum, item) => sum + parseFloat(item.default_price) * item.quantity, 0);
    
    try {
      const formattedItems = cart.map(i => ({
        menu_item_id: i.id,
        quantity: i.quantity,
        customization: i.customization,
        price: i.default_price
      }));
      
      const res = await api.post('/orders', {
        cashier_id: cashierId,
        total_amount,
        items: formattedItems
      });
      
      alert(res.data.message + ` (Order #${res.data.id})`);
      setCart([]); // Reset Cart
    } catch (err) {
      alert('Checkout failed: ' + err.message);
    }
  };

  const total = cart.reduce((sum, item) => sum + parseFloat(item.default_price) * item.quantity, 0);

  return (
    <div className="min-h-screen bg-green-50 flex">
      <div className="flex-1 p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max overflow-y-auto pb-12">
        {menuItems.map(item => (
          <button 
            key={item.id} 
            onClick={() => addToCart(item)}
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow h-40 flex flex-col items-center justify-center border-2 border-green-200 active:bg-green-100 cursor-pointer focus:ring-4 focus:ring-green-300 outline-none">
            <span className="text-2xl font-bold text-center text-gray-800 leading-tight">{item.name}</span>
            <span className="text-green-700 font-bold mt-3 text-xl bg-green-50 px-4 py-1 rounded-lg">${parseFloat(item.default_price).toFixed(2)}</span>
          </button>
        ))}
      </div>
      
      {/* Sidebar Cart */}
      <div className="w-96 bg-white shadow-2xl flex flex-col border-l border-green-200 z-10">
        <div className="p-6 bg-green-800 text-white flex justify-between items-center shadow-md">
          <span className="text-2xl font-black">Current Order</span>
          <span className="bg-green-600 px-4 py-1 rounded-full text-md font-bold shadow-inner">{cart.length} ITEMS</span>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50 border-b border-gray-200">
          {cart.map(item => (
            <div key={item.unique_id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <div className="font-bold text-gray-800 text-lg">{item.name}</div>
                <div className="text-md text-green-700 font-semibold">${parseFloat(item.default_price).toFixed(2)}</div>
              </div>
              <button 
                onClick={() => removeFromCart(item.unique_id)} 
                className="text-red-500 hover:text-white font-bold px-4 py-3 hover:bg-red-500 bg-red-50 rounded-lg transition-colors cursor-pointer text-lg">
                ✕
              </button>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-10 space-y-4">
              <svg className="w-20 h-20 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <div className="text-center font-bold text-2xl">
                Tap items to add to order
              </div>
            </div>
          )}
        </div>
        
        <div className="p-8 bg-white flex flex-col space-y-6">
          <div className="flex justify-between text-3xl text-gray-800 items-end">
            <span className="font-semibold">Total:</span>
            <span className="font-black text-green-700">${total.toFixed(2)}</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-3xl font-black py-6 rounded-2xl hover:bg-green-700 active:bg-green-800 transition shadow-lg cursor-pointer transform active:scale-95">
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
