import { I18nManager } from 'react-native';
import { languageOf } from '@brokeriq/shared';
import { translateChildren, translatorFor } from '../i18n';
import { deviceLanguage } from '../lang';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

describe('app translation', () => {
  it('leaves the original (Hindi/English) text when no language is chosen', () => {
    const t = translatorFor(null);
    expect(t('Co-broking network')).toBe('Co-broking network');
  });

  it('translates into the chosen language', () => {
    expect(translatorFor('ta')('Co-broking network')).toBe('கோ-ப்ரோக்கிங் நெட்வொர்க்');
  });

  it('joins "{count} text" children before translating', () => {
    const t = translatorFor('ta');
    expect(translateChildren(t, [12, ' listings'])).toBe('12 லிஸ்டிங்குகள்');
    expect(translateChildren(t, 'Co-broking network')).toBe('கோ-ப்ரோக்கிங் நெட்வொர்க்');
  });

  it('marks Urdu as right-to-left and others left-to-right', () => {
    expect(languageOf('ur').dir).toBe('rtl');
    expect(languageOf('hi').dir).toBe('ltr');
  });
});

describe('phone language', () => {
  const spy = (tag: string) => jest.spyOn(I18nManager as unknown as { getConstants: () => object }, 'getConstants').mockReturnValue({ localeIdentifier: tag });
  afterEach(() => jest.restoreAllMocks());

  it('maps the OS locale to a supported language', () => {
    spy('ta_IN');
    expect(deviceLanguage()).toBe('ta');
    spy('ur-IN');
    expect(deviceLanguage()).toBe('ur');
  });

  it('ignores languages BrokerIQ does not support', () => {
    spy('fr_FR');
    expect(deviceLanguage()).toBeNull();
  });
});
