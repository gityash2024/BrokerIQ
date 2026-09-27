export function Select({ label, options, className = '', ...props }: any) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select 
        className={`w-full p-2.5 border border-gray-300 rounded outline-none transition-colors focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] bg-white ${className}`} 
        {...props}
      >
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
