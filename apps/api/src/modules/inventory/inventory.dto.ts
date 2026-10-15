import type { z } from 'zod';
import type { inventoryFilterSchema, InventoryInput } from '@brokeriq/shared';
export type CreateInventoryItemDto = InventoryInput;
export type UpdateInventoryItemDto = InventoryInput;
export type InventoryFilterQuery = z.infer<typeof inventoryFilterSchema>;
