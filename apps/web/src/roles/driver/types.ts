export type StopStatus = 'upcoming' | 'next' | 'arrived' | 'delivered' | 'unable';
export interface Stop {
  id: string;
  seq: number;
  orderId: string;
  outletName: string;
  address: string;
  windowOpen: string;
  windowClose: string;
  parcels: number;
  temp: 'chilled' | 'ambient';
  status: StopStatus;
  eta: string;
  instructions: string;
}
export interface Run {
  route: { id: string; vehicleId: string; status: string; name: string };
  stops: Stop[];
}
export interface DeliverPayload {
  deliveredQty: number;
  recipient: string;
  signature: string;
  photo: string;
  note?: string;
}
export interface ExceptionPayload {
  reason: string;
  details: string;
  requestedAction: string;
}
