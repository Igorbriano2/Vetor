import SidebarNav from "./SidebarNav";

export default function VetorAppShell({
  orgNome,
  userNome,
  children,
}: {
  orgNome?: string | null;
  userNome?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-petroleo text-areia">
      <SidebarNav orgNome={orgNome} userNome={userNome} />
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
