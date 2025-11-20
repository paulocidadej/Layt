import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const customers = [
  { id: 1, name: "Customer A" },
  { id: 2, name: "Customer B" },
];

const vessels = [
    { id: 1, name: "MV Example" },
    { id: 2, name: "MV Sample" },
  ];

export default function DataPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Data Management</h1>

      {/* Customers Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Customers</h2>
        <div className="flex gap-4 mb-4">
          <Input placeholder="New Customer Name" className="max-w-xs" />
          <Button>Add Customer</Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                    <Button variant="ghost" size="sm" className="text-red-500">Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Vessels Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Vessels</h2>
        <div className="flex gap-4 mb-4">
          <Input placeholder="New Vessel Name" className="max-w-xs" />
          <Button>Add Vessel</Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vessel Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vessels.map((vessel) => (
                <TableRow key={vessel.id}>
                  <TableCell>{vessel.name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                    <Button variant="ghost" size="sm" className="text-red-500">Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add other sections here following the same pattern */}
      {/* Cargo, Owners, Charterers, Charter Parties, Counter Parties, Ports, Terms */}

    </div>
  );
}
