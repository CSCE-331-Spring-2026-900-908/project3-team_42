import { Link } from 'react-router-dom';

export default function Portal() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 space-y-8 p-4">
      <h1 className="text-4xl font-bold mb-8">POS Portal Hub</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Link to="/manager" className="p-8 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition flex flex-col items-center text-center">
          <span className="text-2xl font-bold">Manager Mode</span>
          <span className="mt-2 opacity-80">Desktop interface for inventory and metrics</span>
        </Link>
        
        <Link to="/cashier" className="p-8 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition flex flex-col items-center text-center">
          <span className="text-2xl font-bold">Cashier POS</span>
          <span className="mt-2 opacity-80">Fast touchscreen ordering interface</span>
        </Link>

        <Link to="/customer" className="p-8 bg-purple-600 text-white rounded-xl shadow-lg hover:bg-purple-700 transition flex flex-col items-center text-center">
          <span className="text-2xl font-bold">Customer Kiosk</span>
          <span className="mt-2 opacity-80">Accessible self-service terminal</span>
        </Link>

        <Link to="/menuboard" className="p-8 bg-orange-600 text-white rounded-xl shadow-lg hover:bg-orange-700 transition flex flex-col items-center text-center">
          <span className="text-2xl font-bold">Menu Board</span>
          <span className="mt-2 opacity-80">Large display interface</span>
        </Link>
      </div>
    </div>
  );
}
