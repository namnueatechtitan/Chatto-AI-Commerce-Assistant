export interface LiveMessage {
  id: string;
  customerName: string;
  customerAvatar?: string;
  message: string;
  timestamp: string;
  unread: boolean;
  channel: "LINE";
}
