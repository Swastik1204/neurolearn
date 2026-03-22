import { RouterProvider } from 'react-router-dom';
import router from './router';
import OfflineBanner from './components/OfflineBanner';
import './index.css';

export default function App() {
  return (
    <>
      <OfflineBanner />
      <RouterProvider router={router} />
    </>
  );
}
