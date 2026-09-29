/**
 * Theme constants shared by the server (the boot script in app/layout.js) and
 * the client. They cannot live in ThemeProvider: it is 'use client', and a
 * constant imported from there into a Server Component reads as `undefined`.
 * Nothing here may import from a client module.
 */

export const THEME_KEY = 'hotaru-theme'

export const PREFERENCES = ['system', 'light', 'dark']

/* --t-paper per theme, for the address bar. */
export const THEME_COLOR = { light: '#fbfcfe', dark: '#13191f' }
