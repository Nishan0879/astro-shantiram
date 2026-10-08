// Shared by admin pages and their client components, so it must stay free of server-only imports

export type IssueStatus = "draft" | "sending" | "sent";

export type NewsletterIssue = {
  id: string;
  subject: string;
  body: string;
  status: IssueStatus;
  recipientCount: number;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

export type SubscriberCounts = { pending: number; subscribed: number; unsubscribed: number };

export type SendProgress = { issue: NewsletterIssue; sent: number; failed: number; remaining: number };

export type Subscriber = {
  id: string;
  email: string;
  locale: string | null;
  status: keyof SubscriberCounts;
  createdAt: string;
  confirmedAt: string | null;
};
