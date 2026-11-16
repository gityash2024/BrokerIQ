import { redirect } from 'next/navigation';

export default function DirectoryRedirect() {
  redirect('/broker/inventory');
}
