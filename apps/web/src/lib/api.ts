import axios from "axios";

export type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
  error?: unknown;
};

export function readApiErrorMessage(
  error: unknown,
  fallbackMessage = "Request failed."
): string {
  if (axios.isAxiosError(error)) {
    const responseMessage =
      typeof error.response?.data?.message === "string"
        ? error.response.data.message
        : undefined;

    return responseMessage ?? error.message ?? fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}
