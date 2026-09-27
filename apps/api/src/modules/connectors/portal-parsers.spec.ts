import { parsePortalEmail, mapGenericPayload, sourceFromLabel } from './portal-parsers';

describe('portal email parsers', () => {
  it('parses a label-style Housing.com enquiry', () => {
    const r = parsePortalEmail({
      from: 'Housing.com <no-reply@housing.com>',
      subject: 'New Enquiry for your property in Sector 65, Gurgaon',
      text: `Hi Partner,\nYou have received a new enquiry.\nName: Rahul Sharma\nMobile: +91 98765 43210\nEmail: rahul.s@gmail.com\nProperty: 3 BHK Apartment, M3M Golf Estate\nMessage: Is it still available?`,
    });
    expect(r.source).toBe('HOUSING');
    expect(r.name).toBe('Rahul Sharma');
    expect(r.phone).toBe('+919876543210');
    expect(r.email).toBe('rahul.s@gmail.com');
    expect(r.property).toContain('M3M');
    expect(r.confidence).toBeGreaterThanOrEqual(65);
  });

  it('parses an HTML table style 99acres response', () => {
    const r = parsePortalEmail({
      from: '99acres <response@99acres.com>',
      subject: 'Response on your property ad',
      html: '<table><tr><td>Name</td><td>Priya Verma</td></tr><tr><td>Contact No.</td><td>9811122233</td></tr><tr><td>Email ID</td><td>priya@yahoo.com</td></tr></table><p>Interested in 2 BHK Builder Floor, Sector 57</p>',
    });
    expect(r.source).toBe('ACRES99');
    expect(r.phone).toBe('+919811122233');
    expect(r.email).toBe('priya@yahoo.com');
    expect(r.name).toBe('Priya Verma');
  });

  it('extracts name from the subject for MagicBricks style mails', () => {
    const r = parsePortalEmail({
      from: 'MagicBricks <alerts@magicbricks.com>',
      subject: 'Amit Kumar has shown interest in your property',
      text: 'Buyer contact details\nPhone - 07011223344\nRegards, MagicBricks',
    });
    expect(r.source).toBe('MAGICBRICKS');
    expect(r.name).toBe('Amit Kumar');
    expect(r.phone).toBe('+917011223344');
  });

  it('ignores newsletters without a phone', () => {
    const r = parsePortalEmail({ from: 'news@housing.com', subject: 'Top 10 localities in Gurgaon', text: 'Read our latest guide.' });
    expect(r.phone).toBeNull();
    expect(r.confidence).toBeLessThan(65);
  });

  it('maps generic webhook & facebook payloads', () => {
    expect(mapGenericPayload({ full_name: 'A B', phone_number: '9876543210', campaign_name: 'Diwali' })).toMatchObject({ name: 'A B', phone: '9876543210', property: 'Diwali' });
    expect(mapGenericPayload({ field_data: [{ name: 'full_name', values: ['Neha'] }, { name: 'phone_number', values: ['+919999988888'] }] })).toMatchObject({ name: 'Neha', phone: '+919999988888' });
    expect(mapGenericPayload({ data: { customer: { name: 'X', mobile: '9876500000' } } }).phone).toBe('9876500000');
    expect(sourceFromLabel('99acres')).toBe('ACRES99');
  });
});
