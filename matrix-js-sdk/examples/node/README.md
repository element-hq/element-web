This is a functional terminal app which allows you to see the room list for a user, join rooms, send messages and view room membership lists.


To try it out, you will need to edit `app.js` to configure it for your `homeserver`, `access_token` and `user_id`. Then run:

```
 $ npm install
 $ node app
```

Example output:

```
Room List:
[0] Room Invite (0 members)
[1] Room Invite (0 members)
[2] My New Room (2 members)
[3] @megan:localhost (1 members)
[4] True Stuff (7 members)
Global commands:
  '/help' : Show this help.
Room list index commands:
  '/enter <index>' Enter a room, e.g. '/enter 5'
Room commands:
  '/exit' Return to the room list index.
  '/members' Show the room member list.
  
$ /enter 2

[2015-06-12 15:14:54] Megan2 <<< herro
[2015-06-12 15:22:58] Me >>> hey
[2015-06-12 15:23:00] Me >>> whats up?
[2015-06-12 15:25:40] Megan2 <<< not a lot
[2015-06-12 15:25:47] Megan2 --- [State: m.room.topic updated to: {"topic":"xXx_topic_goes_here_xXx"}]
[2015-06-12 15:25:55] Megan2 --- [State: m.room.name updated to: {"name":"My Newer Room"}]

$ /members

Membership list for room "My Newer Room"
----------------------------------------
join      :: @example:localhost (Me)
leave     :: @fred:localhost (@fred:localhost)
invite    :: @earl:localhost (@earl:localhost)
join      :: Megan2 (@megan:localhost)
invite    :: @toejam:localhost (@toejam:localhost)
```
