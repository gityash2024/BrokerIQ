import Link from 'next/link';
const links = [
  ['Health & jobs', '/admin/health'],
  ['Audit log', '/admin/audit'],
  ['App & release settings', '/admin/settings/app'],
  ['Localities', '/admin/localities'],
  ['Amenities', '/admin/amenities'],
  ['Message templates', '/admin/templates'],
  ['Legacy feature switches', '/admin/settings/flags'],
];
export default function SystemPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">System</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map(([title, href]) => (
          <Link key={href} href={href} className="rounded-2xl border border-line bg-surface p-5 font-semibold">
            {title} →
          </Link>
        ))}
      </div>
    </>
  );
}
