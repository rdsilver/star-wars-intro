function preload() {
  mySound = loadSound('star_wars_theme.mp3');
}

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  background(0);
  /*
  fill(0);
  textSize(50);
  textAlign(CENTER);
  textFont("Helvetica");
  noStroke();
  */
  mySound.setVolume(0.2);
  mySound.play();
}

function draw() {
  

}

