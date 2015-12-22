function preload() {
  mySound = loadSound('star_wars_theme.mp3');
  logo = loadImage("star_wars_logo.gif");
  dollar_sign_texture = loadImage("dollar_texture.gif");
}

function setup() {
  createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  background(0);
  fill(236, 199, 96);
  mySound.setVolume(0.2);
  mySound.play();
}

var scale_amount = 0;
var count = 0;
function draw() {
  drawLogo();
  drawDollarSign();
}

function drawLogo() {
  push();
  background(0);
  texture(logo);
  scale_amount = 1 - (frameCount/500);
  if (scale_amount > 0) {
    scale(scale_amount);
    plane(width/2.0, height/2.0);
  }
  pop();
}

function drawDollarSign() {
  push();
  texture(dollar_sign_texture);
  rotateX(150);
  translate(0, height + 100 - count, 0);
  console.log("translate:" + (height + 100 - count));
  console.log("count: " + count);
  console.log(scale_amount);
  if (scale_amount < .35) {
    plane(width/10.0, height/10.0);
    count += 2;
  }
  pop();
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}
