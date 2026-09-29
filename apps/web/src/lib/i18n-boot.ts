/** Shared by the server layout (inline script) and the client i18n provider. */
export const LANG_KEY = 'biq.lang';

/** Inline, pre-paint: hide the page until the chosen language is applied (max 1.5 s). */
export const I18N_BOOT_SCRIPT = `(function(){try{var l=localStorage.getItem('${LANG_KEY}');if(l){document.documentElement.lang=l;document.documentElement.classList.add('i18n-pending');setTimeout(function(){document.documentElement.classList.remove('i18n-pending')},1500)}}catch(e){}})()`;
