import { AppText } from "./AppText";

type LtrValueProps = {
  value: string;
  className?: string;
};

export function LtrValue({ value, className }: LtrValueProps) {
  return (
    <AppText
      className={className}
      style={{
        writingDirection: "ltr",
        textAlign: "left"
      }}
    >
      {value}
    </AppText>
  );
}
