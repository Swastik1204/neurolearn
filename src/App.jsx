import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Learn from "./pages/Learn.jsx";
import Draw from "./pages/Draw.jsx";
import Profile from "./pages/Profile.jsx";
import Login from "./pages/Login.jsx";

function App() {
  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/draw" element={<Draw />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
