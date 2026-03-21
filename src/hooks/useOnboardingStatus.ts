import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export interface OnboardingStatus {
    needsOnboarding: boolean;
    isMember: boolean;
    onboardingCompleted: boolean;
}

/**
 * Hook to check if user needs onboarding and their membership status
 */
export function useOnboardingStatus() {
    return useQuery({
        queryKey: ["onboarding-status"],
        queryFn: async (): Promise<OnboardingStatus> => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                return {
                    needsOnboarding: false,
                    isMember: false,
                    onboardingCompleted: false,
                };
            }

            // Check if user is a member of any project
            const { data: memberData, error: memberError } = await supabase
                .from("projects_members")
                .select("project_id")
                .eq("user_id", user.id)
                .is("deleted_at", null)
                .limit(1);

            if (memberError) throw memberError;
            const isMember = (memberData?.length ?? 0) > 0;

            // Check onboarding completion status from public.users table
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("onboarding_completed")
                .eq("id", user.id)
                .single();

            if (userError && userError.code !== "PGRST116") {
                // PGRST116 is "not found" - user might not exist in public.users yet
                throw userError;
            }

            const onboardingCompleted = userData?.onboarding_completed ?? false;

            // User needs onboarding if they're not a member and haven't completed onboarding
            const needsOnboarding = !isMember && !onboardingCompleted;

            return {
                needsOnboarding,
                isMember,
                onboardingCompleted,
            };
        },
        retry: false,
        staleTime: 1800000,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });
}

/**
 * Hook to mark onboarding as complete
 */
export function useCompleteOnboarding() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                throw new Error("User not authenticated");
            }

            // Update public.users table to mark onboarding as complete
            const { data, error } = await supabase
                .from("users")
                .update({
                    onboarding_completed: true,
                    onboarding_completed_at: new Date().toISOString(),
                })
                .eq("id", user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });
}
