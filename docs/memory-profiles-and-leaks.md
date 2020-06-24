## Memory leaks

Riot usually emits slow behaviour just before it is about to crash. Getting a 
memory snapshot (below) just before that happens is ideal in figuring out what
is going wrong.

Common symptoms are clicking on a room and it feels like the tab froze and scrolling
becoming jumpy/staggered. 

If you receive a white screen (electron) or the chrome crash page, it is likely
run out of memory and it is too late for a memory profile. Please do report when
this happens though so we can try and narrow down what might have gone wrong.

## Memory profiles/snapshots

When investigating memory leaks/problems it's usually important to compare snapshots
from different points in the Riot session lifecycle. Most importantly, a snapshot
to establish the baseline or "normal" memory usage is useful. Taking a snapshot
roughly 30-60 minutes after starting Riot is a good time to establish "normal"
memory usage for the app - anything after that is at risk of hiding the memory leak
and anything newer is still in the warmup stages of the app.

**Memory profiles can contain sensitive information.** If you are submitting a memory
profile to us for debugging purposes, please pick the appropriate Riot developer and
send them over an encrypted private message. *Do not share your memory profile in
public channels or with people you do not trust.*

### Taking a memory profile (Firefox)

1. Press CTRL+SHIFT+I (I as in eye).
2. Click the Memory tab.
3. Press the camera icon in the top left of the pane.
4. Wait a bit (coffee is a good option).
5. When the save button appears on the left side of the panel, click it to save the
   profile locally.
6. Compress the file (gzip or regular zip) to make the file smaller.
7. Send the compressed file to whoever asked for it (if you trust them).

While the profile is in progress, the tab might be frozen or unresponsive.

### Taking a memory profile (Chrome/Desktop)

1. Press CTRL+SHIFT+I (I as in eye).
2. Click the Memory tab.
3. Select "Heap Snapshot" and the riot.im VM instance (not the indexeddb one).
4. Click "Take Snapshot".
5. Wait a bit (coffee is a good option).
6. When the save button appears on the left side of the panel, click it to save the
   profile locally.
7. Compress the file (gzip or regular zip) to make the file smaller.
8. Send the compressed file to whoever asked for it (if you trust them).

While the profile is in progress, the tab might be frozen or unresponsive.
