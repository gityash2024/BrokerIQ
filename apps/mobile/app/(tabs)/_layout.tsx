import React from 'react';
import { Tabs } from 'expo-router';
import { DynamicTabBar } from '../../src/components/navigation/DynamicTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <DynamicTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 1. Dynamic Landing Screen (Explore / My Listings / Dashboard) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />

      {/* 2. Broker CRM Screens */}
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
        }}
      />
      <Tabs.Screen
        name="market-hub"
        options={{
          title: 'Market Hub',
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Properties',
        }}
      />
      <Tabs.Screen
        name="follow-ups"
        options={{
          title: 'Follow-ups',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
        }}
      />

      {/* 3. Seeker Wishlist Screen */}
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
        }}
      />

      {/* 4. Buyer/Owner Inquiries Log */}
      <Tabs.Screen
        name="inquiries"
        options={{
          title: 'Inquiries',
        }}
      />

      {/* 5. Owner Landlord Screens */}
      <Tabs.Screen
        name="post-property"
        options={{
          title: 'Post Property',
        }}
      />
      <Tabs.Screen
        name="verification"
        options={{
          title: 'Verification',
        }}
      />

      {/* 6. User Profile Screen */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}