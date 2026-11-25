import { View } from 'react-native';
import { Check, ClipboardCheck, FileSearch, Mic, PenLine, RefreshCw, Sparkles } from 'lucide-react-native';
import { assistantBlocks, assistantInlineDestination, assistantPhaseText, type AssistantPhase } from '@brokeriq/shared';
import { InlineLoader } from '@/components/request-loader';
import { fonts, useTheme } from '@/lib/theme';
import { Row, Txt } from '@/ui';

const icons = {
  understanding: Sparkles,
  retrieving: FileSearch,
  composing: PenLine,
  retrying: RefreshCw,
  confirming: ClipboardCheck,
  applying: Check,
  transcribing: Mic,
};

export function AssistantActivity({ phases, lang }: { phases: AssistantPhase[]; lang: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ padding: 10, gap: 5, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.brandSoft }}>
      {phases.map((phase, index) => {
        const Icon = icons[phase];
        const current = index === phases.length - 1;
        return (
          <Row key={index} gap={8}>
            <Icon size={15} color={c.brand} />
            <Txt v="caption" color={current ? 'fg' : 'muted'} style={{ flex: 1 }}>
              {assistantPhaseText[phase][lang === 'hi' ? 'hi' : 'en']}
            </Txt>
            {current && <InlineLoader size={20} />}
          </Row>
        );
      })}
    </View>
  );
}

export function AssistantText({
  content,
  cardUrls,
  staff,
  onNavigate,
}: {
  content: string;
  cardUrls: unknown[];
  staff: boolean;
  onNavigate: (destination: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {assistantBlocks(content).map((block, index) => (
        <View
          key={index}
          style={[
            block.kind === 'quote' && { borderLeftWidth: 2, borderLeftColor: c.brand, paddingLeft: 8 },
            block.kind === 'code' && { borderRadius: 8, backgroundColor: c.surface, padding: 8 },
          ]}
        >
          {block.lines.map((parts, i) => (
            <Txt
              key={i}
              selectable
              v={block.kind === 'heading' ? 'bodyStrong' : 'body'}
              style={block.kind === 'code' ? { fontFamily: 'monospace' } : undefined}
            >
              {block.kind === 'list' ? (block.start === null ? '•  ' : `${block.start + i}.  `) : ''}
              {parts.map(({ kind, text, url }, j) => {
                const destination = kind === 'link' ? assistantInlineDestination(url, cardUrls, staff, true) : undefined;
                return (
                  <Txt
                    key={j}
                    accessibilityRole={destination ? 'link' : undefined}
                    onPress={destination ? () => onNavigate(destination) : undefined}
                    style={{
                      ...(kind === 'bold' ? { fontFamily: fonts.semibold } : {}),
                      ...(kind === 'emphasis' ? { fontStyle: 'italic' } : {}),
                      ...(kind === 'code' ? { fontFamily: 'monospace' } : {}),
                      ...(destination ? { color: c.brand, textDecorationLine: 'underline' } : {}),
                    }}
                  >
                    {text}
                  </Txt>
                );
              })}
            </Txt>
          ))}
        </View>
      ))}
    </View>
  );
}
