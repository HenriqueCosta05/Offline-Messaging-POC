export type PermissionRowProps = {
  title: string;
  reason: string;
  status: string;
  actionable: boolean;
  onRequest: () => void;
};
