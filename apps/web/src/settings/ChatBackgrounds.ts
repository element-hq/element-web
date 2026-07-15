/*
 * Copyright 2026 hayaksi1
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { mediaFromMxc } from "../customisations/Media";

/**
 * The bundled chat-background presets.
 *
 * Every preset is authored at full legible strength (the `RoomView.backgroundOpacity` slider is a
 * true intensity dial on top) and carries an explicit light/dark variant pair, picked in CSS via
 * the `cpd-theme-*` class on the body. All artwork is inline SVG tiles and CSS gradients bundled
 * with the app, so the feature works fully offline -- no binary assets, no CDN fetch.
 */
export interface ChatBackgroundVariant {
    /** Full CSS `background-image` layer stack. The FIRST list item paints on top. */
    readonly image: string;
    /** CSS `background-repeat` list matching {@link image} layer for layer. */
    readonly repeat: string;
    /** CSS `background-size` list matching {@link image} layer for layer. */
    readonly size: string;
}

export interface ChatBackgroundPreset {
    /** Stable id, stored verbatim in the `RoomView.backgroundImage` setting. */
    readonly id: string;
    readonly light: ChatBackgroundVariant;
    readonly dark: ChatBackgroundVariant;
}

/** The ready-to-apply variants for a stored setting value: one per theme. */
export type ResolvedChatBackground = Pick<ChatBackgroundPreset, "light" | "dark">;

/**
 * Lowest selectable wallpaper opacity. Not zero: an invisible wallpaper is indistinguishable from None, and
 * the rail already has a None tile for that.
 */
export const MIN_CHAT_BACKGROUND_OPACITY = 0.1;

/** Step between selectable wallpaper opacities. */
export const CHAT_BACKGROUND_OPACITY_STEP = 0.05;

/** Opacity used when nothing valid is stored. Matches the `RoomView.backgroundOpacity` setting default. */
export const DEFAULT_CHAT_BACKGROUND_OPACITY = 1;

/*
 * Shared artwork. Each tile is authored once with __INK__ / __INKO__ placeholders and re-inked
 * per preset and theme. All tiles are seamless: every glyph that crosses a tile edge has an exact
 * duplicate offset by the tile size on the opposite side, and glyph spacing is enforced on the
 * torus, so no seam or gutter appears when the tile repeats.
 */

/** 480x480, 22 hand-drawn chat doodle icons (organic scatter, no grid rhythm). */
const DOODLE_TILE =
    "<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'><g fill='none" +
    "' stroke='__INK__' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><g transform='t" +
    "ranslate(421.3 91.6) rotate(-14) scale(0.90)'><circle r='12'/><ellipse rx='5.5' ry='12'/><path d='M-" +
    "12 0 h24'/></g><g transform='translate(139.7 263.0) rotate(-17) scale(1.12)'><path d='M-9 -1 a13 13 " +
    "0 0 1 18 0 M-5.5 3 a8 8 0 0 1 11 0'/><circle cy='7' r='1.7' fill='__INK__' stroke='none'/></g><g tra" +
    "nsform='translate(438.2 265.8) rotate(7) scale(1.07)'><rect x='-13' y='-7' width='26' height='17' rx" +
    "='4'/><circle cy='1' r='5'/><path d='M-5 -7 L-3 -11 H3 L5 -7'/></g><g transform='translate(442.2 397" +
    ".3) rotate(-13) scale(0.86)'><circle r='12'/><circle cx='-4.5' cy='-3' r='1.7' fill='__INK__' stroke" +
    "='none'/><circle cx='4.5' cy='-3' r='1.7' fill='__INK__' stroke='none'/><path d='M-5.5 3 Q0 8 5.5 3'" +
    "/></g><g transform='translate(9.7 42.3) rotate(-5) scale(1.12)'><circle cx='-2' cy='-2' r='8'/><path" +
    " d='M4 4 L12 12'/></g><g transform='translate(489.7 42.3) rotate(-5) scale(1.12)'><circle cx='-2' cy" +
    "='-2' r='8'/><path d='M4 4 L12 12'/></g><g transform='translate(330.4 158.7) rotate(-14) scale(0.97)" +
    "'><rect x='-9' y='-2' width='18' height='13' rx='3'/><path d='M-5 -2 v-5 a5 5 0 0 1 10 0 v5'/><circl" +
    "e cy='4' r='1.7' fill='__INK__' stroke='none'/></g><g transform='translate(64.0 438.3) rotate(-12) s" +
    "cale(0.96)'><path d='M14 -10 L-14 0 L-3 4 L1 12 Z M14 -10 L-3 4'/></g><g transform='translate(20.9 3" +
    "28.4) rotate(2) scale(1.17)'><circle cy='-3' r='8'/><path d='M-4 7 h8 M-3 11 h6'/></g><g transform='" +
    "translate(500.9 328.4) rotate(2) scale(1.17)'><circle cy='-3' r='8'/><path d='M-4 7 h8 M-3 11 h6'/><" +
    "/g><g transform='translate(254.4 311.6) rotate(18) scale(1.16)'><path d='M0 -13 L3.6 -4.3 L13 -4 L5." +
    "6 1.9 L8 12 L0 6.5 L-8 12 L-5.6 1.9 L-13 -4 L-3.6 -4.3 Z'/></g><g transform='translate(157.5 347.7) " +
    "rotate(10) scale(1.04)'><rect x='-13' y='-10' width='26' height='20' rx='3'/><path d='M-13 5 L-4 -3 " +
    "L3 4 L8 -1 L13 4'/><circle cx='7' cy='-5' r='1.8' fill='__INK__' stroke='none'/></g><g transform='tr" +
    "anslate(272.1 77.2) rotate(-12) scale(0.99)'><path d='M-9 7 h18 C7 5 6 3 6 -1 a6 6 0 0 0 -12 0 C-6 3" +
    " -7 5 -9 7 Z M-2 10 a2 2 0 0 0 4 0'/></g><g transform='translate(353.2 316.1) rotate(4) scale(1.20)'" +
    "><rect x='-13' y='-9' width='26' height='18' rx='3'/><path d='M-13 -7 L0 3 L13 -7'/></g><g transform" +
    "='translate(353.5 -21.4) rotate(-11) scale(1.02)'><circle r='12'/><path d='M0 -6 V0 L5 3'/></g><g tr" +
    "ansform='translate(353.5 458.6) rotate(-11) scale(1.02)'><circle r='12'/><path d='M0 -6 V0 L5 3'/></" +
    "g><g transform='translate(266.4 229.3) rotate(-13) scale(1.03)'><path d='M-10 6 L6 -10 L11 -5 L-5 11" +
    " L-11 12 Z M-7 3 L-2 8'/></g><g transform='translate(206.3 171.3) rotate(-10) scale(1.17)'><path d='" +
    "M0 9 C-2 6 -12 1 -12 -5 C-12 -10 -7 -12 -3 -9.5 C-1.5 -8.5 0 -6.5 0 -6.5 C0 -6.5 1.5 -8.5 3 -9.5 C7 " +
    "-12 12 -10 12 -5 C12 1 2 6 0 9 Z'/></g><g transform='translate(410.9 184.2) rotate(-16) scale(0.95)'" +
    "><path d='M-6 8 V-8 L10 -12 V4'/><ellipse cx='-8.5' cy='8' rx='3' ry='2.2' fill='__INK__' stroke='no" +
    "ne'/><ellipse cx='7.5' cy='4' rx='3' ry='2.2' fill='__INK__' stroke='none'/></g><g transform='transl" +
    "ate(124.6 32.4) rotate(17) scale(1.10)'><rect x='-11' y='-6' width='17' height='14' rx='3'/><path d=" +
    "'M6 -3 h2.5 a4 4 0 0 1 0 8 H6 M-8 -10 q1.5 -3 0 -6 M-1 -10 q1.5 -3 0 -6'/></g><g transform='translat" +
    "e(188.5 436.8) rotate(1) scale(1.15)'><path d='M6 -10 v14 a6 6 0 0 1 -12 0 v-16 a4 4 0 0 1 8 0 v14 a" +
    "2 2 0 0 1 -4 0 v-12'/></g><g transform='translate(81.8 114.7) rotate(15) scale(0.92)'><path d='M0 -1" +
    "3 C1 -5 5 -1 13 0 C5 1 1 5 0 13 C-1 5 -5 1 -13 0 C-5 -1 -1 -5 0 -13 Z'/></g><g transform='translate(" +
    "37.3 201.0) rotate(8) scale(1.18)'><path d='M0 12 C-7 4 -9 0 -9 -4 a9 9 0 0 1 18 0 C9 0 7 4 0 12 Z'/" +
    "><circle cy='-4' r='3'/></g><g transform='translate(193.1 87.9) rotate(9) scale(1.09)'><rect x='-14'" +
    " y='-8' width='28' height='16' rx='8'/><circle cx='-6' cy='0' r='1.7' fill='__INK__' stroke='none'/>" +
    "<circle cx='0' cy='0' r='1.7' fill='__INK__' stroke='none'/><circle cx='6' cy='0' r='1.7' fill='__IN" +
    "K__' stroke='none'/></g><g transform='translate(291.4 402.5) rotate(-12) scale(0.88)'><rect x='-14' " +
    "y='-12' width='28' height='20' rx='6'/><path d='M-4 8 L-7 14 L0 8'/></g><g transform='translate(413." +
    "2 34.7) rotate(-7) scale(0.57)'><path d='M0 -13 C1 -5 5 -1 13 0 C5 1 1 5 0 13 C-1 5 -5 1 -13 0 C-5 -" +
    "1 -1 -5 0 -13 Z'/></g><g transform='translate(82.9 385.7) rotate(7) scale(0.59)'><path d='M0 9 C-2 6" +
    " -12 1 -12 -5 C-12 -10 -7 -12 -3 -9.5 C-1.5 -8.5 0 -6.5 0 -6.5 C0 -6.5 1.5 -8.5 3 -9.5 C7 -12 12 -10" +
    " 12 -5 C12 1 2 6 0 9 Z'/></g><g transform='translate(15.5 88.7) rotate(-11) scale(0.54)'><path d='M0" +
    " -13 L3.6 -4.3 L13 -4 L5.6 1.9 L8 12 L0 6.5 L-8 12 L-5.6 1.9 L-13 -4 L-3.6 -4.3 Z'/></g><g transform" +
    "='translate(146.4 208.7) rotate(-16) scale(0.48)'><path d='M0 -13 C1 -5 5 -1 13 0 C5 1 1 5 0 13 C-1 " +
    "5 -5 1 -13 0 C-5 -1 -1 -5 0 -13 Z'/></g><g transform='translate(454.7 313.9) rotate(-1) scale(0.55)'" +
    "><path d='M0 -13 L3.6 -4.3 L13 -4 L5.6 1.9 L8 12 L0 6.5 L-8 12 L-5.6 1.9 L-13 -4 L-3.6 -4.3 Z'/></g>" +
    "</g></svg>";

/** 480x840 doodle sheet (non-square so the repeat is harder to spot at timeline widths). */
const DOODLE_SHEET =
    "<svg xmlns='http://www.w3.org/2000/svg' width='480' height='840' viewBox='0 0 480 840'><defs><path i" +
    "d='bubble' d='M-16 -13h24a8 8 0 0 1 8 8v9a8 8 0 0 1 -8 8h-11l-9 9v-9h-4a8 8 0 0 1 -8 -8v-9a8 8 0 0 1" +
    " 8 -8zM-9 -2h14M-9 5h9'/><path id='plane' d='M21 -13L-21 1L-7 6L21 -13ZM-7 6L-5 16L2 8L11 12L21 -13'" +
    "/><path id='star' d='M0 -18L4.3 -6L17.1 -5.6L7 2.3L10.6 14.6L0 7.4L-10.6 14.6L-7 2.3L-17.1 -5.6L-4.3" +
    " -6Z'/><path id='heart' d='M0 14C-2 9 -16 3 -16 -6C-16 -12 -11 -15.5 -6 -13.5C-2.4 -12 0 -8.5 0 -6.5" +
    "C0 -8.5 2.4 -12 6 -13.5C11 -15.5 16 -12 16 -6C16 3 2 9 0 14Z'/><path id='planet' d='M-11 0A11 11 0 1" +
    " 1 11 0A11 11 0 1 1 -11 0M-13.4 -5.4C-18.6 -4.4 -21.8 -2.4 -21.3 -0.2C-20.6 3 -12.4 4.3 -3 2.7C6.4 1" +
    ".1 13.6 -2.8 12.9 -6C12.5 -8.2 8.7 -9.1 3.4 -8.7'/><path id='envelope' d='M-17 -11h34v22h-34zM-17 -1" +
    "1L0 4L17 -11'/><path id='coffee' d='M-11 -5h20v11a6 6 0 0 1 -6 6h-8a6 6 0 0 1 -6 -6zM9 -3h4a5 5 0 0 " +
    "1 0 10h-4M-6 -10c2 -2.5 -2 -4.5 0 -7M2 -10c2 -2.5 -2 -4.5 0 -7'/><path id='moon' d='M5 -15A15.5 15.5" +
    " 0 1 0 15.2 5.8A12.6 12.6 0 0 1 5 -15Z'/><path id='bolt' d='M4 -17L-9 3L-1 3L-4 17L9 -3L1 -3Z'/><pat" +
    "h id='note' d='M-7.4 12.6A4.6 4 -20 1 1 -7.3 12.7ZM-3 11V-13Q5 -11 8 -5'/><path id='sparkle' d='M0 -" +
    "11C1.3 -3.3 3.3 -1.3 11 0C3.3 1.3 1.3 3.3 0 11C-1.3 3.3 -3.3 1.3 -11 0C-3.3 -1.3 -1.3 -3.3 0 -11Z'/>" +
    "<path id='flower' d='M2.8 0A2.8 2.8 0 1 1 -2.8 0A2.8 2.8 0 1 1 2.8 0M-5.2 -9.6A5.2 5.2 0 1 1 5.2 -9." +
    "6A5.2 5.2 0 1 1 -5.2 -9.6M3.9 -3A5.2 5.2 0 1 1 14.3 -3A5.2 5.2 0 1 1 3.9 -3M0.4 7.8A5.2 5.2 0 1 1 10" +
    ".8 7.8A5.2 5.2 0 1 1 0.4 7.8M-10.8 7.8A5.2 5.2 0 1 1 -0.4 7.8A5.2 5.2 0 1 1 -10.8 7.8M-14.3 -3A5.2 5" +
    ".2 0 1 1 -3.9 -3A5.2 5.2 0 1 1 -14.3 -3'/><path id='dot' d='M2.6 0A2.6 2.6 0 1 1 -2.6 0A2.6 2.6 0 1 " +
    "1 2.6 0'/><path id='plus' d='M0 -4.5V4.5M-4.5 0H4.5'/></defs><g fill='none' stroke='__INK__' stroke-" +
    "opacity='__INKO__' stroke-linecap='round' stroke-linejoin='round'><use href='#bubble' transform='tra" +
    "nslate(60.6 61.4) rotate(-16.1) scale(1.02)' stroke-width='2'/><use href='#note' transform='translat" +
    "e(169.3 55) rotate(-22.2) scale(0.54)' stroke-width='3.7'/><use href='#coffee' transform='translate(" +
    "311.6 82.9) rotate(-17.7) scale(1.08)' stroke-width='1.8'/><use href='#sparkle' transform='translate" +
    "(431.7 52.7) rotate(3.8) scale(0.59)' stroke-width='3.4'/><use href='#flower' transform='translate(1" +
    "36.6 162.9) rotate(16) scale(0.64)' stroke-width='3.1'/><use href='#plane' transform='translate(234." +
    "5 157.2) rotate(17.1) scale(0.98)' stroke-width='2'/><use href='#bolt' transform='translate(359.9 18" +
    "1.3) rotate(0.1) scale(0.54)' stroke-width='3.7'/><use href='#moon' transform='translate(11.2 160.3)" +
    " rotate(-22.7) scale(1.24)' stroke-width='1.6'/><use href='#moon' transform='translate(491.2 160.3) " +
    "rotate(-22.7) scale(1.24)' stroke-width='1.6'/><use href='#star' transform='translate(57.3 306.5) ro" +
    "tate(-3.6) scale(1.39)' stroke-width='1.4'/><use href='#heart' transform='translate(178.4 292.9) rot" +
    "ate(11.7) scale(0.51)' stroke-width='3.9'/><use href='#heart' transform='translate(296.1 312.5) rota" +
    "te(2.7) scale(1.09)' stroke-width='1.8'/><use href='#star' transform='translate(412.7 316.4) rotate(" +
    "-19.1) scale(0.53)' stroke-width='3.8'/><use href='#flower' transform='translate(126.3 425.9) rotate" +
    "(-3.3) scale(0.59)' stroke-width='3.4'/><use href='#planet' transform='translate(230.8 420.7) rotate" +
    "(19) scale(0.95)' stroke-width='2.1'/><use href='#sparkle' transform='translate(350.5 415.6) rotate(" +
    "-21) scale(0.52)' stroke-width='3.8'/><use href='#envelope' transform='translate(11.8 422.1) rotate(" +
    "-19.8) scale(1.18)' stroke-width='1.7'/><use href='#envelope' transform='translate(491.8 422.1) rota" +
    "te(-19.8) scale(1.18)' stroke-width='1.7'/><use href='#bubble' transform='translate(62.9 545.9) rota" +
    "te(7.3) scale(1.01)' stroke-width='2'/><use href='#heart' transform='translate(202.7 532.5) rotate(-" +
    "6.2) scale(0.65)' stroke-width='3.1'/><use href='#plane' transform='translate(312.5 547.4) rotate(-1" +
    "0.7) scale(0.98)' stroke-width='2'/><use href='#note' transform='translate(427.9 539.6) rotate(-13.7" +
    ") scale(0.6)' stroke-width='3.3'/><use href='#bolt' transform='translate(130.5 651.1) rotate(2.7) sc" +
    "ale(0.51)' stroke-width='3.9'/><use href='#star' transform='translate(234.3 644.7) rotate(21.8) scal" +
    "e(1.32)' stroke-width='1.5'/><use href='#star' transform='translate(372 636.2) rotate(17.5) scale(0." +
    "57)' stroke-width='3.5'/><use href='#coffee' transform='translate(3.3 669.6) rotate(-25) scale(1.23)" +
    "' stroke-width='1.6'/><use href='#coffee' transform='translate(483.3 669.6) rotate(-25) scale(1.23)'" +
    " stroke-width='1.6'/><use href='#heart' transform='translate(59.8 779.6) rotate(15.4) scale(1.02)' s" +
    "troke-width='2'/><use href='#bolt' transform='translate(159.1 760.1) rotate(-22.5) scale(0.66)' stro" +
    "ke-width='3'/><use href='#planet' transform='translate(284.1 784.6) rotate(-4.1) scale(1.13)' stroke" +
    "-width='1.8'/><use href='#note' transform='translate(421.6 758.4) rotate(-1.9) scale(0.51)' stroke-w" +
    "idth='3.9'/><use href='#plus' transform='translate(133.3 -7.4) rotate(-18) scale(1.3)' stroke-width=" +
    "'1.5'/><use href='#plus' transform='translate(133.3 832.6) rotate(-18) scale(1.3)' stroke-width='1.5" +
    "'/><use href='#plus' transform='translate(257.7 -11.7) rotate(20) scale(0.88)' stroke-width='2.3'/><" +
    "use href='#plus' transform='translate(257.7 828.3) rotate(20) scale(0.88)' stroke-width='2.3'/><use " +
    "href='#dot' transform='translate(197.8 131.3) rotate(3.6) scale(1.1)' stroke-width='1.8'/><use href=" +
    "'#dot' transform='translate(317.3 104.2) rotate(-15.6) scale(1.02)' stroke-width='2'/><use href='#sp" +
    "arkle' transform='translate(123 252.3) rotate(18.5) scale(0.47)' stroke-width='4.2'/><use href='#spa" +
    "rkle' transform='translate(238.3 223.6) rotate(8) scale(0.56)' stroke-width='3.6'/><use href='#plus'" +
    " transform='translate(184.9 343.7) rotate(-0.6) scale(1.29)' stroke-width='1.6'/><use href='#sparkle" +
    "' transform='translate(307.6 346.4) rotate(-18.6) scale(0.52)' stroke-width='3.8'/><use href='#spark" +
    "le' transform='translate(132.3 495.2) rotate(-11) scale(0.59)' stroke-width='3.4'/><use href='#plus'" +
    " transform='translate(241.8 494.6) rotate(17.2) scale(0.91)' stroke-width='2.2'/><use href='#sparkle" +
    "' transform='translate(172.1 601.7) rotate(-5.8) scale(0.54)' stroke-width='3.7'/><use href='#plus' " +
    "transform='translate(295 604.3) rotate(-10.7) scale(1.3)' stroke-width='1.5'/><use href='#sparkle' t" +
    "ransform='translate(133.5 737.5) rotate(19.9) scale(0.51)' stroke-width='3.9'/><use href='#sparkle' " +
    "transform='translate(226.8 732.2) rotate(26.1) scale(0.56)' stroke-width='3.6'/></g></svg>";

/** 480x840 botanical sheet: fern sprigs with berry-cluster accents. */
const FERN_SHEET =
    "<svg xmlns='http://www.w3.org/2000/svg' width='480' height='840' viewBox='0 0 480 840'><defs><path i" +
    "d='lf' d='M0 0Q10 -10 23 -8Q12 2 0 0Z'/><g id='sprig'><path d='M-2 34C-7 14 -4 -12 5 -34'/><use href" +
    "='#lf' transform='translate(-5 22) rotate(-155)'/><use href='#lf' transform='translate(-4 8) rotate(" +
    "-30)'/><use href='#lf' transform='translate(-4 -6) rotate(-160)'/><use href='#lf' transform='transla" +
    "te(-1 -20) rotate(-35)'/><use href='#lf' transform='translate(5 -34) rotate(-80)'/></g><g id='frond'" +
    "><path d='M-3 46C-11 18 -7 -18 7 -46'/><path d='M-6 34Q-20 31 -25 21'/><path d='M-6 34Q7 29 10 18'/>" +
    "<path d='M-8 20Q-22 16 -26 6'/><path d='M-8 20Q5 15 8 4'/><path d='M-8 6Q-21 2 -24 -8'/><path d='M-8" +
    " 6Q4 1 6 -10'/><path d='M-6 -8Q-18 -12 -20 -21'/><path d='M-6 -8Q5 -13 7 -23'/><path d='M-3 -22Q-13 " +
    "-26 -14 -34'/><path d='M-3 -22Q7 -27 8 -35'/><path d='M1 -34Q-7 -38 -8 -44'/><path d='M1 -34Q9 -38 1" +
    "0 -43'/></g><g id='euca'><path d='M0 38C4 14 -4 -12 1 -38'/><circle cx='-8' cy='25' r='5.5'/><circle" +
    " cx='10' cy='17' r='5.5'/><circle cx='-8' cy='3' r='5.5'/><circle cx='9' cy='-5' r='5.5'/><circle cx" +
    "='-7' cy='-19' r='5'/><circle cx='8' cy='-27' r='5'/><circle cx='2' cy='-42' r='4'/></g><g id='berry" +
    "'><path d='M0 26C-2 14 -9 4 -14 -5'/><path d='M0 26C2 12 9 2 12 -9'/><path d='M0 26C0 16 -1 9 -1 3'/" +
    "><circle cx='-16' cy='-9' r='4.5'/><circle cx='14' cy='-13' r='4.5'/><circle cx='-1' cy='-2' r='4.5'" +
    "/></g><g id='bigleaf'><path d='M0 2C4 -14 24 -26 42 -22C42 -6 22 8 0 2Z'/><path d='M4 0C16 -8 28 -14" +
    " 38 -19'/></g><g id='dots' fill='__INK__' fill-opacity='__INKO__' stroke='none'><circle cx='0' cy='0" +
    "' r='2'/><circle cx='10' cy='4' r='2'/><circle cx='4' cy='12' r='2'/></g><g id='seed'><path d='M0 12" +
    "C0 6 0 2 0 -2'/><use href='#lf' transform='translate(0 -2) rotate(-125) scale(0.55)'/><use href='#lf" +
    "' transform='translate(0 -2) rotate(-55) scale(0.55)'/></g></defs><g fill='none' stroke='__INK__' st" +
    "roke-opacity='__INKO__' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><use href='#" +
    "sprig' transform='translate(49 42) rotate(-32) scale(0.95)'/><use href='#euca' transform='translate(" +
    "159 58) rotate(37) scale(0.82)'/><use href='#dots' transform='translate(322 76) rotate(14) scale(1)'" +
    "/><use href='#frond' transform='translate(436 64) rotate(-22) scale(0.81)'/><use href='#berry' trans" +
    "form='translate(139 197) rotate(-32) scale(0.95)'/><use href='#seed' transform='translate(242 169) r" +
    "otate(32) scale(1.09)'/><use href='#bigleaf' transform='translate(345 194) rotate(-58) scale(0.92)'/" +
    "><use href='#dots' transform='translate(2 195) rotate(18) scale(1.07)'/><use href='#dots' transform=" +
    "'translate(482 195) rotate(18) scale(1.07)'/><use href='#frond' transform='translate(55 304) rotate(" +
    "21) scale(0.99)'/><use href='#dots' transform='translate(190 322) rotate(-49) scale(0.99)'/><use hre" +
    "f='#sprig' transform='translate(298 284) rotate(9) scale(1.01)'/><use href='#euca' transform='transl" +
    "ate(433 295) rotate(-23) scale(0.84)'/><use href='#seed' transform='translate(99 410) rotate(52) sca" +
    "le(0.97)'/><use href='#bigleaf' transform='translate(226 436) rotate(-16) scale(0.95)'/><use href='#" +
    "berry' transform='translate(352 404) rotate(-40) scale(1.07)'/><use href='#seed' transform='translat" +
    "e(19 433) rotate(15) scale(0.99)'/><use href='#euca' transform='translate(43 540) rotate(-26) scale(" +
    "0.82)'/><use href='#sprig' transform='translate(185 549) rotate(-29) scale(0.93)'/><use href='#dots'" +
    " transform='translate(288 549) rotate(38) scale(1.08)'/><use href='#frond' transform='translate(435 " +
    "536) rotate(-37) scale(0.83)'/><use href='#dots' transform='translate(122 667) rotate(-7) scale(1.1)" +
    "'/><use href='#berry' transform='translate(251 657) rotate(-32) scale(0.79)'/><use href='#seed' tran" +
    "sform='translate(381 673) rotate(-11) scale(0.93)'/><use href='#bigleaf' transform='translate(470 66" +
    "0) rotate(41) scale(1.03)'/><use href='#bigleaf' transform='translate(-10 660) rotate(41) scale(1.03" +
    ")'/><use href='#frond' transform='translate(47 772) rotate(-27) scale(0.94)'/><use href='#frond' tra" +
    "nsform='translate(527 772) rotate(-27) scale(0.94)'/><use href='#seed' transform='translate(159 787)" +
    " rotate(-3) scale(0.97)'/><use href='#euca' transform='translate(289 784) rotate(5) scale(0.99)'/><u" +
    "se href='#sprig' transform='translate(425 768) rotate(5) scale(0.89)'/></g></svg>";

/** 420x420 star field: varied stars, four-point sparkles and two faint constellations. */
const STAR_TILE =
    "<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420' viewBox='0 0 420 420'><circle cx='2" +
    "89.7' cy='324.6' r='0.94' fill='__INK__' opacity='0.76'/><circle cx='35.8' cy='248.7' r='1.49' fill=" +
    "'__INK__' opacity='0.65'/><circle cx='380.4' cy='96.4' r='1.56' fill='__INK__' opacity='0.83'/><circ" +
    "le cx='277.4' cy='5.8' r='1.21' fill='__INK__' opacity='0.55'/><circle cx='317.2' cy='303.9' r='0.98" +
    "' fill='__INK__' opacity='0.36'/><circle cx='333.3' cy='87.5' r='1.00' fill='__INK__' opacity='0.43'" +
    "/><circle cx='197.4' cy='416.5' r='0.97' fill='__INK__' opacity='0.40'/><circle cx='356.4' cy='133.2" +
    "' r='1.15' fill='__INK__' opacity='0.99'/><circle cx='114.2' cy='162.2' r='0.94' fill='__INK__' opac" +
    "ity='0.91'/><circle cx='303.4' cy='369.1' r='1.26' fill='__INK__' opacity='0.87'/><circle cx='272.6'" +
    " cy='58.6' r='1.40' fill='__INK__' opacity='0.73'/><circle cx='132.4' cy='327.1' r='1.37' fill='__IN" +
    "K__' opacity='0.36'/><circle cx='391.4' cy='143.4' r='1.09' fill='__INK__' opacity='0.92'/><circle c" +
    "x='104.7' cy='73.6' r='1.62' fill='__INK__' opacity='0.53'/><circle cx='-0.7' cy='5.8' r='1.09' fill" +
    "='__INK__' opacity='0.84'/><circle cx='419.3' cy='5.8' r='1.09' fill='__INK__' opacity='0.84'/><circ" +
    "le cx='132.0' cy='277.5' r='0.78' fill='__INK__' opacity='0.40'/><circle cx='308.7' cy='220.4' r='0." +
    "98' fill='__INK__' opacity='0.95'/><circle cx='20.8' cy='308.6' r='1.75' fill='__INK__' opacity='0.5" +
    "4'/><circle cx='223.9' cy='359.7' r='1.63' fill='__INK__' opacity='0.73'/><circle cx='401.7' cy='295" +
    ".0' r='1.29' fill='__INK__' opacity='0.42'/><circle cx='123.5' cy='222.4' r='0.87' fill='__INK__' op" +
    "acity='0.51'/><circle cx='322.1' cy='58.2' r='0.79' fill='__INK__' opacity='0.56'/><circle cx='338.4" +
    "' cy='270.1' r='1.15' fill='__INK__' opacity='0.41'/><circle cx='122.0' cy='401.9' r='1.06' fill='__" +
    "INK__' opacity='0.81'/><circle cx='329.1' cy='391.3' r='1.37' fill='__INK__' opacity='0.42'/><circle" +
    " cx='151.9' cy='169.3' r='0.76' fill='__INK__' opacity='0.62'/><circle cx='322.1' cy='21.8' r='1.60'" +
    " fill='__INK__' opacity='0.42'/><circle cx='88.1' cy='250.5' r='0.81' fill='__INK__' opacity='0.59'/" +
    "><circle cx='278.6' cy='106.8' r='1.45' fill='__INK__' opacity='0.51'/><circle cx='270.1' cy='190.2'" +
    " r='1.52' fill='__INK__' opacity='0.38'/><circle cx='259.7' cy='275.4' r='0.72' fill='__INK__' opaci" +
    "ty='0.44'/><circle cx='140.1' cy='140.7' r='1.41' fill='__INK__' opacity='0.97'/><circle cx='324.8' " +
    "cy='119.0' r='0.77' fill='__INK__' opacity='0.46'/><circle cx='17.5' cy='95.4' r='1.68' fill='__INK_" +
    "_' opacity='0.64'/><circle cx='246.2' cy='120.2' r='1.68' fill='__INK__' opacity='0.85'/><circle cx=" +
    "'407.5' cy='76.9' r='1.00' fill='__INK__' opacity='0.87'/><circle cx='115.1' cy='123.4' r='1.54' fil" +
    "l='__INK__' opacity='0.35'/><circle cx='276.5' cy='222.7' r='1.00' fill='__INK__' opacity='0.51'/><c" +
    "ircle cx='237.0' cy='254.2' r='1.44' fill='__INK__' opacity='0.63'/><circle cx='239.0' cy='83.7' r='" +
    "0.82' fill='__INK__' opacity='0.59'/><circle cx='208.3' cy='26.4' r='1.37' fill='__INK__' opacity='0" +
    ".65'/><circle cx='195.4' cy='161.3' r='1.25' fill='__INK__' opacity='0.58'/><circle cx='150.7' cy='1" +
    "03.0' r='1.57' fill='__INK__' opacity='0.39'/><circle cx='54.5' cy='57.3' r='1.79' fill='__INK__' op" +
    "acity='0.40'/><circle cx='56.0' cy='87.6' r='1.78' fill='__INK__' opacity='0.61'/><circle cx='79.0' " +
    "cy='363.6' r='1.76' fill='__INK__' opacity='0.68'/><circle cx='44.6' cy='285.5' r='1.24' fill='__INK" +
    "__' opacity='0.55'/><circle cx='45.3' cy='204.4' r='1.78' fill='__INK__' opacity='0.69'/><circle cx=" +
    "'181.5' cy='386.9' r='0.70' fill='__INK__' opacity='0.85'/><circle cx='208.4' cy='233.7' r='1.19' fi" +
    "ll='__INK__' opacity='0.56'/><circle cx='342.2' cy='208.4' r='1.64' fill='__INK__' opacity='0.99'/><" +
    "circle cx='211.9' cy='271.8' r='0.79' fill='__INK__' opacity='0.42'/><circle cx='235.6' cy='413.5' r" +
    "='0.82' fill='__INK__' opacity='0.45'/><circle cx='151.3' cy='365.8' r='1.73' fill='__INK__' opacity" +
    "='0.92'/><circle cx='366.6' cy='291.8' r='0.76' fill='__INK__' opacity='0.73'/><circle cx='360.9' cy" +
    "='405.1' r='1.19' fill='__INK__' opacity='0.39'/><circle cx='250.8' cy='156.0' r='1.37' fill='__INK_" +
    "_' opacity='0.71'/><circle cx='159.8' cy='65.2' r='1.13' fill='__INK__' opacity='0.60'/><circle cx='" +
    "83.4' cy='136.2' r='1.12' fill='__INK__' opacity='0.85'/><circle cx='194.8' cy='93.3' r='0.96' fill=" +
    "'__INK__' opacity='0.80'/><circle cx='234.4' cy='307.5' r='1.26' fill='__INK__' opacity='0.60'/><cir" +
    "cle cx='85.1' cy='40.0' r='0.71' fill='__INK__' opacity='0.54'/><circle cx='343.6' cy='176.9' r='1.4" +
    "2' fill='__INK__' opacity='0.37'/><circle cx='160.1' cy='263.7' r='1.07' fill='__INK__' opacity='0.5" +
    "6'/><path d='M0 -13 C1 -5 5 -1 13 0 C5 1 1 5 0 13 C-1 5 -5 1 -13 0 C-5 -1 -1 -5 0 -13 Z' fill='__INK" +
    "__' opacity='0.60' transform='translate(355.1 348.2) scale(0.51)'/><path d='M0 -13 C1 -5 5 -1 13 0 C" +
    "5 1 1 5 0 13 C-1 5 -5 1 -13 0 C-5 -1 -1 -5 0 -13 Z' fill='__INK__' opacity='0.72' transform='transla" +
    "te(28.8 358.2) scale(0.42)'/><path d='M0 -13 C1 -5 5 -1 13 0 C5 1 1 5 0 13 C-1 5 -5 1 -13 0 C-5 -1 -" +
    "1 -5 0 -13 Z' fill='__INK__' opacity='0.58' transform='translate(30.4 148.5) scale(0.53)'/><path d='" +
    "M0 -13 C1 -5 5 -1 13 0 C5 1 1 5 0 13 C-1 5 -5 1 -13 0 C-5 -1 -1 -5 0 -13 Z' fill='__INK__' opacity='" +
    "0.55' transform='translate(398.6 193.2) scale(0.52)'/><path d='M0 -13 C1 -5 5 -1 13 0 C5 1 1 5 0 13 " +
    "C-1 5 -5 1 -13 0 C-5 -1 -1 -5 0 -13 Z' fill='__INK__' opacity='0.51' transform='translate(65.0 -7.4)" +
    " scale(0.49)'/><path d='M0 -13 C1 -5 5 -1 13 0 C5 1 1 5 0 13 C-1 5 -5 1 -13 0 C-5 -1 -1 -5 0 -13 Z' " +
    "fill='__INK__' opacity='0.51' transform='translate(65.0 412.6) scale(0.49)'/></svg>";

/** Substitute a tile's ink colour and ink opacity placeholders. */
function inked(tile: string, ink: string, opacity = "1"): string {
    return tile.replaceAll("__INKO__", opacity).replaceAll("__INK__", ink);
}

/** Wrap a raw SVG tile into a CSS `background-image` layer. */
function svgLayer(svg: string): string {
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Assemble per-layer [image, repeat, size] tuples (top layer first) into a variant. */
function variant(layers: Array<[image: string, repeat: string, size: string]>): ChatBackgroundVariant {
    return {
        image: layers.map((l) => l[0]).join(", "),
        repeat: layers.map((l) => l[1]).join(", "),
        size: layers.map((l) => l[2]).join(", "),
    };
}

/**
 * The bundled presets, in display order. The `RoomView.backgroundImage` setting stores either one
 * of these ids or an `mxc://` URI for a user-uploaded image.
 */
export const CHAT_BACKGROUND_PRESETS: readonly ChatBackgroundPreset[] = [
    {
        // Hand-drawn chat doodles straight on the canvas; single ink per theme.
        id: "doodle",
        light: variant([[svgLayer(inked(DOODLE_TILE, "rgba(84,100,130,0.26)")), "repeat", "480px 480px"]]),
        dark: variant([[svgLayer(inked(DOODLE_TILE, "rgba(190,205,225,0.20)")), "repeat", "480px 480px"]]),
    },
    {
        // The same doodles on a warm paper field, ink derived from the paper (tone-on-tone).
        id: "doodle-paper",
        light: variant([
            [svgLayer(inked(DOODLE_TILE, "rgba(126,110,86,0.26)")), "repeat", "480px 480px"],
            ["linear-gradient(#f2efe9, #f2efe9)", "no-repeat", "auto"],
        ]),
        dark: variant([
            [svgLayer(inked(DOODLE_TILE, "rgba(210,196,168,0.17)")), "repeat", "480px 480px"],
            ["linear-gradient(#1a1712, #1a1712)", "no-repeat", "auto"],
        ]),
    },
    {
        // Tone-on-tone doodle sheet over a four-lobe sage/cream mesh.
        id: "doodle-meadow",
        light: variant([
            [svgLayer(inked(DOODLE_SHEET, "#1c2b18", "0.1")), "repeat", "480px 840px"],
            ["radial-gradient(115% 115% at 80% 10%, #dfe8cd 0%, rgba(223,232,205,0) 60%)", "no-repeat", "auto"],
            ["radial-gradient(115% 115% at 35% 25%, #f0e4cf 0%, rgba(240,228,207,0) 58%)", "no-repeat", "auto"],
            ["radial-gradient(120% 120% at 20% 90%, #dce8dc 0%, rgba(220,232,220,0) 60%)", "no-repeat", "auto"],
            ["radial-gradient(115% 115% at 65% 75%, #ece3d2 0%, rgba(236,227,210,0) 58%)", "no-repeat", "auto"],
            ["linear-gradient(0deg, #ecebdf, #ecebdf)", "no-repeat", "auto"],
        ]),
        dark: variant([
            [svgLayer(inked(DOODLE_SHEET, "#000000", "0.34")), "repeat", "480px 840px"],
            ["radial-gradient(115% 115% at 80% 10%, #1a2018 0%, rgba(26,32,24,0) 60%)", "no-repeat", "auto"],
            ["radial-gradient(115% 115% at 35% 25%, #1d1e16 0%, rgba(29,30,22,0) 58%)", "no-repeat", "auto"],
            ["radial-gradient(120% 120% at 20% 90%, #161c1a 0%, rgba(22,28,26,0) 60%)", "no-repeat", "auto"],
            ["radial-gradient(115% 115% at 65% 75%, #191d13 0%, rgba(25,29,19,0) 58%)", "no-repeat", "auto"],
            ["linear-gradient(0deg, #171a14, #171a14)", "no-repeat", "auto"],
        ]),
    },
    {
        // Lavender morning in light; in dark the doodles glow periwinkle over a deep indigo mesh.
        id: "dusk-glow",
        light: variant([
            [svgLayer(inked(DOODLE_SHEET, "#2c2452", "0.09")), "repeat", "480px 840px"],
            ["radial-gradient(115% 115% at 80% 10%, #e2ddf4 0%, rgba(226,221,244,0) 60%)", "no-repeat", "auto"],
            ["radial-gradient(115% 115% at 35% 25%, #efdfec 0%, rgba(239,223,236,0) 58%)", "no-repeat", "auto"],
            ["radial-gradient(120% 120% at 20% 90%, #dde5f5 0%, rgba(221,229,245,0) 60%)", "no-repeat", "auto"],
            ["radial-gradient(115% 115% at 65% 75%, #e6ddf1 0%, rgba(230,221,241,0) 58%)", "no-repeat", "auto"],
            ["linear-gradient(0deg, #eae7f5, #eae7f5)", "no-repeat", "auto"],
        ]),
        dark: variant([
            [svgLayer(inked(DOODLE_SHEET, "#7a83f2", "0.18")), "repeat", "480px 840px"],
            ["radial-gradient(115% 115% at 80% 10%, #1a1a2e 0%, rgba(26,26,46,0) 60%)", "no-repeat", "auto"],
            ["radial-gradient(115% 115% at 35% 25%, #1b1626 0%, rgba(27,22,38,0) 58%)", "no-repeat", "auto"],
            ["radial-gradient(120% 120% at 20% 90%, #221527 0%, rgba(34,21,39,0) 60%)", "no-repeat", "auto"],
            ["radial-gradient(115% 115% at 65% 75%, #131b28 0%, rgba(19,27,40,0) 58%)", "no-repeat", "auto"],
            ["linear-gradient(0deg, #14141f, #14141f)", "no-repeat", "auto"],
        ]),
    },
    {
        // Star field over a sky glow; dark is the hero, light reads as an airy daybreak.
        id: "night-sky",
        light: variant([
            [svgLayer(inked(STAR_TILE, "rgba(90,110,160,0.5)")), "repeat", "420px 420px"],
            [
                "linear-gradient(180deg, rgba(168,196,255,0.55) 0%, rgba(214,226,255,0.30) 45%, rgba(255,240,224,0.35) 100%)",
                "no-repeat",
                "auto",
            ],
        ]),
        dark: variant([
            [svgLayer(inked(STAR_TILE, "rgba(205,220,255,0.8)")), "repeat", "420px 420px"],
            [
                "linear-gradient(180deg, rgba(47,66,116,0.55) 0%, rgba(26,34,58,0.30) 55%, rgba(16,19,23,0) 100%)",
                "no-repeat",
                "auto",
            ],
        ]),
    },
    {
        // Botanical line art on a celadon field, tone-on-tone in light, dark cutout ink in dark.
        id: "fern",
        light: variant([
            [svgLayer(inked(FERN_SHEET, "#cfdac6", "1")), "repeat", "480px 840px"],
            ["linear-gradient(155deg in oklab, #ecf2e3, #dfe9d8)", "no-repeat", "auto"],
        ]),
        dark: variant([
            [svgLayer(inked(FERN_SHEET, "#000000", "0.35")), "repeat", "480px 840px"],
            ["linear-gradient(155deg in oklab, #1a231b, #131a14)", "no-repeat", "auto"],
        ]),
    },
];

/**
 * Stored values from the retired first-generation presets, mapped to the nearest current preset
 * so existing account data keeps painting a wallpaper instead of silently going blank.
 */
const LEGACY_PRESET_ALIASES: Record<string, string> = {
    dots: "doodle",
    grid: "doodle",
    diagonal: "doodle",
    soft: "dusk-glow",
};

/**
 * Look up a bundled preset by id, following legacy aliases.
 * @param id The preset id (current or retired).
 * @returns The preset, or `undefined` if no preset has that id.
 */
export function getChatBackgroundPreset(id: string): ChatBackgroundPreset | undefined {
    const target = LEGACY_PRESET_ALIASES[id] ?? id;
    return CHAT_BACKGROUND_PRESETS.find((preset) => preset.id === target);
}

/**
 * Resolve a stored `RoomView.backgroundImage` value into ready-to-apply per-theme CSS values.
 *
 * @param value The stored setting value: `null`/empty for none, an `mxc://` URI for an uploaded
 *     image, or a bundled preset id (current or legacy).
 * @param client Optional client, used to turn an `mxc://` URI into an HTTP URL.
 * @returns The resolved background, or `null` when nothing should be painted (no value, an
 *     unknown preset id, or an `mxc://` URI that could not be turned into an HTTP URL).
 */
export function resolveChatBackground(
    value: string | null | undefined,
    client?: MatrixClient,
): ResolvedChatBackground | null {
    // The value comes from account data, which any client can write and which nothing validates on the way
    // in, so the declared type is a promise the data doesn't have to keep. Anything that isn't a string is
    // treated as "no background" rather than allowed to throw out of the caller's render.
    if (typeof value !== "string" || !value) return null;

    if (value.startsWith("mxc://")) {
        const srcHttp = mediaFromMxc(value, client).srcHttp;
        if (!srcHttp) return null;
        // An uploaded image is what it is -- the same variant serves both themes.
        const uploaded = { image: `url("${srcHttp}")`, repeat: "no-repeat", size: "cover" };
        return { light: uploaded, dark: uploaded };
    }

    const preset = getChatBackgroundPreset(value);
    if (!preset) return null;
    return { light: preset.light, dark: preset.dark };
}

/**
 * Coerce a stored `RoomView.backgroundOpacity` value into a usable opacity.
 *
 * Like the image setting, this comes from unvalidated account data: a non-numeric value would reach CSS as an
 * invalid declaration and silently paint the wallpaper at full strength, while the slider showed something
 * else entirely. Anything unusable falls back to the default, and out-of-range numbers are clamped so the
 * control and the timeline always agree.
 *
 * @param value The stored setting value.
 * @returns An opacity between {@link MIN_CHAT_BACKGROUND_OPACITY} and 1.
 */
export function clampChatBackgroundOpacity(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CHAT_BACKGROUND_OPACITY;
    return Math.min(1, Math.max(MIN_CHAT_BACKGROUND_OPACITY, value));
}
