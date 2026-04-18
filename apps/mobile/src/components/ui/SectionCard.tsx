import { View, type ViewProps } from "react-native";

type SectionCardProps = ViewProps & {
  className?: string;
};

export function SectionCard({
  children,
  className = "",
  ...props
}: SectionCardProps) {
  return (
    <View
      {...props}
      className={`rounded-[28px] border border-border bg-panel p-5 shadow-sm ${className}`}
    >
      {children}
    </View>
  );
}
