import { Linking, Text } from 'react-native';
import { messageLinks } from '@brokeriq/shared';
import { showError } from '@/lib/hooks';

export function LinkedMessage({ text }: { text: string }) {
  return (
    <>
      {messageLinks(text).map((part, index) =>
        part.url ? (
          <Text key={index} accessibilityRole="link" style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(part.url!).catch(showError)}>
            {part.text}
          </Text>
        ) : (
          <Text key={index}>{part.text}</Text>
        ),
      )}
    </>
  );
}
