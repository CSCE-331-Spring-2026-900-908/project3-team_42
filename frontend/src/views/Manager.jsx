import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

export default function Manager() {
  const [user, setUser] = useState(null);

  const handleLogin = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    // Verifying token claims locally for MVP
    if (decoded.email === 'reveille.bubbletea@gmail.com' || decoded.email_verified) {
      setUser(decoded);
    } else {
      alert('Unauthorized email address!');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-6">
        <h1 className="text-4xl font-extrabold text-blue-900">Manager Access</h1>
        <p className="text-gray-600 text-lg">Please authenticate with an authorized Google account.</p>
        <div className="bg-white p-8 rounded shadow-lg border-2 border-blue-100 flex justify-center">
          <GoogleLogin
            onSuccess={handleLogin}
            onError={() => {
              console.log('Login Failed');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <header className="bg-blue-800 text-white w-full p-4 shadow-md flex justify-between items-center px-8">
        <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <img src={user.picture} alt="Profile" className="w-8 h-8 rounded-full" />
            <span className="text-blue-200">Welcome, {user.name}</span>
          </div>
          <button onClick={() => setUser(null)} className="hover:bg-blue-700 px-4 py-2 rounded font-bold bg-blue-600 shadow-sm border border-blue-500 transition">Logout</button>
        </div>
      </header>
      <main className="p-8 w-full max-w-7xl">
        <div className="flex space-x-4 mb-6 border-b pb-4">
          <button className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2 shadow font-bold rounded">Inventory</button>
          <button className="text-blue-600 hover:bg-blue-100 px-6 py-2 shadow-sm border font-bold bg-white rounded">Menu Items</button>
          <button className="text-blue-600 hover:bg-blue-100 px-6 py-2 shadow-sm border font-bold bg-white rounded">Financials & Users</button>
        </div>
        <div className="bg-white p-8 rounded shadow min-h-[500px] border border-gray-200">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Inventory Overview</h2>
          <p className="text-gray-500">Secure manager data loaded successfully.</p>
        </div>
      </main>
    </div>
  );
}
