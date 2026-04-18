import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocaleStore } from "./locale-store";

const baseState = {
  locale: "en" as const,
  hydrated: false
};

describe("locale store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocaleStore.setState(baseState);
  });

  it("hydrates persisted locale", async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue("ar");

    await useLocaleStore.getState().hydrate();

    expect(useLocaleStore.getState().hydrated).toBe(true);
    expect(useLocaleStore.getState().locale).toBe("ar");
  });

  it("persists locale changes", async () => {
    await useLocaleStore.getState().setLocale("ar");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith("stb.mobile.locale", "ar");
    expect(useLocaleStore.getState().locale).toBe("ar");
  });
});
