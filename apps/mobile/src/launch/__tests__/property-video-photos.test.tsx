import React from 'react';
import * as ImagePicker from '@/lib/image-picker';
import { api } from '@/lib/api';
import { NativePropertyMedia } from '../property-media';

const { act, create } = require('react-test-renderer');
const mockUploadAsync = jest.fn(async () => ({ status: 200 }));

jest.mock('@/lib/image-picker', () => ({ launchImageLibraryAsync: jest.fn(), VideoExportPreset: { Passthrough: 0 } }));
jest.mock('expo-file-system', () => ({
  File: class {
    size = 100;
    name = 'walkthrough.MOV';
    createUploadTask = () => ({ uploadAsync: mockUploadAsync });
  },
}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('@/lib/api', () => ({ api: jest.fn(), captureAccountContext: () => ({ userId: 'broker' }), assertAccountContext: jest.fn(), errorMessage: String, img: (url: string) => url }));
jest.mock('@/ui', () => {
  const { View, Text } = require('react-native');
  return { Button: View, Txt: Text };
});

it('keeps the usual photo picker in the editor and adds only approved frames from the property detail', async () => {
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///walkthrough.MOV' }] });
  (api as jest.Mock).mockImplementation(async (path: string) => {
    switch (path) {
      case '/media/property-video': return { id: 'job', uploadUrl: 'https://files.example.test/video', headers: {}, maxBytes: 500 };
      case '/media/property-video/job': return { state: 'READY', frames: ['data:image/webp;base64,one', 'data:image/webp;base64,two'], aiVerified: false };
      case '/media/property-video/job/save': return { urls: ['https://files.example.test/approved.jpg'] };
      default: return {};
    }
  });
  const onAdd = jest.fn();
  const onAddExtracted = jest.fn(async () => undefined);
  let view: any;
  const actions = (title: string) => view.root.findAll((node: any) => node.props.title === title && typeof node.props.onPress === 'function');
  try {
    act(() => { view = create(<NativePropertyMedia photos={[]} onAdd={onAdd} />); });
    expect(actions('Upload photos').length).toBeGreaterThan(0);
    expect(actions('Extract photos from video').length).toBeGreaterThan(0);
    act(() => view.update(<NativePropertyMedia photos={[]} extractionOnly onAddExtracted={onAddExtracted} />));
    expect(actions('Upload photos')).toHaveLength(0);
    await act(async () => { actions('Extract photos from video')[0].props.onPress(); });
    expect(api).toHaveBeenCalledWith('/media/property-video', expect.objectContaining({ body: { contentType: 'video/quicktime' } }));
    expect(mockUploadAsync).toHaveBeenCalledTimes(1);
    act(() => { actions('Remove photo 2')[0].props.onPress(); });
    await act(async () => { actions('Add selected photos')[0].props.onPress(); });
    expect(api).toHaveBeenCalledWith('/media/property-video/job/save', expect.objectContaining({ body: { indices: [0] } }));
    expect(onAddExtracted).toHaveBeenCalledTimes(1);
    expect(onAddExtracted).toHaveBeenCalledWith(['https://files.example.test/approved.jpg']);
    expect(api).toHaveBeenCalledWith('/media/property-video/job/complete', expect.objectContaining({ method: 'POST' }));
    expect(onAdd).not.toHaveBeenCalled();
  } finally {
    act(() => view?.unmount());
  }
});
