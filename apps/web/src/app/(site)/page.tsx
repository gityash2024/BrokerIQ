import { BrokerIQLanding } from '@brokeriq/landing';
import type { Metadata } from 'next';
export const metadata:Metadata={title:'BrokerIQ — Your broker workspace',description:'Inventory, client requirements, WhatsApp capture and daily follow-ups for Gurgaon real estate brokers.'};
export default function Home(){return <BrokerIQLanding apkUrl={process.env.ANDROID_RELEASE_URL} checksum={process.env.ANDROID_RELEASE_SHA256}/>;}
