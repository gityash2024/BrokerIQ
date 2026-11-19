import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react-native';
import * as ImagePicker from '@/lib/image-picker';
import { assertAccountContext, captureAccountContext, errorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Button } from '@/ui';
import { getLocalDraft, queueSurveyPhoto, syncDrafts } from './drafts';
import { preparePropertyPhoto } from './property-media';

export function SurveyPhotoAction({ sector, allowed }: { sector?: string; allowed: boolean }) {
  const client = useQueryClient();
  const { c } = useTheme();
  const capturing = useRef(false);
  const [busy, setBusy] = useState(false);

  async function capture() {
    if (capturing.current || !allowed) return;
    const owner = captureAccountContext();
    capturing.current = true;
    setBusy(true);
    try {
      if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access to take a survey photo.');
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || (asset.fileSize ?? 0) > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
      const uri = await preparePropertyPhoto(asset);
      assertAccountContext(owner);
      const id = await queueSurveyPhoto(uri, sector, owner);
      toast.success('Survey photo saved on this device');
      // The draft pump retries failed connections and keeps the image if the app closes.
      try {
        await syncDrafts();
        const saved = await getLocalDraft(id, owner);
        if (saved?.state === 'SYNCED') {
          await Promise.all(['inventory-folders', 'inventory-folder-items'].map((key) => client.invalidateQueries({ queryKey: [key] })));
          toast.success('Photo saved to Survey for review');
        } else if (saved?.state === 'FAILED') {
          toast.error('Photo is saved on this device. Retry in Saved drafts.');
        }
      } finally {
        void client.invalidateQueries({ queryKey: ['local-drafts'] });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      capturing.current = false;
      setBusy(false);
    }
  }

  return (
    <Button
      title="Take survey photo"
      variant="secondary"
      disabled={!allowed}
      loading={busy}
      icon={<ImagePlus size={17} color={c.brand} />}
      style={{ flexGrow: 1, flexBasis: 140, minHeight: 44, borderRadius: 16, paddingHorizontal: 10 }}
      onPress={() => void capture()}
    />
  );
}
