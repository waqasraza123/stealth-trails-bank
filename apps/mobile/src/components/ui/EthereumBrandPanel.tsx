import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { AppText } from "./AppText";

type EthereumBrandPanelProps = {
  readonly title?: string;
  readonly subtitle?: string;
  readonly centered?: boolean;
  readonly compact?: boolean;
  readonly testID?: string;
};

type EthereumMarkProps = {
  readonly size?: number;
};

function EthereumMark({ size = 88 }: EthereumMarkProps) {
  return (
    <Svg
      accessibilityLabel="Ethereum logo"
      height={size}
      viewBox="0 0 256 256"
      width={size}>
      <Rect fill="#0F172A" height="256" rx="64" width="256" />
      <Path d="M128 28L67 128L128 100.5L189 128L128 28Z" fill="#8B5CF6" />
      <Path d="M128 100.5L67 128L128 164.5L189 128L128 100.5Z" fill="#A78BFA" />
      <Path d="M128 175L67 139L128 228L189 139L128 175Z" fill="#C4B5FD" />
    </Svg>
  );
}

export function EthereumBrandPanel({
  title = "Ethereum",
  subtitle,
  centered = true,
  compact = false,
  testID,
}: EthereumBrandPanelProps) {
  const alignmentClassName = centered ? "items-center" : "items-start";
  const textClassName = centered ? "text-center" : "text-left";
  const markSize = compact ? 72 : 104;
  const containerClassName = compact
    ? `gap-3 rounded-[28px] border border-sand bg-white/90 px-5 py-5 ${alignmentClassName}`
    : `gap-4 rounded-[32px] border border-sand bg-white/90 px-6 py-6 ${alignmentClassName}`;

  return (
    <View className={containerClassName} testID={testID}>
      <EthereumMark size={markSize} />
      <View className={`gap-1 ${alignmentClassName}`}>
        <AppText className={`text-2xl text-ink ${textClassName}`} weight="bold">
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            className={`max-w-[280px] text-sm leading-6 text-slate ${textClassName}`}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
