import { AuthChangeEvent, Provider, Session } from "@supabase/supabase-js";
import { supabase } from "./client";
import { logger } from "@/lib/logger";

export const initializeAuth = () => {
    supabase.auth.onAuthStateChange((event) => {
        if (process.env.NODE_ENV === "development" && ["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) {
            logger.debug("Auth event:", event);
        }
    });
};

export const getCurrentUser = async () => {
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    const user = session?.user;
    return user;
};

const signInWithOauth = async (
    provider: Provider,
    options: { redirectTo: string; [key: string]: string } = {
        redirectTo: window.location.origin,
    }
) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
    });
    if (error) throw error;
    return data;
};

export const signInWithDiscord = async (
    redirectTo = "/auth/confirmed",
    options: { [key: string]: string } = {}
) => {
    try {
        const data = await signInWithOauth("discord", {
            scopes: "identify email",
            redirectTo: window.location.origin + redirectTo,
            ...options,
        });
        return data;
    } catch (error) {
        logger.error("SignIn Discord failed", error);
        throw error;
    }
};

export const signInWithSlack = async (
    redirectTo = "/auth/confirmed",
    options: { [key: string]: string } = {}
) => {
    try {
        const data = await signInWithOauth("slack_oidc", {
            redirectTo: window.location.origin + redirectTo,
            ...options,
        });
        return data;
    } catch (error) {
        logger.error("SignIn Slack failed", error);
        throw error;
    }
};

export const loginUserGoogle = async (
    redirectTo = "/auth/confirmed",
    options: { [key: string]: string } = {}
) => {
    try {
        const data = await signInWithOauth("google", {
            redirectTo: window.location.origin + redirectTo,
            ...options,
        });
        return data;
    } catch (error) {
        logger.error("SignIn Google failed", error);
        throw error;
    }
};

export const signInWithMicrosoft = async (
    redirectTo = "/auth/confirmed",
    options: { [key: string]: string } = {}
) => {
    try {
        const data = await signInWithOauth("azure", {
            redirectTo: window.location.origin + redirectTo,
            ...options,
        });
        return data;
    } catch (error) {
        logger.error("SignIn Microsoft failed", error);
        throw error;
    }
};

export const signInWithGitHub = async (
    redirectTo = "/auth/confirmed",
    options: { scopes?: string; skipCache?: boolean; [key: string]: unknown } = {}
) => {
    try {
        const { skipCache, ...rest } = options;
        const defaultScopes = "repo read:user read:org";
        const oauthOptions: Record<string, unknown> = {
            scopes: options.scopes ?? defaultScopes,
            redirectTo: window.location.origin + redirectTo,
            ...rest,
        };
        if (skipCache) {
            oauthOptions.queryParams = { prompt: "consent" };
        }
        const data = await signInWithOauth("github", oauthOptions as { redirectTo: string; [key: string]: string });
        return data;
    } catch (error) {
        logger.error("SignIn GitHub failed", error);
        throw error;
    }
};

export const linkGitHubIdentity = async () => {
    try {
        const { data, error } = await supabase.auth.linkIdentity({
            provider: "github",
            options: {
                scopes: "repo read:user read:org",
                redirectTo: window.location.origin + "/helper/settings/profile",
            },
        });
        if (error) throw error;
        return data;
    } catch (error) {
        logger.error("Link GitHub identity failed", error);
        throw error;
    }
};

export const signInWithEmail = async (
    email: string,
    redirectTo = window.origin
) => {
    const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: redirectTo,
        },
    });
    if (error) throw error;
    return data;
};

export const logoutUser = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        logger.error("Logout failed", error);
        throw error;
    }
};

export const refreshSession = async () => {
    try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return data;
    } catch (error) {
        logger.error("Refresh session failed", error);
        throw error;
    }
};

export const supabaseSubscribeAuthState = (
    callbackFunction: (event: AuthChangeEvent, session: Session | null) => void
) => {
    return supabase.auth.onAuthStateChange((event, session) => {
        callbackFunction(event, session);
    });
};

export const subscribeAuthState = (
    callbackFunction: (
        authState: AuthChangeEvent,
        session: Session | null
    ) => void
) => {
    return supabaseSubscribeAuthState(callbackFunction);
};
