import { getCookie, setCookie, deleteCookie, H3Event, getHeader } from "h3";
import { $fetch } from "ofetch";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  EXP_TIME_KEY,
} from "../constants";

export async function refreshToken(event: H3Event): Promise<string | null> {
  const config = useRuntimeConfig();

  const accessToken = getCookie(event, ACCESS_TOKEN_KEY);
  const expTimeStr = getCookie(event, EXP_TIME_KEY);
  const refreshToken = getCookie(event, REFRESH_TOKEN_KEY);
  const now = Date.now();

  // Nếu không có refreshToken thì chịu
  if (!refreshToken) {
    console.warn("⚠️ No refreshToken, cannot refresh");
    return null;
  }

  const expTime = expTimeStr ? parseInt(expTimeStr) : 0;
  const tokenStillValid = accessToken && now < expTime - 10_000;

  // Nếu token còn hạn thì dùng luôn
  if (tokenStillValid) {
    return accessToken!;
  }

  // Nếu token hết hạn hoặc không có, đi refresh
  try {
    const response: any = await $fetch<{
      accessToken: string;
      refreshToken: string;
      expTime: number;
    }>(`${config.public.apiUrl}/auth/refresh-token`, {
      method: "POST",
      headers: {
        cookie: getHeader(event, "cookie") || "",
      },
      body: {
        refreshToken,
      },
    });

    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expTime: newExpTime,
    } = response;

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    };

    setCookie(event, ACCESS_TOKEN_KEY, newAccessToken, cookieOptions);
    setCookie(event, REFRESH_TOKEN_KEY, newRefreshToken, cookieOptions);
    setCookie(event, EXP_TIME_KEY, String(newExpTime), cookieOptions);

    console.log("✅ Token refreshed successfully");

    return newAccessToken;
  } catch (err: any) {
    console.warn("⚠️ Refresh token failed:", err);

    // Nếu lỗi có code 401/403 thì xoá token
    const shouldDelete =
      err?.response?.status === 401 || err?.response?.status === 403;

    if (shouldDelete) {
      deleteCookie(event, ACCESS_TOKEN_KEY);
      deleteCookie(event, REFRESH_TOKEN_KEY);
      deleteCookie(event, EXP_TIME_KEY);
    }

    return null;
  }
}
