/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/* eslint-disable max-len, camelcase */

declare const __webpack_hash__: string;

import ThemeWatcher from "../../settings/watchers/ThemeWatcher";

const getExportCSS = async (): Promise<string> => {
    const theme = new ThemeWatcher().getEffectiveTheme();
    const hash = __webpack_hash__;

    const bundle = await fetch(`bundles/${hash}/bundle.css`);
    const bundleCSS = await bundle.text();
    let themeCSS: string;
    if (theme === 'light') {
        const res = await fetch(`bundles/${hash}/theme-light.css`);
        themeCSS = await res.text();
    } else {
        const res = await fetch(`bundles/${hash}/theme-dark.css`);
        themeCSS = await res.text();
    }
    const fontFaceRegex = /@font-face {.*?}/sg;

    themeCSS = themeCSS.replace(fontFaceRegex, '');
    themeCSS = themeCSS.replace(
        /font-family: Inter/g,
        `font-family: -apple-system, BlinkMacSystemFont, avenir next, 
        avenir, segoe ui, helvetica neue, helvetica, Ubuntu, roboto, noto, arial, sans-serif`,
    );
    themeCSS = themeCSS.replace(
        /font-family: Inconsolata/g,
        "font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace",
    );

    const customCSS = `
#snackbar {
    display: flex;
    visibility: hidden;
    min-width: 250px;
    margin-left: -125px;
    background-color: #333;
    color: #fff;
    text-align: center;
    position: fixed;
    z-index: 1;
    left: 50%;
    bottom: 30px;
    font-size: 17px;
    padding: 6px 16px;
    font-family: -apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Ubuntu, roboto, noto, arial, sans-serif;
    font-weight: 400;
    line-height: 1.43;
    border-radius: 4px;
    letter-spacing: 0.01071em;
  }
  
  #snackbar.mx_show {
    visibility: visible;
    -webkit-animation: mx_snackbar_fadein 0.5s, mx_snackbar_fadeout 0.5s 2.5s;
    animation: mx_snackbar_fadein 0.5s, mx_snackbar_fadeout 0.5s 2.5s;
  }
  
  a.mx_reply_anchor{
    cursor: pointer;
    color: #238cf5;
  }
  
  a.mx_reply_anchor:hover{
    text-decoration: underline;
  }
  
  @-webkit-keyframes mx_snackbar_fadein {
    from {bottom: 0; opacity: 0;}
    to {bottom: 30px; opacity: 1;}
  }
  
  @keyframes mx_snackbar_fadein {
    from {bottom: 0; opacity: 0;}
    to {bottom: 30px; opacity: 1;}
  }
  
  @-webkit-keyframes mx_snackbar_fadeout {
    from {bottom: 30px; opacity: 1;}
    to {bottom: 0; opacity: 0;}
  }
  
  @keyframes mx_snackbar_fadeout {
    from {bottom: 30px; opacity: 1;}
    to {bottom: 0; opacity: 0;}
  }
  
  .mx_MFileBody_info .mx_MFileBody_info_icon img.mx_export_attach_icon {
    content: '';
    background-color: ${theme == 'light' ? "#ffffff": "inherit"};
    width: 13px;
    height: 15px;
    position: absolute;
    top: 8px;
    left: 9px;
  }
  
  * {
    scroll-behavior: smooth !important;
  }
  
  
  .mx_Export_EventWrapper:target {
    background: ${theme == 'light' ? "white" : "#15191E"};
    animation: mx_event_highlight_animation 2s linear;
  }
  
  
  @keyframes mx_event_highlight_animation {
    0%,100% {
      background: ${theme == 'light' ? "white" : "#15191E"};
    }
    50% {
      background: ${theme == 'light' ? "#e3e2df" : "#21262c"};
    }
  }
  
  .mx_ReplyThread_Export {
    margin-top: -5px;
    margin-bottom: 5px;
  }
  
  .mx_RedactedBody img.mx_export_trash_icon {
    height: 14px;
    width: 14px;
    background-color: ${theme == 'light' ? "#ffffff": "inherit"};
    content: '';
    position: absolute;
    top: 1px;
    left: 0;
  }
  
  img {
    white-space: nowrap;
    overflow: hidden;
  }
`;

    return themeCSS + bundleCSS + customCSS;
};

export default getExportCSS;
