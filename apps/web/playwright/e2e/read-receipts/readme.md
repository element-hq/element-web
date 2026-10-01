# High Level Read Receipt Tests

Tips for writing these tests:

- Break up your tests into the smallest test case possible. The purpose of
  these tests is to understand hard-to-find bugs, so small tests are necessary.
  We know that Playwright recommends combining tests together for performance, but
  that will frustrate our goals here. (We will need to find a different way to
  reduce CI time.)

- Try to assert something after every action, to make sure it has completed.
  E.g.:
  markAsRead(room2);
  assertRead(room2);
  You should especially follow this rule if you are jumping to a different
  room or similar straight afterward.

- Use assertStillRead() if you are asserting something is read when it was
  also read before. This waits a little while to make sure you're not getting a
  false positive.
