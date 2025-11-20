"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

const sofEvents = [
  {
    id: 1,
    deductionName: "Rain",
    from: "2025-11-20T10:00",
    to: "2025-11-20T12:00",
    rate: 100,
    timeUsed: "02:00:00",
    incrementalTime: "02:00:00",
  },
  {
    id: 2,
    deductionName: "NOR Tendered",
    from: "2025-11-20T12:00",
    to: "2025-11-20T12:00",
    rate: 0,
    timeUsed: "00:00:00",
    incrementalTime: "02:00:00",
  },
];

export default function CalculationPage({ params }: { params: { claimId: string } }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Laytime Calculation - Claim {params.claimId}</h1>
        <Button>Export to PDF</Button>
      </div>

      {/* Claim Information Section */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div><span className="font-semibold">Laytime Allowed:</span> 4 days</div>
        <div><span className="font-semibold">Laytime Used:</span> 5 days 12:00:00</div>
        <div className="text-red-500"><span className="font-semibold">Demurrage:</span> 1 day 12:00:00</div>
        <div className="text-red-500"><span className="font-semibold">Demurrage Amount:</span> $25,000</div>
      </div>

      {/* SOF Events Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deduction Name</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Rate (%)</TableHead>
              <TableHead>Time Used</TableHead>
              <TableHead>Incremental Time Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sofEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <Input defaultValue={event.deductionName} />
                </TableCell>
                <TableCell>
                  <Input type="datetime-local" defaultValue={event.from} />
                </TableCell>
                <TableCell>
                  <Input type="datetime-local" defaultValue={event.to} />
                </TableCell>
                <TableCell>
                  <Input type="number" defaultValue={event.rate} />
                </TableCell>
                <TableCell>{event.timeUsed}</TableCell>
                <TableCell>{event.incrementalTime}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-red-500">Delete</Button>
                </TableCell>
              </TableRow>
            ))}
             <TableRow>
                <TableCell>
                  <Input placeholder="Deduction Name" />
                </TableCell>
                <TableCell>
                  <Input type="datetime-local" />
                </TableCell>
                <TableCell>
                  <Input type="datetime-local" />
                </TableCell>
                <TableCell>
                  <Input type="number" placeholder="Rate" />
                </TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">
                    <Button size="sm">Add</Button>
                </TableCell>
              </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
