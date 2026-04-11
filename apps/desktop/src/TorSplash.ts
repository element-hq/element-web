/**
 * TorSplash.ts
 *
 * Displays a minimal splash window while Tor bootstraps.
 * Closes automatically once TorService emits EVENT_READY.
 * Lives entirely in the main process.
 */

import { BrowserWindow } from "electron";
import * as path from "path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TorService, type BootstrapEvent } from "./TorService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class TorSplash {
    private window: BrowserWindow | null = null;

    /** Create and show the splash window */
    show(): void {
        this.window = new BrowserWindow({
            width: 380,
            height: 220,
            resizable: false,
            frame: false,
            alwaysOnTop: true,
            center: true,
            backgroundColor: "#1a1a2e",
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
            },
        });

        // Load inline HTML — no external file needed
        void this.window.loadURL(
            `data:text/html;charset=utf-8,${encodeURIComponent(this.buildHtml())}`,
        );

        this.window.once("ready-to-show", () => {
            this.window?.show();
        });
    }

    /** Update the progress bar and status text */
    update(event: BootstrapEvent): void {
        if (!this.window || this.window.isDestroyed()) return;

        void this.window.webContents.executeJavaScript(`
            document.getElementById('progress').style.width = '${event.percent}%';
            document.getElementById('status').textContent = '${event.summary.replace(/'/g, "\\'")}';
            document.getElementById('percent').textContent = '${event.percent}%';
        `);
    }

    /** Close the splash window */
    close(): void {
        if (this.window && !this.window.isDestroyed()) {
            this.window.close();
            this.window = null;
        }
    }

    private buildHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1a1a2e;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 16px;
    user-select: none;
    -webkit-app-region: drag;
  }
  .logo {
    font-size: 32px;
    font-weight: 700;
    color: #7b68ee;
    letter-spacing: 2px;
  }
  .subtitle {
    font-size: 13px;
    color: #888;
    margin-top: -8px;
  }
  .progress-container {
    width: 280px;
    background: #2a2a4a;
    border-radius: 4px;
    height: 6px;
    overflow: hidden;
    margin-top: 8px;
  }
  .progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #7b68ee, #9b8fff);
    border-radius: 4px;
    transition: width 0.4s ease;
  }
  .status-row {
    display: flex;
    justify-content: space-between;
    width: 280px;
    font-size: 11px;
    color: #666;
  }
</style>
</head>
<body>
  <div class="logo">element-tor</div>
  <div class="subtitle">Connecting to Tor network...</div>
  <div class="progress-container">
    <div class="progress-bar" id="progress"></div>
  </div>
  <div class="status-row">
    <span id="status">Starting...</span>
    <span id="percent">0%</span>
  </div>
</body>
</html>`;
    }
}