import { useMobileI18n } from "./provider";

export function useT() {
  return useMobileI18n().t;
}
