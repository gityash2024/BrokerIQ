export const OPENROUTER_DAILY_LIMIT = 1000;

export const openRouterFreeRouting = {
  data_collection: 'deny',
  max_price: { prompt: 0, completion: 0, image: 0, request: 0 },
} as const;

export function isFreeOpenRouterModel(model: string) {
  return model === 'openrouter/free' || model.endsWith(':free');
}
