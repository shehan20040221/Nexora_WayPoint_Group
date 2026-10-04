import { Navigate, Route, Routes } from 'react-router-dom';
import Overview from './Overview';
import PlaceOrder from './PlaceOrder';
import Track from './Track';
import Issues from './Issues';
import { ConfirmReceipt, ReceiptsList } from './Receipts';

export default function StoreRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="order" element={<PlaceOrder />} />
      <Route path="track" element={<Track />} />
      <Route path="receipts" element={<ReceiptsList />} />
      <Route path="receipts/:id" element={<ConfirmReceipt />} />
      <Route path="issues" element={<Issues />} />
      <Route path="*" element={<Navigate to="/store" replace />} />
    </Routes>
  );
}
