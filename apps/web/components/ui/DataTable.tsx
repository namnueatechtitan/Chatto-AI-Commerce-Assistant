/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ UI แบบใช้ซ้ำชื่อ Data Table
 */

interface DataTableProps {
  columns: string[];
  rows: Array<Array<string>>;
}

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน Data Table ตามข้อมูลที่รับเข้ามา
 */
export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="table min-w-full">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.join("-")}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`} className="text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
