export interface CreateInventoryItemDto {
  sector: string;
  houseNo: string;
  ownerName?: string;
  ownerPhone?: string;
  propertyType?: string;
  purpose?: string;
  bhk?: number;
  floor?: string;
  furnishing?: string;
  rent?: number;
  securityDeposit?: number;
  brokerage?: string;
  tenantPreference?: string;
  amenities?: string[];
  notes?: string;
  status?: string;
  date?: string;
  pageNo?: number;
}

export interface UpdateInventoryItemDto extends Partial<CreateInventoryItemDto> {
  status?: string;
}

export interface InventoryFilterQuery {
  search?: string;
  sector?: string;
  houseNo?: string;
  bhk?: number | string;
  status?: string;
  purpose?: string;
  furnishing?: string;
  dateFrom?: string;
  dateTo?: string;
  organizationId?: string;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
