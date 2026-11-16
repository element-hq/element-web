/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/*
 * Styles de l'écran d'installation, injectés avec lui et retirés après. Tout est préfixé par
 * `.lvgInstall` pour ne rien toucher dans Element, et pour qu'Element ne touche rien ici.
 * Polices sous licence SIL OFL 1.1 (voir res/fonts/Leveragers/).
 */

import monaSansUrl from "../../../res/fonts/Leveragers/MonaSans-latin.woff2";
import soraUrl from "../../../res/fonts/Leveragers/Sora-latin.woff2";

export const installScreenCss = `
@font-face{font-family:"Lvg Mona Sans";src:url("${monaSansUrl}") format("woff2");font-weight:200 900;font-stretch:75% 125%;font-display:swap}
@font-face{font-family:"Lvg Sora";src:url("${soraUrl}") format("woff2");font-weight:400 800;font-display:swap}

.lvgInstall{
  --navy:#0A082B; --cyan:#2CF8E5; --primary:#0A082B; --primary-hover:#25224f;
  --ink:#0f172a; --ink-2:#475569; --ink-3:#64748b; --line:#e2e8f0; --soft:#f1f5f9; --ok:#047857;
  --sans:"Lvg Sora",Inter,system-ui,sans-serif; --display:"Lvg Mona Sans",Inter,system-ui,sans-serif;
  position:fixed;inset:0;z-index:2000;overflow-y:auto;display:flex;background:#fff;color:var(--ink);
  font-family:var(--sans);font-size:1rem;line-height:1.6;-webkit-font-smoothing:antialiased;text-align:left
}
.lvgInstall *,.lvgInstall *::before,.lvgInstall *::after{box-sizing:border-box}
.lvgInstall h1,.lvgInstall h2,.lvgInstall .lvgI-display{font-family:var(--display);font-stretch:125%;font-weight:600;letter-spacing:-.01em}
.lvgInstall :focus-visible{outline:2px solid var(--primary);outline-offset:2px;border-radius:6px}
.lvgInstall :where(button){font:inherit;margin:0}
.lvgInstall p,.lvgInstall ul,.lvgInstall ol{margin:0;padding:0}

.lvgI-brand{width:44%;flex:none;background:var(--navy);padding:40px;display:flex;flex-direction:column;justify-content:space-between;gap:32px;color:#cbd5e1}
.lvgI-brand .lvgI-lockup{display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.lvgI-brand .lvgI-name{font-size:17px;line-height:1.2;color:#fff}
.lvgI-brand .lvgI-by{font-size:11px;line-height:1.2;font-style:italic;color:#67e8f9}
.lvgI-brand h2{margin:0;max-width:14ch;color:#fff;font-size:clamp(1.875rem,2.6vw,2.25rem);font-weight:700;line-height:1.15;letter-spacing:-.02em;text-wrap:balance}
.lvgI-brand .lvgI-pitch p{margin-top:16px;max-width:38ch;font-size:.9375rem;line-height:1.65}
.lvgI-brand ul{list-style:none;display:grid;gap:10px;font-size:.8125rem}
.lvgI-brand li{display:flex;align-items:center;gap:10px}
.lvgI-brand li svg{color:var(--cyan);flex:none}

.lvgI-main{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 24px}
.lvgI-content{width:100%;max-width:27rem}
.lvgInstall h1{margin:0;font-size:1.625rem;line-height:1.2;text-wrap:balance;color:var(--ink)}
.lvgI-lead{margin-top:12px!important;margin-bottom:0!important;color:var(--ink-2);font-size:.9375rem;text-wrap:pretty}

.lvgI-steps{list-style:none;display:grid}
.lvgI-lead + .lvgI-steps{margin-top:24px!important}
.lvgI-steps li{position:relative;display:grid;grid-template-columns:28px 1fr;gap:12px;align-items:start;padding-bottom:20px}
.lvgI-steps li:last-child{padding-bottom:0}
.lvgI-steps li:not(:last-child)::before{content:"";position:absolute;left:13.5px;top:36px;bottom:8px;width:1px;background:#c9c8dc}
.lvgI-n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--primary);color:#fff;font-size:.75rem;font-weight:600;font-variant-numeric:tabular-nums}
.lvgI-steps strong{display:block;font-size:.9375rem;font-weight:600;line-height:28px;color:var(--ink)}
.lvgI-d{display:block;font-size:.875rem;color:var(--ink-3);line-height:1.5}
.lvgInstall kbd{font:600 .8125rem/1 var(--sans);background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:2px 6px;white-space:nowrap;color:var(--ink)}
.lvgI-hint{margin-top:8px!important;font-size:.8125rem;color:var(--ink-2)}

.lvgI-actions{margin-top:24px;display:grid;gap:12px}
.lvgI-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;width:100%;padding:0 16px;border-radius:8px;border:0;font-size:.875rem;font-weight:600;cursor:pointer;transition:background-color 150ms ease-out}
.lvgI-btn:disabled{cursor:not-allowed;opacity:.7}
.lvgI-btn-primary{background:var(--primary);color:#fff}
.lvgI-btn-primary:hover:not(:disabled){background:var(--primary-hover)}
.lvgI-more{margin-top:20px!important;text-align:center}
.lvgI-link{background:none;border:0;padding:4px 2px;font-size:.8125rem;font-weight:500;color:var(--ink-3);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.lvgI-link:hover{color:var(--ink)}
a.lvgI-btn{text-decoration:none}
.lvgI-note{margin-top:12px!important;font-size:.75rem;color:var(--ink-3)}
.lvgI-done{display:inline-flex;align-items:center;gap:8px;font-size:.8125rem;font-weight:600;color:var(--ok)}
.lvgI-done + h1{margin-top:10px}

/* Scène animée : 480 x 300, mise à l'échelle de sa boîte */
.lvgI-stage-wrap{width:100%;margin-top:32px}
.lvgI-stage-box{position:relative;width:100%;aspect-ratio:480/300}
.lvgI-stage{position:absolute;left:0;top:0;width:480px;height:300px;transform-origin:0 0;transform:scale(var(--s,1));border-radius:14px;overflow:hidden;
  background:linear-gradient(160deg,#28306b 0%,#3b4a8f 55%,#6f7fc0 100%);box-shadow:0 0 0 1px rgba(255,255,255,.08),0 20px 50px rgba(0,0,0,.35);font:500 12px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#111}
.lvgI-stage .appwin{position:absolute;left:70px;top:34px;width:340px;height:190px;background:#FAF8F4;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);overflow:hidden}
.lvgI-stage .tb{height:22px;display:flex;align-items:center;gap:5px;padding:0 9px;border-bottom:1px solid #E5E0D7;font-size:10px;color:#6A645B}
.lvgI-stage .tb i{width:8px;height:8px;border-radius:50%;background:#E2DDD4}
.lvgI-stage .tb .ctl{margin-left:auto;letter-spacing:8px}
.lvgI-stage .bd{display:grid;grid-template-columns:110px 1fr;height:calc(100% - 22px)}
.lvgI-stage .sd{border-right:1px solid #E5E0D7;padding:9px;display:grid;gap:9px;align-content:start}
.lvgI-stage .r{display:flex;gap:6px;align-items:center}
.lvgI-stage .r b{width:14px;height:14px;border-radius:50%;background:#E4E3F3}
.lvgI-stage .r s{flex:1;height:5px;border-radius:3px;background:#E7E2D9;text-decoration:none}
.lvgI-stage .mn{padding:10px;display:grid;gap:7px;align-content:end}
.lvgI-stage .mn u{height:14px;border-radius:7px;background:#F0EBE3;width:70%;text-decoration:none}
.lvgI-stage .mn u.me{background:#E7EDF6;justify-self:end;width:52%}
.lvgI-stage .dock{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:8px;padding:6px 9px;background:rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.35);border-radius:14px}
.lvgI-stage .dock span{width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.55);position:relative;display:block}
.lvgI-stage .dock .me{background:none}
.lvgI-stage .dock .me img{width:34px;height:34px;border-radius:8px;display:block}
.lvgI-stage .dock .me::after{content:"";position:absolute;left:50%;bottom:-5px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:rgba(255,255,255,.9)}
.lvgI-stage .taskbar{position:absolute;left:0;right:0;bottom:0;height:40px;background:rgba(243,244,248,.94);border-top:1px solid rgba(0,0,0,.08);display:flex;justify-content:center;align-items:center;gap:6px}
.lvgI-stage .taskbar span{width:30px;height:30px;border-radius:6px;background:#dfe3ec;position:relative;display:block}
.lvgI-stage .taskbar .me{background:none}
.lvgI-stage .taskbar .me img{width:30px;height:30px;border-radius:6px;display:block}
.lvgI-stage .taskbar .me::after{content:"";position:absolute;left:50%;bottom:-4px;width:12px;height:3px;margin-left:-6px;border-radius:2px;background:#5b6cd6}
.lvgI-stage .menu{position:absolute;background:rgba(246,246,248,.98);border:1px solid rgba(0,0,0,.12);border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.28);padding:4px;min-width:150px;opacity:0;transform-origin:bottom left}
.lvgI-stage .menu div{padding:4px 10px;border-radius:5px;white-space:nowrap;display:flex;justify-content:space-between;gap:16px}
.lvgI-stage .menu hr{border:0;border-top:1px solid rgba(0,0,0,.1);margin:3px 6px}
.lvgI-stage .win-menu{background:#fbfbfd;min-width:200px}
.lvgI-stage .win-menu div{padding:7px 12px;justify-content:flex-start;gap:8px}
.lvgI-stage .cursor{position:absolute;left:0;top:0;width:18px;height:18px;z-index:5;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}
.lvgI-stage .ring{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid #fff;opacity:0;z-index:4}
.lvgI-stage .badge{position:absolute;padding:5px 10px;border-radius:999px;background:#fff;color:#065f46;font-weight:600;font-size:11px;box-shadow:0 4px 14px rgba(0,0,0,.25);opacity:0;white-space:nowrap}
.lvgI-stage .menubar{position:absolute;left:0;right:0;top:0;height:20px;background:rgba(255,255,255,.78);display:flex;gap:14px;align-items:center;padding:0 12px;font-size:11px}
.lvgI-stage .menubar b{font-weight:700}
.lvgI-stage .menubar .fichier{padding:1px 6px;border-radius:4px}
.lvgI-stage .sdialog{position:absolute;left:140px;top:70px;width:200px;background:#f6f6f8;border-radius:10px;box-shadow:0 14px 36px rgba(0,0,0,.35);padding:14px;opacity:0;text-align:center;display:grid;gap:8px;justify-items:center}
.lvgI-stage .sdialog img{width:36px;height:36px;border-radius:8px}
.lvgI-stage .sdialog .bt{display:flex;gap:6px}
.lvgI-stage .sdialog .bt span{padding:3px 12px;border-radius:6px;background:#e4e4e8}
.lvgI-stage .sdialog .bt span.go{background:#2f6feb;color:#fff}

/* Chorégraphies : 8 s en boucle, transform et opacity (plus la surbrillance des menus) */
.lvgI-stage.s-mac .cursor{animation:lvg-mac-cur 8s ease-out infinite}
@keyframes lvg-mac-cur{0%{transform:translate(400px,110px)}14%,26%{transform:translate(280px,260px)}36%,46%{transform:translate(300px,146px)}54%,100%{transform:translate(118px,146px)}}
.lvgI-stage.s-mac .ring{left:282px;top:264px;animation:lvg-ring 8s infinite}
@keyframes lvg-ring{0%,15%{opacity:0;transform:scale(.4)}17%{opacity:.9;transform:scale(1)}21%,100%{opacity:0;transform:scale(1.4)}}
.lvgI-stage.s-mac .m1{left:196px;bottom:56px;animation:lvg-m1 8s infinite}
@keyframes lvg-m1{0%,16%{opacity:0;transform:scale(.96)}18%,62%{opacity:1;transform:scale(1)}64%,100%{opacity:0;transform:scale(.96)}}
.lvgI-stage.s-mac .m1 .opt{animation:lvg-hl 8s infinite}
@keyframes lvg-hl{0%,35%{background:transparent;color:inherit}37%,62%{background:#2f6feb;color:#fff}64%,100%{background:transparent;color:inherit}}
.lvgI-stage.s-mac .m2{left:44px;bottom:86px;transform-origin:top right;animation:lvg-m2 8s infinite}
@keyframes lvg-m2{0%,38%{opacity:0;transform:scale(.96)}40%,62%{opacity:1;transform:scale(1)}64%,100%{opacity:0;transform:scale(.96)}}
.lvgI-stage.s-mac .m2 .keep{animation:lvg-hl2 8s infinite}
@keyframes lvg-hl2{0%,53%{background:transparent;color:inherit}55%,62%{background:#2f6feb;color:#fff}64%,100%{background:transparent;color:inherit}}
.lvgI-stage.s-mac .badge{left:160px;bottom:62px;animation:lvg-bdg 8s infinite}
@keyframes lvg-bdg{0%,65%{opacity:0;transform:translateY(6px)}69%,94%{opacity:1;transform:translateY(0)}100%{opacity:0}}

.lvgI-stage.s-win .cursor{animation:lvg-win-cur 8s ease-out infinite}
@keyframes lvg-win-cur{0%{transform:translate(400px,110px)}14%,28%{transform:translate(274px,276px)}40%,100%{transform:translate(268px,202px)}}
.lvgI-stage.s-win .ring{left:276px;top:281px;animation:lvg-ring 8s infinite}
.lvgI-stage.s-win .m1{left:175px;bottom:46px;animation:lvg-m1w 8s infinite}
@keyframes lvg-m1w{0%,16%{opacity:0;transform:scale(.96)}18%,56%{opacity:1;transform:scale(1)}58%,100%{opacity:0;transform:scale(.96)}}
.lvgI-stage.s-win .m1 .pin{animation:lvg-hlw 8s infinite}
@keyframes lvg-hlw{0%,38%{background:transparent}40%,56%{background:#e5e9f7}58%,100%{background:transparent}}
.lvgI-stage.s-win .badge{left:130px;bottom:52px;animation:lvg-bdgw 8s infinite}
@keyframes lvg-bdgw{0%,59%{opacity:0;transform:translateY(6px)}63%,94%{opacity:1;transform:translateY(0)}100%{opacity:0}}

.lvgI-stage.s-safari .cursor{animation:lvg-saf-cur 8s ease-out infinite}
@keyframes lvg-saf-cur{0%{transform:translate(400px,150px)}12%,22%{transform:translate(86px,6px)}32%,42%{transform:translate(118px,87px)}52%,100%{transform:translate(272px,159px)}}
.lvgI-stage.s-safari .ring{left:89px;top:10px;animation:lvg-ring 8s infinite}
.lvgI-stage.s-safari .fichier{animation:lvg-fich 8s infinite}
@keyframes lvg-fich{0%,13%{background:transparent;color:inherit}15%,40%{background:#2f6feb;color:#fff}42%,100%{background:transparent;color:inherit}}
.lvgI-stage.s-safari .m1{left:48px;top:20px;transform-origin:top left;animation:lvg-m1s 8s infinite}
@keyframes lvg-m1s{0%,14%{opacity:0}16%,40%{opacity:1}42%,100%{opacity:0}}
.lvgI-stage.s-safari .m1 .add{animation:lvg-hls 8s infinite}
@keyframes lvg-hls{0%,29%{background:transparent;color:inherit}31%,40%{background:#2f6feb;color:#fff}42%,100%{background:transparent;color:inherit}}
.lvgI-stage.s-safari .sdialog{animation:lvg-sdl 8s infinite}
@keyframes lvg-sdl{0%,41%{opacity:0;transform:scale(.96)}44%,60%{opacity:1;transform:scale(1)}62%,100%{opacity:0;transform:scale(.96)}}
.lvgI-stage.s-safari .dock .me{animation:lvg-pop 8s infinite}
@keyframes lvg-pop{0%,62%{opacity:0;transform:scale(.4)}68%,96%{opacity:1;transform:scale(1)}100%{opacity:0}}
.lvgI-stage.s-safari .badge{left:178px;bottom:62px;animation:lvg-bdg 8s infinite}

/* Mockup d'intro : l'app arrive dans le Dock (ou la barre des tâches), une seule fois */
.lvgI-stage.s-intro-mac .cursor,.lvgI-stage.s-intro-mac .ring,.lvgI-stage.s-intro-win .cursor,.lvgI-stage.s-intro-win .ring{display:none}
.lvgI-stage[class*="s-intro"] .me{animation:lvg-intro-pop 600ms 300ms cubic-bezier(.2,.7,.2,1) both}
.lvgI-stage[class*="s-intro"] .me img{box-shadow:0 0 0 2px rgba(44,248,229,.9),0 6px 16px rgba(0,0,0,.3)}
.lvgI-stage .tip{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);padding:3px 9px;border-radius:6px;background:rgba(30,30,36,.88);color:#fff;font-size:11px;font-weight:600;white-space:nowrap;animation:lvg-intro-tip 400ms 900ms ease-out both}
@keyframes lvg-intro-pop{from{opacity:0;transform:translateY(10px) scale(.6)}to{opacity:1;transform:none}}
@keyframes lvg-intro-tip{from{opacity:0}to{opacity:1}}

@media (prefers-reduced-motion:reduce){
  .lvgI-stage *{animation:none!important}
  /* Image fixe : le moment clé, menus ouverts */
  .lvgI-stage.s-mac .m1,.lvgI-stage.s-mac .m2,.lvgI-stage.s-win .m1,.lvgI-stage.s-safari .m1{opacity:1;transform:none}
  .lvgI-stage.s-mac .cursor{transform:translate(118px,146px)}
  .lvgI-stage.s-mac .m2 .keep,.lvgI-stage.s-safari .m1 .add{background:#2f6feb;color:#fff}
  .lvgI-stage.s-win .cursor{transform:translate(268px,202px)}
  .lvgI-stage.s-win .m1 .pin{background:#e5e9f7}
  .lvgI-stage.s-safari .cursor{transform:translate(118px,87px)}
  .lvgInstall .lvgI-btn{transition:none}
}

@media (max-width:900px){.lvgInstall{flex-direction:column}.lvgI-brand{width:100%}}
`;
