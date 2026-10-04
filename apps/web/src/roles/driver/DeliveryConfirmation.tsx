import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { queueOp } from '../../offline';
import { useRunCtx } from './useRun';
import { SignaturePad } from './SignaturePad';
import { fileToDataUrl } from './image';
import { Btn, Card, Chip } from '../loader/ui';
import type { DeliverPayload } from './types';

export default function DeliveryConfirmation() {
  const { stopId = '' } = useParams();
  const nav = useNavigate();
  const { stops } = useRunCtx();
  const stop = stops.find((s) => s.id === stopId);
  const [qty, setQty] = useState(stop?.parcels ?? 0);
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!stop) return <p className="p-4 text-sm">Stop not found.</p>;

  const ready = !!photo && !!signature && recipient.trim().length > 1 && qty >= 0;
  const partial = qty < stop.parcels;

  async function complete() {
    if (!ready) return;
    setBusy(true);
    const payload: DeliverPayload = { deliveredQty: qty, recipient: recipient.trim(), signature: signature!, photo: photo!, note: note.trim() || undefined };
    await queueOp('deliver', stop!.id, payload); // saved on the device first, sent when possible
    nav('/driver');
  }

  return (
    <div className="space-y-4 p-4 pb-8">
      <Link to={`/driver/stop/${stop.id}`} className="text-xs font-semibold text-[#C2501B]">← Stop details</Link>
      <div>
        <div className="text-xs font-semibold text-[#C2501B]">STOP {stop.seq} · {stop.orderId}</div>
        <h1 className="text-xl font-semibold">Confirm delivery</h1>
        <p className="text-sm text-slate-500">{stop.outletName}</p>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Parcels handed over</h2>{partial ? <Chip tone="orange">Partial delivery</Chip> : <Chip tone="green">Full</Chip>}</div>
        <div className="flex items-center gap-4">
          <Btn variant="ghost" className="!h-12 !w-12" onClick={() => setQty(Math.max(0, qty - 1))} aria-label="Fewer">−</Btn>
          <span className="min-w-12 text-center text-3xl font-semibold">{qty}</span>
          <Btn variant="ghost" className="!h-12 !w-12" onClick={() => setQty(Math.min(stop.parcels, qty + 1))} aria-label="More">+</Btn>
          <span className="text-sm text-slate-500">of {stop.parcels}</span>
        </div>
        {partial && <p className="mt-2 text-xs text-[#8F3A12]">Add a note below so the store knows what is missing.</p>}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Delivery photo</h2><Chip tone="orange">Required</Chip></div>
        {photo ? (
          <div>
            <img src={photo} alt="Proof of delivery" className="max-h-56 w-full rounded-xl object-cover" />
            <button className="mt-1 min-h-9 text-sm font-semibold text-[#C2501B]" onClick={() => setPhoto(null)}>Retake</button>
          </div>
        ) : (
          <label className="grid min-h-40 cursor-pointer place-items-center rounded-xl border border-dashed border-[#FFD3BD] bg-[#FFF8F3] p-4 text-center text-sm">
            <span><b className="block text-base">Add proof photo</b>Show the parcels at the handoff point. Avoid faces and documents.</span>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { setPhoto(await fileToDataUrl(f)); setErr(null); } catch (x) { setErr((x as Error).message); }
            }} />
          </label>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Recipient signature</h2><Chip tone="orange">Required</Chip></div>
        <label className="block text-xs font-semibold">Recipient name
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Name of person receiving" className="mb-3 mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base" />
        </label>
        <SignaturePad onChange={setSignature} />
      </Card>

      <label className="block text-xs font-semibold">Note for dispatch (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base" />
      </label>

      {err && <p className="text-sm text-[#B93815]">{err}</p>}
      {!ready && <p className="text-xs text-[#8F3A12]">Add a photo, the recipient's name and a signature to complete this stop.</p>}
      <Btn variant="primary" className="w-full" disabled={!ready || busy} onClick={complete}>{busy ? 'Saving…' : 'Complete stop'}</Btn>
    </div>
  );
}
