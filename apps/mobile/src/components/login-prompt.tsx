import { router } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { Button, Empty, Screen } from '@/ui';

export function LoginPrompt({ title, text }: { title: string; text: string }) {
  const { c } = useTheme();
  return (
    <Screen>
      <Empty
        icon={<LogIn size={28} color={c.brand} />}
        title={title}
        text={text}
        action={<Button title="Login / Sign up" onPress={() => router.push('/login')} />}
      />
    </Screen>
  );
}
