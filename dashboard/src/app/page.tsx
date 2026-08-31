'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [data, setData] = useState<any[]>([]);
  const [filterVerdict, setFilterVerdict] = useState('ALL');
  const [filterLabel, setFilterLabel] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: records, error } = await supabase
        .from('master_eval_dataset')
        .select('id, village_name, district, multimodal_verdict, fraud_label')
        .order('id', { ascending: true });
      if (records) {
        setData(records);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredData = data.filter((row) => {
    if (filterVerdict !== 'ALL' && row.multimodal_verdict !== filterVerdict) return false;
    if (filterLabel !== 'ALL' && row.fraud_label !== filterLabel) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">FasalTruth Dashboard</h1>
          <p className="text-gray-600">Verification layer for PMFBY crop insurance claims</p>
        </div>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Multimodal Verdict</label>
            <select
              className="border border-gray-300 rounded p-2 text-gray-900"
              value={filterVerdict}
              onChange={(e) => setFilterVerdict(e.target.value)}
            >
              <option value="ALL">All Verdicts</option>
              <option value="INCONCLUSIVE">INCONCLUSIVE</option>
              <option value="INCONSISTENT">INCONSISTENT</option>
              <option value="CONSISTENT">CONSISTENT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fraud Label</label>
            <select
              className="border border-gray-300 rounded p-2 text-gray-900"
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
            >
              <option value="ALL">All Labels</option>
              <option value="MISMATCH">MISMATCH</option>
              <option value="INCONCLUSIVE">INCONCLUSIVE</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading claims...</div>
      ) : (
        <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">ID</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Village</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">District</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Verdict (Pipeline)</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fraud Label (Signal)</th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredData.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">{row.id}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{row.village_name}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{row.district}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${row.multimodal_verdict === 'INCONCLUSIVE' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                      {row.multimodal_verdict}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${row.fraud_label === 'MISMATCH' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {row.fraud_label}
                    </span>
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <Link href={`/village/${row.id}`} className="text-indigo-600 hover:text-indigo-900">
                      View details<span className="sr-only">, {row.village_name}</span>
                    </Link>
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
