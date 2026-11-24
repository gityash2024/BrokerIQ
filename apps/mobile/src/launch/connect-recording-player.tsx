import { useAudioPlayer } from 'expo-audio';
import { API_URL, authStore } from '@/lib/api';
import { Button, Row } from '@/ui';

export default function ConnectRecordingPlayer({ eventId }: { eventId: string }) {
  const player = useAudioPlayer(null);

  function play() {
    const token = authStore.get()?.accessToken;
    if (!token) return;
    player.replace({
      uri: API_URL + '/connect/events/' + eventId + '/recording',
      headers: { Authorization: 'Bearer ' + token },
    });
    player.play();
  }

  return <Row gap={6}>
    <Button title="Play private recording" size="sm" onPress={play} />
    <Button title="Pause" size="sm" variant="secondary" onPress={() => player.pause()} />
  </Row>;
}
