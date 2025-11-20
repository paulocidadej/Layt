import Link from "next/link";
import {
  LayoutDashboard,
  Ship,
  FileText,
  Database,
  Settings,
} from "lucide-react";

export function SideNav() {
  return (
    <div className="flex h-full flex-col px-3 py-4 md:px-2">
      <div className="mb-2 flex h-20 items-end justify-start rounded-md bg-gradient-to-r from-blue-500 to-green-500 p-4">
        <Link href="/" className="text-white text-2xl font-bold">
          Laytime App
        </Link>
      </div>
      <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2">
        <nav className="flex flex-col space-y-2">
          <Link
            href="/"
            className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
          >
            <LayoutDashboard className="w-6" />
            <p className="hidden md:block">Dashboard</p>
          </Link>
          <Link
            href="/voyages"
            className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
          >
            <Ship className="w-6" />
            <p className="hidden md:block">Voyages</p>
          </Link>
          <Link
            href="/claims"
            className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
          >
            <FileText className="w-6" />
            <p className="hidden md:block">Claims</p>
          </Link>
          <Link
            href="/data"
            className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
          >
            <Database className="w-6" />
            <p className="hidden md:block">Data</p>
          </Link>
        </nav>
        <div className="hidden h-auto w-full grow rounded-md bg-gray-50 md:block"></div>
        <div className="flex h-[48px] w-full grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3">
          <Settings className="w-6" />
          <div className="hidden md:block">Settings</div>
        </div>
      </div>
    </div>
  );
}
