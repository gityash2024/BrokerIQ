import React from 'react';
import { View, Text, Modal } from 'react-native';

export const BottomSheet = ({ visible, onClose, children }: any) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View className="flex-1 justify-end bg-black/50">
      <View className="bg-surface rounded-t-2xl p-4 min-h-[50%]">
        <Text onPress={onClose} className="self-end text-primary mb-2">Close</Text>
        {children}
      </View>
    </View>
  </Modal>
);