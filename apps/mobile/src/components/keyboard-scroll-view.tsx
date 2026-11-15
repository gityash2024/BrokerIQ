import { forwardRef, useCallback } from 'react';
import { ScrollView as NativeScrollView, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

export type ScrollView = NativeScrollView;

/** Retains horizontal rails while keeping focused form fields above the keyboard. */
export const ScrollView = forwardRef<NativeScrollView, ScrollViewProps>(function ScrollView(props, ref) {
  const assignRef = useCallback(
    (view: NativeScrollView | null) => {
      if (typeof ref === 'function') return ref(view);
      if (ref) ref.current = view;
    },
    [ref],
  );
  if (props.horizontal) return <NativeScrollView {...props} ref={assignRef} />;
  return <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={16} {...props} ref={assignRef} />;
});
