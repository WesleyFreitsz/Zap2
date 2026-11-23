import { MutationCache, QueryClient } from '@tanstack/react-query';

export const sharedContactKeys = [['leads'], ['conversations'], ['conversation-tags']];

export function invalidateContactData(queryClient) {
	return Promise.all(sharedContactKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export const queryClientInstance = new QueryClient({
	mutationCache: new MutationCache({
		onSuccess: () => invalidateContactData(queryClientInstance),
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
