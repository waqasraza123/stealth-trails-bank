import { fireEvent, waitFor } from "@testing-library/react-native";
import { SignInScreen } from "./SignInScreen";
import { renderMobile } from "../../test/test-utils";

const mockNavigate = jest.fn();
const mockSignIn = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate
  })
}));

jest.mock("../../hooks/use-session", () => ({
  useAuthActions: () => ({
    signIn: mockSignIn,
    signUp: jest.fn(),
    loading: false,
    error: null
  })
}));

describe("SignInScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSignIn.mockReset();
  });

  it("blocks invalid email before calling the API action", async () => {
    const screen = renderMobile(<SignInScreen />);

    expect(screen.getByTestId("ethereum-brand-panel")).toBeTruthy();
    expect(screen.getByText("Ethereum")).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText("Email"), "invalid-email");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(mockSignIn).not.toHaveBeenCalled();
      expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    });
  });

  it("submits trimmed credentials", async () => {
    mockSignIn.mockResolvedValueOnce({
      token: "token"
    });

    const screen = renderMobile(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "  user@example.com  ");
    fireEvent.changeText(screen.getByLabelText("Password"), "  password123  ");
    fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123"
      });
    });
  });
});
