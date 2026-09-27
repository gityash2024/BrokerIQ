/** Quick time presets (no native date picker needed). */
export function timePresets() {
  const at = (days: number, h: number, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const inHours = (h: number) => new Date(Date.now() + h * 3600_000);
  return [
    { label: '1 घंटे में', at: inHours(1) },
    { label: '3 घंटे में', at: inHours(3) },
    { label: 'आज शाम 6', at: at(0, 18) },
    { label: 'कल 10 बजे', at: at(1, 10) },
    { label: 'कल 4 बजे', at: at(1, 16) },
    { label: '3 दिन बाद', at: at(3, 11) },
    { label: 'Weekend (शनिवार 11)', at: at((6 - new Date().getDay() + 7) % 7 || 7, 11) },
  ].filter((p) => p.at.getTime() > Date.now());
}
