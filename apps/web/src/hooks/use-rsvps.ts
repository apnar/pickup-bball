import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

/** Query options for the next game's headcount; the home loader prefetches this. */
export const nextHeadcountOptions = () =>
	orpc.rsvp.list.queryOptions({ input: {} });

/**
 * The shared headcount for the next scheduled game, stored in D1 and read
 * through oRPC. `headcount` is null when no gym is booked.
 */
export function useRsvps() {
	const queryClient = useQueryClient();
	const listOptions = nextHeadcountOptions();
	const query = useQuery(listOptions);

	const onSuccess = (data: typeof query.data) => {
		queryClient.setQueryData(listOptions.queryKey, data);
	};
	const onError = (error: Error) => {
		toast.error(error.message);
	};

	const addMutation = useMutation(
		orpc.rsvp.add.mutationOptions({ onSuccess, onError }),
	);
	const addMeMutation = useMutation(
		orpc.rsvp.addMe.mutationOptions({ onSuccess, onError }),
	);
	const toggleMutation = useMutation(
		orpc.rsvp.toggle.mutationOptions({ onSuccess, onError }),
	);

	const gameId = query.data?.game.id;

	return {
		headcount: query.data ?? null,
		isPending:
			addMutation.isPending ||
			addMeMutation.isPending ||
			toggleMutation.isPending,
		/** One tap: the signed-in player puts themselves in. */
		addMe: () => {
			if (!gameId) return Promise.resolve(undefined);
			return addMeMutation.mutateAsync({ gameId });
		},
		add: (name: string) => {
			if (!gameId) return Promise.resolve(undefined);
			return addMutation.mutateAsync({ gameId, name });
		},
		toggle: (id: string) => {
			if (!gameId) return;
			toggleMutation.mutate({ gameId, id });
		},
	};
}
