import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { CreateVoyageDialog } from "@/components/voyages/CreateVoyageDialog";

const voyages = [
  {
    voyageReference: "VOY-001",
    vesselName: "MV Example",
    customerName: "Customer A",
    counterPartyName: "Counter Party 1",
    voyageNumber: "VN-101",
  },
  {
    voyageReference: "VOY-002",
    vesselName: "MV Sample",
    customerName: "Customer B",
    counterPartyName: "Counter Party 2",
    voyageNumber: "VN-102",
  },
];

export default function VoyagesPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Voyages</h1>
        <CreateVoyageDialog />
      </div>

      {/* Filters section - placeholder */}
      <div className="mb-4">
        <p>Filters will go here.</p>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voyage Reference</TableHead>
              <TableHead>Vessel Name</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Counter Party Name</TableHead>
              <TableHead>Voyage Number</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {voyages.map((voyage) => (
              <TableRow key={voyage.voyageReference}>
                <TableCell>{voyage.voyageReference}</TableCell>
                <TableCell>{voyage.vesselName}</TableCell>
                <TableCell>{voyage.customerName}</TableCell>
                <TableCell>{voyage.counterPartyName}</TableCell>
                <TableCell>{voyage.voyageNumber}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Remove</DropdownMenuItem>
                      <DropdownMenuItem>Create Claim</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
