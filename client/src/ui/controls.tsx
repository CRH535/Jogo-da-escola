import { useId, type ReactNode } from 'react';

export function Slider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }: {
  label: string; value: number; min?: number; max?: number; step?: number; unit?: string; onChange: (value: number) => void;
}) {
  const id = useId();
  return <div className="setting-row">
    <label htmlFor={id}>{label}</label>
    <div className="slider-control">
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output htmlFor={id}>{value}{unit}</output>
    </div>
  </div>;
}

export function Toggle({ label, checked, onChange, disabled = false }: {
  label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  return <label className="setting-row toggle-row">
    <span>{label}</span>
    <span className="toggle-control"><span aria-hidden="true">{checked ? 'Ligado' : 'Desligado'}</span>
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </span>
  </label>;
}

export function SelectControl({ label, value, onChange, children }: {
  label: string; value: string | number; onChange: (value: string) => void; children: ReactNode;
}) {
  const id = useId();
  return <div className="setting-row"><label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
  </div>;
}
