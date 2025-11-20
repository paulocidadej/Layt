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
import { cn } from "@/lib/utils";
import { CreateClaimDialog } from "@/components/claims/CreateClaimDialog";
import Link from "next/link";

const claims = [
  {
    claimReference: "CLM-001",
    vesselName: "MV Example",
    customerName: "Customer A",
    counterPartyName: "Counter Party 1",
    voyageNumber: "VN-101",
    portName: "Port of Rotterdam",
    claimStatus: "In Progress",
    amount: -25000, // Negative for Demurrage
  },
  {
    claimReference: "CLM-002",
    vesselName: "MV Sample",
    customerName: "Customer B",
    counterPartyName: "Counter Party 2",
    voyageNumber: "VN-102",
    portName: "Port of Singapore",
    claimStatus: "Settled",
    amount: 15000, // Positive for Despatch
  },
];

export default function ClaimsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Claims</h1>
        <CreateClaimDialog />
      </div>

      {/* Filters section - placeholder */}
      <div className="mb-4">
        <p>Filters will go here.</p>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim Reference</TableHead>
              <TableHead>Vessel Name</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Counter Party Name</TableHead>
              <TableHead>Voyage Number</TableHead>
              <TableHead>Port Name</TableHead>
              <TableHead>Claim Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <TableRow key={claim.claimReference}>
                <TableCell>{claim.claimReference}</TableCell>
                <TableCell>{claim.vesselName}</TableCell>
                <TableCell>{claim.customerName}</TableCell>
                <TableCell>{claim.counterPartyName}</TableCell>
                <TableCell>{claim.voyageNumber}</TableCell>
                <TableCell>{claim.portName}</TableCell>
                <TableCell>{claim.claimStatus}</TableCell>
                <TableCell
                  className={cn({
                    "text-red-500": claim.amount < 0,
                    "text-green-500": claim.amount > 0,
                  })}
                >
                  {claim.amount < 0 ? "Demurrage" : "Despatch"}: $
                  {Math.abs(claim.amount)}
                </TableCell>
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
                      <Link href={`/claims/${claim.claimReference}/calculation`}>
                        <DropdownMenuItem>View Calculation</DropdownMenuItem>
                      </Link>
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
