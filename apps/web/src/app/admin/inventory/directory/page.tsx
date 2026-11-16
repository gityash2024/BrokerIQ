import { redirect } from 'next/navigation';

export default function DirectoryRedirect() {
  redirect('/admin/inventory');
}
