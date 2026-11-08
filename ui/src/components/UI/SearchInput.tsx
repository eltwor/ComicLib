type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  const baseCSS =
    "rounded-md border border-line bg-surface px-3 py-2 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none";
  const width = className ?? "w-full sm:w-80";
  return (
    <input
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      placeholder={placeholder}
      className={width + " " + baseCSS}
    />
  );
}
