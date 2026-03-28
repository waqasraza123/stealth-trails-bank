import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useUserStore } from "@/stores/userStore";

type UserStoreState = ReturnType<typeof useUserStore.getState>;
type SetUser = UserStoreState["setUser"];
type StoredUser = Parameters<SetUser>[0];

const fetchUser = async (
  userId: string,
  token: string,
  setUser: SetUser
): Promise<StoredUser> => {
  if (!token) {
    throw new Error("User is not authenticated.");
  }

  const serverUrl = import.meta.env.VITE_SERVER_URL;
  const response = await axios.get(`${serverUrl}/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const userData = response.data.data as StoredUser;
  setUser(userData);
  return userData;
};

export const useGetUser = (userId: string) => {
  const token = useUserStore((state) => state.token);
  const setUser = useUserStore((state) => state.setUser);
  const authToken = token ?? "";

  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId, authToken, setUser),
    enabled: Boolean(userId && authToken),
  });

  return {
    user,
    loading: isLoading,
    error: isError ? (error as Error).message : null,
  };
};
