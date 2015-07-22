// a trivial processing.org snippet to generate these
// using java2d (ugh).  Peity and JS might have been
// a better idea.  Or SVG.

size(48, 48);
g = createGraphics(48, 48, JAVA2D);

for (int i = 0; i <= 20; i++) {
  g.beginDraw();
  g.background(0.0, 0.0);
  g.smooth();
  g.strokeCap(SQUARE);
  g.strokeWeight(3);
  g.stroke(0x80, 0xcf, 0xf4, 255.0);
  g.fill(0.0, 0.0);
  g.arc(24, 24, 43, 43, -PI/2, -PI/2 + (i*2*PI/20.0));
  g.save("p" + i + ".png");
  g.endDraw();
}
