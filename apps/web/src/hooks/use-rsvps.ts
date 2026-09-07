import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

/**
 * This week's shared headcount, stored in D1 and read through oRPC. The home
 * route prefetches the list so the server render already has real data.
 */
export function useRsvps() {
	const queryClient = useQueryClient();
	const listOptions = orpc.rsvp.list.queryOptions();
	const query = useQuery(listOptions);

	const onSuccess = (data: NonNullable<typeof query.data>) => {
		queryClient.setQueryData(listOptions.queryKey, data);
	};
	const onError = (error: Error) => {
		toast.error(error.message);
	};

	const addMutation = useMutation(
		orpc.rsvp.add.mutationOptions({ onSuccess, onError }),
	);
	const toggleMutation = useMutation(
		orpc.rsvp.toggle.mutationOptions({ onSuccess, onError }),
	);

	return {
		headcount: query.data,
		isPending: addMutation.isPending || toggleMutation.isPending,
		add: (name: string) => addMutation.mutateAsync({ name }),
		toggle: (id: string) => toggleMutation.mutate({ id }),
	};
}
