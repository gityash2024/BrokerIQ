import sharp from 'sharp';
import { PhotoBrandingService } from './photo-branding.service';

describe('photo branding', () => {
  const svc = new PhotoBrandingService({} as never, {} as never);
  const photo = () =>
    sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 90, g: 120, b: 160 } } })
      .jpeg()
      .toBuffer();

  it('adds a visible watermark in the chosen corner and keeps the size', async () => {
    const src = await photo();
    const out = await svc.render(src, { watermark: true, text: 'Sharma Estates', position: 'br', opacity: 0.6, enhance: false, firm: 'X' });
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 800]);
    const region = async (left: number, top: number) => sharp(await sharp(out).extract({ left, top, width: 25, height: 40 }).toBuffer()).stats();
    const corner = await region(1135, 720);
    const opposite = await region(20, 20);
    // The watermark box changes the pixels in its corner only.
    expect(Math.abs(corner.channels[0].mean - opposite.channels[0].mean)).toBeGreaterThan(5);
  });

  it('enhance-only returns a valid image and non-listing uploads are untouched', async () => {
    const src = await photo();
    const out = await svc.render(src, { watermark: false, position: 'br', opacity: 0.5, enhance: true, firm: 'X' });
    expect((await sharp(out).metadata()).format).toBe('jpeg');
    expect(await svc.apply('avatar/u1/202609/abc', 'image/jpeg', src)).toBe(src);
    expect(await svc.apply('listing/o1/202609/abc', 'application/pdf', src)).toBe(src);
  });
});
