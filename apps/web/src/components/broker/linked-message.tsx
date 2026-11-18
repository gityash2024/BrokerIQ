import { messageLinks } from '@brokeriq/shared';

export function LinkedMessage({ text }: { text: string }) {
  return (
    <>
      {messageLinks(text).map((part, index) =>
        part.url ? (
          <a key={index} href={part.url} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
