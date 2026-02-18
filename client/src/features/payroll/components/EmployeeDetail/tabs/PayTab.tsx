import type { PayStructureRecord } from '../types.js';

interface PayTabProps {
  payStructure: PayStructureRecord[];
  employeeId: string;
  onRefresh: () => void;
}

export function PayTab({ payStructure }: PayTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Pay Structure</h3>
      </div>

      {payStructure.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No pay structure assigned</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                  Category
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                  Rate Type
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                  Rate
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                  Hours/Units
                </th>
              </tr>
            </thead>
            <tbody>
              {payStructure.map((ps, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-sm text-white">
                    {ps.category_name ?? ps.pay_category_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 capitalize">
                    {ps.rate_type ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-right font-mono">
                    ${((ps.rate_cents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 text-right">
                    {ps.standard_hours ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
