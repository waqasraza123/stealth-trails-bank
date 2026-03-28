import { useState } from "react";
import axios from "axios";

type SignupInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type AuthErrorResponse = {
  message?: string;
};

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<AuthErrorResponse>(error)) {
    return error.response?.data?.message ?? "An error occurred";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An error occurred";
};

const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = async (data: SignupInput) => {
    setLoading(true);
    setError(null);

    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL;
      const response = await axios.post(serverUrl + "/auth/signup", data);
      return response.data;
    } catch (error: unknown) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: LoginInput) => {
    setLoading(true);
    setError(null);

    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL;
      const response = await axios.post(serverUrl + "/auth/login", data);
      return response.data;
    } catch (error: unknown) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { signup, login, loading, error };
};

export default useAuth;
