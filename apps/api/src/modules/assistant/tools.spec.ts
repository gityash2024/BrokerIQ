import { slimListing, TOOLS } from './tools';

describe('Assistant property purpose and amount contract', () => {
  it('keeps rental and total sale amounts distinct, including legacy card fields', () => {
    expect(slimListing({ purpose: 'RENT', price: 25000 })).toMatchObject({ purpose: 'RENT', price: 25000, rent: 25000, priceText: expect.stringContaining('/month'), rentText: expect.stringContaining('/month') });
    const sale = slimListing({ purpose: 'SALE', price: '25000000' });
    expect(sale).toMatchObject({ purpose: 'SALE', price: 25000000, rent: null, rentText: null });
    expect(sale.priceText).not.toContain('/month');
    expect(slimListing({ price: 25000 })).toMatchObject({ purpose: null, rent: null, rentText: null });
    expect(slimListing({ purpose: 'RENT', price: 0 })).toMatchObject({ price: 0, priceText: expect.any(String) });
    for (const price of [null, undefined, '', 'not a price', Infinity, -1]) expect(slimListing({ purpose: 'SALE', price }).priceText).toBeNull();
  });

  it('sends explicit purpose filters, rejects missing purpose and preserves the user API boundary', async () => {
    const call = jest.fn().mockResolvedValue({ total: 0, items: [] });
    const ctx = { call, me: jest.fn() };
    await TOOLS.find(t => t.name === 'search_rentals')!.run({}, ctx);
    expect(call.mock.calls[0][0].path).toContain('purpose=RENT');
    await TOOLS.find(t => t.name === 'search_properties')!.run({ purpose: 'SALE', maxPrice: 20000000, q: 'Sector 65' }, ctx);
    const path = call.mock.calls[1][0].path;
    expect(path).toContain('purpose=SALE');
    expect(path).toContain('maxPrice=20000000');
    await expect(TOOLS.find(t => t.name === 'search_properties')!.run({}, ctx)).rejects.toThrow('Choose RENT or SALE');
    expect(call).toHaveBeenCalledTimes(2);
  });
});
